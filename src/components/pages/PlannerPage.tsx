import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  Clock,
  Info,
  Share2,
  ShieldAlert,
  Square,
  Users,
} from 'lucide-react';
import {
  generateDailyPlan,
  getDailyRecommendations,
  getFamilySafetySummary,
  getPlannerConditionTier,
} from '../../domain/plannerRules';
import { useAutoClearState } from '../../hooks/useAutoClearTimer';
import { useAppState } from '../../state/AppStateContext';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

const CONDITION_BADGE_MAP = {
  severe: {
    label: 'Severe Pollution Day',
    className: 'bg-red-50 text-red-800 border-red-200',
  },
  moderate: {
    label: 'Moderate Pollution Day',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  better: {
    label: 'Better Air-Quality Period',
    className: 'bg-green-50 text-green-800 border-green-200',
  },
  missing_data: {
    label: 'Missing Data Condition',
    className: 'bg-slate-100 text-slate-800 border-slate-300',
  },
} as const;

const OUTDOOR_RISK_META = {
  severe: { label: 'Severe Risk', className: 'text-red-800' },
  high: { label: 'High Risk', className: 'text-amber-900' },
  moderate: { label: 'Moderate Risk', className: 'text-amber-800' },
  low: { label: 'Low Risk', className: 'text-green-800' },
  unknown: { label: 'Unmeasured Risk', className: 'text-slate-700' },
} as const;

function PlannerDisclosureContent({
  readingLocationName,
  providerName,
  hasReading,
  hasHourlyCurve,
  intervalCount,
}: {
  readingLocationName: string;
  providerName: string;
  hasReading: boolean;
  hasHourlyCurve: boolean;
  intervalCount: number;
}) {
  if (!hasReading) {
    return (
      <span>
        <strong>Missing Data Condition:</strong> Live AQI and hourly trajectory are
        currently unavailable. Precautionary guidance is shown below—no outdoor period is
        assumed cleaner until a verified reading returns.
      </span>
    );
  }
  if (!hasHourlyCurve) {
    return (
      <span>
        <strong>Single-Point Reading Only:</strong> Hourly trajectory data is unavailable for{' '}
        {readingLocationName}. BreatheWise does not assume any time of day is
        cleaner outdoors without verified hourly evidence.
      </span>
    );
  }
  return (
    <span>
      <strong>Hourly Trajectory Active:</strong> Time-block expectations combine{' '}
      {providerName} current levels with available hourly PM2.5
      points ({intervalCount} intervals). Hyper-local traffic or burning spikes may
      still differ.
    </span>
  );
}

export function PlannerPage() {
  const {
    currentReading,
    hourlyForecast,
    familyProfile,
    location,
    completedPlannerIds,
    togglePlannerCompleted,
    setActivePage,
    setDataState,
  } = useAppState();

  const safety = getFamilySafetySummary(currentReading, familyProfile);
  const blocks = generateDailyPlan(currentReading, hourlyForecast, familyProfile);
  const priorityRecs = getDailyRecommendations(currentReading, familyProfile);
  const overallCondition = getPlannerConditionTier(currentReading);
  const conditionMeta = CONDITION_BADGE_MAP[overallCondition];

  const hasHourlyCurve = hourlyForecast.length >= 2;
  const scaleLabel = currentReading?.aqi.scale === 'INDIA_CPCB_NAQI' ? 'NAQI' : 'US AQI';

  const [advisoryCopied, triggerAdvisoryCopied, clearAdvisoryCopied] = useAutoClearState(false, 3000);
  const [advisoryPreview, setAdvisoryPreview] = useState<string | null>(null);

  const buildAdvisoryText = () => {
    const locName = currentReading?.location.name ?? location.name;
    const readingLine = currentReading
      ? `${scaleLabel}: ${currentReading.aqi.value ?? 'N/A'} (${currentReading.aqi.category}) · Source: ${currentReading.provenance.sourceLabel} · Observed: ${currentReading.provenance.observedAt ?? 'Unavailable'}`
      : 'Live AQI: Currently unavailable (precautionary guidance active)';
    const topActions = priorityRecs.map((rec, idx) => `${idx + 1}. [${rec.impactType}] ${rec.title}: ${rec.summary}`);
    return [
      `BreatheWise Household & Community Advisory — ${locName}`,
      `Condition: ${conditionMeta.label} (${familyProfile.householdName})`,
      readingLine,
      '',
      'Priority Actions Today:',
      ...topActions,
      '',
      'Data Attribution: AirLive (https://airlive.tracsa.co.in). Guidance is informational and does not diagnose medical conditions.',
    ].join('\n');
  };

  const handleCopyAdvisory = async () => {
    const text = buildAdvisoryText();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        triggerAdvisoryCopied(true);
        setAdvisoryPreview(null);
      } else {
        clearAdvisoryCopied();
        setAdvisoryPreview(text);
      }
    } catch {
      clearAdvisoryCopied();
      setAdvisoryPreview(text);
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Users className="w-4 h-4 text-teal-700" aria-hidden="true" />
              <span className="font-medium text-slate-800">{familyProfile.householdName}</span>
              <span aria-hidden="true">·</span>
              <span>{currentReading?.location.name ?? location.name}</span>
              <span aria-hidden="true">·</span>
              <span>
                {currentReading
                  ? `${scaleLabel} ${currentReading.aqi.value ?? 'N/A'} (${currentReading.aqi.category})`
                  : 'Live AQI unavailable'}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${conditionMeta.className}`}
              >
                {conditionMeta.label}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-slate-900">
              Personalized Daily Schedule
            </h2>
            <p className="text-sm text-slate-700 max-w-3xl">{safety.headline}</p>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-1">
              <span>
                Profile: {familyProfile.members.adults} adult(s), {familyProfile.members.children}{' '}
                child(ren), {familyProfile.members.seniors} senior(s)
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">
                Commute: {familyProfile.lifestyle.primaryCommute.replace(/_/g, ' ')} (
                {familyProfile.lifestyle.dailyCommuteKm} km)
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">
                Work: {familyProfile.lifestyle.workSchedule.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!currentReading && (
              <Button variant="secondary" size="sm" onClick={() => setDataState('preview')}>
                Load preview fixture
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleCopyAdvisory}>
              {advisoryCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Advisory copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy community advisory</span>
                </>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setActivePage('family')}>
              Edit family profile
            </Button>
          </div>
        </div>

        {advisoryCopied && (
          <p className="mt-3 text-xs text-teal-800 font-medium" role="status">
            Community &amp; family air-quality advisory copied to clipboard.
          </p>
        )}

        {advisoryPreview && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Shareable Family &amp; Community Advisory (clipboard unavailable — copy manually)
              </span>
              <button
                type="button"
                onClick={() => setAdvisoryPreview(null)}
                className="min-h-6 px-2 text-xs font-medium text-teal-800 hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">{advisoryPreview}</pre>
          </div>
        )}

        {/* Hourly evidence & missing-data disclosure banner */}
        <div
          className={`mt-4 rounded-md border px-3.5 py-2.5 text-xs flex items-start gap-2.5 ${
            !currentReading || !hasHourlyCurve
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-sky-50 border-sky-200 text-sky-950'
          }`}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <PlannerDisclosureContent
              readingLocationName={currentReading?.location.name ?? location.name}
              providerName={currentReading?.provenance.providerName ?? 'AirLive'}
              hasReading={currentReading !== null}
              hasHourlyCurve={hasHourlyCurve}
              intervalCount={hourlyForecast.length}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {blocks.map((block) => {
          const done = completedPlannerIds.includes(block.id);
          const { label: riskLabel, className: riskClass } = OUTDOOR_RISK_META[block.outdoorRisk];

          return (
            <Card key={block.id} className="flex flex-col justify-between gap-4">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>{block.timeRange}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {block.expectedNaqi !== null
                          ? `${block.hasHourlyEvidence ? 'Slot' : 'Current'} ${scaleLabel} ${block.expectedNaqi}`
                          : 'AQI unavailable'}
                      </span>
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">{block.label}</h3>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${riskClass}`}>{riskLabel}</span>
                </div>

                <dl className="space-y-2.5 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Suggested action
                    </dt>
                    <dd className="text-slate-900 mt-0.5">{block.recommendedActivity}</dd>
                    <dd className="text-slate-700 text-xs mt-1">
                      <strong>Safer alternative:</strong> {block.saferAlternative}
                    </dd>
                    <dd className="text-slate-700 text-xs mt-1">
                      <strong>Mask &amp; ventilation:</strong> {block.maskGuidance} ·{' '}
                      {block.ventilationAction}
                    </dd>
                    <dd className="text-slate-700 text-xs mt-1">
                      <strong>Commute:</strong> {block.commuteNote}
                    </dd>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Recommended time
                      </dt>
                      <dd className="text-xs text-slate-800 mt-0.5 font-mono">
                        {block.timeRange}{' '}
                        {block.hasHourlyEvidence
                          ? '(hourly curve evidence)'
                          : '(no hourly cleaner-window evidence)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Expected benefit
                      </dt>
                      <dd className="text-xs text-teal-900 mt-0.5">{block.expectedBenefit}</dd>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Reason
                    </dt>
                    <dd className="text-xs text-slate-700 mt-0.5">{block.reason}</dd>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Data or guidance behind it
                      </dt>
                      <dd className="text-xs text-slate-600 mt-0.5">{block.guidanceBasis}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Limitations
                      </dt>
                      <dd className="text-xs text-slate-600 mt-0.5">{block.limitations}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => togglePlannerCompleted(block.id)}
                  aria-pressed={done}
                  className="min-h-6 px-2 py-1 -ml-2 rounded inline-flex items-center gap-2 text-xs font-medium text-teal-800 hover:bg-teal-50 hover:text-teal-900 cursor-pointer"
                >
                  {done ? (
                    <CheckSquare className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  )}
                  <span>{done ? 'Completed for today' : 'Mark routine block done'}</span>
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Household Priority Takeaways */}
      <Card padding="lg">
        <CardHeader
          title="Priority Household Actions for Today"
          subtitle="Distinguishes exposure protection from personal emissions reduction"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {priorityRecs.map((rec) => (
            <div key={rec.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-teal-800">{rec.impactType}</span>
                <span className="inline-flex items-center gap-1 text-slate-600 capitalize">
                  {rec.priority === 'critical' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                  )}
                  {rec.priority}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{rec.title}</h3>
              <p className="text-xs text-slate-700 leading-relaxed">{rec.summary}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

