import { ArrowRight } from 'lucide-react';
import { getDailyRecommendations } from '../../domain/plannerRules';
import { useAppState } from '../../state/AppStateContext';
import {
  FamilySafetyCard,
  MeasuredPollutantsCard,
  OverviewStateNotice,
  OverviewStatusBanners,
  RecentImpactCard,
} from '../overview/OverviewSections';
import { AqiIndicator } from '../ui/AqiIndicator';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { HourlyTrendChart } from '../ui/HourlyTrendChart';
import { RecommendationPanel } from '../ui/RecommendationPanel';

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

  const showDashboard =
    (dataState === 'preview' || (dataState === 'live' && liveStatus === 'ready')) &&
    currentReading !== null;

  return (
    <div className="space-y-6">
      <OverviewStatusBanners
        dataState={dataState}
        isOffline={isOffline}
        onSetDataState={setDataState}
      />

      <OverviewStateNotice
        dataState={dataState}
        liveStatus={liveStatus}
        liveError={liveError}
        onSetDataState={setDataState}
        onRetryLiveCheck={retryLiveCheck}
      />

      {showDashboard && currentReading && (
        <>
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

            <FamilySafetyCard
              reading={currentReading}
              familyProfile={familyProfile}
              onNavigate={setActivePage}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MeasuredPollutantsCard reading={currentReading} />

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

            <RecentImpactCard impactLogs={impactLogs} onNavigate={setActivePage} />
          </div>
        </>
      )}
    </div>
  );
}
