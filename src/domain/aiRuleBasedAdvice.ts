import { sanitizeHttpUrl } from './airliveNormalize.ts';
import type {
  AiFallbackReasonCode,
  AiStructuredAdvice,
  AqiCategory,
  FamilyProfile,
  FreshnessStatus,
  MeasurementType,
  PollutantKey,
} from '../types/breathewise.ts';

export type QuestionTopic =
  | 'outdoor_exercise'
  | 'child_play'
  | 'indoor_air'
  | 'pollution_causes'
  | 'commute_transport'
  | 'budget_500'
  | 'daily_routine'
  | 'severe_smog'
  | 'general';

export interface GroundedAirReadingLike {
  location: {
    id: string;
    slug?: string;
    name: string;
    country?: string;
    countryName?: string;
  };
  aqi: {
    value: number | null;
    category: AqiCategory | 'Unavailable';
    modelUsAqi?: number | null;
  };
  pollutants: Array<{
    key: PollutantKey;
    value: number | null;
    unit: 'µg/m³' | 'mg/m³';
  }>;
  provenance: {
    measurementType: MeasurementType | 'ground_station' | 'modeled_forecast';
    sourceLabel?: string;
    stationsUsed?: number | null;
    observedAt: string | null;
    freshnessStatus?: FreshnessStatus;
    attributionUrl?: string;
  };
}

export interface VerifiedAirQualityContext {
  locationName: string;
  aqiSummary: string;
  measuredFacts: string[];
  missingData: string[];
  dataFreshness: string;
  sources: Array<{ name: string; detail: string; url?: string }>;
  confidenceNoteSuffix: string;
}

export function classifyQuestionTopics(question: string): {
  primaryTopic: QuestionTopic;
  includeCommute: boolean;
  includeIndoor: boolean;
  includeBudget: boolean;
  includeOutdoorHabit: boolean;
} {
  const q = question.toLowerCase();

  const isBudget = /budget|₹|rs\.?|rupee|cost|cheap|afford|500/.test(q);
  const isCommute = /transport|metro|bus|car|commute|cycle|walk|drive|carpool|emission|fuel/.test(q);
  const isIndoor = /indoor|room|home|window|ventilat|purifier|cook|kitchen|smoke|dust|hepa|filter/.test(q);
  const isChild = /child|kid|school|playground|play outside|son|daughter|baby|toddler/.test(q);
  const isJog = /jog|run|exercise|workout|gym|sports|cycling|walk outside/.test(q);
  const isCauses = /caus|why|source|inversion|winter|traffic|stubble|pm2\.?5/.test(q);
  const isSmog = /severe smog|emergency|hazardous|very unhealthy|severe pollution/.test(q);
  const isRoutine = /\b(daily routine|routine|schedule|daily plan|whole day|full day|all day)\b/.test(q);

  let primaryTopic: QuestionTopic = 'general';
  if (isBudget) primaryTopic = 'budget_500';
  else if (isChild) primaryTopic = 'child_play';
  else if (isJog) primaryTopic = 'outdoor_exercise';
  else if (isIndoor) primaryTopic = 'indoor_air';
  else if (isCommute) primaryTopic = 'commute_transport';
  else if (isCauses) primaryTopic = 'pollution_causes';
  else if (isSmog) primaryTopic = 'severe_smog';
  else if (isRoutine) primaryTopic = 'daily_routine';

  // Only transmit lifestyle/home slices necessary for the requested answer; omit PII (householdName, updatedAt)
  const broadQuestion =
    primaryTopic === 'general' ||
    primaryTopic === 'daily_routine' ||
    primaryTopic === 'severe_smog';

  return {
    primaryTopic,
    includeCommute: broadQuestion || primaryTopic === 'commute_transport',
    includeIndoor: broadQuestion || primaryTopic === 'indoor_air' || primaryTopic === 'budget_500',
    includeBudget:
      broadQuestion ||
      primaryTopic === 'budget_500' ||
      primaryTopic === 'indoor_air' ||
      primaryTopic === 'commute_transport',
    includeOutdoorHabit:
      broadQuestion || primaryTopic === 'outdoor_exercise' || primaryTopic === 'child_play',
  };
}

export function stripControlChars(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const allowed = code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    if (allowed) {
      out += value[i];
    }
  }
  return out;
}

export function stripUnsafeHtml(value: string): string {
  return stripControlChars(value)
    .replace(/<[^>]*>/g, '')
    .replace(/(?:javascript|vbscript|data):/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeStructuredAdvice(advice: AiStructuredAdvice): AiStructuredAdvice {
  return {
    summary: stripUnsafeHtml(advice.summary),
    currentAirQualityContext: {
      locationName: stripUnsafeHtml(advice.currentAirQualityContext.locationName),
      aqiSummary: stripUnsafeHtml(advice.currentAirQualityContext.aqiSummary),
      measuredFacts: advice.currentAirQualityContext.measuredFacts.map(stripUnsafeHtml),
      missingData: advice.currentAirQualityContext.missingData.map(stripUnsafeHtml),
    },
    recommendations: advice.recommendations.map((rec) => ({
      title: stripUnsafeHtml(rec.title),
      action: stripUnsafeHtml(rec.action),
      outcomeCategory: rec.outcomeCategory,
      outcomeLabel: stripUnsafeHtml(rec.outcomeLabel),
      estimatedCostOrBudgetNote: stripUnsafeHtml(rec.estimatedCostOrBudgetNote),
    })),
    explanation: stripUnsafeHtml(advice.explanation),
    precautions: advice.precautions.map(stripUnsafeHtml),
    confidenceAndLimitations: {
      confidenceLevel: advice.confidenceAndLimitations.confidenceLevel,
      notes: stripUnsafeHtml(advice.confidenceAndLimitations.notes),
    },
    sources: advice.sources.map((src) => {
      const safeUrl = sanitizeHttpUrl(stripUnsafeHtml(src.url ?? ''));
      return {
        name: stripUnsafeHtml(src.name),
        detail: stripUnsafeHtml(src.detail),
        ...(safeUrl ? { url: safeUrl } : {}),
      };
    }),
    dataFreshness: stripUnsafeHtml(advice.dataFreshness),
  };
}

function buildUnavailableAirQualityContext(
  unavailableReason: string | null,
  requestedLocation: string,
): VerifiedAirQualityContext {
  return {
    locationName: requestedLocation,
    aqiSummary: 'Live US AQI unavailable (provider unreachable or location missing)',
    measuredFacts: [
      `No live AQI or pollutant measurements could be retrieved for "${requestedLocation}".`,
    ],
    missingData: [
      'Live US AQI reading',
      'PM2.5 concentration',
      'Station-level gases (NO2, SO2, O3, CO) and PM10',
    ],
    dataFreshness: `Unavailable (${unavailableReason ?? 'Live AirLive reading could not be loaded'})`,
    sources: [
      {
        name: 'AirLive (status check attempted)',
        detail: unavailableReason ?? 'Live feed temporarily unavailable',
        url: 'https://airlive.tracsa.co.in',
      },
      {
        name: 'WHO & US EPA Public Health Guidance',
        detail: 'General respiratory & particulate exposure precautions',
      },
    ],
    confidenceNoteSuffix:
      'Live measurements are unavailable right now, so numbers are not reported and recommendations rely on general protective guidance.',
  };
}

function formatSourceDetail(reading: GroundedAirReadingLike): string {
  if (reading.provenance.measurementType === 'preview_fixture') {
    return 'Preview Fixture (labeled fallback dataset, not live telemetry)';
  }
  if (reading.provenance.measurementType === 'ground_station') {
    const stationsCount = reading.provenance.stationsUsed ?? 'unknown count';
    return `Ground Stations (${stationsCount} station(s) aggregated)`;
  }
  return 'Atmospheric Model (model-based estimate; no direct local ground station reading)';
}

function formatFreshnessText(
  freshnessStatus: FreshnessStatus,
  observedAt: string | null,
): string {
  if (freshnessStatus === 'fresh') {
    return `Fresh (updated ${observedAt ?? 'recently'})`;
  }
  if (freshnessStatus === 'stale') {
    return `Stale (>3h old: ${observedAt ?? 'unknown time'})`;
  }
  return 'Timestamp unavailable (freshness unverified)';
}

function buildConfidenceNoteSuffix(
  measurementType: GroundedAirReadingLike['provenance']['measurementType'],
  freshnessStatus: FreshnessStatus,
): string {
  if (measurementType === 'preview_fixture') {
    return 'Currently anchored to the labeled preview fixture rather than live telemetry.';
  }
  if (measurementType === 'modeled_forecast') {
    return 'Reading relies on an atmospheric model rather than local ground monitors; local street-level smoke or dust can differ.';
  }
  if (freshnessStatus !== 'fresh') {
    return 'Observation timestamp is stale or unavailable, so current conditions may have shifted.';
  }
  return 'AirLive ground station telemetry is recent, though trace gases (NO2, SO2, O3, CO) are not included in this feed.';
}

export function buildVerifiedAirQualityContext(
  reading: GroundedAirReadingLike | null,
  unavailableReason: string | null,
  requestedLocation: string,
): VerifiedAirQualityContext {
  if (!reading) {
    return buildUnavailableAirQualityContext(unavailableReason, requestedLocation);
  }

  const pm25 = reading.pollutants.find((p) => p.key === 'pm25');
  const pm25Fact =
    pm25 && pm25.value !== null
      ? `PM2.5: ${pm25.value} ${pm25.unit} (WHO 24h guideline: 15 µg/m³)`
      : 'PM2.5: Unavailable in current payload';

  const sourceDetail = formatSourceDetail(reading);
  const locationDisplay = reading.location.countryName
    ? `${reading.location.name}, ${reading.location.countryName}`
    : reading.location.name;

  const missingData: string[] = [];
  if (reading.aqi.value === null) missingData.push('Numeric US AQI value');
  if (!pm25 || pm25.value === null) missingData.push('PM2.5 concentration');
  missingData.push('PM10 and trace gases (NO2, SO2, O3, CO) are not emitted by this AirLive endpoint');

  const freshnessStatus = reading.provenance.freshnessStatus ?? 'unavailable';
  const sourceName =
    reading.provenance.measurementType === 'preview_fixture'
      ? 'BreatheWise Preview Fixture'
      : 'AirLive';

  const measuredFacts = [
    `US EPA AQI (0–500): ${reading.aqi.value !== null ? reading.aqi.value : 'Unavailable'} (${reading.aqi.category})`,
    pm25Fact,
    `Source type: ${sourceDetail}`,
  ];
  if (typeof reading.aqi.modelUsAqi === 'number') {
    measuredFacts.push(`Model baseline reference: US AQI ${reading.aqi.modelUsAqi}`);
  }

  return {
    locationName: locationDisplay,
    aqiSummary:
      reading.aqi.value !== null
        ? `US AQI ${reading.aqi.value} (${reading.aqi.category}) · ${sourceDetail}`
        : `US AQI unavailable (${reading.aqi.category})`,
    measuredFacts,
    missingData,
    dataFreshness: formatFreshnessText(freshnessStatus, reading.provenance.observedAt),
    sources: [
      {
        name: sourceName,
        detail: sourceDetail,
        url: reading.provenance.attributionUrl ?? 'https://airlive.tracsa.co.in',
      },
      {
        name: 'US EPA AQI & WHO Air Quality Guidelines',
        detail: 'Health category thresholds and particulate exposure guidance',
      },
    ],
    confidenceNoteSuffix: buildConfidenceNoteSuffix(
      reading.provenance.measurementType,
      freshnessStatus,
    ),
  };
}

export function formatFallbackNotice(reasonCode: AiFallbackReasonCode): string {
  switch (reasonCode) {
    case 'MISSING_API_KEY':
      return 'Gemini AI is unavailable because GEMINI_API_KEY is not configured on the server. Showing deterministic rule-based AQI guidance instead (not generated by Gemini).';
    case 'QUOTA_EXHAUSTED':
      return 'Gemini AI is temporarily unavailable due to API quota exhaustion (HTTP 429). Showing deterministic rule-based AQI guidance instead (not generated by Gemini).';
    case 'TIMEOUT':
      return 'Gemini AI is temporarily unavailable because the request timed out. Showing deterministic rule-based AQI guidance instead (not generated by Gemini).';
    case 'MALFORMED_AI_RESPONSE':
      return 'Gemini AI returned an unvalidated or malformed response format. Showing deterministic rule-based AQI guidance instead (not generated by Gemini).';
    case 'UPSTREAM_ERROR':
      return 'Gemini AI is temporarily unavailable due to an upstream service error. Showing deterministic rule-based AQI guidance instead (not generated by Gemini).';
  }
}

function hasSensitiveHouseholdMember(profile: FamilyProfile): boolean {
  return (
    profile.members.children > 0 ||
    profile.members.seniors > 0 ||
    profile.sensitivities.hasAsthmaOrRespiratory ||
    profile.sensitivities.hasHeartCondition ||
    profile.sensitivities.hasPregnantMember
  );
}

function buildFallbackSummary(params: {
  locationName: string;
  aqi: number | null;
  category: AqiCategory | 'Unavailable' | undefined;
  pm25Val: number | null;
  primaryTopic: QuestionTopic;
  hasSensitive: boolean;
}): string {
  const { locationName, aqi, category, pm25Val, primaryTopic, hasSensitive } = params;
  const pmSuffix = pm25Val !== null ? `, PM2.5 ${pm25Val} µg/m³` : '';

  if (aqi === null) {
    return `Live AQI data for ${locationName} is currently unavailable, so exact outdoor risk cannot be scored. Prioritize low-exertion precautions if hazy conditions or smoke are visible, and check back once AirLive telemetry updates.`;
  }
  if (primaryTopic === 'budget_500') {
    return `At ${locationName} US AQI ${aqi} (${category}), a ₹500/month budget is best spent on high-impact personal exposure and indoor dust controls—reusable NIOSH N95 masks, wet mopping, and door-gap sealing—rather than expensive purifiers.`;
  }
  if (primaryTopic === 'pollution_causes') {
    return `${locationName} shows US AQI ${aqi} (${category}${pmSuffix}). AirLive reports particulate levels rather than source-apportionment, though urban winter spikes typically combine vehicle exhaust, construction dust, biomass/waste burning, and cool-air temperature inversions.`;
  }
  if (aqi >= 201) {
    return `Do not exercise or let children or seniors stay outdoors in ${locationName} right now: live US AQI is ${aqi} (${category}${pmSuffix}). Keep activity indoors and wear a well-fitted N95/FFP2 mask for unavoidable trips.`;
  }
  if (aqi >= 151) {
    const groupText = hasSensitive
      ? 'children, seniors, or respiratory sensitivities in your household'
      : 'sensitive individuals';
    return `Conditions in ${locationName} are ${category} (US AQI ${aqi}). Avoid vigorous outdoor jogging or prolonged play, especially with ${groupText}, and move workouts indoors.`;
  }
  if (aqi >= 51) {
    const modText = hasSensitive
      ? 'children, seniors, and sensitive household members should reduce exertion and watch for irritation'
      : 'prolonged heavy exertion near busy roads should be shortened';
    return `${locationName} is at US AQI ${aqi} (${category}). Brief outdoor activity may be tolerated by healthy adults, but ${modText}.`;
  }
  return `${locationName} is currently Good at US AQI ${aqi}. Normal outdoor walking, jogging, and brief window cross-ventilation are generally suitable today while keeping routine smoke controls indoors.`;
}

function buildOutdoorRecommendation(
  aqi: number | null,
): AiStructuredAdvice['recommendations'][number] {
  const highRisk = aqi !== null && aqi >= 151;
  let action =
    'Prefer midday or afternoon hours over early-morning/late-evening rush hour near traffic corridors, and pause outdoor activity if coughing or breathlessness occurs.';

  if (aqi === null) {
    action =
      'Without a live AQI reading, avoid vigorous outdoor exercise if visibility is hazy or smoke is noticeable, and wear a well-fitted N95 mask near heavy traffic.';
  } else if (highRisk) {
    action = `Move walking, jogging, and children's play indoors today (US AQI ${aqi}). If stepping outside for essentials, wear a sealed N95/KN95/FFP2 respirator rather than a cloth mask.`;
  }

  return {
    title: highRisk ? 'Pause outdoor jogging & play' : 'Time outdoor activity safely',
    action,
    outcomeCategory: 'reduce_personal_exposure',
    outcomeLabel: 'Reduces Personal Exposure',
    estimatedCostOrBudgetNote: '₹0 (schedule shift) or ~₹80–₹150 per reusable N95 mask',
  };
}

function buildIndoorRecommendation(
  profile: FamilyProfile,
  aqi: number | null,
  primaryTopic: QuestionTopic,
): AiStructuredAdvice['recommendations'][number] {
  const highRisk = aqi !== null && aqi >= 151;
  const { homeEnvironment } = profile;
  const title =
    primaryTopic === 'budget_500'
      ? 'High-impact ₹500/month indoor air steps'
      : 'Control indoor dust & cooking smoke';

  const action = homeEnvironment.hasAirPurifier
    ? `Keep windows closed during ${highRisk ? 'high-smog hours' : 'rush hours'}, run your HEPA purifier inside your ${homeEnvironment.roomAreaSqFt} sq ft primary room on medium/high, wet-mop floors daily, and use kitchen exhaust while cooking.`
    : `Wet-mop floors instead of dry sweeping, keep exterior door/window gaps sealed with inexpensive foam weather-stripping (~₹150–₹250), run kitchen exhaust during ${homeEnvironment.cookingFuel.toUpperCase()} cooking, and avoid incense or indoor smoke.`;

  const budgetNote =
    homeEnvironment.budgetTier === 'low' || primaryTopic === 'budget_500'
      ? 'Fits ₹500/month (wet mopping ₹0 + door seal tape/masks ~₹300–₹450)'
      : '₹0–₹500/month maintenance; HEPA purifier optional for enclosed room';

  return {
    title,
    action,
    outcomeCategory: 'improve_indoor_air',
    outcomeLabel: 'Improves Indoor Air Conditions',
    estimatedCostOrBudgetNote: budgetNote,
  };
}

function buildCommuteRecommendation(
  profile: FamilyProfile,
): AiStructuredAdvice['recommendations'][number] {
  const { primaryCommute, dailyCommuteKm } = profile.lifestyle;
  const motorised =
    primaryCommute === 'petrol_car' ||
    primaryCommute === 'diesel_car' ||
    primaryCommute === 'two_wheeler';
  const commuteLabel = primaryCommute.replace(/_/g, ' ');

  const action = motorised
    ? `Switching your ${dailyCommuteKm} km/day ${commuteLabel} commute to Metro rail, public bus, or carpool reduces personal transport emissions and fuel spend. Note: an individual commute shift lowers your household footprint, not city-wide AQI directly.`
    : `Continue using lower-emission transit (${commuteLabel}) and combine errands into single trips; individual choices cut personal emissions even though city AQI reflects regional sources.`;

  return {
    title: 'Shift high-emission trips where feasible',
    action,
    outcomeCategory: 'reduce_personal_emissions',
    outcomeLabel: 'Reduces Personal Emissions',
    estimatedCostOrBudgetNote: 'Often reduces monthly fuel spend vs. private vehicle trips',
  };
}

function buildFallbackPrecautions(
  profile: FamilyProfile,
  reading: GroundedAirReadingLike | null,
): string[] {
  const precautions = [
    'This guidance is informational and does not diagnose medical conditions or guarantee illness prevention.',
  ];
  if (profile.sensitivities.hasAsthmaOrRespiratory) {
    precautions.push(
      'Keep prescribed rescue inhalers and medications within reach and seek medical care for wheezing or shortness of breath.',
    );
  }
  if (profile.members.seniors > 0 || profile.members.children > 0) {
    precautions.push(
      'Monitor children and seniors closely for throat irritation, coughing, or unusual fatigue during polluted periods.',
    );
  }
  if (reading?.provenance.freshnessStatus !== 'fresh') {
    precautions.push(
      'Because live timestamp freshness is stale or unverified, corroborate with local visibility and official advisories before outdoor plans.',
    );
  }
  return precautions;
}

function resolveFallbackConfidenceLevel(
  aqi: number | null,
  reading: GroundedAirReadingLike | null,
): 'low' | 'moderate' | 'high' {
  if (aqi === null) return 'low';
  if (
    reading?.provenance.measurementType !== 'ground_station' ||
    reading?.provenance.freshnessStatus !== 'fresh'
  ) {
    return 'moderate';
  }
  return 'high';
}

export function buildRuleBasedFallbackAdvice(params: {
  question: string;
  reading: GroundedAirReadingLike | null;
  unavailableReason: string | null;
  requestedLocation: string;
  profile: FamilyProfile;
}): AiStructuredAdvice {
  const { question, reading, unavailableReason, requestedLocation, profile } = params;
  const verified = buildVerifiedAirQualityContext(reading, unavailableReason, requestedLocation);
  const topics = classifyQuestionTopics(question);

  const aqi = reading?.aqi.value ?? null;
  const pm25Val = reading?.pollutants.find((p) => p.key === 'pm25')?.value ?? null;
  const hasSensitive = hasSensitiveHouseholdMember(profile);

  const summary = buildFallbackSummary({
    locationName: verified.locationName,
    aqi,
    category: reading?.aqi.category,
    pm25Val,
    primaryTopic: topics.primaryTopic,
    hasSensitive,
  });

  const recommendations: AiStructuredAdvice['recommendations'] = [
    buildOutdoorRecommendation(aqi),
    buildIndoorRecommendation(profile, aqi, topics.primaryTopic),
    buildCommuteRecommendation(profile),
  ];

  const pmNote = pm25Val !== null ? ` at ${pm25Val} µg/m³` : '';
  const explanation =
    aqi === null
      ? `Reducing personal exposure (masks, indoor activity), improving indoor air (wet-mopping, sealing leaks, cooking ventilation), and reducing personal emissions (Metro/bus/carpool) target three separate outcomes. Because live AirLive telemetry for ${verified.locationName} is currently unavailable, this guidance focuses on precautionary routines without fabricating pollutant levels.`
      : `At US AQI ${aqi} (${reading?.aqi.category}), fine particulate matter (PM2.5${pmNote}) penetrates deep into lungs and is not blocked by surgical or cloth masks. Reducing personal exposure protects your household right now, improving indoor air lowers particle buildup inside your ${profile.homeEnvironment.roomAreaSqFt} sq ft living space, and shifting commute mode reduces your personal emissions without claiming single-household impact on city-wide AQI.`;

  return {
    summary,
    currentAirQualityContext: {
      locationName: verified.locationName,
      aqiSummary: verified.aqiSummary,
      measuredFacts: verified.measuredFacts,
      missingData: verified.missingData,
    },
    recommendations,
    explanation,
    precautions: buildFallbackPrecautions(profile, reading),
    confidenceAndLimitations: {
      confidenceLevel: resolveFallbackConfidenceLevel(aqi, reading),
      notes: `Generated by BreatheWise rule-based fallback (Gemini AI unavailable). ${verified.confidenceNoteSuffix}`,
    },
    sources: verified.sources,
    dataFreshness: verified.dataFreshness,
  };
}

export function formatAdviceAsPlainText(advice: AiStructuredAdvice): string {
  const recLines = advice.recommendations.map(
    (r, idx) => `${idx + 1}. [${r.outcomeLabel}] ${r.title}: ${r.action} (${r.estimatedCostOrBudgetNote})`,
  );
  return [
    advice.summary,
    '',
    `Context (${advice.currentAirQualityContext.locationName}): ${advice.currentAirQualityContext.aqiSummary}`,
    ...recLines,
    '',
    advice.explanation,
    '',
    `Precautions: ${advice.precautions.join(' ')}`,
  ].join('\n');
}
