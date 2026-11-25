import type {
  AirQualityReading,
  DailyTimeBlock,
  FamilyProfile,
} from '../types/breathewise.ts';

export interface SlotGuidanceFields {
  recommendedActivity: string;
  saferAlternative: string;
  maskGuidance: string;
  ventilationAction: string;
  commuteNote: string;
  reason: string;
  expectedBenefit: string;
}

export function resolveConditionTier(
  expectedNaqi: number | null,
  outdoorRisk: DailyTimeBlock['outdoorRisk'],
): DailyTimeBlock['conditionTier'] {
  if (expectedNaqi === null) return 'missing_data';
  if (outdoorRisk === 'severe') return 'severe';
  if (outdoorRisk === 'high' || outdoorRisk === 'moderate') return 'moderate';
  return 'better';
}

export function resolveGuidanceBasis(params: {
  reading: AirQualityReading | null;
  hasHourlyEvidence: boolean;
  scaleLabel: string;
  expectedNaqi: number | null;
  timeRange: string;
}): string {
  const { reading, hasHourlyEvidence, scaleLabel, expectedNaqi, timeRange } = params;
  if (reading === null) {
    return 'No live AirLive reading or hourly trajectory available; precautionary WHO/public-health exposure principles applied.';
  }
  if (hasHourlyEvidence) {
    const sourceText = reading.provenance.sourceLabel ?? reading.provenance.measurementType;
    return `Based on ${reading.provenance.providerName} (${sourceText}) plus 24h hourly curve average (~${scaleLabel} ${expectedNaqi} in ${timeRange}).`;
  }
  return `Based solely on latest ${reading.provenance.providerName} reading (${scaleLabel} ${reading.aqi.value}, ${reading.provenance.observedAt ?? 'timestamp unavailable'}). Hourly curve unavailable—no cleaner time window assumed.`;
}

export function resolveSlotLimitations(
  reading: AirQualityReading | null,
  hasHourlyEvidence: boolean,
): string {
  if (reading === null) {
    return 'Cannot quantify local AQI right now; local smoke or traffic plumes may be worse than assumed.';
  }
  if (!hasHourlyEvidence) {
    return 'Without hourly trajectory data, time-of-day variation is unknown; re-check live AirLive updates before opening windows.';
  }
  if (reading.provenance.measurementType === 'modeled_forecast') {
    return 'Hourly trajectory and current estimate rely on atmospheric modeling; hyper-local traffic/burning spikes can differ.';
  }
  return 'Ambient monitors reflect neighborhood averages; indoor cooking smoke and roadside exhaust still require separate control.';
}

function getWorkScheduleNote(workSchedule: FamilyProfile['lifestyle']['workSchedule']): string {
  if (workSchedule === 'flexible_hybrid') {
    return ' Consider remote work or shifting office trips outside peak traffic.';
  }
  if (workSchedule === 'home_based') {
    return ' Home-based schedule avoids peak roadside commute exposure.';
  }
  return '';
}

function getSchoolScheduleNote(profile: FamilyProfile): string {
  if (profile.members.children > 0 && profile.lifestyle.schoolSchedule === 'morning_afternoon') {
    return ' Coordinate school drop-off/pickup with enclosed transit and avoid outdoor assembly/sports when AQI is elevated.';
  }
  return '';
}

export function buildSlotGuidance(params: {
  outdoorRisk: DailyTimeBlock['outdoorRisk'];
  locationLabel: string;
  scaleLabel: string;
  expectedNaqi: number | null;
  timeRange: string;
  hasHourlyEvidence: boolean;
  isVerifiedCleanerWindow: boolean;
  sensitive: boolean;
  profile: FamilyProfile;
}): SlotGuidanceFields {
  const {
    outdoorRisk,
    locationLabel,
    scaleLabel,
    expectedNaqi,
    timeRange,
    hasHourlyEvidence,
    isVerifiedCleanerWindow,
    sensitive,
    profile,
  } = params;

  const activityPref = profile.lifestyle.preferredOutdoorActivity.replace(/_/g, ' ');
  const schoolNote = getSchoolScheduleNote(profile);
  const workNote = getWorkScheduleNote(profile.lifestyle.workSchedule);

  if (outdoorRisk === 'unknown') {
    return {
      recommendedActivity: `Live AQI data is unavailable for ${locationLabel}; postpone strenuous outdoor ${activityPref} if visible haze, smoke, or eye/throat irritation is present.`,
      saferAlternative: 'Keep structured movement indoors (stretching, hallway walking) until a live reading is confirmed.',
      maskGuidance: 'Carry a fitted N95/FFP2 mask for traffic corridors as a precaution.',
      ventilationAction: 'Do not assume this hour is cleaner outdoors; ventilate briefly only if indoor smoke/cooking odors build up and outdoor air looks clear.',
      commuteNote: `Use enclosed transit where possible for your ${profile.lifestyle.dailyCommuteKm} km routine.${workNote}${schoolNote}`,
      reason: 'Live AQI telemetry and verified hourly data are currently missing, so outdoor particulate concentration is unknown.',
      expectedBenefit: 'Avoids unmeasured respiratory exposure if local smog levels are elevated.',
    };
  }

  if (outdoorRisk === 'low') {
    return {
      recommendedActivity: `Suitable for normal ${activityPref} and outdoor errands away from busy arterial roads.${schoolNote}`,
      saferAlternative: 'Choose parks or residential lanes at least 100m away from heavy diesel traffic.',
      maskGuidance: 'No mask required for most people; sensitive members may carry an N95 near dense traffic.',
      ventilationAction: hasHourlyEvidence
        ? 'Cross-ventilate for 20–30 minutes while outdoor AQI remains low and wind dispersion is active.'
        : 'Brief ventilation is suitable based on current low reading, though hourly curve is unavailable.',
      commuteNote: `Walking, cycling, Metro, or public bus are all low-risk options today.${workNote}`,
      reason: `Current/slot ${scaleLabel} (${expectedNaqi}) falls in the Good/Low-risk range for your household profile.`,
      expectedBenefit: 'Maintains active outdoor fitness and indoor CO2/humidity dilution with low particulate burden.',
    };
  }

  if (outdoorRisk === 'moderate') {
    return {
      recommendedActivity: sensitive
        ? `Keep outdoor ${activityPref} brief (under 25–30 minutes) at low exertion; skip roadside workouts.${schoolNote}`
        : `Moderate outdoor tasks OK; shorten intense cardio near busy roads.${schoolNote}`,
      saferAlternative: isVerifiedCleanerWindow
        ? `If outdoor time is planned, hourly trajectory shows ${timeRange} is the relatively lower-PM2.5 slot (${scaleLabel} ~${expectedNaqi}); otherwise exercise indoors.`
        : 'Move vigorous workouts indoors rather than assuming a cleaner outdoor hour without evidence.',
      maskGuidance: sensitive ? 'N95 mask advised near traffic' : 'Optional N95 for heavy-traffic commutes',
      ventilationAction: isVerifiedCleanerWindow
        ? 'Brief 10–15 minute cross-ventilation can help clear indoor CO2/cooking buildup during this relatively lower slot.'
        : 'Keep windows mostly closed near roads; use kitchen exhaust while cooking.',
      commuteNote:
        profile.lifestyle.primaryCommute === 'two_wheeler'
          ? `Wear a snug N95 under helmet for your ${profile.lifestyle.dailyCommuteKm} km ride.${workNote}`
          : `Prefer enclosed Metro or AC bus over open-window rides.${workNote}`,
      reason: `${scaleLabel} ~${expectedNaqi} can irritate airways in sensitive groups (${profile.members.children} children, ${profile.members.seniors} seniors).`,
      expectedBenefit: 'Lowers deep-lung PM2.5 deposition during moderate pollution without halting essential routines.',
    };
  }

  if (outdoorRisk === 'high') {
    return {
      recommendedActivity: `Cancel outdoor jogging, sports, and prolonged playground play; keep trips essential only.${schoolNote}`,
      saferAlternative: '25-minute indoor mobility routine, yoga, or indoor play inside a dust-controlled room.',
      maskGuidance: 'Well-fitted N95 / KN95 / FFP2 recommended outdoors',
      ventilationAction: 'Keep exterior windows closed; run kitchen exhaust during cooking and wet-mop floors.',
      commuteNote:
        profile.lifestyle.primaryCommute === 'walk_cycle'
          ? 'Pause long cycling/walking commutes today; switch to enclosed Metro/bus to reduce inhaled particles.'
          : `Prefer Metro or enclosed transit; enable cabin recirculation if driving.${workNote}`,
      reason: `High pollution (${scaleLabel} ~${expectedNaqi}) increases airway inflammation and breathing rate multiplies inhaled dose during exercise.`,
      expectedBenefit: 'Substantially reduces daily fine-particulate inhalation for sensitive household members.',
    };
  }

  return {
    recommendedActivity: `Keep children, seniors, and sensitive members strictly indoors; avoid outdoor ${activityPref}.${schoolNote}`,
    saferAlternative: 'Indoor stretching, reading, and low-dust indoor activities in your primary room.',
    maskGuidance: 'Certified N95/FFP2 essential for any unavoidable outdoor step',
    ventilationAction: 'Seal loose window/door gaps; run HEPA purifier (or DIY MERV-13 fan filter) if available and avoid indoor smoke.',
    commuteNote:
      profile.sensitivities.hasOutdoorWorker
        ? 'Outdoor worker: take clean-air indoor breaks every 90 minutes and replace damp/clogged N95 masks.'
        : `Work remotely or consolidate trips via enclosed Metro/cab if urgent.${workNote}`,
    reason: `Severe smog (${scaleLabel} ~${expectedNaqi}) poses acute respiratory and cardiovascular stress across all age groups.`,
    expectedBenefit: 'Minimizes peak smog inhalation during high-concentration periods.',
  };
}
