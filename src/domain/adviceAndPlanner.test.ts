import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAMILY_PROFILE,
  PRESET_LOCATIONS,
  getPreviewFixtureForecast,
  getPreviewFixtureReading,
} from '../data/previewFixtures';
import type { AirQualityReading, FamilyProfile, HourlyForecastPoint } from '../types/breathewise';
import {
  buildRuleBasedFallbackAdvice,
  buildVerifiedAirQualityContext,
  classifyQuestionTopics,
  formatAdviceAsPlainText,
  formatFallbackNotice,
  sanitizeStructuredAdvice,
  stripControlChars,
  stripUnsafeHtml,
  type GroundedAirReadingLike,
} from './aiRuleBasedAdvice';
import {
  calculateCadr,
  findBestVentilationWindow,
  generateTailoredIndoorGuide,
} from './indoorRules';
import {
  generateDailyPlan,
  getDailyRecommendations,
  getFamilySafetySummary,
  getPlannerConditionTier,
} from './plannerRules';
import { resolveConditionTier, resolveGuidanceBasis, resolveSlotLimitations } from './plannerGuidance';
import { getPersonalizedSustainableAlternatives } from './sustainableRules';

function makeGroundedReading(overrides: Partial<GroundedAirReadingLike> = {}): GroundedAirReadingLike {
  return {
    location: {
      id: 'delhi',
      slug: 'delhi',
      name: 'Delhi',
      country: 'IN',
      countryName: 'India',
    },
    aqi: {
      value: 215,
      category: 'Very Unhealthy',
      modelUsAqi: 198,
    },
    pollutants: [{ key: 'pm25', value: 145.2, unit: 'µg/m³' }],
    provenance: {
      measurementType: 'ground_station',
      sourceLabel: 'Ground Stations',
      stationsUsed: 4,
      observedAt: '2026-01-15T10:00:00Z',
      freshnessStatus: 'fresh',
      attributionUrl: 'https://airlive.tracsa.co.in',
    },
    ...overrides,
  };
}

function makeClientReading(
  aqiValue: number | null,
  scale: AirQualityReading['aqi']['scale'] = 'US_AQI',
  category: AirQualityReading['aqi']['category'] = 'Unhealthy',
): AirQualityReading {
  const previewDelhi = getPreviewFixtureReading(PRESET_LOCATIONS[0]);
  return {
    ...previewDelhi,
    aqi: {
      value: aqiValue,
      scale,
      category,
      dominantPollutant: 'PM2.5',
    },
    provenance: {
      ...previewDelhi.provenance,
      providerId: 'airlive',
      providerName: 'AirLive',
      measurementType: 'ground_station',
      freshnessStatus: 'fresh',
    },
  };
}

describe('aiRuleBasedAdvice domain branches', () => {
  it('classifies all question topics and data-minimization flags', () => {
    expect(classifyQuestionTopics('Best ₹500 budget actions?')).toMatchObject({
      primaryTopic: 'budget_500',
      includeBudget: true,
      includeIndoor: true,
      includeCommute: false,
    });
    expect(classifyQuestionTopics('Can my child play outside after school?')).toMatchObject({
      primaryTopic: 'child_play',
      includeOutdoorHabit: true,
      includeBudget: false,
    });
    expect(classifyQuestionTopics('Is morning jogging safe?')).toMatchObject({
      primaryTopic: 'outdoor_exercise',
      includeOutdoorHabit: true,
    });
    expect(classifyQuestionTopics('Should I open bedroom windows or use a purifier?')).toMatchObject({
      primaryTopic: 'indoor_air',
      includeIndoor: true,
      includeBudget: true,
    });
    expect(classifyQuestionTopics('Should I take metro rail or petrol car commute?')).toMatchObject({
      primaryTopic: 'commute_transport',
      includeCommute: true,
      includeBudget: true,
    });
    expect(classifyQuestionTopics('Why is winter pollution high and what causes PM2.5?')).toMatchObject({
      primaryTopic: 'pollution_causes',
      includeCommute: false,
    });
    expect(classifyQuestionTopics('Severe smog emergency checklist')).toMatchObject({
      primaryTopic: 'severe_smog',
      includeCommute: true,
      includeIndoor: true,
    });
    expect(classifyQuestionTopics('Give me a full daily routine')).toMatchObject({
      primaryTopic: 'daily_routine',
      includeOutdoorHabit: true,
    });
    expect(classifyQuestionTopics('General advice for today')).toMatchObject({
      primaryTopic: 'general',
      includeCommute: true,
      includeIndoor: true,
      includeBudget: true,
      includeOutdoorHabit: true,
    });
  });

  it('strips control characters, unsafe HTML tags, and javascript/data URLs', () => {
    expect(stripControlChars('Hello\u0000\u0007\nWorld\t!')).toBe('Hello\nWorld\t!');
    expect(stripUnsafeHtml('<b>Stay indoors</b> javascript:alert(1)   now')).toBe('Stay indoors alert(1) now');

    const baseAdvice = buildRuleBasedFallbackAdvice({
      question: 'What should we do?',
      reading: makeGroundedReading(),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: DEFAULT_FAMILY_PROFILE,
    });
    const sanitized = sanitizeStructuredAdvice({
      ...baseAdvice,
      summary: '<script>x</script>Wear mask',
      sources: [
        { name: '<i>AirLive</i>', detail: 'Feed', url: 'https://airlive.tracsa.co.in' },
        { name: 'Evil', detail: 'Bad', url: 'javascript:alert(1)' },
      ],
    });
    expect(sanitized.summary).toBe('xWear mask');
    expect(sanitized.sources[0].url).toBe('https://airlive.tracsa.co.in/');
    expect(sanitized.sources[1].url).toBeUndefined();
  });

  it('builds verified air quality context across unavailable, modeled, stale, and fixture sources', () => {
    const unavailable = buildVerifiedAirQualityContext(null, 'HTTP 503 outage', 'Pune');
    expect(unavailable.locationName).toBe('Pune');
    expect(unavailable.dataFreshness).toContain('HTTP 503 outage');

    const modeledStale = buildVerifiedAirQualityContext(
      makeGroundedReading({
        location: { id: 'pune', name: 'Pune' },
        aqi: { value: null, category: 'Unavailable' },
        pollutants: [],
        provenance: {
          measurementType: 'modeled_forecast',
          observedAt: null,
          freshnessStatus: 'stale',
        },
      }),
      null,
      'Pune',
    );
    expect(modeledStale.locationName).toBe('Pune');
    expect(modeledStale.missingData).toContain('Numeric US AQI value');
    expect(modeledStale.missingData).toContain('PM2.5 concentration');
    expect(modeledStale.dataFreshness).toContain('Stale');
    expect(modeledStale.confidenceNoteSuffix).toContain('atmospheric model');

    const fixtureCtx = buildVerifiedAirQualityContext(
      makeGroundedReading({
        provenance: {
          measurementType: 'preview_fixture',
          observedAt: null,
          freshnessStatus: 'unavailable',
        },
      }),
      null,
      'Delhi',
    );
    expect(fixtureCtx.sources[0].name).toBe('BreatheWise Preview Fixture');
    expect(fixtureCtx.dataFreshness).toContain('Timestamp unavailable');
    expect(fixtureCtx.confidenceNoteSuffix).toContain('labeled preview fixture');
  });

  it('formats all five Gemini fallback reason notices cleanly', () => {
    expect(formatFallbackNotice('MISSING_API_KEY')).toContain('GEMINI_API_KEY');
    expect(formatFallbackNotice('QUOTA_EXHAUSTED')).toContain('HTTP 429');
    expect(formatFallbackNotice('TIMEOUT')).toContain('timed out');
    expect(formatFallbackNotice('MALFORMED_AI_RESPONSE')).toContain('malformed');
    expect(formatFallbackNotice('UPSTREAM_ERROR')).toContain('upstream');
  });

  it('produces tailored fallback advice across all AQI tiers, topics, and household configurations', () => {
    const adultOnlyProfile: FamilyProfile = {
      ...DEFAULT_FAMILY_PROFILE,
      members: { adults: 2, children: 0, seniors: 0 },
      sensitivities: {
        hasAsthmaOrRespiratory: false,
        hasHeartCondition: false,
        hasPregnantMember: false,
        hasOutdoorWorker: false,
      },
      homeEnvironment: {
        ...DEFAULT_FAMILY_PROFILE.homeEnvironment,
        hasAirPurifier: true,
        budgetTier: 'flexible',
      },
      lifestyle: {
        ...DEFAULT_FAMILY_PROFILE.lifestyle,
        primaryCommute: 'metro_rail',
      },
    };

    const nullAdvice = buildRuleBasedFallbackAdvice({
      question: 'Can we jog outside?',
      reading: makeGroundedReading({
        aqi: { value: null, category: 'Unavailable' },
        pollutants: [],
        provenance: { measurementType: 'ground_station', observedAt: null, freshnessStatus: 'unavailable' },
      }),
      unavailableReason: 'Missing',
      requestedLocation: 'Shimla',
      profile: adultOnlyProfile,
    });
    expect(nullAdvice.confidenceAndLimitations.confidenceLevel).toBe('low');
    expect(nullAdvice.summary).toContain('unavailable');

    const goodAdvice = buildRuleBasedFallbackAdvice({
      question: 'Good day for jogging?',
      reading: makeGroundedReading({ aqi: { value: 38, category: 'Good' } }),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: adultOnlyProfile,
    });
    expect(goodAdvice.confidenceAndLimitations.confidenceLevel).toBe('high');
    expect(goodAdvice.summary).toContain('Good');

    const moderateSensitive = buildRuleBasedFallbackAdvice({
      question: 'General advice',
      reading: makeGroundedReading({
        aqi: { value: 88, category: 'Moderate' },
        provenance: { measurementType: 'modeled_forecast', observedAt: null, freshnessStatus: 'fresh' },
      }),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: DEFAULT_FAMILY_PROFILE,
    });
    expect(moderateSensitive.confidenceAndLimitations.confidenceLevel).toBe('moderate');
    expect(moderateSensitive.summary).toContain('children, seniors');

    const moderateNonSensitive = buildRuleBasedFallbackAdvice({
      question: 'General advice',
      reading: makeGroundedReading({ aqi: { value: 88, category: 'Moderate' } }),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: adultOnlyProfile,
    });
    expect(moderateNonSensitive.summary).toContain('prolonged heavy exertion');

    const unhealthySensitive = buildRuleBasedFallbackAdvice({
      question: 'Should kids play?',
      reading: makeGroundedReading({ aqi: { value: 175, category: 'Unhealthy' } }),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: DEFAULT_FAMILY_PROFILE,
    });
    expect(unhealthySensitive.summary).toContain('household');

    const unhealthyNonSensitive = buildRuleBasedFallbackAdvice({
      question: 'Should we run?',
      reading: makeGroundedReading({ aqi: { value: 175, category: 'Unhealthy' } }),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: adultOnlyProfile,
    });
    expect(unhealthyNonSensitive.summary).toContain('sensitive individuals');

    const causesAdvice = buildRuleBasedFallbackAdvice({
      question: 'What causes high PM2.5 in winter?',
      reading: makeGroundedReading(),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: DEFAULT_FAMILY_PROFILE,
    });
    expect(causesAdvice.summary).toContain('temperature inversions');

    const budgetAdvice = buildRuleBasedFallbackAdvice({
      question: 'Best ₹500 budget actions',
      reading: makeGroundedReading(),
      unavailableReason: null,
      requestedLocation: 'Delhi',
      profile: DEFAULT_FAMILY_PROFILE,
    });
    expect(budgetAdvice.summary).toContain('₹500/month');
    const plain = formatAdviceAsPlainText(budgetAdvice);
    expect(plain).toContain('Precautions:');
    expect(plain).toContain('Delhi');
  });
});

describe('plannerRules and plannerGuidance coverage', () => {
  it('computes planner condition tiers across missing data, US_AQI, and NAQI', () => {
    expect(getPlannerConditionTier(null)).toBe('missing_data');
    expect(getPlannerConditionTier(makeClientReading(null, 'US_AQI', 'Unavailable'))).toBe('missing_data');
    expect(getPlannerConditionTier(makeClientReading(220, 'US_AQI', 'Very Unhealthy'))).toBe('severe');
    expect(getPlannerConditionTier(makeClientReading(120, 'US_AQI', 'Unhealthy for Sensitive Groups'))).toBe('moderate');
    expect(getPlannerConditionTier(makeClientReading(45, 'US_AQI', 'Good'))).toBe('better');
    expect(getPlannerConditionTier(makeClientReading(340, 'INDIA_CPCB_NAQI', 'Very Poor'))).toBe('severe');
    expect(getPlannerConditionTier(makeClientReading(180, 'INDIA_CPCB_NAQI', 'Moderate'))).toBe('moderate');
    expect(getPlannerConditionTier(makeClientReading(80, 'INDIA_CPCB_NAQI', 'Satisfactory'))).toBe('better');
  });

  it('produces family safety summaries across all US AQI and CPCB NAQI bands', () => {
    const outdoorWorkerProfile: FamilyProfile = {
      ...DEFAULT_FAMILY_PROFILE,
      sensitivities: { ...DEFAULT_FAMILY_PROFILE.sensitivities, hasOutdoorWorker: true },
    };
    const nonSensitiveProfile: FamilyProfile = {
      ...DEFAULT_FAMILY_PROFILE,
      members: { adults: 2, children: 0, seniors: 0 },
      sensitivities: {
        hasAsthmaOrRespiratory: false,
        hasHeartCondition: false,
        hasPregnantMember: false,
        hasOutdoorWorker: false,
      },
    };

    expect(getFamilySafetySummary(null, outdoorWorkerProfile).riskLevel).toBe('Moderate');
    expect(getFamilySafetySummary(null, outdoorWorkerProfile).keyConstraints.length).toBeGreaterThanOrEqual(4);

    // US AQI bands
    expect(getFamilySafetySummary(makeClientReading(35, 'US_AQI', 'Good'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Low');
    expect(getFamilySafetySummary(makeClientReading(75, 'US_AQI', 'Moderate'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Moderate');
    expect(getFamilySafetySummary(makeClientReading(75, 'US_AQI', 'Moderate'), nonSensitiveProfile).riskLevel).toBe('Low');
    expect(getFamilySafetySummary(makeClientReading(130, 'US_AQI', 'Unhealthy for Sensitive Groups'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Elevated');
    expect(getFamilySafetySummary(makeClientReading(130, 'US_AQI', 'Unhealthy for Sensitive Groups'), nonSensitiveProfile).riskLevel).toBe('Moderate');
    expect(getFamilySafetySummary(makeClientReading(180, 'US_AQI', 'Unhealthy'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Elevated');
    expect(getFamilySafetySummary(makeClientReading(250, 'US_AQI', 'Very Unhealthy'), DEFAULT_FAMILY_PROFILE).headline).toContain('Very Unhealthy');
    expect(getFamilySafetySummary(makeClientReading(350, 'US_AQI', 'Hazardous'), DEFAULT_FAMILY_PROFILE).headline).toContain('Hazardous');

    // CPCB NAQI bands
    expect(getFamilySafetySummary(makeClientReading(40, 'INDIA_CPCB_NAQI', 'Good'), nonSensitiveProfile).riskLevel).toBe('Low');
    expect(getFamilySafetySummary(makeClientReading(80, 'INDIA_CPCB_NAQI', 'Satisfactory'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Moderate');
    expect(getFamilySafetySummary(makeClientReading(150, 'INDIA_CPCB_NAQI', 'Moderate'), nonSensitiveProfile).riskLevel).toBe('Moderate');
    expect(getFamilySafetySummary(makeClientReading(150, 'INDIA_CPCB_NAQI', 'Moderate'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Elevated');
    expect(getFamilySafetySummary(makeClientReading(260, 'INDIA_CPCB_NAQI', 'Poor'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Elevated');
    expect(getFamilySafetySummary(makeClientReading(350, 'INDIA_CPCB_NAQI', 'Very Poor'), DEFAULT_FAMILY_PROFILE).riskLevel).toBe('Severe');
    expect(getFamilySafetySummary(makeClientReading(450, 'INDIA_CPCB_NAQI', 'Severe'), DEFAULT_FAMILY_PROFILE).headline).toContain('Severe smog emergency');
  });

  it('builds daily plans across hourly curves, work/school schedules, and recommendation combinations', () => {
    const baseHourly = getPreviewFixtureForecast(PRESET_LOCATIONS[0]);
    const diverseHourly: HourlyForecastPoint[] = [
      { ...baseHourly[0], hourLabel: '07:00', pm25: 160, estimatedNaqi: 340 },
      { ...baseHourly[1], hourLabel: '13:00', pm25: 25, estimatedNaqi: 75 },
      { ...baseHourly[2], hourLabel: '19:00', pm25: 60, estimatedNaqi: 140 },
      { ...baseHourly[3], hourLabel: 'invalid-label', timestamp: '2026-01-15T22:00:00Z', pm25: 10, estimatedNaqi: 40 },
    ];

    const customProfile: FamilyProfile = {
      ...DEFAULT_FAMILY_PROFILE,
      homeEnvironment: {
        ...DEFAULT_FAMILY_PROFILE.homeEnvironment,
        budgetTier: 'flexible',
        hasAirPurifier: true,
      },
      lifestyle: {
        ...DEFAULT_FAMILY_PROFILE.lifestyle,
        primaryCommute: 'walk_cycle',
        workSchedule: 'flexible_hybrid',
      },
      sensitivities: {
        ...DEFAULT_FAMILY_PROFILE.sensitivities,
        hasOutdoorWorker: true,
      },
    };

    const planWithHourly = generateDailyPlan(
      makeClientReading(180, 'US_AQI', 'Unhealthy'),
      diverseHourly,
      customProfile,
    );
    expect(planWithHourly).toHaveLength(4);
    expect(planWithHourly.every((b) => b.hasHourlyEvidence)).toBe(true);

    const planMissing = generateDailyPlan(null, [], {
      ...customProfile,
      lifestyle: { ...customProfile.lifestyle, primaryCommute: 'two_wheeler', workSchedule: 'home_based' },
    });
    expect(planMissing.every((b) => b.outdoorRisk === 'unknown')).toBe(true);

    const modeledReading: AirQualityReading = {
      ...makeClientReading(140, 'INDIA_CPCB_NAQI', 'Moderate'),
      provenance: {
        ...makeClientReading(140).provenance,
        measurementType: 'modeled_forecast',
      },
    };
    const naqiPlan = generateDailyPlan(modeledReading, diverseHourly, {
      ...customProfile,
      lifestyle: { ...customProfile.lifestyle, primaryCommute: 'two_wheeler' },
    });
    expect(naqiPlan[0].limitations).toContain('atmospheric modeling');

    expect(resolveConditionTier(null, 'unknown')).toBe('missing_data');
    expect(resolveConditionTier(250, 'severe')).toBe('severe');
    expect(resolveConditionTier(120, 'moderate')).toBe('moderate');
    expect(resolveConditionTier(35, 'low')).toBe('better');
    expect(resolveGuidanceBasis({
      reading: modeledReading,
      hasHourlyEvidence: false,
      scaleLabel: 'NAQI',
      expectedNaqi: 140,
      timeRange: '06:00 – 10:00',
    })).toContain('Hourly curve unavailable');
    expect(resolveSlotLimitations(modeledReading, false)).toContain('time-of-day variation is unknown');

    const recsMissing = getDailyRecommendations(null, customProfile);
    expect(recsMissing[0].id).toBe('rec-unavailable-pm');
    expect(recsMissing[1].id).toBe('rec-purifier');

    const recsLowAqi = getDailyRecommendations(makeClientReading(40, 'US_AQI', 'Good'), {
      ...DEFAULT_FAMILY_PROFILE,
      homeEnvironment: { ...DEFAULT_FAMILY_PROFILE.homeEnvironment, budgetTier: 'low' },
      lifestyle: { ...DEFAULT_FAMILY_PROFILE.lifestyle, primaryCommute: 'petrol_car' },
    });
    expect(recsLowAqi.map((r) => r.id)).toEqual(['rec-window', 'rec-wetmop', 'rec-transit']);
  });
});

describe('indoorRules and sustainableRules branches', () => {
  it('computes CADR tiers and ventilation windows across all outdoor conditions', () => {
    expect(findBestVentilationWindow([])).toBeNull();

    const lowWin = findBestVentilationWindow(
      [{ hourLabel: '14:00', timestamp: '2026-01-15T14:00:00Z', pm25: 12, pm10: 20, estimatedNaqi: 50, category: 'Good', scale: 'US_AQI' }],
      makeClientReading(60, 'US_AQI', 'Moderate'),
    );
    expect(lowWin?.guidance).toContain('Open opposite windows');

    const modWin = findBestVentilationWindow(
      [{ hourLabel: '14:00', timestamp: '2026-01-15T14:00:00Z', pm25: 45, pm10: 70, estimatedNaqi: 125, category: 'Unhealthy for Sensitive Groups', scale: 'US_AQI' }],
      makeClientReading(140, 'US_AQI', 'Unhealthy for Sensitive Groups'),
    );
    expect(modWin?.guidance).toContain('Brief 10–15 minute');

    const poorWin = findBestVentilationWindow(
      [{ hourLabel: '14:00', timestamp: '2026-01-15T14:00:00Z', pm25: 130, pm10: 210, estimatedNaqi: 190, category: 'Unhealthy', scale: 'US_AQI' }],
      makeClientReading(195, 'US_AQI', 'Unhealthy'),
    );
    expect(poorWin?.guidance).toContain('Keep windows sealed');

    const severeWin = findBestVentilationWindow(
      [{ hourLabel: '14:00', timestamp: '2026-01-15T14:00:00Z', pm25: 160, pm10: 240, estimatedNaqi: 240, category: 'Very Unhealthy', scale: 'US_AQI' }],
      makeClientReading(250, 'US_AQI', 'Very Unhealthy'),
    );
    expect(severeWin?.guidance).toContain('currently severe');

    expect(calculateCadr(150).estimatedFilterBudgetInr).toContain('6,000');
    expect(calculateCadr(200).estimatedFilterBudgetInr).toContain('9,500');
    expect(calculateCadr(320).estimatedFilterBudgetInr).toContain('14,000');
  });

  it('generates tailored indoor guide and sustainable alternatives across edge profiles', () => {
    const biomassLeakyProfile: FamilyProfile = {
      ...DEFAULT_FAMILY_PROFILE,
      homeEnvironment: {
        housingType: 'independent_leaky',
        roomAreaSqFt: 320,
        cookingFuel: 'biomass_solid',
        kitchenExhaust: 'none',
        hasAirPurifier: false,
        budgetTier: 'moderate',
      },
      lifestyle: {
        ...DEFAULT_FAMILY_PROFILE.lifestyle,
        primaryCommute: 'diesel_car',
      },
      sensitivities: {
        ...DEFAULT_FAMILY_PROFILE.sensitivities,
        hasAsthmaOrRespiratory: false,
      },
    };

    const topicsNoCurve = generateTailoredIndoorGuide(
      biomassLeakyProfile,
      makeClientReading(120, 'US_AQI', 'Unhealthy for Sensitive Groups'),
      [],
    );
    expect(topicsNoCurve).toHaveLength(7);
    expect(topicsNoCurve[0].actionSummary).toContain('No hourly outdoor curve');
    expect(topicsNoCurve[1].actionSummary).toContain('solid/biomass');

    const topicsGood = generateTailoredIndoorGuide(
      {
        ...biomassLeakyProfile,
        homeEnvironment: {
          ...biomassLeakyProfile.homeEnvironment,
          housingType: 'high_traffic_roadside',
          cookingFuel: 'lpg',
          kitchenExhaust: 'chimney_or_exhaust',
          hasAirPurifier: true,
          budgetTier: 'flexible',
        },
      },
      makeClientReading(42, 'US_AQI', 'Good'),
      [],
    );
    expect(topicsGood[0].actionSummary).toContain('Cross-ventilate for 20–30 minutes');
    expect(topicsGood[1].actionSummary).toContain('chimney/exhaust');

    const topicsMissing = generateTailoredIndoorGuide(biomassLeakyProfile, null, []);
    expect(topicsMissing[0].actionSummary).toContain('Outdoor AQI is unavailable');

    const dieselAlts = getPersonalizedSustainableAlternatives(biomassLeakyProfile, null);
    expect(dieselAlts[0].defaultShift?.baselineMode).toBe('diesel_car');
    expect(dieselAlts[1].practicalLimitations).toContain('currently unavailable');

    const twoWheelerAlts = getPersonalizedSustainableAlternatives(
      {
        ...DEFAULT_FAMILY_PROFILE,
        lifestyle: { ...DEFAULT_FAMILY_PROFILE.lifestyle, primaryCommute: 'two_wheeler' },
      },
      makeClientReading(110, 'US_AQI', 'Unhealthy for Sensitive Groups'),
    );
    expect(twoWheelerAlts[0].defaultShift?.baselineMode).toBe('two_wheeler');
    expect(twoWheelerAlts[0].estimatedCostOrSavings).toContain('No reliable single rupee estimate');
  });
});
