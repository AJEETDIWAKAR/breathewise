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
  clearAllAppStorage,
  loadInitialPersistedState,
  saveToStorage,
  STORAGE_KEYS,
} from './storagePersistence';
import {
  ANONYMOUS_MINIMAL_PROFILE,
  DEFAULT_FAMILY_PROFILE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PREVIEW_IMPACT_LOGS,
  DEFAULT_SETTINGS,
  PRESET_LOCATIONS,
} from '../data/previewFixtures';
import { fetchLiveCurrentAirQuality, type AirLivePlaceDto } from '../services/airQualityApi';
import type {
  AirQualityRankingItem,
  AirQualityReading,
  AppNotification,
  AppSettings,
  DashboardDataState,
  FamilyProfile,
  HourlyForecastPoint,
  ImpactLogEntry,
  LocationOption,
  PageId,
} from '../types/breathewise';
import { useAirQualityDirectory } from './useAirQualityDirectory';
import {
  useLiveAirQualitySync,
  type LiveFetchErrorInfo,
  type LiveFetchStatus,
} from './useLiveAirQualitySync';

export type { LiveFetchErrorInfo, LiveFetchStatus };

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
  const initialPersisted = useMemo(
    () =>
      loadInitialPersistedState({
        location: PRESET_LOCATIONS[0],
        settings: DEFAULT_SETTINGS,
        profile: DEFAULT_FAMILY_PROFILE,
        impactLogs: DEFAULT_PREVIEW_IMPACT_LOGS,
      }),
    [],
  );

  const [activePage, setActivePage] = useState<PageId>('overview');
  const [location, setLocationState] = useState<LocationOption>(initialPersisted.location);
  const [isOffline, setIsOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [settings, setSettings] = useState<AppSettings>(initialPersisted.settings);
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile>(initialPersisted.familyProfile);
  const [impactLogs, setImpactLogs] = useState<ImpactLogEntry[]>(initialPersisted.impactLogs);
  const [completedPlannerIds, setCompletedPlannerIds] = useState<string[]>(
    initialPersisted.completedPlannerIds,
  );
  const [completedIndoorIds, setCompletedIndoorIds] = useState<string[]>(
    initialPersisted.completedIndoorIds,
  );
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const coordLookupSeqRef = useRef(0);

  const directory = useAirQualityDirectory({
    location,
    onHydrateLocation: setLocationState,
  });

  const liveSync = useLiveAirQualitySync(location, initialPersisted.settings.dataModePreference);

  const { refreshPlaces } = directory;
  const {
    dataState,
    setDataState,
    notifyLocationChanging,
    clearCacheAndRefresh,
    resetSyncState,
    activeReading,
  } = liveSync;

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      clearCacheAndRefresh();
      refreshPlaces();
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
  }, [clearCacheAndRefresh, refreshPlaces]);

  const setLocation = useCallback(
    (next: LocationOption) => {
      coordLookupSeqRef.current += 1;
      const slug = next.slug || next.id;
      if (dataState === 'live') {
        notifyLocationChanging();
      }
      setLocationState({
        ...next,
        id: slug,
        slug,
      });
    },
    [dataState, notifyLocationChanging],
  );

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
    [setDataState],
  );

  useEffect(() => saveToStorage(STORAGE_KEYS.location, location), [location]);
  useEffect(() => saveToStorage(STORAGE_KEYS.profile, familyProfile), [familyProfile]);
  useEffect(() => saveToStorage(STORAGE_KEYS.impactLogs, impactLogs), [impactLogs]);
  useEffect(() => saveToStorage(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(
    () => saveToStorage(STORAGE_KEYS.completedPlanner, completedPlannerIds),
    [completedPlannerIds],
  );
  useEffect(
    () => saveToStorage(STORAGE_KEYS.completedIndoor, completedIndoorIds),
    [completedIndoorIds],
  );

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

  const updateSettings = useCallback(
    (next: AppSettings) => {
      setSettings(next);
      setDataState(next.dataModePreference === 'live' ? 'live' : 'preview');
    },
    [setDataState],
  );

  const resetAllLocalData = useCallback(() => {
    coordLookupSeqRef.current += 1;
    setLocationState({ ...PRESET_LOCATIONS[0] });
    setFamilyProfile(DEFAULT_FAMILY_PROFILE);
    setImpactLogs(DEFAULT_PREVIEW_IMPACT_LOGS);
    setCompletedPlannerIds([]);
    setCompletedIndoorIds([]);
    setReadNotifIds([]);
    setSettings(DEFAULT_SETTINGS);
    resetSyncState(DEFAULT_SETTINGS.dataModePreference === 'live' ? 'live' : 'preview');
  }, [resetSyncState]);

  const clearPersonalData = useCallback(() => {
    coordLookupSeqRef.current += 1;
    clearAllAppStorage();
    setLocationState({ ...PRESET_LOCATIONS[0] });
    setFamilyProfile(ANONYMOUS_MINIMAL_PROFILE);
    setImpactLogs([]);
    setCompletedPlannerIds([]);
    setCompletedIndoorIds([]);
    setReadNotifIds([]);
    setSettings(DEFAULT_SETTINGS);
    resetSyncState(DEFAULT_SETTINGS.dataModePreference === 'live' ? 'live' : 'preview');
  }, [resetSyncState]);

  const contextValue = useMemo<AppStateContextValue>(
    () => ({
      activePage,
      setActivePage,
      location,
      setLocation,
      availableLocations: directory.availableLocations,
      airLivePlaces: directory.airLivePlaces,
      placesLoading: directory.placesLoading,
      placesError: directory.placesError,
      refreshPlaces: directory.refreshPlaces,
      selectLocationByCoordinates,
      indiaRanking: directory.indiaRanking,
      rankingOrder: directory.rankingOrder,
      setRankingOrder: directory.setRankingOrder,
      rankingLoading: directory.rankingLoading,
      rankingError: directory.rankingError,
      isOffline,
      dataState: liveSync.dataState,
      setDataState: liveSync.setDataState,
      liveStatus: liveSync.liveStatus,
      liveError: liveSync.liveError,
      retryLiveCheck: liveSync.retryLiveCheck,
      currentReading: liveSync.activeReading,
      hourlyForecast: liveSync.hourlyForecast,
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
      directory.availableLocations,
      directory.airLivePlaces,
      directory.placesLoading,
      directory.placesError,
      directory.refreshPlaces,
      selectLocationByCoordinates,
      directory.indiaRanking,
      directory.rankingOrder,
      directory.setRankingOrder,
      directory.rankingLoading,
      directory.rankingError,
      isOffline,
      liveSync.dataState,
      liveSync.setDataState,
      liveSync.liveStatus,
      liveSync.liveError,
      liveSync.retryLiveCheck,
      liveSync.activeReading,
      liveSync.hourlyForecast,
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
