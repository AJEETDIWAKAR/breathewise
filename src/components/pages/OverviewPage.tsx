import { ArrowRight, CheckCircle2, CloudOff, Info, ShieldAlert, Sprout } from 'lucide-react';
import { summarizeImpactLogs } from '../../domain/impactCalculator';
import { getDailyRecommendations, getFamilySafetySummary } from '../../domain/plannerRules';
import { useAppState } from '../../state/AppStateContext';
import { AqiIndicator } from '../ui/AqiIndicator';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { HourlyTrendChart } from '../ui/HourlyTrendChart';
import { RecommendationPanel } from '../ui/RecommendationPanel';
import { ErrorMessage, LoadingSkeleton, UnavailableNotice } from '../ui/States';

export function OverviewPage() {
  const {
    dataState,
    setDataState,
    liveStatus,
    liveError,
    retryLiveCheck,
    isOffline,
    currentReading,
    hourlyForecast,
    familyProfile,
    impactLogs,
    settings,
    setActivePage,
  } = useAppState();

  const impactTotals = summarizeImpactLogs(impactLogs);

  const isLoading = dataState === 'loading' || (dataState === 'live' && liveStatus === 'loading');
  const isUnavailable =
    dataState === 'unavailable' || (dataState === 'live' && liveStatus === 'unavailable');
  const isError = dataState === 'error' || (dataState === 'live' && liveStatus === 'error');
  const showDashboard =
    (dataState === 'preview' || (dataState === 'live' && liveStatus === 'ready')) &&
    currentReading !== null;

  return (
    <div className="space-y-6">
      {/* Preview Fixture Disclosure (shown only when viewing simulated preview data) */}
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
          <Button variant="secondary" size="sm" onClick={() => setDataState('live')}>
            Switch to Live AirLive
          </Button>
        </div>
      )}

      {/* Offline Banner */}
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
            <Button variant="secondary" size="sm" onClick={() => setDataState('preview')}>
              Use preview fixture offline
            </Button>
          )}
        </div>
      )}

      {/* Distinct Data States */}
      {isLoading && <LoadingSkeleton rows={4} />}

      {isUnavailable && (
        <UnavailableNotice
          headingLevel="h2"
          title="Live AirLive reading unavailable for this location"
          message={
            liveError?.message ??
            'BreatheWise never fabricates live AQI readings. The live AirLive feed could not be reached or has no record for this location.'
          }
          primaryAction={
            <Button variant="primary" size="sm" onClick={() => setDataState('preview')}>
              Load labeled preview fixture
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" size="sm" onClick={retryLiveCheck}>
              Retry live check
            </Button>
          }
        />
      )}

      {isError && (
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
          onRetry={retryLiveCheck}
          secondaryAction={
            <Button variant="primary" size="sm" onClick={() => setDataState('preview')}>
              View preview fixture
            </Button>
          }
        />
      )}

      {showDashboard && currentReading && (
        <>
          {/* Top Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" padding="lg">
              <CardHeader
                title="Current Air Quality Summary"
                subtitle={
                  currentReading.aqi.scale === 'US_AQI'
                    ? 'US EPA AQI scale (0–500) · Live data from AirLive'
                    : 'Preview Fixture · Indian CPCB National AQI scale (0–500)'
                }
                action={
                  <Button variant="secondary" size="sm" onClick={() => setActivePage('air-quality')}>
                    Explore India cities &amp; ranking
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                }
              />
              <AqiIndicator reading={currentReading} preferredUnit={settings.preferredUnit} />
            </Card>

            {/* Family Safety Summary */}
            {(() => {
              const safety = getFamilySafetySummary(currentReading, familyProfile);
              return (
                <Card padding="lg" className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        Family Safety Summary
                      </h2>
                      <span className="text-xs font-semibold text-slate-700">
                        {safety.riskLevel} risk
                      </span>
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
                    <Button variant="primary" size="sm" onClick={() => setActivePage('planner')}>
                      Open Daily Planner
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setActivePage('family')}>
                      Adjust family
                    </Button>
                  </div>
                </Card>
              );
            })()}
          </div>

          {/* Pollutant Breakdown + Hourly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader
                title="Measured Pollutants"
                subtitle={
                  currentReading.aqi.scale === 'US_AQI'
                    ? 'Reported directly by AirLive (missing values are never zeroed)'
                    : 'Preview concentrations & CPCB sub-indices'
                }
              />
              <div className="divide-y divide-slate-100">
                {currentReading.pollutants.slice(0, 6).map((p) => (
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
                              ? `${currentReading.aqi.scale === 'US_AQI' ? 'US AQI' : 'Sub-index'} ${p.subIndex}`
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
              {currentReading.aqi.scale === 'US_AQI' && (
                <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  AirLive reports US AQI and PM2.5 for Indian locations; trace gases (NO2, SO2, O3, CO) are not emitted by this feed.
                </p>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="24-Hour Pollution Trajectory"
                subtitle={
                  dataState === 'live'
                    ? 'Hourly Copernicus CAMS modeled particulate curve for ventilation planning'
                    : 'Simulated diurnal inversion curve for preview planning'
                }
                action={
                  <Button variant="ghost" size="sm" onClick={() => setActivePage('indoor')}>
                    Ventilation windows
                  </Button>
                }
              />
              {hourlyForecast.length > 0 ? (
                <HourlyTrendChart
                  points={hourlyForecast}
                  scale={currentReading.aqi.scale}
                  caption={
                    dataState === 'live'
                      ? 'Modeled hourly trajectory illustrates diurnal PM2.5 changes to help choose brief ventilation windows.'
                      : 'Preview trend illustrates morning/evening winter trapping vs. afternoon dispersion.'
                  }
                />
              ) : (
                <p className="text-sm text-slate-600 py-8 text-center">
                  Hourly concentration trajectory is currently unavailable for this location.
                </p>
              )}
            </Card>
          </div>

          {/* Recommendations + Environmental Progress + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Today's Recommended Actions"
                subtitle="Tailored to active US AQI severity and household budget"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setActivePage('assistant')}>
                    Ask AI Assistant
                  </Button>
                }
              />
              <RecommendationPanel
                items={getDailyRecommendations(currentReading, familyProfile)}
                onAction={(item) => {
                  if (item.category === 'indoor') setActivePage('indoor');
                  else if (item.category === 'commute') setActivePage('sustainable');
                  else setActivePage('planner');
                }}
              />
            </Card>

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
                onClick={() => setActivePage('impact')}
              >
                Open Impact Tracker
              </Button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
