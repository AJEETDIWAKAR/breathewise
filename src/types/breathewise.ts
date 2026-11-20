export const PAGE_IDS = [
  'overview',
  'air-quality',
  'assistant',
  'family',
  'planner',
  'indoor',
  'sustainable',
  'impact',
  'settings',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export type UsAqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type NaqiCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderately Polluted'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

export type AqiCategory = UsAqiCategory | NaqiCategory;

export type AqiScale = 'US_AQI' | 'INDIA_CPCB_NAQI';

export type MeasurementType = 'ground_station' | 'modeled_forecast' | 'preview_fixture';

export type FreshnessStatus = 'fresh' | 'stale' | 'unavailable';

export type DashboardDataState = 'live' | 'preview' | 'loading' | 'unavailable' | 'error';

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3' | 'nh3';

export interface PollutantMetric {
  key: PollutantKey;
  label: string;
  value: number | null;
  unit: 'µg/m³' | 'mg/m³';
  subIndex: number | null;
  safeReference: string;
  status?: 'measured' | 'unavailable';
}

export interface AirQualityReading {
  location: {
    id: string;
    slug?: string;
    name: string;
    city: string;
    state: string;
    country?: string;
    countryName?: string;
    kind?: string;
    lat: number;
    lon: number;
    distanceKm?: number;
  };
  aqi: {
    value: number | null;
    scale: AqiScale;
    category: AqiCategory | 'Unavailable';
    dominantPollutant: string;
    modelUsAqi?: number | null;
    stationToModelRatio?: number | null;
    providerReferenceAqi?: {
      scale: 'US_AQI' | 'EAQI' | 'WAQI_AQI';
      value: number;
      note: string;
    };
  };
  pollutants: PollutantMetric[];
  missingPollutants?: PollutantKey[];
  provenance: {
    providerId: string;
    providerName: string;
    stationName: string;
    measurementType: MeasurementType;
    sourceLabel?: string;
    stationsUsed?: number | null;
    observedAt: string | null;
    fetchedAt: string;
    isStale: boolean;
    freshnessStatus?: FreshnessStatus;
    staleReason?: string;
    spatialResolution?: string;
    attribution: string;
    attributionUrl?: string;
    placeUrl?: string;
    coverageLimitations?: string;
    cacheHit?: boolean;
  };
}

export interface AirQualityRankingItem {
  rank: number;
  slug: string;
  name: string;
  kind: string;
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  usAqi: number | null;
  category: UsAqiCategory | 'Unavailable';
  pm25: number | null;
  source: string;
  measurementType: 'ground_station' | 'modeled_forecast';
  stationsUsed: number | null;
  updated: string | null;
  freshnessStatus: FreshnessStatus;
  url?: string;
}

export interface HourlyForecastPoint {
  hourLabel: string;
  timestamp: string;
  pm25: number;
  pm10: number;
  estimatedNaqi: number;
  scale?: AqiScale;
  category: AqiCategory;
}

export interface LocationOption {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  country?: string;
  countryName?: string;
  kind?: string;
  lat: number;
  lon: number;
}

export type CommuteMode =
  | 'petrol_car'
  | 'diesel_car'
  | 'two_wheeler'
  | 'metro_rail'
  | 'public_bus'
  | 'carpool'
  | 'walk_cycle'
  | 'work_from_home';

export type BudgetTier = 'low' | 'moderate' | 'flexible';
export type CookingFuel = 'lpg' | 'induction' | 'biomass_solid';
export type WorkSchedule =
  | 'morning_evening_commute'
  | 'flexible_hybrid'
  | 'shift_work'
  | 'home_based';
export type SchoolSchedule = 'morning_afternoon' | 'online_or_none';
export type HousingType = 'apartment_sealed' | 'independent_leaky' | 'high_traffic_roadside';
export type KitchenExhaust = 'chimney_or_exhaust' | 'window_only' | 'none';
export type OutdoorActivityPattern = 'walking' | 'running_sports' | 'park_play' | 'none';
export type OutdoorExerciseWindow = 'early_morning' | 'midday' | 'evening';

export interface FamilyProfile {
  version: 1;
  householdName: string;
  members: {
    adults: number;
    children: number;
    seniors: number;
  };
  sensitivities: {
    hasAsthmaOrRespiratory: boolean;
    hasHeartCondition: boolean;
    hasPregnantMember: boolean;
    hasOutdoorWorker: boolean;
  };
  lifestyle: {
    primaryCommute: CommuteMode;
    dailyCommuteKm: number;
    preferredOutdoorActivity: OutdoorActivityPattern;
    outdoorExerciseTime: OutdoorExerciseWindow;
    workSchedule: WorkSchedule;
    schoolSchedule: SchoolSchedule;
  };
  homeEnvironment: {
    budgetTier: BudgetTier;
    cookingFuel: CookingFuel;
    hasAirPurifier: boolean;
    roomAreaSqFt: number;
    housingType: HousingType;
    kitchenExhaust: KitchenExhaust;
  };
  updatedAt: string;
}

export interface ImpactLogEntry {
  id: string;
  date: string;
  category: 'transport_shift' | 'exposure_protection' | 'energy_household';
  title: string;
  baselineMode?: 'petrol_car' | 'diesel_car' | 'two_wheeler';
  chosenMode?: 'metro_rail' | 'public_bus' | 'carpool' | 'walk_cycle' | 'work_from_home';
  distanceKm?: number;
  emissionsAvoidedGrams: number;
  fuelSavedLitres: number;
  exposureProtectionPoints: number;
  methodologyNote: string;
  assumptions?: string;
  updatedAt?: string;
}

export interface DailyTimeBlock {
  id: string;
  period: 'morning' | 'midday' | 'evening' | 'night';
  label: string;
  timeRange: string;
  expectedNaqi: number | null;
  hasHourlyEvidence: boolean;
  conditionTier: 'severe' | 'moderate' | 'better' | 'missing_data';
  outdoorRisk: 'low' | 'moderate' | 'high' | 'severe' | 'unknown';
  recommendedActivity: string;
  saferAlternative: string;
  maskGuidance: string;
  ventilationAction: string;
  commuteNote: string;
  reason: string;
  expectedBenefit: string;
  guidanceBasis: string;
  limitations: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  summary: string;
  category: 'exposure' | 'indoor' | 'commute' | 'energy';
  priority: 'critical' | 'high' | 'standard';
  impactType: 'Exposure Reduction' | 'Emissions Avoided';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  targetPage?: PageId;
}

export interface AppSettings {
  preferredUnit: 'aqi' | 'ugm3';
  enableThresholdAlerts: boolean;
  dataModePreference: 'preview' | 'live';
}

export type AiRecommendationOutcome =
  | 'reduce_personal_exposure'
  | 'improve_indoor_air'
  | 'reduce_personal_emissions';

export interface AiRecommendationItem {
  title: string;
  action: string;
  outcomeCategory: AiRecommendationOutcome;
  outcomeLabel: string;
  estimatedCostOrBudgetNote: string;
}

export interface AiSourceAttribution {
  name: string;
  detail: string;
  url?: string;
}

export interface AiStructuredAdvice {
  summary: string;
  currentAirQualityContext: {
    locationName: string;
    aqiSummary: string;
    measuredFacts: string[];
    missingData: string[];
  };
  recommendations: AiRecommendationItem[];
  explanation: string;
  precautions: string[];
  confidenceAndLimitations: {
    confidenceLevel: 'high' | 'moderate' | 'low';
    notes: string;
  };
  sources: AiSourceAttribution[];
  dataFreshness: string;
}

export type AiFallbackReasonCode =
  | 'MISSING_API_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'TIMEOUT'
  | 'MALFORMED_AI_RESPONSE'
  | 'UPSTREAM_ERROR';

// Lightweight pure-TypeScript validators for browser runtime (avoids shipping Zod in client bundle)

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val);
}

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

function isFiniteInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
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
  if (
    !isRecord(input.members) ||
    !isIntInRange(input.members.adults, 0, 15) ||
    !isIntInRange(input.members.children, 0, 15) ||
    !isIntInRange(input.members.seniors, 0, 15)
  ) {
    return { success: false, message: 'Household member counts must be integers between 0 and 15.' };
  }
  if (
    !isRecord(input.sensitivities) ||
    typeof input.sensitivities.hasAsthmaOrRespiratory !== 'boolean' ||
    typeof input.sensitivities.hasHeartCondition !== 'boolean' ||
    typeof input.sensitivities.hasPregnantMember !== 'boolean' ||
    typeof input.sensitivities.hasOutdoorWorker !== 'boolean'
  ) {
    return { success: false, message: 'Please check household sensitivity flags.' };
  }
  if (
    !isRecord(input.lifestyle) ||
    !isOneOf(input.lifestyle.primaryCommute, COMMUTE_MODES) ||
    !isFiniteInRange(input.lifestyle.dailyCommuteKm, 0, 200) ||
    !isOneOf(input.lifestyle.preferredOutdoorActivity, OUTDOOR_ACTIVITIES) ||
    !isOneOf(input.lifestyle.outdoorExerciseTime, OUTDOOR_TIMES)
  ) {
    return { success: false, message: 'Please check commute and outdoor lifestyle settings.' };
  }
  const workSchedule =
    input.lifestyle.workSchedule === undefined
      ? 'morning_evening_commute'
      : isOneOf(input.lifestyle.workSchedule, WORK_SCHEDULES)
        ? input.lifestyle.workSchedule
        : null;
  const schoolSchedule =
    input.lifestyle.schoolSchedule === undefined
      ? 'morning_afternoon'
      : isOneOf(input.lifestyle.schoolSchedule, SCHOOL_SCHEDULES)
        ? input.lifestyle.schoolSchedule
        : null;
  if (!workSchedule || !schoolSchedule) {
    return { success: false, message: 'Invalid work or school schedule option.' };
  }

  if (
    !isRecord(input.homeEnvironment) ||
    !isOneOf(input.homeEnvironment.budgetTier, BUDGET_TIERS) ||
    !isOneOf(input.homeEnvironment.cookingFuel, COOKING_FUELS) ||
    typeof input.homeEnvironment.hasAirPurifier !== 'boolean' ||
    !isIntInRange(input.homeEnvironment.roomAreaSqFt, 50, 2500)
  ) {
    return {
      success: false,
      message: 'Please check home environment values (room area must be 50–2500 sq ft).',
    };
  }
  const housingType =
    input.homeEnvironment.housingType === undefined
      ? 'apartment_sealed'
      : isOneOf(input.homeEnvironment.housingType, HOUSING_TYPES)
        ? input.homeEnvironment.housingType
        : null;
  const kitchenExhaust =
    input.homeEnvironment.kitchenExhaust === undefined
      ? 'window_only'
      : isOneOf(input.homeEnvironment.kitchenExhaust, KITCHEN_EXHAUSTS)
        ? input.homeEnvironment.kitchenExhaust
        : null;
  if (!housingType || !kitchenExhaust) {
    return { success: false, message: 'Invalid housing or kitchen exhaust option.' };
  }
  if (typeof input.updatedAt !== 'string') {
    return { success: false, message: 'Invalid profile timestamp.' };
  }

  return {
    success: true,
    data: {
      version: 1,
      householdName: rawName,
      members: {
        adults: input.members.adults,
        children: input.members.children,
        seniors: input.members.seniors,
      },
      sensitivities: {
        hasAsthmaOrRespiratory: input.sensitivities.hasAsthmaOrRespiratory,
        hasHeartCondition: input.sensitivities.hasHeartCondition,
        hasPregnantMember: input.sensitivities.hasPregnantMember,
        hasOutdoorWorker: input.sensitivities.hasOutdoorWorker,
      },
      lifestyle: {
        primaryCommute: input.lifestyle.primaryCommute,
        dailyCommuteKm: input.lifestyle.dailyCommuteKm,
        preferredOutdoorActivity: input.lifestyle.preferredOutdoorActivity,
        outdoorExerciseTime: input.lifestyle.outdoorExerciseTime,
        workSchedule,
        schoolSchedule,
      },
      homeEnvironment: {
        budgetTier: input.homeEnvironment.budgetTier,
        cookingFuel: input.homeEnvironment.cookingFuel,
        hasAirPurifier: input.homeEnvironment.hasAirPurifier,
        roomAreaSqFt: input.homeEnvironment.roomAreaSqFt,
        housingType,
        kitchenExhaust,
      },
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
  const legacySlugMap: Record<string, string> = {
    'delhi-anand-vihar': 'anand-vihar-delhi',
    'lucknow-lalbagh': 'lucknow',
    'patna-muradpur': 'patna',
    'mumbai-worli': 'mumbai',
    'bengaluru-btm': 'bengaluru',
  };
  const rawSlug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : raw.id;
  const resolvedSlug = legacySlugMap[rawSlug] || rawSlug;
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

export function parseStoredImpactLogs(raw: unknown): ImpactLogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ImpactLogEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (
      typeof item.id !== 'string' ||
      typeof item.date !== 'string' ||
      !isOneOf(item.category, IMPACT_CATEGORIES) ||
      title.length < 1 ||
      title.length > 140 ||
      typeof item.emissionsAvoidedGrams !== 'number' ||
      !Number.isFinite(item.emissionsAvoidedGrams) ||
      item.emissionsAvoidedGrams < 0 ||
      typeof item.fuelSavedLitres !== 'number' ||
      !Number.isFinite(item.fuelSavedLitres) ||
      item.fuelSavedLitres < 0 ||
      !isIntInRange(item.exposureProtectionPoints, 0, 1_000_000) ||
      typeof item.methodologyNote !== 'string' ||
      item.methodologyNote.length > 400
    ) {
      return null;
    }
    if (item.baselineMode !== undefined && !isOneOf(item.baselineMode, BASELINE_MODES)) {
      return null;
    }
    if (item.chosenMode !== undefined && !isOneOf(item.chosenMode, CHOSEN_MODES)) {
      return null;
    }
    if (
      item.distanceKm !== undefined &&
      !isFiniteInRange(item.distanceKm, 0, 500)
    ) {
      return null;
    }
    if (item.assumptions !== undefined && (typeof item.assumptions !== 'string' || item.assumptions.length > 400)) {
      return null;
    }
    if (item.updatedAt !== undefined && typeof item.updatedAt !== 'string') {
      return null;
    }
    out.push({
      id: item.id,
      date: item.date,
      category: item.category,
      title,
      ...(item.baselineMode ? { baselineMode: item.baselineMode } : {}),
      ...(item.chosenMode ? { chosenMode: item.chosenMode } : {}),
      ...(item.distanceKm !== undefined ? { distanceKm: item.distanceKm } : {}),
      emissionsAvoidedGrams: item.emissionsAvoidedGrams,
      fuelSavedLitres: item.fuelSavedLitres,
      exposureProtectionPoints: item.exposureProtectionPoints,
      methodologyNote: item.methodologyNote,
      ...(item.assumptions !== undefined ? { assumptions: item.assumptions } : {}),
      ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
    });
  }
  return out;
}

export function parseStoredStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.every((entry) => typeof entry === 'string') ? raw : null;
}
