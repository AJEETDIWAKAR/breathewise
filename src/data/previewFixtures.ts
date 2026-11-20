import { calculatePollutantSubIndex, computeOverallNaqi, getNaqiCategory } from '../domain/naqi';
import type {
  AirQualityReading,
  AppNotification,
  AppSettings,
  FamilyProfile,
  HourlyForecastPoint,
  ImpactLogEntry,
  LocationOption,
} from '../types/breathewise';

export const PRESET_LOCATIONS: LocationOption[] = [
  {
    id: 'delhi',
    slug: 'delhi',
    name: 'Delhi',
    city: 'Delhi',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'city',
    lat: 28.6139,
    lon: 77.209,
  },
  {
    id: 'anand-vihar-delhi',
    slug: 'anand-vihar-delhi',
    name: 'Anand Vihar',
    city: 'Anand Vihar',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'locality',
    lat: 28.6469,
    lon: 77.3164,
  },
  {
    id: 'lucknow',
    slug: 'lucknow',
    name: 'Lucknow',
    city: 'Lucknow',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'city',
    lat: 26.8467,
    lon: 80.9462,
  },
  {
    id: 'patna',
    slug: 'patna',
    name: 'Patna',
    city: 'Patna',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'city',
    lat: 25.5941,
    lon: 85.1376,
  },
  {
    id: 'mumbai',
    slug: 'mumbai',
    name: 'Mumbai',
    city: 'Mumbai',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'city',
    lat: 19.076,
    lon: 72.8777,
  },
  {
    id: 'bengaluru',
    slug: 'bengaluru',
    name: 'Bengaluru',
    city: 'Bengaluru',
    state: 'India',
    country: 'IN',
    countryName: 'India',
    kind: 'city',
    lat: 12.9716,
    lon: 77.5946,
  },
];

interface CityFixtureSpec {
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  o3: number;
  nh3: number;
  curveFactor: number[];
}

const FIXTURE_SPECS: Record<string, CityFixtureSpec> = {
  delhi: {
    pm25: 204,
    pm10: 336,
    no2: 68,
    so2: 16,
    co: 1.9,
    o3: 32,
    nh3: 44,
    curveFactor: [1.15, 1.12, 1.05, 0.92, 0.74, 0.64, 0.61, 0.78, 0.98, 1.14, 1.2, 1.18],
  },
  'anand-vihar-delhi': {
    pm25: 204,
    pm10: 336,
    no2: 68,
    so2: 16,
    co: 1.9,
    o3: 32,
    nh3: 44,
    curveFactor: [1.15, 1.12, 1.05, 0.92, 0.74, 0.64, 0.61, 0.78, 0.98, 1.14, 1.2, 1.18],
  },
  lucknow: {
    pm25: 148,
    pm10: 242,
    no2: 52,
    so2: 14,
    co: 1.5,
    o3: 38,
    nh3: 36,
    curveFactor: [1.12, 1.08, 0.96, 0.85, 0.7, 0.62, 0.65, 0.8, 0.96, 1.08, 1.14, 1.11],
  },
  patna: {
    pm25: 166,
    pm10: 278,
    no2: 49,
    so2: 12,
    co: 1.6,
    o3: 35,
    nh3: 39,
    curveFactor: [1.1, 1.06, 0.95, 0.84, 0.72, 0.66, 0.68, 0.82, 0.99, 1.12, 1.15, 1.1],
  },
  mumbai: {
    pm25: 58,
    pm10: 118,
    no2: 42,
    so2: 11,
    co: 0.9,
    o3: 46,
    nh3: 18,
    curveFactor: [1.05, 1.02, 0.92, 0.86, 0.78, 0.76, 0.8, 0.88, 0.98, 1.04, 1.06, 1.02],
  },
  bengaluru: {
    pm25: 28,
    pm10: 62,
    no2: 29,
    so2: 7,
    co: 0.7,
    o3: 41,
    nh3: 14,
    curveFactor: [1.08, 1.04, 0.94, 0.88, 0.8, 0.78, 0.82, 0.9, 1.0, 1.05, 1.02, 0.98],
  },
};

export function getPreviewFixtureReading(location: LocationOption): AirQualityReading {
  const spec = FIXTURE_SPECS[location.slug] ?? FIXTURE_SPECS.delhi;
  const summary = computeOverallNaqi({
    pm25: spec.pm25,
    pm10: spec.pm10,
    no2: spec.no2,
    so2: spec.so2,
    co: spec.co,
    o3: spec.o3,
    nh3: spec.nh3,
  });

  const referenceIso = '2026-11-18T06:00:00.000Z';

  return {
    location: {
      id: location.id,
      slug: location.slug,
      name: location.name,
      city: location.city,
      state: location.state,
      country: location.country ?? 'IN',
      countryName: location.countryName ?? 'India',
      kind: location.kind ?? 'city',
      lat: location.lat,
      lon: location.lon,
      distanceKm: 1.8,
    },
    aqi: {
      value: summary.value,
      scale: 'INDIA_CPCB_NAQI',
      category: summary.category,
      dominantPollutant: summary.dominantPollutant,
    },
    pollutants: [
      {
        key: 'pm25',
        label: 'PM2.5',
        value: spec.pm25,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('pm25', spec.pm25),
        safeReference: 'CPCB 24h limit: 60 µg/m³',
      },
      {
        key: 'pm10',
        label: 'PM10',
        value: spec.pm10,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('pm10', spec.pm10),
        safeReference: 'CPCB 24h limit: 100 µg/m³',
      },
      {
        key: 'no2',
        label: 'NO2',
        value: spec.no2,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('no2', spec.no2),
        safeReference: 'CPCB 24h limit: 80 µg/m³',
      },
      {
        key: 'o3',
        label: 'O3',
        value: spec.o3,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('o3', spec.o3),
        safeReference: 'CPCB 8h limit: 100 µg/m³',
      },
      {
        key: 'co',
        label: 'CO',
        value: spec.co,
        unit: 'mg/m³',
        subIndex: calculatePollutantSubIndex('co', spec.co),
        safeReference: 'CPCB 8h limit: 2.0 mg/m³',
      },
      {
        key: 'so2',
        label: 'SO2',
        value: spec.so2,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('so2', spec.so2),
        safeReference: 'CPCB 24h limit: 80 µg/m³',
      },
      {
        key: 'nh3',
        label: 'NH3',
        value: spec.nh3,
        unit: 'µg/m³',
        subIndex: calculatePollutantSubIndex('nh3', spec.nh3),
        safeReference: 'CPCB 24h limit: 400 µg/m³',
      },
    ],
    provenance: {
      providerId: 'preview_fixture',
      providerName: 'Preview Fixture (Simulated Reference)',
      stationName: `${location.name} Reference Sample`,
      measurementType: 'preview_fixture',
      sourceLabel: 'Preview Fixture',
      stationsUsed: null,
      observedAt: referenceIso,
      fetchedAt: referenceIso,
      isStale: false,
      freshnessStatus: 'fresh',
      attribution:
        'Preview Fixture for UI demonstration only — strictly separated from live AirLive telemetry.',
    },
  };
}

export function getPreviewFixtureForecast(location: LocationOption): HourlyForecastPoint[] {
  const spec = FIXTURE_SPECS[location.slug] ?? FIXTURE_SPECS.delhi;
  const hours = ['02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:59'];
  const baseDate = '2026-11-18';

  return hours.map((hr, idx) => {
    const factor = spec.curveFactor[idx] ?? 1;
    const pm25 = Math.round(spec.pm25 * factor);
    const pm10 = Math.round(spec.pm10 * factor);
    const estimatedNaqi = Math.max(
      calculatePollutantSubIndex('pm25', pm25),
      calculatePollutantSubIndex('pm10', pm10),
    );
    return {
      hourLabel: hr,
      timestamp: `${baseDate}T${hr === '23:59' ? '23:00' : hr}:00.000Z`,
      pm25,
      pm10,
      estimatedNaqi,
      scale: 'INDIA_CPCB_NAQI',
      category: getNaqiCategory(estimatedNaqi),
    };
  });
}

export const DEFAULT_FAMILY_PROFILE: FamilyProfile = {
  version: 1,
  householdName: 'Sharma Household',
  members: {
    adults: 2,
    children: 1,
    seniors: 1,
  },
  sensitivities: {
    hasAsthmaOrRespiratory: true,
    hasHeartCondition: false,
    hasPregnantMember: false,
    hasOutdoorWorker: false,
  },
  lifestyle: {
    primaryCommute: 'petrol_car',
    dailyCommuteKm: 18,
    preferredOutdoorActivity: 'walking',
    outdoorExerciseTime: 'early_morning',
    workSchedule: 'morning_evening_commute',
    schoolSchedule: 'morning_afternoon',
  },
  homeEnvironment: {
    budgetTier: 'moderate',
    cookingFuel: 'lpg',
    hasAirPurifier: false,
    roomAreaSqFt: 160,
    housingType: 'apartment_sealed',
    kitchenExhaust: 'window_only',
  },
  updatedAt: '2026-11-18T06:00:00.000Z',
};

export const ANONYMOUS_MINIMAL_PROFILE: FamilyProfile = {
  version: 1,
  householdName: 'My Household',
  members: {
    adults: 1,
    children: 0,
    seniors: 0,
  },
  sensitivities: {
    hasAsthmaOrRespiratory: false,
    hasHeartCondition: false,
    hasPregnantMember: false,
    hasOutdoorWorker: false,
  },
  lifestyle: {
    primaryCommute: 'work_from_home',
    dailyCommuteKm: 0,
    preferredOutdoorActivity: 'walking',
    outdoorExerciseTime: 'midday',
    workSchedule: 'flexible_hybrid',
    schoolSchedule: 'online_or_none',
  },
  homeEnvironment: {
    budgetTier: 'low',
    cookingFuel: 'lpg',
    hasAirPurifier: false,
    roomAreaSqFt: 150,
    housingType: 'apartment_sealed',
    kitchenExhaust: 'window_only',
  },
  updatedAt: '2026-11-18T06:00:00.000Z',
};

export const DEFAULT_PREVIEW_IMPACT_LOGS: ImpactLogEntry[] = [
  {
    id: 'preview-log-1',
    date: '2026-11-17',
    category: 'transport_shift',
    title: 'Took Metro instead of Petrol Car (18 km round trip)',
    baselineMode: 'petrol_car',
    chosenMode: 'metro_rail',
    distanceKm: 18,
    emissionsAvoidedGrams: 1890,
    fuelSavedLitres: 1.29,
    exposureProtectionPoints: 0,
    methodologyNote: 'Preview fixture: (140 - 35 g CO2e/pkm) × 18 km; fuel displaced at 14 km/L',
    assumptions: 'Petrol car 140 g/pkm (14 km/L) displaced by Metro 35 g/pkm over 18 km.',
  },
  {
    id: 'preview-log-2',
    date: '2026-11-17',
    category: 'exposure_protection',
    title: 'Wet-mopped living room & paused evening outdoor play',
    emissionsAvoidedGrams: 0,
    fuelSavedLitres: 0,
    exposureProtectionPoints: 1,
    methodologyNote: 'Exposure protection action only (0 g CO2e claimed)',
    assumptions: 'Protective health habit; counted under Exposure Management rather than emissions.',
  },
];

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-live-ready',
    title: 'AirLive Live Monitoring Connected',
    message: 'BreatheWise fetches live US AQI and PM2.5 readings from AirLive with explicit ground-station vs. atmospheric-model attribution.',
    severity: 'info',
    timestamp: 'Just now',
    read: false,
    targetPage: 'air-quality',
  },
  {
    id: 'notif-smog-advisory',
    title: 'Check Today’s Household Daily Plan',
    message: 'Review outdoor safety windows, mask guidance, and indoor air actions tailored to your household.',
    severity: 'warning',
    timestamp: '15m ago',
    read: false,
    targetPage: 'planner',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  preferredUnit: 'aqi',
  enableThresholdAlerts: true,
  dataModePreference: 'live',
};
