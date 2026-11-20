import { describe, expect, it } from 'vitest';
import {
  calculateTransportShiftImpact,
  summarizeImpactByDate,
  summarizeImpactLogs,
} from './impactCalculator';
import {
  INDOOR_EVIDENCE_BOUNDARIES,
  calculateCadr,
  findBestVentilationWindow,
  generateTailoredIndoorGuide,
} from './indoorRules';
import { calculatePollutantSubIndex, computeOverallNaqi, getNaqiCategory } from './naqi';
import { generateDailyPlan, getFamilySafetySummary } from './plannerRules';
import { getPersonalizedSustainableAlternatives } from './sustainableRules';
import {
  calculatePm25UsAqi,
  getUsAqiCategory,
  getUsAqiVisualTokens,
  normalizeUsAqiCategoryLabel,
} from './usAqi';
import {
  DEFAULT_FAMILY_PROFILE,
  PRESET_LOCATIONS,
  getPreviewFixtureForecast,
  getPreviewFixtureReading,
} from '../data/previewFixtures';
import type { AirQualityReading } from '../types/breathewise';

describe('US AQI 6-Band Mapping Engine (AirLive Standard)', () => {
  it('maps all 6 US AQI breakpoint bands accurately', () => {
    expect(getUsAqiCategory(0)).toBe('Good');
    expect(getUsAqiCategory(50)).toBe('Good');
    expect(getUsAqiCategory(51)).toBe('Moderate');
    expect(getUsAqiCategory(100)).toBe('Moderate');
    expect(getUsAqiCategory(101)).toBe('Unhealthy for Sensitive Groups');
    expect(getUsAqiCategory(150)).toBe('Unhealthy for Sensitive Groups');
    expect(getUsAqiCategory(151)).toBe('Unhealthy');
    expect(getUsAqiCategory(200)).toBe('Unhealthy');
    expect(getUsAqiCategory(201)).toBe('Very Unhealthy');
    expect(getUsAqiCategory(300)).toBe('Very Unhealthy');
    expect(getUsAqiCategory(301)).toBe('Hazardous');
    expect(getUsAqiCategory(500)).toBe('Hazardous');
  });

  it('normalizes category labels and computes EPA PM2.5 US AQI cleanly', () => {
    expect(normalizeUsAqiCategoryLabel('very unhealthy')).toBe('Very Unhealthy');
    expect(normalizeUsAqiCategoryLabel('unknown-label')).toBeNull();
    expect(calculatePm25UsAqi(35.4)).toBe(100);
    expect(calculatePm25UsAqi(150)).toBeGreaterThanOrEqual(200);
    expect(getUsAqiVisualTokens('Very Unhealthy').tone).toBe('critical');
  });

  it('evaluates US_AQI family safety thresholds accurately', () => {
    const liveSample: AirQualityReading = {
      location: {
        id: 'delhi',
        slug: 'delhi',
        name: 'Delhi',
        city: 'Delhi',
        state: 'India',
        country: 'IN',
        countryName: 'India',
        lat: 28.6139,
        lon: 77.209,
      },
      aqi: {
        value: 262,
        scale: 'US_AQI',
        category: 'Very Unhealthy',
        dominantPollutant: 'PM2.5',
      },
      pollutants: [
        {
          key: 'pm25',
          label: 'PM2.5',
          value: 212.1,
          unit: 'µg/m³',
          subIndex: 262,
          safeReference: 'WHO 24h: 15 µg/m³',
          status: 'measured',
        },
      ],
      provenance: {
        providerId: 'airlive',
        providerName: 'AirLive',
        stationName: 'Delhi (3 ground stations)',
        measurementType: 'ground_station',
        sourceLabel: 'Ground Stations',
        stationsUsed: 3,
        observedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        isStale: false,
        freshnessStatus: 'fresh',
        attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
        attributionUrl: 'https://airlive.tracsa.co.in',
      },
    };

    const summary = getFamilySafetySummary(liveSample, DEFAULT_FAMILY_PROFILE);
    expect(summary.riskLevel).toBe('Severe');
    expect(summary.headline).toMatch(/Very Unhealthy/i);
  });
});

describe('CPCB NAQI Calculation Engine (Preview Fixtures)', () => {
  it('maps PM2.5 breakpoints accurately across bands', () => {
    expect(calculatePollutantSubIndex('pm25', 30)).toBe(50);
    expect(calculatePollutantSubIndex('pm25', 31)).toBe(51);
    expect(calculatePollutantSubIndex('pm25', 60)).toBe(100);
    expect(calculatePollutantSubIndex('pm25', 250)).toBe(400);
    expect(getNaqiCategory(365)).toBe('Very Poor');
    expect(getNaqiCategory(420)).toBe('Severe');
  });

  it('applies CPCB worst-pollutant rule for overall NAQI', () => {
    const result = computeOverallNaqi({
      pm25: 204,
      pm10: 120,
      no2: 30,
    });
    expect(result.dominantPollutant).toBe('PM2.5');
    expect(result.value).toBe(calculatePollutantSubIndex('pm25', 204));
    expect(result.category).toBe('Very Poor');
  });
});

describe('Module A – Personalized Family Planner Rules', () => {
  it('flags severe risk, hourly evidence, and all 6 recommendation fields in Delhi smog', () => {
    const reading = getPreviewFixtureReading(PRESET_LOCATIONS[0]);
    const forecast = getPreviewFixtureForecast(PRESET_LOCATIONS[0]);
    const summary = getFamilySafetySummary(reading, DEFAULT_FAMILY_PROFILE);
    expect(summary.riskLevel).toBe('Severe');
    expect(summary.vulnerableGroupsCount).toBe(2);

    const blocks = generateDailyPlan(reading, forecast, DEFAULT_FAMILY_PROFILE);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].outdoorRisk).toBe('severe');
    expect(blocks[0].conditionTier).toBe('severe');
    expect(blocks[0].reason.length).toBeGreaterThan(10);
    expect(blocks[0].expectedBenefit.length).toBeGreaterThan(10);
    expect(blocks[0].guidanceBasis.length).toBeGreaterThan(10);
    expect(blocks[0].limitations.length).toBeGreaterThan(10);
  });

  it('supports missing data conditions and never assumes a cleaner time without hourly evidence', () => {
    const missingBlocks = generateDailyPlan(null, [], DEFAULT_FAMILY_PROFILE);
    expect(missingBlocks).toHaveLength(4);
    for (const block of missingBlocks) {
      expect(block.conditionTier).toBe('missing_data');
      expect(block.outdoorRisk).toBe('unknown');
      expect(block.hasHourlyEvidence).toBe(false);
      expect(block.expectedNaqi).toBeNull();
      expect(block.guidanceBasis).toMatch(/unavailable|missing|No live/i);
    }

    const moderateReading = getPreviewFixtureReading(PRESET_LOCATIONS[4]); // Mumbai NAQI ~98-112
    const noHourlyBlocks = generateDailyPlan(moderateReading, [], DEFAULT_FAMILY_PROFILE);
    expect(noHourlyBlocks[0].hasHourlyEvidence).toBe(false);
    expect(noHourlyBlocks[0].guidanceBasis).toMatch(/no cleaner time window assumed/i);
  });

  it('recognizes better air-quality periods cleanly', () => {
    const goodReading = getPreviewFixtureReading(PRESET_LOCATIONS[5]); // Bengaluru Good/Satisfactory
    const forecast = getPreviewFixtureForecast(PRESET_LOCATIONS[5]);
    const blocks = generateDailyPlan(goodReading, forecast, DEFAULT_FAMILY_PROFILE);
    expect(blocks.some((b) => b.conditionTier === 'better')).toBe(true);
  });
});

describe('Module B – Indoor Air Rules, 7 Topics & Evidence Boundaries', () => {
  it('computes 5 ACH CADR for a 160 sq ft bedroom', () => {
    const cadr = calculateCadr(160);
    expect(cadr.recommendedMinCadrM3h).toBeGreaterThanOrEqual(195);
    expect(cadr.recommendedMinCadrM3h).toBeLessThanOrEqual(210);
  });

  it('identifies lowest afternoon PM2.5 window from forecast curve, tracks scale thresholds, and returns null when empty', () => {
    expect(findBestVentilationWindow([])).toBeNull();
    const forecast = getPreviewFixtureForecast(PRESET_LOCATIONS[0]);
    const win = findBestVentilationWindow(forecast);
    expect(win).not.toBeNull();
    expect(win!.startLabel).toBe('14:00');
    expect(win!.scale).toBe('INDIA_CPCB_NAQI');

    const usAqiModerateWin = findBestVentilationWindow([
      {
        hourLabel: '14:00',
        timestamp: '2026-11-18T14:00:00.000Z',
        pm25: 47,
        pm10: 80,
        estimatedNaqi: 130,
        scale: 'US_AQI',
        category: 'Unhealthy for Sensitive Groups',
      },
    ]);
    expect(usAqiModerateWin?.scale).toBe('US_AQI');
    expect(usAqiModerateWin?.guidance).toMatch(/10–15 minute/);
  });

  it('covers all 7 indoor topics tailored by housing & budget with explicit safety boundaries', () => {
    const reading = getPreviewFixtureReading(PRESET_LOCATIONS[0]);
    const forecast = getPreviewFixtureForecast(PRESET_LOCATIONS[0]);
    const topics = generateTailoredIndoorGuide(DEFAULT_FAMILY_PROFILE, reading, forecast);
    expect(topics).toHaveLength(7);
    expect(topics.map((t) => t.id)).toEqual([
      'ventilation',
      'cooking_smoke',
      'dust',
      'cleaning_combustion',
      'purifier_maintenance',
      'filtration',
      'indoor_activity',
    ]);
    expect(INDOOR_EVIDENCE_BOUNDARIES.some((r) => /houseplants/i.test(r.title))).toBe(true);
    expect(INDOOR_EVIDENCE_BOUNDARIES.some((r) => /never burn incense/i.test(r.title))).toBe(true);
  });
});

describe('Module C – Sustainable Alternatives Rules', () => {
  it('provides personalized alternatives across all 7 required areas with 6 fields', () => {
    const reading = getPreviewFixtureReading(PRESET_LOCATIONS[0]);
    const items = getPersonalizedSustainableAlternatives(DEFAULT_FAMILY_PROFILE, reading);
    const areas = new Set(items.map((i) => i.area));
    expect(areas.size).toBe(7);
    for (const item of items) {
      expect(item.whatToChange.length).toBeGreaterThan(5);
      expect(item.whyItMatters.length).toBeGreaterThan(5);
      expect(item.alternative.length).toBeGreaterThan(5);
      expect(item.estimatedCostOrSavings.length).toBeGreaterThan(5);
      expect(item.environmentalBenefit.length).toBeGreaterThan(5);
      expect(item.practicalLimitations.length).toBeGreaterThan(5);
    }
  });
});

describe('Module D – Environmental Impact Calculator & Historical Grouping', () => {
  it('calculates transport CO2e avoided, fuel saved, and assumptions transparently', () => {
    const calc = calculateTransportShiftImpact('petrol_car', 'metro_rail', 20);
    expect(calc.emissionsAvoidedGrams).toBe(2100);
    expect(calc.fuelSavedLitres).toBe(1.43);
    expect(calc.assumptions).toMatch(/140 g CO2e\/pkm/);
  });

  it('strictly separates exposure protection actions, emissions avoided, and daily history', () => {
    const logs = [
      {
        id: 'exp-1',
        date: '2026-11-18',
        category: 'exposure_protection' as const,
        title: 'Wet-mopped bedroom',
        emissionsAvoidedGrams: 0,
        fuelSavedLitres: 0,
        exposureProtectionPoints: 1,
        methodologyNote: 'Exposure only',
      },
      {
        id: 'hh-1',
        date: '2026-11-18',
        category: 'energy_household' as const,
        title: 'Composted dry leaves',
        emissionsAvoidedGrams: 0,
        fuelSavedLitres: 0,
        exposureProtectionPoints: 0,
        methodologyNote: 'Household habit',
      },
      {
        id: 'tr-1',
        date: '2026-11-17',
        category: 'transport_shift' as const,
        title: 'Metro trip',
        emissionsAvoidedGrams: 1050,
        fuelSavedLitres: 0.71,
        exposureProtectionPoints: 0,
        methodologyNote: 'Transport',
      },
    ];

    const totals = summarizeImpactLogs(logs);
    expect(totals.totalEmissionsAvoidedKg).toBe(1.05);
    expect(totals.totalFuelSavedLitres).toBe(0.71);
    expect(totals.exposureProtectionActions).toBe(1);
    expect(totals.householdEnergyActions).toBe(1);
    expect(totals.activeDaysCount).toBe(2);

    const byDate = summarizeImpactByDate(logs);
    expect(byDate).toHaveLength(2);
    expect(byDate[0].date).toBe('2026-11-18');
    expect(byDate[0].exposureActions).toBe(1);
    expect(byDate[0].householdActions).toBe(1);
    expect(byDate[0].emissionsAvoidedKg).toBe(0);
  });

  it('handles empty environmental history cleanly with zero totals and empty date buckets', () => {
    const emptyTotals = summarizeImpactLogs([]);
    expect(emptyTotals.totalEmissionsAvoidedKg).toBe(0);
    expect(emptyTotals.totalFuelSavedLitres).toBe(0);
    expect(emptyTotals.exposureProtectionActions).toBe(0);
    expect(emptyTotals.householdEnergyActions).toBe(0);
    expect(emptyTotals.transportShiftsCount).toBe(0);
    expect(emptyTotals.activeDaysCount).toBe(0);
    expect(summarizeImpactByDate([])).toEqual([]);
  });
});

describe('Different Household Configurations & Missing AQI Handling', () => {
  it('handles null AQI values without fabricating numbers and differentiates low-budget solo vs high-risk multi-member households', () => {
    const missingAqiReading: AirQualityReading = {
      location: PRESET_LOCATIONS[0],
      aqi: {
        value: null,
        scale: 'US_AQI',
        category: 'Unavailable',
        dominantPollutant: 'Unavailable',
      },
      pollutants: [
        {
          key: 'pm25',
          label: 'PM2.5',
          value: null,
          unit: 'µg/m³',
          subIndex: null,
          safeReference: 'WHO 24h: 15 µg/m³',
          status: 'unavailable',
        },
      ],
      provenance: {
        providerId: 'airlive',
        providerName: 'AirLive',
        stationName: 'Delhi',
        measurementType: 'ground_station',
        sourceLabel: 'Ground Stations',
        stationsUsed: 0,
        observedAt: null,
        fetchedAt: new Date().toISOString(),
        isStale: true,
        freshnessStatus: 'unavailable',
        attribution: 'Data: AirLive.',
      },
    };

    const missingSummary = getFamilySafetySummary(missingAqiReading, DEFAULT_FAMILY_PROFILE);
    expect(missingSummary.riskLevel).toBe('Moderate');
    expect(missingSummary.headline).toMatch(/unavailable/i);
    const missingPlan = generateDailyPlan(missingAqiReading, [], DEFAULT_FAMILY_PROFILE);
    expect(missingPlan[0].conditionTier).toBe('missing_data');
    expect(missingPlan[0].outdoorRisk).toBe('unknown');

    const soloLowBudget = {
      ...DEFAULT_FAMILY_PROFILE,
      householdName: 'Solo WFH',
      members: { adults: 1, children: 0, seniors: 0 },
      sensitivities: {
        hasAsthmaOrRespiratory: false,
        hasHeartCondition: false,
        hasPregnantMember: false,
        hasOutdoorWorker: false,
      },
      lifestyle: {
        ...DEFAULT_FAMILY_PROFILE.lifestyle,
        primaryCommute: 'work_from_home' as const,
        dailyCommuteKm: 0,
        workSchedule: 'home_based' as const,
        schoolSchedule: 'online_or_none' as const,
      },
      homeEnvironment: {
        budgetTier: 'low' as const,
        cookingFuel: 'induction' as const,
        hasAirPurifier: false,
        roomAreaSqFt: 120,
        housingType: 'apartment_sealed' as const,
        kitchenExhaust: 'chimney_or_exhaust' as const,
      },
    };

    const highRiskBiomass = {
      ...DEFAULT_FAMILY_PROFILE,
      householdName: 'Multi-Gen Roadside',
      members: { adults: 2, children: 2, seniors: 2 },
      sensitivities: {
        hasAsthmaOrRespiratory: true,
        hasHeartCondition: true,
        hasPregnantMember: true,
        hasOutdoorWorker: true,
      },
      lifestyle: {
        ...DEFAULT_FAMILY_PROFILE.lifestyle,
        primaryCommute: 'diesel_car' as const,
        dailyCommuteKm: 32,
      },
      homeEnvironment: {
        budgetTier: 'flexible' as const,
        cookingFuel: 'biomass_solid' as const,
        hasAirPurifier: false,
        roomAreaSqFt: 240,
        housingType: 'high_traffic_roadside' as const,
        kitchenExhaust: 'none' as const,
      },
    };

    const delhiSevere = getPreviewFixtureReading(PRESET_LOCATIONS[0]);
    const delhiForecast = getPreviewFixtureForecast(PRESET_LOCATIONS[0]);
    const bengaluruGood = getPreviewFixtureReading(PRESET_LOCATIONS[5]);

    const soloSummary = getFamilySafetySummary(bengaluruGood, soloLowBudget);
    const highRiskSummary = getFamilySafetySummary(delhiSevere, highRiskBiomass);
    expect(soloSummary.vulnerableGroupsCount).toBe(0);
    expect(soloSummary.riskLevel).toBe('Low');
    expect(highRiskSummary.vulnerableGroupsCount).toBe(4);
    expect(highRiskSummary.riskLevel).toBe('Severe');

    const soloIndoor = generateTailoredIndoorGuide(soloLowBudget, bengaluruGood, []);
    const biomassIndoor = generateTailoredIndoorGuide(highRiskBiomass, delhiSevere, delhiForecast);
    const soloCooking = soloIndoor.find((t) => t.id === 'cooking_smoke');
    const biomassCooking = biomassIndoor.find((t) => t.id === 'cooking_smoke');
    expect(soloCooking?.householdFitNote).toMatch(/INDUCTION/i);
    expect(biomassCooking?.actionSummary).toMatch(/biomass|solid/i);
    expect(soloIndoor.find((t) => t.id === 'ventilation')?.actionSummary).not.toEqual(
      biomassIndoor.find((t) => t.id === 'ventilation')?.actionSummary,
    );

    const highRiskSustainable = getPersonalizedSustainableAlternatives(highRiskBiomass, delhiSevere);
    expect(highRiskSustainable.some((item) => item.area === 'energy')).toBe(true);
  });
});

