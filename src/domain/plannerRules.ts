import type {
  AirQualityReading,
  AqiScale,
  DailyTimeBlock,
  FamilyProfile,
  HourlyForecastPoint,
  RecommendationItem,
} from '../types/breathewise.ts';
import { calculatePm25UsAqi } from './usAqi.ts';
import {
  buildSlotGuidance,
  resolveConditionTier,
  resolveGuidanceBasis,
  resolveSlotLimitations,
} from './plannerGuidance.ts';

export interface FamilySafetySummary {
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'Severe';
  headline: string;
  vulnerableGroupsCount: number;
  keyConstraints: string[];
}

export type PlannerConditionTier = 'severe' | 'moderate' | 'better' | 'missing_data';

export function hasSensitiveMember(profile: FamilyProfile): boolean {
  return (
    profile.members.children > 0 ||
    profile.members.seniors > 0 ||
    profile.sensitivities.hasAsthmaOrRespiratory ||
    profile.sensitivities.hasHeartCondition ||
    profile.sensitivities.hasPregnantMember
  );
}

export function getPlannerConditionTier(reading: AirQualityReading | null): PlannerConditionTier {
  if (!reading || reading.aqi.value === null) return 'missing_data';
  const aqi = reading.aqi.value;
  if (reading.aqi.scale === 'US_AQI') {
    if (aqi >= 201) return 'severe';
    if (aqi >= 101) return 'moderate';
    return 'better';
  }
  // CPCB NAQI (used in Preview Fixture mode)
  if (aqi >= 301) return 'severe';
  if (aqi >= 101) return 'moderate';
  return 'better';
}

function buildHouseholdConstraints(profile: FamilyProfile): string[] {
  const constraints: string[] = [];
  if (profile.members.children > 0) {
    constraints.push(`${profile.members.children} child(ren): higher breathing rate per body weight`);
  }
  if (profile.members.seniors > 0) {
    constraints.push(`${profile.members.seniors} senior(s): elevated cardiopulmonary sensitivity`);
  }
  if (profile.sensitivities.hasAsthmaOrRespiratory) {
    constraints.push('Asthma/respiratory sensitivity: keep rescue inhaler accessible');
  }
  if (profile.sensitivities.hasOutdoorWorker) {
    constraints.push('Outdoor worker in household: mandatory N95 fit and indoor micro-breaks');
  }
  return constraints;
}

function getUsAqiSafetySummary(
  aqi: number,
  sensitive: boolean,
): Pick<FamilySafetySummary, 'riskLevel' | 'headline'> {
  if (aqi <= 50) {
    return {
      riskLevel: 'Low',
      headline:
        'Good air quality (US AQI 0–50): suitable for normal family outdoor routines and active commuting.',
    };
  }
  if (aqi <= 100) {
    return {
      riskLevel: sensitive ? 'Moderate' : 'Low',
      headline:
        'Moderate air quality (US AQI 51–100): acceptable for most; monitor sensitive members during long outdoor exertion.',
    };
  }
  if (aqi <= 150) {
    return {
      riskLevel: sensitive ? 'Elevated' : 'Moderate',
      headline: sensitive
        ? 'Unhealthy for Sensitive Groups (US AQI 101–150): shorten outdoor play for children, seniors, and asthma-prone members.'
        : 'Unhealthy for Sensitive Groups: reduce prolonged heavy exertion near busy corridors.',
    };
  }
  if (aqi <= 200) {
    return {
      riskLevel: 'Elevated',
      headline:
        'Unhealthy air quality (US AQI 151–200): shift family exercise indoors and wear well-fitted N95 masks during commutes.',
    };
  }
  return {
    riskLevel: 'Severe',
    headline:
      aqi > 300
        ? 'Hazardous air emergency (US AQI 301+): keep children and seniors indoors with sealed windows and clean indoor air.'
        : 'Very Unhealthy smog (US AQI 201–300): avoid outdoor exertion; prioritize enclosed transit and N95 protection.',
  };
}

function getNaqiSafetySummary(
  aqi: number,
  sensitive: boolean,
): Pick<FamilySafetySummary, 'riskLevel' | 'headline'> {
  if (aqi <= 100) {
    return {
      riskLevel: sensitive && aqi > 50 ? 'Moderate' : 'Low',
      headline:
        aqi <= 50
          ? 'Safe for normal family outdoor routines and active commuting.'
          : 'Acceptable for general public; monitor sensitive members during long exertion.',
    };
  }
  if (aqi <= 200) {
    return {
      riskLevel: sensitive ? 'Elevated' : 'Moderate',
      headline: sensitive
        ? 'Limit prolonged outdoor play or morning runs for children, seniors, and asthma-prone members.'
        : 'Moderate pollution: shorten strenuous outdoor workouts near busy roads.',
    };
  }
  if (aqi <= 300) {
    return {
      riskLevel: 'Elevated',
      headline:
        'Poor air quality: move family exercise indoors and use well-fitted N95 masks for commutes.',
    };
  }
  return {
    riskLevel: 'Severe',
    headline:
      aqi > 400
        ? 'Severe smog emergency: keep children and seniors indoors with sealed windows and clean indoor air.'
        : 'Very Poor smog: avoid outdoor exertion; prioritize enclosed transit and N95 protection.',
  };
}

export function getFamilySafetySummary(
  reading: AirQualityReading | null,
  profile: FamilyProfile,
): FamilySafetySummary {
  const sensitive = hasSensitiveMember(profile);
  const vulnerableGroupsCount = profile.members.children + profile.members.seniors;
  const keyConstraints = buildHouseholdConstraints(profile);

  if (!reading || reading.aqi.value === null) {
    return {
      riskLevel: 'Moderate',
      headline:
        'Live AQI measurement is unavailable right now. Use precautionary protection near traffic and avoid assuming any hour is clean without verified readings.',
      vulnerableGroupsCount,
      keyConstraints,
    };
  }

  const band =
    reading.aqi.scale === 'US_AQI'
      ? getUsAqiSafetySummary(reading.aqi.value, sensitive)
      : getNaqiSafetySummary(reading.aqi.value, sensitive);

  return {
    ...band,
    vulnerableGroupsCount,
    keyConstraints,
  };
}

function getRiskTier(
  aqi: number,
  sensitive: boolean,
  scale: AqiScale,
): 'low' | 'moderate' | 'high' | 'severe' {
  if (scale === 'US_AQI') {
    if (aqi > 200 || (sensitive && aqi > 175)) return 'severe';
    if (aqi > 150 || (sensitive && aqi > 100)) return 'high';
    if (aqi > 50) return 'moderate';
    return 'low';
  }
  if (aqi > 300 || (sensitive && aqi > 250)) return 'severe';
  if (aqi > 200 || (sensitive && aqi > 150)) return 'high';
  if (aqi > 100 || (sensitive && aqi > 75)) return 'moderate';
  return 'low';
}

function parseSlotHour(pt: HourlyForecastPoint): number {
  const match = /^(\d{1,2}):\d{2}/.exec(pt.hourLabel.trim());
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return new Date(pt.timestamp).getHours();
}

function getSlotHourlyAverage(
  hourly: HourlyForecastPoint[],
  startHour: number,
  endHour: number,
  scale: AqiScale,
): number | null {
  const slice = hourly.filter((pt) => {
    const hr = parseSlotHour(pt);
    return Number.isFinite(hr) && hr >= startHour && hr < endHour;
  });
  if (slice.length === 0) return null;
  const sum = slice.reduce(
    (acc, p) => acc + (scale === 'US_AQI' ? calculatePm25UsAqi(p.pm25) : p.estimatedNaqi),
    0,
  );
  return Math.round(sum / slice.length);
}

const DAILY_PERIODS: Array<{
  id: string;
  period: DailyTimeBlock['period'];
  label: string;
  timeRange: string;
  startHour: number;
  endHour: number;
}> = [
  { id: 'morning', period: 'morning', label: 'Early Morning & School/Work Start', timeRange: '06:00 – 10:00', startHour: 6, endHour: 10 },
  { id: 'midday', period: 'midday', label: 'Midday Window', timeRange: '12:00 – 16:00', startHour: 12, endHour: 16 },
  { id: 'evening', period: 'evening', label: 'Evening Peak & Return Commute', timeRange: '17:00 – 21:00', startHour: 17, endHour: 21 },
  { id: 'night', period: 'night', label: 'Night Rest & Indoor Recovery', timeRange: '21:00 – 06:00', startHour: 21, endHour: 24 },
];

export function generateDailyPlan(
  reading: AirQualityReading | null,
  hourly: HourlyForecastPoint[],
  profile: FamilyProfile,
): DailyTimeBlock[] {
  const sensitive = hasSensitiveMember(profile);
  const scale: AqiScale = reading?.aqi.scale ?? 'US_AQI';
  const currentAqi = reading?.aqi.value ?? null;

  const slotAverages = DAILY_PERIODS.map((slot) =>
    getSlotHourlyAverage(hourly, slot.startHour, slot.endHour, scale),
  );
  const validSlotAvgs = slotAverages.filter((v): v is number => v !== null);
  const minHourlyAvg = validSlotAvgs.length >= 2 ? Math.min(...validSlotAvgs) : null;

  const scaleLabel = scale === 'US_AQI' ? 'US AQI' : 'NAQI';
  const locationLabel = reading?.location.name ?? 'Selected location';

  return DAILY_PERIODS.map((slot, index) => {
    const slotHourlyAvg = slotAverages[index];
    const hasHourlyEvidence = slotHourlyAvg !== null;
    const expectedNaqi = slotHourlyAvg ?? currentAqi;
    const isVerifiedCleanerWindow =
      hasHourlyEvidence &&
      minHourlyAvg !== null &&
      slotHourlyAvg === minHourlyAvg &&
      validSlotAvgs.some((v) => v - minHourlyAvg >= 15);

    const outdoorRisk: DailyTimeBlock['outdoorRisk'] =
      expectedNaqi === null ? 'unknown' : getRiskTier(expectedNaqi, sensitive, scale);

    const conditionTier = resolveConditionTier(expectedNaqi, outdoorRisk);
    const guidance = buildSlotGuidance({
      outdoorRisk,
      locationLabel,
      scaleLabel,
      expectedNaqi,
      timeRange: slot.timeRange,
      hasHourlyEvidence,
      isVerifiedCleanerWindow,
      sensitive,
      profile,
    });

    return {
      id: slot.id,
      period: slot.period,
      label: slot.label,
      timeRange: slot.timeRange,
      expectedNaqi,
      hasHourlyEvidence,
      conditionTier,
      outdoorRisk,
      ...guidance,
      guidanceBasis: resolveGuidanceBasis({
        reading,
        hasHourlyEvidence,
        scaleLabel,
        expectedNaqi,
        timeRange: slot.timeRange,
      }),
      limitations: resolveSlotLimitations(reading, hasHourlyEvidence),
    };
  });
}

export function getDailyRecommendations(
  reading: AirQualityReading | null,
  profile: FamilyProfile,
): RecommendationItem[] {
  const aqi = reading?.aqi.value ?? null;
  const items: RecommendationItem[] = [];
  const highThreshold = reading?.aqi.scale === 'US_AQI' ? 150 : 200;

  if (aqi === null) {
    items.push({
      id: 'rec-unavailable-pm',
      title: 'Apply precautionary protection while live AQI is unavailable',
      summary: 'Live AQI measurement is missing for this location. Avoid assuming clean hours without evidence and keep N95 masks accessible.',
      category: 'exposure',
      priority: 'high',
      impactType: 'Exposure Reduction',
    });
  } else if (aqi > highThreshold) {
    items.push({
      id: 'rec-mask',
      title: 'Shift outdoor exercise indoors',
      summary: `Current ${reading?.aqi.category} air (${reading?.aqi.scale === 'US_AQI' ? `US AQI ${aqi}` : `NAQI ${aqi}`}) increases fine particle lung deposition during outdoor exertion.`,
      category: 'exposure',
      priority: 'critical',
      impactType: 'Exposure Reduction',
    });
  } else {
    items.push({
      id: 'rec-window',
      title: 'Keep outdoor activity away from heavy-traffic corridors',
      summary: `At ${reading?.aqi.scale === 'US_AQI' ? `US AQI ${aqi}` : `NAQI ${aqi}`}, parks or side streets reduce direct vehicle exhaust exposure compared to main roads.`,
      category: 'exposure',
      priority: 'standard',
      impactType: 'Exposure Reduction',
    });
  }

  if (profile.homeEnvironment.budgetTier === 'low') {
    items.push({
      id: 'rec-wetmop',
      title: 'Wet-mop floors instead of dry sweeping',
      summary: 'Zero-cost dust control prevents settled PM10 and PM2.5 particles from resuspending indoors.',
      category: 'indoor',
      priority: 'high',
      impactType: 'Exposure Reduction',
    });
  } else {
    items.push({
      id: 'rec-purifier',
      title: profile.homeEnvironment.hasAirPurifier
        ? 'Run bedroom HEPA purifier on continuous medium speed'
        : 'Size an H13 True HEPA purifier for sleeping rooms',
      summary: `For a ${profile.homeEnvironment.roomAreaSqFt} sq ft room, aim for continuous 5 ACH filtration with closed windows.`,
      category: 'indoor',
      priority: 'high',
      impactType: 'Exposure Reduction',
    });
  }

  if (profile.lifestyle.primaryCommute === 'petrol_car' || profile.lifestyle.primaryCommute === 'diesel_car') {
    items.push({
      id: 'rec-transit',
      title: 'Replace solo car leg with Metro or carpool',
      summary: `Cutting a ${profile.lifestyle.dailyCommuteKm} km solo drive lowers personal tailpipe CO2e and fuel spend without increasing outdoor inhalation.`,
      category: 'commute',
      priority: 'high',
      impactType: 'Emissions Avoided',
    });
  } else {
    items.push({
      id: 'rec-kitchen',
      title: 'Run kitchen exhaust + lid pots while cooking',
      summary: 'Reduces indoor cooking aerosols and NO2 buildup inside the home.',
      category: 'energy',
      priority: 'standard',
      impactType: 'Exposure Reduction',
    });
  }

  return items;
}
