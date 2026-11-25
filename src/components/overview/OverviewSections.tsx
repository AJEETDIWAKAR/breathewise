import { CheckCircle2, CloudOff, Info, ShieldAlert, Sprout } from 'lucide-react';
import { summarizeImpactLogs } from '../../domain/impactCalculator';
import { getFamilySafetySummary } from '../../domain/plannerRules';
import type { LiveFetchStatus } from '../../state/AppStateContext';
import type {
  AirQualityReading,
  DashboardDataState,
  FamilyProfile,
  ImpactLogEntry,
  PageId,
} from '../../types/breathewise';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ErrorMessage, LoadingSkeleton, UnavailableNotice } from '../ui/States';

export function OverviewStateNotice({
  dataState,
  liveStatus,
  liveError,
  onSetDataState,
  onRetryLiveCheck,
}: {
  dataState: DashboardDataState;
  liveStatus: LiveFetchStatus;
  liveError: { code?: string; message?: string } | null;
  onSetDataState: (state: DashboardDataState) => void;
  onRetryLiveCheck: () => void;
}) {
  const isLoading = dataState === 'loading' || (dataState === 'live' && liveStatus === 'loading');
  if (isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  const isUnavailable =
    dataState === 'unavailable' || (dataState === 'live' && liveStatus === 'unavailable');
  if (isUnavailable) {
    return (
      <UnavailableNotice
        headingLevel="h2"
        title="Live AirLive reading unavailable for this location"
        message={
          liveError?.message ??
          'BreatheWise never fabricates live AQI readings. The live AirLive feed could not be reached or has no record for this location.'
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => onSetDataState('preview')}>
            Load labeled preview fixture
          </Button>
        }
        secondaryAction={
          <Button variant="secondary" size="sm" onClick={onRetryLiveCheck}>
            Retry live check
          </Button>
        }
      />
    );
  }

  const isError = dataState === 'error' || (dataState === 'live' && liveStatus === 'error');
  if (isError) {
    return (
      <ErrorMessage
        headingLevel="h2"
        title={
          liveError?.code === 'BACKEND_API_UNAVAILABLE'
            ? 'BreatheWise API server unavailable'
            : 'Upstream AirLive query failed'
        }
        message={
          liveError?.message ??
          'The monitoring endpoint timed out or returned an unverified payload. Retry or switch to the labeled preview fixture.'
        }
        onRetry={onRetryLiveCheck}
        secondaryAction={
          <Button variant="primary" size="sm" onClick={() => onSetDataState('preview')}>
            View preview fixture
          </Button>
        }
      />
    );
  }

  return null;
}

export function OverviewStatusBanners({
  dataState,
  isOffline,
  onSetDataState,
}: {
  dataState: DashboardDataState;
  isOffline: boolean;
  onSetDataState: (state: DashboardDataState) => void;
}) {
  return (
    <>
      {dataState === 'preview' && (
        <div
          role="status"
          className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-sky-950"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Preview Fixture Mode:</strong> Viewing simulated reference data (Indian CPCB NAQI) instead of live AirLive telemetry.
            </span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => onSetDataState('live')}>
            Switch to Live AirLive
          </Button>
        </div>
      )}

      {isOffline && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-amber-950"
        >
          <span className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-amber-800 shrink-0" aria-hidden="true" />
            <span>
              <strong>Offline connection detected:</strong> Live AirLive and Gemini requests are unavailable until network access returns. Local planner, profile, and impact tools remain usable.
            </span>
          </span>
          {dataState === 'live' && (
            <Button variant="secondary" size="sm" onClick={() => onSetDataState('preview')}>
              Use preview fixture offline
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function FamilySafetyCard({
  reading,
  familyProfile,
  onNavigate,
}: {
  reading: AirQualityReading;
  familyProfile: FamilyProfile;
  onNavigate: (page: PageId) => void;
}) {
  const safety = getFamilySafetySummary(reading, familyProfile);
  return (
    <Card padding="lg" className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Family Safety Summary</h2>
          <span className="text-xs font-semibold text-slate-700">{safety.riskLevel} risk</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-md flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-800 leading-snug">{safety.headline}</p>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-600">
          {safety.keyConstraints.length > 0 ? (
            safety.keyConstraints.map((line) => <li key={line}>• {line}</li>)
          ) : (
            <li>• General adult household profile active.</li>
          )}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <Button variant="primary" size="sm" onClick={() => onNavigate('planner')}>
          Open Daily Planner
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onNavigate('family')}>
          Adjust family
        </Button>
      </div>
    </Card>
  );
}

export function MeasuredPollutantsCard({ reading }: { reading: AirQualityReading }) {
  const isUsAqi = reading.aqi.scale === 'US_AQI';
  return (
    <Card>
      <CardHeader
        title="Measured Pollutants"
        subtitle={
          isUsAqi
            ? 'Reported directly by AirLive (missing values are never zeroed)'
            : 'Preview concentrations & CPCB sub-indices'
        }
      />
      <div className="divide-y divide-slate-100">
        {reading.pollutants.slice(0, 6).map((p) => (
          <div key={p.key} className="py-2.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{p.label}</p>
              <p className="text-xs text-slate-600">{p.safeReference}</p>
            </div>
            <div className="text-right font-mono tabular-nums">
              {p.value !== null ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    {p.value} {p.unit}
                  </p>
                  <p className="text-xs text-slate-600">
                    {p.subIndex !== null
                      ? `${isUsAqi ? 'US AQI' : 'Sub-index'} ${p.subIndex}`
                      : 'Measured'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Unavailable</p>
                  <p className="text-xs text-slate-600">Not reported</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {isUsAqi && (
        <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          AirLive reports US AQI and PM2.5 for Indian locations; trace gases (NO2, SO2, O3, CO) are not emitted by this feed.
        </p>
      )}
    </Card>
  );
}

export function RecentImpactCard({
  impactLogs,
  onNavigate,
}: {
  impactLogs: ImpactLogEntry[];
  onNavigate: (page: PageId) => void;
}) {
  const impactTotals = summarizeImpactLogs(impactLogs);
  return (
    <Card className="space-y-5">
      <CardHeader
        title="Progress & Recent Activity"
        subtitle="Exposure reduction tracked separately from emissions"
      />
      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-slate-50 rounded-md py-3">
        <div className="px-3">
          <p className="text-xs text-slate-600">CO2e avoided</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {impactTotals.totalEmissionsAvoidedKg} kg
          </p>
        </div>
        <div className="px-3">
          <p className="text-xs text-slate-600">Exposure actions</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {impactTotals.exposureProtectionActions}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-slate-700">Recent logged activity</p>
        {impactLogs.length === 0 ? (
          <p className="text-xs text-slate-600">No actions logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {impactLogs.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-2 text-xs text-slate-700 border-b border-slate-100 pb-2 last:border-none last:pb-0"
              >
                {entry.category === 'transport_shift' ? (
                  <Sprout className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{entry.title}</p>
                  <p className="text-slate-600 font-mono tabular-nums">{entry.date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => onNavigate('impact')}
      >
        Open Impact Tracker
      </Button>
    </Card>
  );
}
