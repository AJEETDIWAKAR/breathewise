import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ANONYMOUS_MINIMAL_PROFILE,
  DEFAULT_FAMILY_PROFILE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PREVIEW_IMPACT_LOGS,
  DEFAULT_SETTINGS,
  PRESET_LOCATIONS,
  getPreviewFixtureForecast,
  getPreviewFixtureReading,
} from '../data/previewFixtures';
import {
  ApiClientError,
  fetchAirLivePlaces,
  fetchIndiaRanking,
  fetchLiveCurrentAirQuality,
  fetchLiveHistoryAirQuality,
  type AirLivePlaceDto,
} from '../services/airQualityApi';
import {
  parseStoredImpactLogs,
  parseStoredLocationOption,
  parseStoredSettings,
  parseStoredStringArray,
  validateFamilyProfile,
  type AirQualityRankingItem,
  type AirQualityReading,
  type AppNotification,
  type AppSettings,
  type DashboardDataState,
  type FamilyProfile,
  type HourlyForecastPoint,
  type ImpactLogEntry,
  type LocationOption,
  type PageId,
} from '../types/breathewise';

const STORAGE_KEYS = {
  profile: 'breathewise.v1.profile',
  location: 'breathewise.v1.location',
  impactLogs: 'breathewise.v1.impactLogs',
  settings: 'breathewise.v1.settings',
  completedPlanner: 'breathewise.v1.completedPlanner',
  completedIndoor: 'breathewise.v1.completedIndoor',
};

const CLIENT_READING_CACHE_TTL_MS = 5 * 60 * 1000;

function loadFromStorage<T>(key: string, parse: (raw: unknown) => T | null, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const validated = parse(parsed);
    return validated !== null ? validated : fallback;
  } catch {
    return fallback;
  }
}

function parseFamilyProfileFromStorage(raw: unknown): FamilyProfile | null {
  const result = validateFamilyProfile(raw);
  return result.success ? result.data : null;
}

function mapAirLiveDtoToLocationOption(place: AirLivePlaceDto): LocationOption {
  return {
    id: place.slug,
    slug: place.slug,
    name: place.name,
    city: place.name,
    state: place.countryName || place.country || 'India',
    country: place.country,
    countryName: place.countryName,
    kind: place.kind,
    lat: place.lat,
    lon: place.lon,
  };
}

export type LiveFetchStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface LiveFetchErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

interface AppStateContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  location: LocationOption;
  setLocation: (loc: LocationOption) => void;
  availableLocations: LocationOption[];
  airLivePlaces: AirLivePlaceDto[];
  placesLoading: boolean;
  placesError: string | null;
  refreshPlaces: () => void;
  selectLocationByCoordinates: (lat: number, lon: number) => Promise<LocationOption>;
  indiaRanking: AirQualityRankingItem[];
  rankingOrder: 'worst' | 'best';
  setRankingOrder: (order: 'worst' | 'best') => void;
  rankingLoading: boolean;
  rankingError: string | null;
  isOffline: boolean;
  dataState: DashboardDataState;
  setDataState: (state: DashboardDataState) => void;
  liveStatus: LiveFetchStatus;
  liveError: LiveFetchErrorInfo | null;
  retryLiveCheck: () => void;
  currentReading: AirQualityReading | null;
  hourlyForecast: HourlyForecastPoint[];
  familyProfile: FamilyProfile;
  updateFamilyProfile: (profile: FamilyProfile) => void;
  impactLogs: ImpactLogEntry[];
  addImpactLog: (entry: ImpactLogEntry) => void;
  updateImpactLog: (id: string, next: ImpactLogEntry) => void;
  removeImpactLog: (id: string) => void;
  completedPlannerIds: string[];
  togglePlannerCompleted: (id: string) => void;
  completedIndoorIds: string[];
  toggleIndoorCompleted: (id: string) => void;
  notifications: AppNotification[];
  markAllNotificationsRead: () => void;
  settings: AppSettings;
  updateSettings: (next: AppSettings) => void;
  resetAllLocalData: () => void;
  clearPersonalData: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [location, setLocationState] = useState<LocationOption>(() =>
    loadFromStorage(STORAGE_KEYS.location, parseStoredLocationOption, PRESET_LOCATIONS[0]),
  );
  const [airLivePlaces, setAirLivePlaces] = useState<AirLivePlaceDto[]>([]);
  const [placesLoading, setPlacesLoading] = useState<boolean>(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [placesNonce, setPlacesNonce] = useState(0);

  const [indiaRanking, setIndiaRanking] = useState<AirQualityRankingItem[]>([]);
  const [rankingOrder, setRankingOrder] = useState<'worst' | 'best'>('worst');
  const [rankingLoading, setRankingLoading] = useState<boolean>(true);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const [isOffline, setIsOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  const [settings, setSettings] = useState<AppSettings>(() =>
    loadFromStorage(STORAGE_KEYS.settings, parseStoredSettings, DEFAULT_SETTINGS),
  );
  const [dataState, setDataState] = useState<DashboardDataState>(() =>
    settings.dataModePreference === 'live' ? 'live' : 'preview',
  );
  const [liveStatus, setLiveStatus] = useState<LiveFetchStatus>(() =>
    settings.dataModePreference === 'live' ? 'loading' : 'idle',
  );
  const [liveError, setLiveError] = useState<LiveFetchErrorInfo | null>(null);
  const [liveReading, setLiveReading] = useState<AirQualityReading | null>(null);
  const [liveForecast, setLiveForecast] = useState<HourlyForecastPoint[]>([]);
  const [liveRetryNonce, setLiveRetryNonce] = useState(0);

  const [familyProfile, setFamilyProfile] = useState<FamilyProfile>(() =>
    loadFromStorage(STORAGE_KEYS.profile, parseFamilyProfileFromStorage, DEFAULT_FAMILY_PROFILE),
  );
  const [impactLogs, setImpactLogs] = useState<ImpactLogEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.impactLogs, parseStoredImpactLogs, DEFAULT_PREVIEW_IMPACT_LOGS),
  );
  const [completedPlannerIds, setCompletedPlannerIds] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.completedPlanner, parseStoredStringArray, []),
  );
  const [completedIndoorIds, setCompletedIndoorIds] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.completedIndoor, parseStoredStringArray, []),
  );
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const coordLookupSeqRef = useRef(0);
  const clientReadingCacheRef = useRef(
    new Map<
      string,
      { reading: AirQualityReading; forecast: HourlyForecastPoint[]; cachedAt: number }
    >(),
  );
  const lastRetryNonceRef = useRef(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      clientReadingCacheRef.current.clear();
      setLiveRetryNonce((n) => n + 1);
      setPlacesNonce((n) => n + 1);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Indian places directory from AirLive
  useEffect(() => {
    const controller = new AbortController();
    setPlacesLoading(true);
    setPlacesError(null);

    fetchAirLivePlaces('IN', { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setAirLivePlaces(res.items);
        setPlacesLoading(false);

        if (res.items.length > 0) {
          setLocationState((prev) => {
            const match = res.items.find((p) => p.slug === prev.slug);
            if (!match) return prev;
            const mapped = mapAirLiveDtoToLocationOption(match);
            if (
              mapped.name === prev.name &&
              mapped.country === prev.country &&
              mapped.countryName === prev.countryName &&
              mapped.kind === prev.kind &&
              mapped.lat === prev.lat &&
              mapped.lon === prev.lon
            ) {
              return prev;
            }
            return mapped;
          });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setAirLivePlaces([]);
        setPlacesLoading(false);
        setPlacesError(
          err instanceof Error
            ? err.message
            : 'Unable to load Indian locations directory from AirLive.',
        );
      });

    return () => {
      controller.abort();
    };
  }, [placesNonce]);

  // Load India worst/best ranking from AirLive
  useEffect(() => {
    const controller = new AbortController();
    setRankingLoading(true);
    setRankingError(null);

    fetchIndiaRanking(rankingOrder, 10, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setIndiaRanking(res.items);
        setRankingLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setIndiaRanking([]);
        setRankingLoading(false);
        setRankingError(
          err instanceof Error ? err.message : 'Unable to load India AQI ranking from AirLive.',
        );
      });

    return () => {
      controller.abort();
    };
  }, [placesNonce, rankingOrder]);

  const availableLocations = useMemo(() => {
    const map = new Map<string, LocationOption>();
    if (airLivePlaces.length > 0) {
      for (const place of airLivePlaces) {
        map.set(place.slug, mapAirLiveDtoToLocationOption(place));
      }
    } else {
      for (const preset of PRESET_LOCATIONS) {
        map.set(preset.slug, preset);
      }
    }
    if (!map.has(location.slug)) {
      map.set(location.slug, location);
    }
    return Array.from(map.values());
  }, [airLivePlaces, location]);

  const setLocation = useCallback((next: LocationOption) => {
    coordLookupSeqRef.current += 1;
    setLocationState({
      ...next,
      id: next.slug || next.id,
      slug: next.slug || next.id,
    });
  }, []);

  const refreshPlaces = useCallback(() => {
    setPlacesNonce((n) => n + 1);
  }, []);

  const selectLocationByCoordinates = useCallback(
    async (lat: number, lon: number): Promise<LocationOption> => {
      const requestSeq = ++coordLookupSeqRef.current;
      const reading = await fetchLiveCurrentAirQuality({
        id: 'coords-lookup',
        slug: '',
        name: '',
        city: '',
        state: '',
        lat,
        lon,
      });
      const matched: LocationOption = {
        id: reading.location.slug || reading.location.id,
        slug: reading.location.slug || reading.location.id,
        name: reading.location.name,
        city: reading.location.city,
        state: reading.location.countryName || reading.location.state || 'India',
        country: reading.location.country,
        countryName: reading.location.countryName,
        kind: reading.location.kind,
        lat: reading.location.lat,
        lon: reading.location.lon,
      };
      if (requestSeq === coordLookupSeqRef.current) {
        setLocationState(matched);
        setDataState('live');
      }
      return matched;
    },
    [],
  );

  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (dataState !== 'live') {
      return;
    }

    const activeLocation = locationRef.current;
    const forceRefresh = liveRetryNonce !== lastRetryNonceRef.current;
    lastRetryNonceRef.current = liveRetryNonce;

    if (!forceRefresh) {
      const cached = clientReadingCacheRef.current.get(activeLocation.slug);
      if (cached && Date.now() - cached.cachedAt < CLIENT_READING_CACHE_TTL_MS) {
        setLiveReading(cached.reading);
        setLiveForecast(cached.forecast);
        setLiveError(null);
        setLiveStatus('ready');
        return;
      }
    }

    const controller = new AbortController();
    setLiveStatus('loading');
    setLiveError(null);

    Promise.all([
      fetchLiveCurrentAirQuality(activeLocation, { signal: controller.signal }),
      fetchLiveHistoryAirQuality(activeLocation, { signal: controller.signal }).catch(() => []),
    ])
      .then(([reading, history]) => {
        if (controller.signal.aborted) return;
        if (clientReadingCacheRef.current.size >= 20) {
          const oldest = clientReadingCacheRef.current.keys().next().value;
          if (oldest) clientReadingCacheRef.current.delete(oldest);
        }
        clientReadingCacheRef.current.set(location.slug, {
          reading,
          forecast: history,
          cachedAt: Date.now(),
        });
        setLiveReading(reading);
        setLiveForecast(history);
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
  }, [dataState, location.slug, location.lat, location.lon, liveRetryNonce]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(location));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [location]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(familyProfile));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [familyProfile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.impactLogs, JSON.stringify(impactLogs));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [impactLogs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.completedPlanner, JSON.stringify(completedPlannerIds));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [completedPlannerIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.completedIndoor, JSON.stringify(completedIndoorIds));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [completedIndoorIds]);

  const hourlyForecast = useMemo(() => {
    if (dataState === 'preview') return getPreviewFixtureForecast(location);
    if (dataState === 'live' && liveStatus === 'ready') return liveForecast;
    return [];
  }, [dataState, liveForecast, liveStatus, location]);

  const retryLiveCheck = useCallback(() => {
    setDataState('live');
    setLiveRetryNonce((n) => n + 1);
  }, []);

  const updateFamilyProfile = useCallback((next: FamilyProfile) => {
    setFamilyProfile({ ...next, updatedAt: new Date().toISOString() });
  }, []);

  const addImpactLog = useCallback((entry: ImpactLogEntry) => {
    setImpactLogs((prev) => [entry, ...prev]);
  }, []);

  const updateImpactLog = useCallback((id: string, next: ImpactLogEntry) => {
    setImpactLogs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...next, id, updatedAt: new Date().toISOString() } : item,
      ),
    );
  }, []);

  const removeImpactLog = useCallback((id: string) => {
    setImpactLogs((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const togglePlannerCompleted = useCallback((id: string) => {
    setCompletedPlannerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const toggleIndoorCompleted = useCallback((id: string) => {
    setCompletedIndoorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const activeReading = useMemo(() => {
    if (dataState === 'preview') return getPreviewFixtureReading(location);
    if (dataState === 'live' && liveStatus === 'ready') return liveReading;
    return null;
  }, [dataState, liveReading, liveStatus, location]);

  const notifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];
    const aqiVal = activeReading?.aqi.value ?? null;
    if (settings.enableThresholdAlerts && activeReading && aqiVal !== null && aqiVal >= 151) {
      const scaleText = activeReading.aqi.scale === 'US_AQI' ? 'US AQI' : 'NAQI';
      items.push({
        id: `notif-threshold-${activeReading.location.slug}-${aqiVal}`,
        title: `High Pollution Alert: ${activeReading.location.name} (${scaleText} ${aqiVal})`,
        message: `${activeReading.aqi.category} air detected. Shift outdoor exertion indoors and check today's protective plan.`,
        severity: aqiVal >= 201 ? 'critical' : 'warning',
        timestamp: 'Active now',
        read: false,
        targetPage: 'planner',
      });
    }
    items.push(...DEFAULT_NOTIFICATIONS);
    return items.map((n) => (readNotifIds.includes(n.id) ? { ...n, read: true } : n));
  }, [activeReading, readNotifIds, settings.enableThresholdAlerts]);

  const markAllNotificationsRead = useCallback(() => {
    setReadNotifIds((prev) => {
      const all = new Set(prev);
      for (const n of notifications) all.add(n.id);
      return Array.from(all);
    });
  }, [notifications]);

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    setDataState(next.dataModePreference === 'live' ? 'live' : 'preview');
  }, []);

  const resetAllLocalData = useCallback(() => {
    coordLookupSeqRef.current += 1;
    setLocationState({ ...PRESET_LOCATIONS[0] });
    setFamilyProfile(DEFAULT_FAMILY_PROFILE);
    setImpactLogs(DEFAULT_PREVIEW_IMPACT_LOGS);
    setCompletedPlannerIds([]);
    setCompletedIndoorIds([]);
    setReadNotifIds([]);
    setLiveError(null);
    setSettings(DEFAULT_SETTINGS);
    setDataState(DEFAULT_SETTINGS.dataModePreference === 'live' ? 'live' : 'preview');
    setLiveRetryNonce((n) => n + 1);
  }, []);

  const clearPersonalData = useCallback(() => {
    coordLookupSeqRef.current += 1;
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors cleanly
    }
    setLocationState({ ...PRESET_LOCATIONS[0] });
    setFamilyProfile(ANONYMOUS_MINIMAL_PROFILE);
    setImpactLogs([]);
    setCompletedPlannerIds([]);
    setCompletedIndoorIds([]);
    setReadNotifIds([]);
    setLiveError(null);
    setSettings(DEFAULT_SETTINGS);
    setDataState(DEFAULT_SETTINGS.dataModePreference === 'live' ? 'live' : 'preview');
    setLiveRetryNonce((n) => n + 1);
  }, []);

  const contextValue = useMemo<AppStateContextValue>(
    () => ({
      activePage,
      setActivePage,
      location,
      setLocation,
      availableLocations,
      airLivePlaces,
      placesLoading,
      placesError,
      refreshPlaces,
      selectLocationByCoordinates,
      indiaRanking,
      rankingOrder,
      setRankingOrder,
      rankingLoading,
      rankingError,
      isOffline,
      dataState,
      setDataState,
      liveStatus,
      liveError,
      retryLiveCheck,
      currentReading: activeReading,
      hourlyForecast,
      familyProfile,
      updateFamilyProfile,
      impactLogs,
      addImpactLog,
      updateImpactLog,
      removeImpactLog,
      completedPlannerIds,
      togglePlannerCompleted,
      completedIndoorIds,
      toggleIndoorCompleted,
      notifications,
      markAllNotificationsRead,
      settings,
      updateSettings,
      resetAllLocalData,
      clearPersonalData,
    }),
    [
      activePage,
      location,
      setLocation,
      availableLocations,
      airLivePlaces,
      placesLoading,
      placesError,
      refreshPlaces,
      selectLocationByCoordinates,
      indiaRanking,
      rankingOrder,
      rankingLoading,
      rankingError,
      isOffline,
      dataState,
      liveStatus,
      liveError,
      retryLiveCheck,
      activeReading,
      hourlyForecast,
      familyProfile,
      updateFamilyProfile,
      impactLogs,
      addImpactLog,
      updateImpactLog,
      removeImpactLog,
      completedPlannerIds,
      togglePlannerCompleted,
      completedIndoorIds,
      toggleIndoorCompleted,
      notifications,
      markAllNotificationsRead,
      settings,
      updateSettings,
      resetAllLocalData,
      clearPersonalData,
    ],
  );

  return <AppStateContext.Provider value={contextValue}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
