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

