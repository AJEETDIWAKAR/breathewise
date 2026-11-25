import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPreviewFixtureForecast, getPreviewFixtureReading } from '../data/previewFixtures';
import {
  ApiClientError,
  fetchLiveCurrentAirQuality,
  fetchLiveHistoryAirQuality,
} from '../services/airQualityApi';
import type {
  AirQualityReading,
  DashboardDataState,
  HourlyForecastPoint,
  LocationOption,
} from '../types/breathewise';

const CLIENT_READING_CACHE_TTL_MS = 5 * 60 * 1000;

export type LiveFetchStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface LiveFetchErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

interface CachedReadingEntry {
  reading: AirQualityReading;
  forecast: HourlyForecastPoint[];
  cachedAt: number;
}

export function useLiveAirQualitySync(
  location: LocationOption,
  initialDataModePreference: 'live' | 'preview',
) {
  const [dataState, setDataStateInternal] = useState<DashboardDataState>(() =>
    initialDataModePreference === 'live' ? 'live' : 'preview',
  );
  const [liveStatus, setLiveStatus] = useState<LiveFetchStatus>(() =>
    initialDataModePreference === 'live' ? 'loading' : 'idle',
  );
  const [liveError, setLiveError] = useState<LiveFetchErrorInfo | null>(null);
  const [liveReading, setLiveReading] = useState<AirQualityReading | null>(null);
  const [liveForecast, setLiveForecast] = useState<HourlyForecastPoint[]>([]);
  const [syncRequest, setSyncRequest] = useState<{ force: boolean; id: number }>({
    force: false,
    id: 0,
  });

  const cacheRef = useRef<Map<string, CachedReadingEntry>>(new Map());
  const handledForceIdRef = useRef(0);

  const targetId = location.id;
  const targetSlug = location.slug;
  const targetName = location.name;
  const targetCity = location.city;
  const targetState = location.state;
  const targetLat = location.lat;
  const targetLon = location.lon;

  useEffect(() => {
    if (dataState !== 'live') {
      return;
    }

    const controller = new AbortController();
    const shouldForce = syncRequest.force && syncRequest.id !== handledForceIdRef.current;
    if (shouldForce) {
      handledForceIdRef.current = syncRequest.id;
    }

    if (!shouldForce) {
      const cached = cacheRef.current.get(targetSlug);
      if (cached && Date.now() - cached.cachedAt < CLIENT_READING_CACHE_TTL_MS) {
        Promise.resolve().then(() => {
          if (controller.signal.aborted) return;
          setLiveReading(cached.reading);
          setLiveForecast(cached.forecast);
          setLiveError(null);
          setLiveStatus('ready');
        });
        return () => {
          controller.abort();
        };
      }
    }

    const requestLocation: LocationOption = {
      id: targetId,
      slug: targetSlug,
      name: targetName,
      city: targetCity,
      state: targetState,
      lat: targetLat,
      lon: targetLon,
    };

    Promise.all([
      fetchLiveCurrentAirQuality(requestLocation, { signal: controller.signal }),
      fetchLiveHistoryAirQuality(requestLocation, { signal: controller.signal }).catch(() => []),
    ])
      .then(([reading, history]) => {
        if (controller.signal.aborted) return;
        if (cacheRef.current.size >= 20) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(targetSlug, {
          reading,
          forecast: history,
          cachedAt: Date.now(),
        });
        setLiveReading(reading);
        setLiveForecast(history);
        setLiveError(null);
        setLiveStatus('ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLiveReading(null);
        setLiveForecast([]);

        if (err instanceof ApiClientError) {
          setLiveError({
            code: err.code,
            message: err.message,
            retryable: err.retryable,
          });
          setLiveStatus(
            err.code === 'AQI_PROVIDER_UNAVAILABLE' || err.code === 'LOCATION_NOT_FOUND'
              ? 'unavailable'
              : 'error',
          );
        } else {
          setLiveError({
            code: 'NETWORK_ERROR',
            message:
              err instanceof Error
                ? err.message
                : 'Unable to reach BreatheWise backend air quality API.',
            retryable: true,
          });
          setLiveStatus('error');
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    dataState,
    syncRequest,
    targetCity,
    targetId,
    targetLat,
    targetLon,
    targetName,
    targetSlug,
    targetState,
  ]);

  const setDataState = useCallback((next: DashboardDataState) => {
    if (next === 'live') {
      setLiveStatus('loading');
      setLiveError(null);
    }
    setDataStateInternal(next);
  }, []);

  const notifyLocationChanging = useCallback(() => {
    setLiveError(null);
    setLiveStatus((prev) => (prev === 'idle' ? 'idle' : 'loading'));
  }, []);

  const retryLiveCheck = useCallback(() => {
    setLiveStatus('loading');
    setLiveError(null);
    setDataStateInternal('live');
    setSyncRequest((prev) => ({ force: true, id: prev.id + 1 }));
  }, []);

  const clearCacheAndRefresh = useCallback(() => {
    cacheRef.current.clear();
    setLiveError(null);
    setLiveStatus((prev) => (prev === 'idle' ? 'idle' : 'loading'));
    setSyncRequest((prev) => ({ force: true, id: prev.id + 1 }));
  }, []);

  const resetSyncState = useCallback((nextMode: DashboardDataState) => {
    setLiveError(null);
    setLiveStatus(nextMode === 'live' ? 'loading' : 'idle');
    setDataStateInternal(nextMode);
    if (nextMode === 'live') {
      setSyncRequest((prev) => ({ force: true, id: prev.id + 1 }));
    }
  }, []);

  const hourlyForecast = useMemo(() => {
    if (dataState === 'preview') return getPreviewFixtureForecast(location);
    if (dataState === 'live' && liveStatus === 'ready') return liveForecast;
    return [];
  }, [dataState, liveForecast, liveStatus, location]);

  const activeReading = useMemo(() => {
    if (dataState === 'preview') return getPreviewFixtureReading(location);
    if (dataState === 'live' && liveStatus === 'ready') return liveReading;
    return null;
  }, [dataState, liveReading, liveStatus, location]);

  return {
    dataState,
    setDataState,
    notifyLocationChanging,
    liveStatus,
    liveError,
    retryLiveCheck,
    clearCacheAndRefresh,
    resetSyncState,
    hourlyForecast,
    activeReading,
  };
}
