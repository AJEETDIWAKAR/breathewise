import type {
  AppSettings,
  BudgetTier,
  CommuteMode,
  CookingFuel,
  FamilyProfile,
  HousingType,
  ImpactLogEntry,
  KitchenExhaust,
  LocationOption,
  OutdoorActivityPattern,
  OutdoorExerciseWindow,
  SchoolSchedule,
  WorkSchedule,
} from '../types/breathewise';

const COMMUTE_MODES: readonly CommuteMode[] = [
  'petrol_car',
  'diesel_car',
  'two_wheeler',
  'metro_rail',
  'public_bus',
  'carpool',
  'walk_cycle',
  'work_from_home',
];
const BUDGET_TIERS: readonly BudgetTier[] = ['low', 'moderate', 'flexible'];
const COOKING_FUELS: readonly CookingFuel[] = ['lpg', 'induction', 'biomass_solid'];
const WORK_SCHEDULES: readonly WorkSchedule[] = [
  'morning_evening_commute',
  'flexible_hybrid',
  'shift_work',
  'home_based',
];
const SCHOOL_SCHEDULES: readonly SchoolSchedule[] = ['morning_afternoon', 'online_or_none'];
const HOUSING_TYPES: readonly HousingType[] = [
  'apartment_sealed',
  'independent_leaky',
  'high_traffic_roadside',
];
const KITCHEN_EXHAUSTS: readonly KitchenExhaust[] = ['chimney_or_exhaust', 'window_only', 'none'];
const OUTDOOR_ACTIVITIES: readonly OutdoorActivityPattern[] = [
  'walking',
  'running_sports',
  'park_play',
  'none',
];
const OUTDOOR_TIMES: readonly OutdoorExerciseWindow[] = ['early_morning', 'midday', 'evening'];
const IMPACT_CATEGORIES: readonly ImpactLogEntry['category'][] = [
  'transport_shift',
  'exposure_protection',
  'energy_household',
];
const BASELINE_MODES: readonly NonNullable<ImpactLogEntry['baselineMode']>[] = [
  'petrol_car',
  'diesel_car',
  'two_wheeler',
];
const CHOSEN_MODES: readonly NonNullable<ImpactLogEntry['chosenMode']>[] = [
  'metro_rail',
  'public_bus',
  'carpool',
  'walk_cycle',
  'work_from_home',
];

const LEGACY_SLUG_MAP: Record<string, string> = {
  'delhi-anand-vihar': 'anand-vihar-delhi',
  'lucknow-lalbagh': 'lucknow',
  'patna-muradpur': 'patna',
  'mumbai-worli': 'mumbai',
  'bengaluru-btm': 'bengaluru',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val);
}

function resolveOptionalEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
  fallback: T,
): T | null {
  if (val === undefined) return fallback;
  return isOneOf(val, allowed) ? val : null;
}

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

function isFiniteInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

function validateMembersSection(raw: unknown): FamilyProfile['members'] | null {
  if (
    !isRecord(raw) ||
    !isIntInRange(raw.adults, 0, 15) ||
    !isIntInRange(raw.children, 0, 15) ||
    !isIntInRange(raw.seniors, 0, 15)
  ) {
    return null;
  }
  return { adults: raw.adults, children: raw.children, seniors: raw.seniors };
}

function validateSensitivitiesSection(raw: unknown): FamilyProfile['sensitivities'] | null {
  if (
    !isRecord(raw) ||
    typeof raw.hasAsthmaOrRespiratory !== 'boolean' ||
    typeof raw.hasHeartCondition !== 'boolean' ||
    typeof raw.hasPregnantMember !== 'boolean' ||
    typeof raw.hasOutdoorWorker !== 'boolean'
  ) {
    return null;
  }
  return {
    hasAsthmaOrRespiratory: raw.hasAsthmaOrRespiratory,
    hasHeartCondition: raw.hasHeartCondition,
    hasPregnantMember: raw.hasPregnantMember,
    hasOutdoorWorker: raw.hasOutdoorWorker,
  };
}

function validateLifestyleSection(
  raw: unknown,
): { ok: true; value: FamilyProfile['lifestyle'] } | { ok: false; message: string } {
  if (
    !isRecord(raw) ||
    !isOneOf(raw.primaryCommute, COMMUTE_MODES) ||
    !isFiniteInRange(raw.dailyCommuteKm, 0, 200) ||
    !isOneOf(raw.preferredOutdoorActivity, OUTDOOR_ACTIVITIES) ||
    !isOneOf(raw.outdoorExerciseTime, OUTDOOR_TIMES)
  ) {
    return { ok: false, message: 'Please check commute and outdoor lifestyle settings.' };
  }
  const workSchedule = resolveOptionalEnum(
    raw.workSchedule,
    WORK_SCHEDULES,
    'morning_evening_commute',
  );
  const schoolSchedule = resolveOptionalEnum(
    raw.schoolSchedule,
    SCHOOL_SCHEDULES,
    'morning_afternoon',
  );
  if (!workSchedule || !schoolSchedule) {
    return { ok: false, message: 'Invalid work or school schedule option.' };
  }
  return {
    ok: true,
    value: {
      primaryCommute: raw.primaryCommute,
      dailyCommuteKm: raw.dailyCommuteKm,
      preferredOutdoorActivity: raw.preferredOutdoorActivity,
      outdoorExerciseTime: raw.outdoorExerciseTime,
      workSchedule,
      schoolSchedule,
    },
  };
}

function validateHomeEnvironmentSection(
  raw: unknown,
): { ok: true; value: FamilyProfile['homeEnvironment'] } | { ok: false; message: string } {
  if (
    !isRecord(raw) ||
    !isOneOf(raw.budgetTier, BUDGET_TIERS) ||
    !isOneOf(raw.cookingFuel, COOKING_FUELS) ||
    typeof raw.hasAirPurifier !== 'boolean' ||
    !isIntInRange(raw.roomAreaSqFt, 50, 2500)
  ) {
    return {
      ok: false,
      message: 'Please check home environment values (room area must be 50–2500 sq ft).',
    };
  }
  const housingType = resolveOptionalEnum(raw.housingType, HOUSING_TYPES, 'apartment_sealed');
  const kitchenExhaust = resolveOptionalEnum(raw.kitchenExhaust, KITCHEN_EXHAUSTS, 'window_only');
  if (!housingType || !kitchenExhaust) {
    return { ok: false, message: 'Invalid housing or kitchen exhaust option.' };
  }
  return {
    ok: true,
    value: {
      budgetTier: raw.budgetTier,
      cookingFuel: raw.cookingFuel,
      hasAirPurifier: raw.hasAirPurifier,
      roomAreaSqFt: raw.roomAreaSqFt,
      housingType,
      kitchenExhaust,
    },
  };
}

export function validateFamilyProfile(
  input: unknown,
):
  | { success: true; data: FamilyProfile }
  | { success: false; field?: 'householdName'; message: string } {
  if (!isRecord(input)) {
    return { success: false, message: 'Invalid household profile format.' };
  }
  if (input.version !== 1) {
    return { success: false, message: 'Unsupported household profile version.' };
  }
  const rawName = typeof input.householdName === 'string' ? input.householdName.trim() : '';
  if (rawName.length < 1 || rawName.length > 60) {
    return {
      success: false,
      field: 'householdName',
      message: 'Enter a household label (1–60 characters).',
    };
  }

  const members = validateMembersSection(input.members);
  if (!members) {
    return { success: false, message: 'Household member counts must be integers between 0 and 15.' };
  }

  const sensitivities = validateSensitivitiesSection(input.sensitivities);
  if (!sensitivities) {
    return { success: false, message: 'Please check household sensitivity flags.' };
  }

  const lifestyle = validateLifestyleSection(input.lifestyle);
  if (!lifestyle.ok) {
    return { success: false, message: lifestyle.message };
  }

  const homeEnvironment = validateHomeEnvironmentSection(input.homeEnvironment);
  if (!homeEnvironment.ok) {
    return { success: false, message: homeEnvironment.message };
  }

  if (typeof input.updatedAt !== 'string') {
    return { success: false, message: 'Invalid profile timestamp.' };
  }

  return {
    success: true,
    data: {
      version: 1,
      householdName: rawName,
      members,
      sensitivities,
      lifestyle: lifestyle.value,
      homeEnvironment: homeEnvironment.value,
      updatedAt: input.updatedAt,
    },
  };
}

export function parseStoredLocationOption(raw: unknown): LocationOption | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.city !== 'string' ||
    typeof raw.state !== 'string' ||
    typeof raw.lat !== 'number' ||
    !Number.isFinite(raw.lat) ||
    typeof raw.lon !== 'number' ||
    !Number.isFinite(raw.lon)
  ) {
    return null;
  }
  const rawSlug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : raw.id;
  const resolvedSlug = LEGACY_SLUG_MAP[rawSlug] || rawSlug;
  return {
    id: resolvedSlug,
    slug: resolvedSlug,
    name: raw.name,
    city: raw.city,
    state: raw.state,
    ...(typeof raw.country === 'string' ? { country: raw.country } : {}),
    ...(typeof raw.countryName === 'string' ? { countryName: raw.countryName } : {}),
    ...(typeof raw.kind === 'string' ? { kind: raw.kind } : {}),
    lat: raw.lat,
    lon: raw.lon,
  };
}

export function parseStoredSettings(raw: unknown): AppSettings | null {
  if (!isRecord(raw)) return null;
  if (
    (raw.preferredUnit !== 'aqi' && raw.preferredUnit !== 'naqi' && raw.preferredUnit !== 'ugm3') ||
    typeof raw.enableThresholdAlerts !== 'boolean' ||
    (raw.dataModePreference !== 'preview' && raw.dataModePreference !== 'live')
  ) {
    return null;
  }
  return {
    preferredUnit: raw.preferredUnit === 'ugm3' ? 'ugm3' : 'aqi',
    enableThresholdAlerts: raw.enableThresholdAlerts,
    dataModePreference: raw.dataModePreference,
  };
}

function hasValidImpactStrings(item: Record<string, unknown>, title: string): boolean {
  return (
    typeof item.id === 'string' &&
    typeof item.date === 'string' &&
    isOneOf(item.category, IMPACT_CATEGORIES) &&
    title.length >= 1 &&
    title.length <= 140 &&
    typeof item.methodologyNote === 'string' &&
    item.methodologyNote.length <= 400
  );
}

function hasValidImpactMetrics(item: Record<string, unknown>): boolean {
  return (
    isFiniteInRange(item.emissionsAvoidedGrams, 0, Number.MAX_SAFE_INTEGER) &&
    isFiniteInRange(item.fuelSavedLitres, 0, Number.MAX_SAFE_INTEGER) &&
    isIntInRange(item.exposureProtectionPoints, 0, 1_000_000)
  );
}

function hasValidImpactOptionals(item: Record<string, unknown>): boolean {
  return (
    (item.baselineMode === undefined || isOneOf(item.baselineMode, BASELINE_MODES)) &&
    (item.chosenMode === undefined || isOneOf(item.chosenMode, CHOSEN_MODES)) &&
    (item.distanceKm === undefined || isFiniteInRange(item.distanceKm, 0, 500)) &&
    (item.assumptions === undefined ||
      (typeof item.assumptions === 'string' && item.assumptions.length <= 400)) &&
    (item.updatedAt === undefined || typeof item.updatedAt === 'string')
  );
}

function parseSingleImpactLogEntry(item: unknown): ImpactLogEntry | null {
  if (!isRecord(item)) return null;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (
    !hasValidImpactStrings(item, title) ||
    !hasValidImpactMetrics(item) ||
    !hasValidImpactOptionals(item)
  ) {
    return null;
  }

  return {
    id: item.id as string,
    date: item.date as string,
    category: item.category as ImpactLogEntry['category'],
    title,
    ...(item.baselineMode ? { baselineMode: item.baselineMode as ImpactLogEntry['baselineMode'] } : {}),
    ...(item.chosenMode ? { chosenMode: item.chosenMode as ImpactLogEntry['chosenMode'] } : {}),
    ...(item.distanceKm !== undefined ? { distanceKm: item.distanceKm as number } : {}),
    emissionsAvoidedGrams: item.emissionsAvoidedGrams as number,
    fuelSavedLitres: item.fuelSavedLitres as number,
    exposureProtectionPoints: item.exposureProtectionPoints as number,
    methodologyNote: item.methodologyNote as string,
    ...(item.assumptions !== undefined ? { assumptions: item.assumptions as string } : {}),
    ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt as string } : {}),
  };
}

export function parseStoredImpactLogs(raw: unknown): ImpactLogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ImpactLogEntry[] = [];
  for (const item of raw) {
    const parsed = parseSingleImpactLogEntry(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

export function parseStoredStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.every((entry) => typeof entry === 'string') ? raw : null;
}
