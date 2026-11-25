import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { useDeviceGeolocation } from '../../hooks/useDeviceGeolocation';
import { searchLocationsApi } from '../../services/airQualityApi';
import { useAppState } from '../../state/AppStateContext';
import type { LocationOption } from '../../types/breathewise';
import { AqiScaleGuideCard, IndiaRankingCard } from '../air-quality/AirQualityReferenceCards';
import { AqiIndicator } from '../ui/AqiIndicator';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { HourlyTrendChart } from '../ui/HourlyTrendChart';
import { EmptyState, LoadingSkeleton } from '../ui/States';

export function AirQualityPage() {
  const {
    currentReading,
    hourlyForecast,
    dataState,
    liveStatus,
    setDataState,
    setLocation,
    selectLocationByCoordinates,
    retryLiveCheck,
    indiaRanking,
    rankingOrder,
    setRankingOrder,
    rankingLoading,
    rankingError,
    location: activeLocation,
    settings,
  } = useAppState();

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [showCoordsEntry, setShowCoordsEntry] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualCoordLoading, setManualCoordLoading] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const {
    loading: geoLoading,
    error: geoError,
    clearError: clearGeoError,
    requestLocation: handleUseDeviceLocation,
  } = useDeviceGeolocation({
    onResolveCoordinates: selectLocationByCoordinates,
    unavailableMessage:
      'Browser geolocation is unavailable here. Search by city name or enter coordinates manually.',
    deniedMessage:
      'Location permission denied or timed out. Search manually or enter coordinates instead.',
    notFoundFallbackMessage: 'No supported AirLive location found within 200 km of your position.',
    onSuccess: () => setSearchResults([]),
  });

  const coordLoading = geoLoading || manualCoordLoading;
  const displayedError = searchError ?? geoError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      searchAbortRef.current?.abort();
    };
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    clearGeoError();
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSearchError('Enter at least 2 characters to search supported AirLive locations.');
      return;
    }
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchLocationsApi(trimmed, { signal: controller.signal });
      if (controller.signal.aborted || !mountedRef.current) return;
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError(`No supported AirLive location matched "${trimmed}".`);
      }
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return;
      setSearchError(err instanceof Error ? err.message : 'Location search failed.');
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setSearching(false);
      }
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
    }
  };

  const handlePickLocation = (loc: LocationOption) => {
    setLocation(loc);
    setDataState('live');
    setSearchResults([]);
    setSearchTerm('');
    setSearchError(null);
    clearGeoError();
  };

  const handleCoordinateLookup = async (e: FormEvent) => {
    e.preventDefault();
    clearGeoError();
    const lat = Number(manualLat.trim());
    const lon = Number(manualLon.trim());
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180
    ) {
      setSearchError('Enter valid coordinates: latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    setManualCoordLoading(true);
    setSearchError(null);
    try {
      await selectLocationByCoordinates(lat, lon);
      if (!mountedRef.current) return;
      setShowCoordsEntry(false);
      setManualLat('');
      setManualLon('');
    } catch (err) {
      if (!mountedRef.current) return;
      setSearchError(
        err instanceof Error
          ? err.message
          : 'No supported AirLive monitoring location found within 200 km of those coordinates.',
      );
    } finally {
      if (mountedRef.current) setManualCoordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader
          title="Search Supported Indian Cities & Localities"
          subtitle="Search live Indian cities, hubs, and Delhi-NCR localities, or match the nearest AirLive station"
        />
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <label htmlFor="city-search-input" className="sr-only">
            Search Indian city or locality
          </label>
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="city-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Indian location (e.g., Delhi, Anand Vihar, Noida, Lucknow, Patna)..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-md placeholder:text-slate-500 focus:outline-none focus:border-teal-700"
            />
          </div>
          <Button type="submit" variant="primary" size="md" disabled={searching || coordLoading}>
            {searching ? 'Searching...' : 'Find location'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={coordLoading}
            onClick={handleUseDeviceLocation}
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            <span>{coordLoading ? 'Matching...' : 'Use device location'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            aria-expanded={showCoordsEntry}
            onClick={() => setShowCoordsEntry((prev) => !prev)}
          >
            Enter coordinates
          </Button>
        </form>

        {showCoordsEntry && (
          <form
            onSubmit={handleCoordinateLookup}
            className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1 min-w-[140px] flex-1">
              <label htmlFor="manual-lat-input" className="text-xs font-medium text-slate-700">
                Latitude (-90 to 90)
              </label>
              <input
                id="manual-lat-input"
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="e.g., 28.6139"
                className="min-h-[38px] px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-700 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1">
              <label htmlFor="manual-lon-input" className="text-xs font-medium text-slate-700">
                Longitude (-180 to 180)
              </label>
              <input
                id="manual-lon-input"
                type="number"
                step="any"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="e.g., 77.2090"
                className="min-h-[38px] px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-700 font-mono"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={coordLoading}>
              Match nearest station
            </Button>
          </form>
        )}

        <p className="mt-2 text-xs text-slate-600">
          Privacy: Location inputs or optional browser geolocation are used solely to find the nearest
          AirLive monitoring station and modeled hourly trend.
        </p>

        {displayedError && (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {displayedError}
          </p>
        )}

        {searchResults.length > 0 && (
          <ul
            aria-label="Location search results"
            className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-md bg-slate-50"
          >
            {searchResults.map((loc) => (
              <li key={loc.slug}>
                <button
                  type="button"
                  onClick={() => handlePickLocation(loc)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <MapPin className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                    <span>
                      {loc.name}, {loc.countryName || loc.state || 'India'}
                    </span>
                    {loc.kind && (
                      <span className="text-xs font-mono text-slate-600">({loc.kind})</span>
                    )}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600">{loc.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(dataState === 'loading' || (dataState === 'live' && liveStatus === 'loading')) && (
        <LoadingSkeleton rows={4} />
      )}

      {!currentReading &&
        dataState !== 'loading' &&
        !(dataState === 'live' && liveStatus === 'loading') && (
          <EmptyState
            headingLevel="h2"
            title="No active AirLive telemetry loaded"
            description="Live AirLive feeds are currently unavailable or paused. Retry the live API check or inspect the labeled preview fixture."
            actionLabel="Retry live API"
            onAction={retryLiveCheck}
          />
        )}

      {currentReading && (
        <>
          <Card padding="lg">
            <CardHeader
              title="Live Reading & Source Attribution"
              subtitle={
                currentReading.aqi.scale === 'US_AQI'
                  ? 'US AQI (0–500) · Ground-station vs. atmospheric-model transparency'
                  : 'Preview Fixture · Indian CPCB NAQI'
              }
            />
            <AqiIndicator reading={currentReading} preferredUnit={settings.preferredUnit} />
          </Card>

          <Card>
            <CardHeader
              title="Measured Pollutants"
              subtitle="Reported pollutant values (missing readings remain Unavailable, never zeroed)"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="py-2.5 pr-4 font-semibold">Pollutant</th>
                    <th scope="col" className="py-2.5 px-4 font-semibold text-right">
                      Concentration
                    </th>
                    <th scope="col" className="py-2.5 px-4 font-semibold text-right">
                      {currentReading.aqi.scale === 'US_AQI' ? 'US AQI' : 'Sub-Index'}
                    </th>
                    <th scope="col" className="py-2.5 pl-4 font-semibold">Reference Standard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentReading.pollutants.map((p) => (
                    <tr key={p.key} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">{p.label}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {p.value !== null ? (
                          `${p.value} ${p.unit}`
                        ) : (
                          <span className="text-slate-600 font-sans">Unavailable</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-800">
                        {p.subIndex !== null ? (
                          p.subIndex
                        ) : (
                          <span className="text-slate-600" aria-label="Not applicable">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-4 text-slate-600">{p.safeReference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="24-Hour Concentration Trajectory"
              subtitle="Inspect hourly diurnal shifts to plan errands and brief ventilation"
            />
            {hourlyForecast.length > 0 ? (
              <HourlyTrendChart points={hourlyForecast} scale={currentReading.aqi.scale} />
            ) : (
              <p className="text-sm text-slate-600 py-6 text-center">
                Hourly trajectory data is not available for this location.
              </p>
            )}
          </Card>
        </>
      )}

      <IndiaRankingCard
        indiaRanking={indiaRanking}
        rankingOrder={rankingOrder}
        onChangeOrder={setRankingOrder}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        activeLocationSlug={activeLocation.slug}
        onSelectLocation={handlePickLocation}
      />

      <AqiScaleGuideCard dataState={dataState} onRetryLiveCheck={retryLiveCheck} />
    </div>
  );
}
