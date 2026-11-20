import type {
  AirQualityReading,
  AqiScale,
  DailyTimeBlock,
  FamilyProfile,
  HourlyForecastPoint,
  RecommendationItem,
} from '../types/breathewise.ts';
import { calculatePm25UsAqi } from './usAqi.ts';

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

export function getFamilySafetySummary(
  reading: AirQualityReading | null,
  profile: FamilyProfile,
): FamilySafetySummary {
  const sensitive = hasSensitiveMember(profile);
  const vulnerableCount = profile.members.children + profile.members.seniors;
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

  if (!reading || reading.aqi.value === null) {
    return {
      riskLevel: 'Moderate',
      headline:
        'Live AQI measurement is unavailable right now. Use precautionary protection near traffic and avoid assuming any hour is clean without verified readings.',
      vulnerableGroupsCount: vulnerableCount,
      keyConstraints: constraints,
    };
  }

  const aqi = reading.aqi.value;
  const scale = reading.aqi.scale;

  if (scale === 'US_AQI') {
    if (aqi <= 50) {
      return {
        riskLevel: 'Low',
        headline: 'Good air quality (US AQI 0–50): suitable for normal family outdoor routines and active commuting.',
        vulnerableGroupsCount: vulnerableCount,
        keyConstraints: constraints,
      };
    }
    if (aqi <= 100) {
      return {
        riskLevel: sensitive ? 'Moderate' : 'Low',
        headline:
          'Moderate air quality (US AQI 51–100): acceptable for most; monitor sensitive members during long outdoor exertion.',
        vulnerableGroupsCount: vulnerableCount,
        keyConstraints: constraints,
      };
    }
    if (aqi <= 150) {
      return {
        riskLevel: sensitive ? 'Elevated' : 'Moderate',
        headline: sensitive
          ? 'Unhealthy for Sensitive Groups (US AQI 101–150): shorten outdoor play for children, seniors, and asthma-prone members.'
          : 'Unhealthy for Sensitive Groups: reduce prolonged heavy exertion near busy corridors.',
        vulnerableGroupsCount: vulnerableCount,
        keyConstraints: constraints,
      };
    }
    if (aqi <= 200) {
      return {
        riskLevel: 'Elevated',
        headline:
          'Unhealthy air quality (US AQI 151–200): shift family exercise indoors and wear well-fitted N95 masks during commutes.',
        vulnerableGroupsCount: vulnerableCount,
        keyConstraints: constraints,
      };
    }
    return {
      riskLevel: 'Severe',
      headline:
        aqi > 300
          ? 'Hazardous air emergency (US AQI 301+): keep children and seniors indoors with sealed windows and clean indoor air.'
          : 'Very Unhealthy smog (US AQI 201–300): avoid outdoor exertion; prioritize enclosed transit and N95 protection.',
      vulnerableGroupsCount: vulnerableCount,
      keyConstraints: constraints,
    };
  }

  if (aqi <= 100) {
    return {
      riskLevel: sensitive && aqi > 50 ? 'Moderate' : 'Low',
      headline:
        aqi <= 50
          ? 'Safe for normal family outdoor routines and active commuting.'
          : 'Acceptable for general public; monitor sensitive members during long exertion.',
      vulnerableGroupsCount: vulnerableCount,
      keyConstraints: constraints,
    };
  }

  if (aqi <= 200) {
    return {
      riskLevel: sensitive ? 'Elevated' : 'Moderate',
      headline: sensitive
        ? 'Limit prolonged outdoor play or morning runs for children, seniors, and asthma-prone members.'
        : 'Moderate pollution: shorten strenuous outdoor workouts near busy roads.',
      vulnerableGroupsCount: vulnerableCount,
      keyConstraints: constraints,
    };
  }

  if (aqi <= 300) {
    return {
      riskLevel: 'Elevated',
      headline:
        'Poor air quality: move family exercise indoors and use well-fitted N95 masks for commutes.',
      vulnerableGroupsCount: vulnerableCount,
      keyConstraints: constraints,
    };
  }

  return {
    riskLevel: 'Severe',
    headline:
      aqi > 400
        ? 'Severe smog emergency: keep children and seniors indoors with sealed windows and clean indoor air.'
        : 'Very Poor smog: avoid outdoor exertion; prioritize enclosed transit and N95 protection.',
    vulnerableGroupsCount: vulnerableCount,
    keyConstraints: constraints,
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

export function generateDailyPlan(
  reading: AirQualityReading | null,
  hourly: HourlyForecastPoint[],
  profile: FamilyProfile,
): DailyTimeBlock[] {
  const sensitive = hasSensitiveMember(profile);
  const scale: AqiScale = reading?.aqi.scale ?? 'US_AQI';
  const currentAqi = reading?.aqi.value ?? null;

  const periods: Array<{
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

  // Check if hourly data actually identifies a cleaner slot (never assume without evidence)
  const slotAverages = periods.map((slot) =>
    getSlotHourlyAverage(hourly, slot.startHour, slot.endHour, scale),
  );
  const validSlotAvgs = slotAverages.filter((v): v is number => v !== null);
  const minHourlyAvg = validSlotAvgs.length >= 2 ? Math.min(...validSlotAvgs) : null;

  const scaleLabel = scale === 'US_AQI' ? 'US AQI' : 'NAQI';
  const locationLabel = reading?.location.name ?? 'Selected location';

  return periods.map((slot, index) => {
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

    const conditionTier: DailyTimeBlock['conditionTier'] =
      expectedNaqi === null
        ? 'missing_data'
        : outdoorRisk === 'severe'
          ? 'severe'
          : outdoorRisk === 'high' || outdoorRisk === 'moderate'
            ? 'moderate'
            : 'better';

    let recommendedActivity = '';
    let saferAlternative = '';
    let maskGuidance = '';
    let ventilationAction = '';
    let commuteNote = '';
    let reason = '';
    let expectedBenefit = '';

    const activityPref = profile.lifestyle.preferredOutdoorActivity.replace(/_/g, ' ');
    const schoolNote =
      profile.members.children > 0 && profile.lifestyle.schoolSchedule === 'morning_afternoon'
        ? ' Coordinate school drop-off/pickup with enclosed transit and avoid outdoor assembly/sports when AQI is elevated.'
        : '';
    const workNote =
      profile.lifestyle.workSchedule === 'flexible_hybrid'
        ? ' Consider remote work or shifting office trips outside peak traffic.'
        : profile.lifestyle.workSchedule === 'home_based'
          ? ' Home-based schedule avoids peak roadside commute exposure.'
          : '';

    if (outdoorRisk === 'unknown') {
      recommendedActivity = `Live AQI data is unavailable for ${locationLabel}; postpone strenuous outdoor ${activityPref} if visible haze, smoke, or eye/throat irritation is present.`;
      saferAlternative = 'Keep structured movement indoors (stretching, hallway walking) until a live reading is confirmed.';
      maskGuidance = 'Carry a fitted N95/FFP2 mask for traffic corridors as a precaution.';
      ventilationAction = 'Do not assume this hour is cleaner outdoors; ventilate briefly only if indoor smoke/cooking odors build up and outdoor air looks clear.';
      commuteNote = `Use enclosed transit where possible for your ${profile.lifestyle.dailyCommuteKm} km routine.${workNote}${schoolNote}`;
      reason = 'Live AQI telemetry and verified hourly data are currently missing, so outdoor particulate concentration is unknown.';
      expectedBenefit = 'Avoids unmeasured respiratory exposure if local smog levels are elevated.';
    } else if (outdoorRisk === 'low') {
      recommendedActivity = `Suitable for normal ${activityPref} and outdoor errands away from busy arterial roads.${schoolNote}`;
      saferAlternative = 'Choose parks or residential lanes at least 100m away from heavy diesel traffic.';
      maskGuidance = 'No mask required for most people; sensitive members may carry an N95 near dense traffic.';
      ventilationAction = hasHourlyEvidence
        ? 'Cross-ventilate for 20–30 minutes while outdoor AQI remains low and wind dispersion is active.'
        : 'Brief ventilation is suitable based on current low reading, though hourly curve is unavailable.';
      commuteNote = `Walking, cycling, Metro, or public bus are all low-risk options today.${workNote}`;
      reason = `Current/slot ${scaleLabel} (${expectedNaqi}) falls in the Good/Low-risk range for your household profile.`;
      expectedBenefit = 'Maintains active outdoor fitness and indoor CO2/humidity dilution with low particulate burden.';
    } else if (outdoorRisk === 'moderate') {
      recommendedActivity = sensitive
        ? `Keep outdoor ${activityPref} brief (under 25–30 minutes) at low exertion; skip roadside workouts.${schoolNote}`
        : `Moderate outdoor tasks OK; shorten intense cardio near busy roads.${schoolNote}`;
      saferAlternative = isVerifiedCleanerWindow
        ? `If outdoor time is planned, hourly trajectory shows ${slot.timeRange} is the relatively lower-PM2.5 slot (${scaleLabel} ~${expectedNaqi}); otherwise exercise indoors.`
        : 'Move vigorous workouts indoors rather than assuming a cleaner outdoor hour without evidence.';
      maskGuidance = sensitive ? 'N95 mask advised near traffic' : 'Optional N95 for heavy-traffic commutes';
      ventilationAction = isVerifiedCleanerWindow
        ? 'Brief 10–15 minute cross-ventilation can help clear indoor CO2/cooking buildup during this relatively lower slot.'
        : 'Keep windows mostly closed near roads; use kitchen exhaust while cooking.';
      commuteNote =
        profile.lifestyle.primaryCommute === 'two_wheeler'
          ? `Wear a snug N95 under helmet for your ${profile.lifestyle.dailyCommuteKm} km ride.${workNote}`
          : `Prefer enclosed Metro or AC bus over open-window rides.${workNote}`;
      reason = `${scaleLabel} ~${expectedNaqi} can irritate airways in sensitive groups (${profile.members.children} children, ${profile.members.seniors} seniors).`;
      expectedBenefit = 'Lowers deep-lung PM2.5 deposition during moderate pollution without halting essential routines.';
    } else if (outdoorRisk === 'high') {
      recommendedActivity = `Cancel outdoor jogging, sports, and prolonged playground play; keep trips essential only.${schoolNote}`;
      saferAlternative = '25-minute indoor mobility routine, yoga, or indoor play inside a dust-controlled room.';
      maskGuidance = 'Well-fitted N95 / KN95 / FFP2 recommended outdoors';
      ventilationAction = 'Keep exterior windows closed; run kitchen exhaust during cooking and wet-mop floors.';
      commuteNote =
        profile.lifestyle.primaryCommute === 'walk_cycle'
          ? 'Pause long cycling/walking commutes today; switch to enclosed Metro/bus to reduce inhaled particles.'
          : `Prefer Metro or enclosed transit; enable cabin recirculation if driving.${workNote}`;
      reason = `High pollution (${scaleLabel} ~${expectedNaqi}) increases airway inflammation and breathing rate multiplies inhaled dose during exercise.`;
      expectedBenefit = 'Substantially reduces daily fine-particulate inhalation for sensitive household members.';
    } else {
      recommendedActivity = `Keep children, seniors, and sensitive members strictly indoors; avoid outdoor ${activityPref}.${schoolNote}`;
      saferAlternative = 'Indoor stretching, reading, and low-dust indoor activities in your primary room.';
      maskGuidance = 'Certified N95/FFP2 essential for any unavoidable outdoor step';
      ventilationAction = 'Seal loose window/door gaps; run HEPA purifier (or DIY MERV-13 fan filter) if available and avoid indoor smoke.';
      commuteNote =
        profile.sensitivities.hasOutdoorWorker
          ? 'Outdoor worker: take clean-air indoor breaks every 90 minutes and replace damp/clogged N95 masks.'
          : `Work remotely or consolidate trips via enclosed Metro/cab if urgent.${workNote}`;
      reason = `Severe smog (${scaleLabel} ~${expectedNaqi}) poses acute respiratory and cardiovascular stress across all age groups.`;
      expectedBenefit = 'Minimizes peak smog inhalation during high-concentration periods.';
    }

    const guidanceBasis =
      reading === null
        ? 'No live AirLive reading or hourly trajectory available; precautionary WHO/public-health exposure principles applied.'
        : hasHourlyEvidence
          ? `Based on ${reading.provenance.providerName} (${reading.provenance.sourceLabel ?? reading.provenance.measurementType}) plus 24h hourly curve average (~${scaleLabel} ${expectedNaqi} in ${slot.timeRange}).`
          : `Based solely on latest ${reading.provenance.providerName} reading (${scaleLabel} ${reading.aqi.value}, ${reading.provenance.observedAt ?? 'timestamp unavailable'}). Hourly curve unavailable—no cleaner time window assumed.`;

    const limitations =
      reading === null
        ? 'Cannot quantify local AQI right now; local smoke or traffic plumes may be worse than assumed.'
        : !hasHourlyEvidence
          ? 'Without hourly trajectory data, time-of-day variation is unknown; re-check live AirLive updates before opening windows.'
          : reading.provenance.measurementType === 'modeled_forecast'
            ? 'Hourly trajectory and current estimate rely on atmospheric modeling; hyper-local traffic/burning spikes can differ.'
            : 'Ambient monitors reflect neighborhood averages; indoor cooking smoke and roadside exhaust still require separate control.';

    return {
      id: slot.id,
      period: slot.period,
      label: slot.label,
      timeRange: slot.timeRange,
      expectedNaqi,
      hasHourlyEvidence,
      conditionTier,
      outdoorRisk,
      recommendedActivity,
      saferAlternative,
      maskGuidance,
      ventilationAction,
      commuteNote,
      reason,
      expectedBenefit,
      guidanceBasis,
      limitations,
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
