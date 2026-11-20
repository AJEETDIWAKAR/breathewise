import {
  parseStoredImpactLogs,
  parseStoredLocationOption,
  parseStoredSettings,
  parseStoredStringArray,
  validateFamilyProfile,
  type AppSettings,
  type FamilyProfile,
  type ImpactLogEntry,
  type LocationOption,
} from '../types/breathewise';

export const STORAGE_KEYS = {
  profile: 'breathewise.v1.profile',
  location: 'breathewise.v1.location',
  impactLogs: 'breathewise.v1.impactLogs',
  settings: 'breathewise.v1.settings',
  completedPlanner: 'breathewise.v1.completedPlanner',
  completedIndoor: 'breathewise.v1.completedIndoor',
} as const;

export function loadFromStorage<T>(
  key: string,
  parse: (raw: unknown) => T | null,
  fallback: T,
): T {
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

export function saveToStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearAllAppStorage(): void {
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors cleanly
  }
}

export function parseFamilyProfileFromStorage(raw: unknown): FamilyProfile | null {
  const result = validateFamilyProfile(raw);
  return result.success ? result.data : null;
}

export interface PersistedAppDefaults {
  location: LocationOption;
  settings: AppSettings;
  profile: FamilyProfile;
  impactLogs: ImpactLogEntry[];
}

export function loadInitialPersistedState(defaults: PersistedAppDefaults) {
  return {
    location: loadFromStorage(STORAGE_KEYS.location, parseStoredLocationOption, defaults.location),
    settings: loadFromStorage(STORAGE_KEYS.settings, parseStoredSettings, defaults.settings),
    familyProfile: loadFromStorage(
      STORAGE_KEYS.profile,
      parseFamilyProfileFromStorage,
      defaults.profile,
    ),
    impactLogs: loadFromStorage(
      STORAGE_KEYS.impactLogs,
      parseStoredImpactLogs,
      defaults.impactLogs,
    ),
    completedPlannerIds: loadFromStorage(
      STORAGE_KEYS.completedPlanner,
      parseStoredStringArray,
      [],
    ),
    completedIndoorIds: loadFromStorage(STORAGE_KEYS.completedIndoor, parseStoredStringArray, []),
  };
}
