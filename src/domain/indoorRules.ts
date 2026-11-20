import type {
  AirQualityReading,
  AqiScale,
  BudgetTier,
  FamilyProfile,
  HourlyForecastPoint,
} from '../types/breathewise.ts';
import { normalizeUsAqiCategoryLabel } from './usAqi.ts';

export interface VentilationWindow {
  startLabel: string;
  endLabel: string;
  minPm25: number;
  minNaqi: number;
  scale: AqiScale;
  guidance: string;
}

export interface CadrCalculation {
  roomAreaSqFt: number;
  roomVolumeM3: number;
  recommendedMinCadrM3h: number;
  recommendedCfm: number;
  estimatedFilterBudgetInr: string;
}

export type CostGuideTier = 'low_cost' | 'medium_cost' | 'higher_cost';

export interface IndoorMeasure {
  id: string;
  category:
    | 'ventilation'
    | 'cooking'
    | 'dust'
    | 'cleaning_combustion'
    | 'purifier_maintenance'
    | 'filtration'
    | 'indoor_activity';
  costTier: CostGuideTier;
  title: string;
  detail: string;
  suitableFor: string;
  budgetTiers: BudgetTier[];
  estimatedCostInr: string;
}

export type IndoorTopicId =
  | 'ventilation'
  | 'cooking_smoke'
  | 'dust'
  | 'cleaning_combustion'
  | 'purifier_maintenance'
  | 'filtration'
  | 'indoor_activity';

export interface TailoredIndoorTopic {
  id: IndoorTopicId;
  topicNumber: number;
  topicLabel: string;
  costTier: CostGuideTier;
  estimatedCostInr: string;
  actionSummary: string;
  tailoredReason: string;
  householdFitNote: string;
  caveat: string;
}

export interface EvidenceBoundaryRule {
  id: string;
  title: string;
  explanation: string;
}

export const INDOOR_EVIDENCE_BOUNDARIES: EvidenceBoundaryRule[] = [
  {
    id: 'boundary-houseplants',
    title: 'Houseplants do not meaningfully replace air filtration',
    explanation:
      'While potted plants add greenery, controlled building-science studies show normal indoor plant density removes negligible PM2.5 compared to room airflow rates. Do not rely on houseplants instead of source control or mechanical HEPA filtration.',
  },
  {
    id: 'boundary-no-burning',
    title: 'Never burn incense, dhoop, candles, or coils to clean air',
    explanation:
      'Combustion products—including dhoop, agarbatti, scented candles, and mosquito coils—release concentrated fine PM2.5, carbon monoxide, and VOCs indoors and offer zero air-cleaning benefit.',
  },
  {
    id: 'boundary-ventilation-balance',
    title: 'Ventilation depends on both outdoor AQI and indoor pollutant sources',
    explanation:
      'Opening windows helps flush indoor cooking smoke, moisture, and CO2 when outdoor air is cleaner. During severe outdoor smog, prolonged open windows increase indoor PM2.5 unless filtered—rely on kitchen exhaust and brief targeted airing only if indoor smoke builds up.',
  },
  {
    id: 'boundary-no-fake-percentages',
    title: 'No unsupported percentage reduction guarantees',
    explanation:
      'Actual indoor PM2.5 improvement varies widely based on window frame leakage, door openings, room volume, cooking frequency, and outdoor smog levels.',
  },
];

export function findBestVentilationWindow(
  hourly: HourlyForecastPoint[],
  reading: AirQualityReading | null = null,
): VentilationWindow | null {
  if (hourly.length === 0) return null;

  let bestIdx = 0;
  for (let i = 1; i < hourly.length; i += 1) {
    if (hourly[i].pm25 < hourly[bestIdx].pm25) {
      bestIdx = i;
    }
  }

  const best = hourly[bestIdx];
  const next = hourly[Math.min(bestIdx + 2, hourly.length - 1)];

  const scale: AqiScale =
    best.scale ??
    reading?.aqi.scale ??
    (normalizeUsAqiCategoryLabel(best.category) !== null ? 'US_AQI' : 'INDIA_CPCB_NAQI');

  const severeActive =
    reading?.aqi.value !== null &&
    reading?.aqi.value !== undefined &&
    (reading.aqi.scale === 'US_AQI' ? reading.aqi.value >= 201 : reading.aqi.value >= 301);

  const goodThreshold = scale === 'US_AQI' ? 100 : 150;
  const moderateThreshold = scale === 'US_AQI' ? 150 : 250;

  const guidance = severeActive
    ? 'Outdoor smog is currently severe. Keep exterior windows sealed except for brief 5–10 minute cross-ventilation if indoor cooking fumes or stuffiness accumulate.'
    : best.estimatedNaqi <= goodThreshold
      ? 'Open opposite windows for 20–30 minutes during this lower-PM2.5 interval to flush indoor CO2 and cooking fumes—keep interior doors open for cross-flow.'
      : best.estimatedNaqi <= moderateThreshold
        ? 'Brief 10–15 minute cross-ventilation is reasonable only if indoor air feels stuffy or smoky; avoid leaving roadside windows open all day.'
        : 'Outdoor air remains Poor/Severe across available intervals. Keep windows sealed and rely on targeted exhaust and filtration.';

  return {
    startLabel: best.hourLabel,
    endLabel: next.hourLabel,
    minPm25: best.pm25,
    minNaqi: best.estimatedNaqi,
    scale,
    guidance,
  };
}

export function calculateCadr(roomAreaSqFt: number): CadrCalculation {
  const safeArea = Math.max(50, Math.min(2500, Math.round(roomAreaSqFt)));
  const areaM2 = safeArea * 0.092903;
  const ceilingMeters = 2.7;
  const roomVolumeM3 = Math.round(areaM2 * ceilingMeters);
  // 5 Air Changes per Hour for severe urban PM2.5 mitigation
  const recommendedMinCadrM3h = Math.round(roomVolumeM3 * 5);
  const recommendedCfm = Math.round(recommendedMinCadrM3h / 1.699);

  let estimatedFilterBudgetInr = '₹6,000 – ₹9,500';
  if (recommendedMinCadrM3h > 350) {
    estimatedFilterBudgetInr = '₹14,000 – ₹22,000';
  } else if (recommendedMinCadrM3h > 220) {
    estimatedFilterBudgetInr = '₹9,500 – ₹14,000';
  }

  return {
    roomAreaSqFt: safeArea,
    roomVolumeM3,
    recommendedMinCadrM3h,
    recommendedCfm,
    estimatedFilterBudgetInr,
  };
}

function isOutdoorAirSeverelyPolluted(reading: AirQualityReading | null): boolean {
  if (!reading || reading.aqi.value === null) return false;
  return reading.aqi.scale === 'US_AQI' ? reading.aqi.value >= 201 : reading.aqi.value >= 301;
}

function isOutdoorAirGoodOrLow(reading: AirQualityReading | null): boolean {
  if (!reading || reading.aqi.value === null) return false;
  return reading.aqi.scale === 'US_AQI' ? reading.aqi.value <= 100 : reading.aqi.value <= 100;
}

export function generateTailoredIndoorGuide(
  profile: FamilyProfile,
  reading: AirQualityReading | null,
  hourly: HourlyForecastPoint[],
): TailoredIndoorTopic[] {
  const totalMembers =
    profile.members.adults + profile.members.children + profile.members.seniors;
  const cadr = calculateCadr(profile.homeEnvironment.roomAreaSqFt);
  const budget = profile.homeEnvironment.budgetTier;
  const housing = profile.homeEnvironment.housingType;
  const exhaust = profile.homeEnvironment.kitchenExhaust;
  const fuel = profile.homeEnvironment.cookingFuel;
  const hasPurifier = profile.homeEnvironment.hasAirPurifier;
  const ventWin = findBestVentilationWindow(hourly, reading);
  const severeOutdoor = isOutdoorAirSeverelyPolluted(reading);
  const goodOutdoor = isOutdoorAirGoodOrLow(reading);
  const readingMissing = !reading || reading.aqi.value === null;

  const housingLabel =
    housing === 'high_traffic_roadside'
      ? 'roadside exposure'
      : housing === 'independent_leaky'
        ? 'drafty/unsealed frames'
        : 'sealed apartment windows';

  return [
    {
      id: 'ventilation',
      topicNumber: 1,
      topicLabel: '1. Ventilation Timing & Source Balance',
      costTier: housing === 'independent_leaky' ? 'low_cost' : 'low_cost',
      estimatedCostInr: '₹0 – ₹400',
      actionSummary: readingMissing
        ? 'Outdoor AQI is unavailable—avoid leaving windows wide open near traffic; air briefly only when cooking steam or CO2 builds up.'
        : severeOutdoor
          ? 'Keep exterior windows closed during outdoor smog peaks and seal obvious door/window gaps with weatherstripping or rolled damp towels.'
          : goodOutdoor
            ? 'Cross-ventilate for 20–30 minutes using opposite windows while outdoor air is relatively clean.'
            : ventWin
              ? `Target brief 10–15 minute cross-ventilation around ${ventWin.startLabel}–${ventWin.endLabel} when outdoor PM2.5 is lowest, unless indoor smoke needs immediate clearing.`
              : 'No hourly outdoor curve is available—avoid assuming afternoon hours are cleaner; ventilate briefly only to clear indoor cooking fumes.',
      tailoredReason:
        'Effective ventilation balances outdoor particulate entry against indoor CO2, moisture, and cooking pollutants—opening windows helps indoors only when outdoor air is cleaner than indoor air.',
      householdFitNote: `Tailored for ${totalMembers} household member(s) with ${housingLabel}${housing === 'high_traffic_roadside' ? ' (prioritize courtyard/rear-facing windows over road-facing ones)' : ''}.`,
      caveat:
        'Sealed bedrooms with multiple people accumulate CO2 overnight; briefly flush air when outdoor readings allow or keep trickle airflow away from traffic.',
    },
    {
      id: 'cooking_smoke',
      topicNumber: 2,
      topicLabel: '2. Cooking Smoke & Kitchen Fume Control',
      costTier: exhaust === 'none' && budget !== 'low' ? 'medium_cost' : 'low_cost',
      estimatedCostInr:
        exhaust === 'none' && budget !== 'low' ? '₹1,800 – ₹4,500 (exhaust fan)' : '₹0',
      actionSummary:
        fuel === 'biomass_solid'
          ? 'Avoid indoor solid/biomass cooking wherever possible; move combustion outdoors with cross-draft or transition toward LPG/induction.'
          : exhaust === 'chimney_or_exhaust'
            ? 'Switch on your kitchen chimney/exhaust 2 minutes before lighting the stove, cover pans with lids during boiling/tadka, and run exhaust 15 minutes after.'
            : exhaust === 'window_only'
              ? 'Cook on rear burners closest to the kitchen window, place a regular fan pointing outward to push smoke out, and keep lids on frying/tempering pans.'
              : 'Because the kitchen lacks direct exhaust, keep kitchen-to-bedroom doors closed while cooking, cover pots, and minimize high-heat smoke/charring.',
      tailoredReason:
        'High-heat oil tempering (tadka), frying, and gas/biomass flames create intense short-term indoor ultrafine particulate and NO2 spikes that linger in living spaces.',
      householdFitNote: `Configured for ${fuel.toUpperCase()} cooking with "${exhaust.replace(/_/g, ' ')}" kitchen ventilation.`,
      caveat:
        'Even an electric chimney requires clean grease baffle filters every 2–4 weeks to maintain outward airflow.',
    },
    {
      id: 'dust',
      topicNumber: 3,
      topicLabel: '3. Indoor Dust & Resuspension Control',
      costTier: 'low_cost',
      estimatedCostInr: '₹0 – ₹350 (microfiber cloths)',
      actionSummary:
        'Replace dry sweeping and feather dusting with daily wet-mopping and damp microfiber wiping; enforce a shoes-off entryway mat and launder curtains/bedding weekly.',
      tailoredReason:
        'Dry brooming lifts settled coarse road dust (PM10) and tracked-in heavy particles back into children’s and seniors’ breathing zone.',
      householdFitNote:
        housing === 'high_traffic_roadside'
          ? 'Critical for main-road housing where brake/tire dust and street silt settle rapidly on sills.'
          : `Beneficial across your ${profile.homeEnvironment.roomAreaSqFt} sq ft primary space for ${profile.members.children} child(ren) and ${profile.members.seniors} senior(s).`,
      caveat:
        'Wet-mopping controls settled dust resuspension but does not filter microscopic suspended outdoor PM2.5 entering through open gaps.',
    },
    {
      id: 'cleaning_combustion',
      topicNumber: 4,
      topicLabel: '4. Cleaning Products & Combustion Sources',
      costTier: 'low_cost',
      estimatedCostInr: '₹0 – ₹400',
      actionSummary:
        'Eliminate indoor incense (agarbatti), dhoop, scented candles, and burning mosquito coils; use fragrance-free mild detergents and dilute floor cleaners rather than aerosol sprays.',
      tailoredReason:
        'Smoldering incense/coils and harsh aerosol sprays release indoor PM2.5 and volatile organic compounds (VOCs) in enclosed rooms, aggravating asthma and airways.',
      householdFitNote: profile.sensitivities.hasAsthmaOrRespiratory
        ? 'High priority: household includes asthma/respiratory sensitivity—avoid bleach-ammonia mixing and aerosol air fresheners.'
        : 'Switch from mosquito coils to window mesh screens or electric liquid vaporizers in ventilated corridors.',
      caveat:
        'Never burn herbs, camphor, or incense believing it purifies indoor air—combustion always adds particulate load.',
    },
    {
      id: 'purifier_maintenance',
      topicNumber: 5,
      topicLabel: '5. Air Purifier Selection & Maintenance',
      costTier: hasPurifier ? 'medium_cost' : budget === 'low' ? 'medium_cost' : 'higher_cost',
      estimatedCostInr: hasPurifier
        ? '₹1,800 – ₹4,500 / yr (replacement HEPA)'
        : cadr.estimatedFilterBudgetInr,
      actionSummary: hasPurifier
        ? `Keep your purifier in the primary sleeping room (${profile.homeEnvironment.roomAreaSqFt} sq ft) on continuous medium/auto speed with doors closed and any ionizer/UV-ozone switch OFF. Vacuum the mesh pre-filter every 2 weeks and replace the HEPA cartridge every 6–12 months.`
        : budget === 'low'
          ? `A retail purifier (${cadr.estimatedFilterBudgetInr}) exceeds a low monthly budget; if purchasing later, choose a simple True HEPA (H13) unit sized for >= ${cadr.recommendedMinCadrM3h} m³/h (${cadr.recommendedCfm} CFM) CADR without ionizer features.`
          : `Select a certified True HEPA (H13) unit delivering at least ${cadr.recommendedMinCadrM3h} m³/h (${cadr.recommendedCfm} CFM) CADR for your ${profile.homeEnvironment.roomAreaSqFt} sq ft room (5 ACH target). Avoid ionizers that emit ozone.`,
      tailoredReason:
        'Air purifiers only sustain clean bedroom air when CADR matches room volume and clogged pre-filters/HEPA media are cleaned or replaced on schedule.',
      householdFitNote: `Sized for ${profile.homeEnvironment.roomAreaSqFt} sq ft (~${cadr.roomVolumeM3} m³ volume) at 5 Air Changes/Hour.`,
      caveat:
        'Never wash disposable paper HEPA pleats with water (only vacuum/rinse the outer mesh pre-filter); water ruins electrostatic fiber capture.',
    },
    {
      id: 'filtration',
      topicNumber: 6,
      topicLabel: '6. Practical Filtration Options by Budget',
      costTier: budget === 'flexible' ? 'higher_cost' : 'medium_cost',
      estimatedCostInr:
        budget === 'low'
          ? '₹1,800 – ₹3,200 (DIY MERV-13 fan box)'
          : budget === 'moderate'
            ? '₹2,500 – ₹8,500'
            : cadr.estimatedFilterBudgetInr,
      actionSummary:
        budget === 'low'
          ? 'For bedroom PM2.5 relief on a tight budget, tape a pleated MERV-13 / E11 replacement filter snugly to the intake side of a standard box/table fan (keep motor vents unobstructed and run only while attended).'
          : 'Focus filtration in one closed "clean-air sleeping room" overnight rather than running small purifiers in open living areas with wide-open balcony doors.',
      tailoredReason:
        'True HEPA (H13) and MERV-13 pleated media physically trap fine PM2.5 particles; houseplants cannot substitute for mechanical airflow filtration.',
      householdFitNote: `Aligned with "${budget}" monthly budget tier and ${hasPurifier ? 'existing purifier ownership' : 'no current retail purifier'}.`,
      caveat:
        'DIY fan-filter setups must never block motor cooling airflow or be left running unattended with frayed cords.',
    },
    {
      id: 'indoor_activity',
      topicNumber: 7,
      topicLabel: '7. Indoor Activity & Room Zoning Arrangements',
      costTier: 'low_cost',
      estimatedCostInr: '₹0',
      actionSummary:
        totalMembers >= 4 || profile.members.children > 0 || profile.members.seniors > 0
          ? 'Shift children’s active play and senior mobility exercises to an interior room away from kitchen cooking and street-facing balconies; sleep with doors closed in the cleanest room.'
          : 'Schedule indoor stretching, yoga, or strength work away from cooking hours and road-facing windows.',
      tailoredReason:
        'Creating a single low-dust, smoke-isolated recovery room lowers cumulative 24-hour particle inhalation for vulnerable family members during smog episodes.',
      householdFitNote: `Covers ${profile.members.adults} adult(s), ${profile.members.children} child(ren), and ${profile.members.seniors} senior(s).`,
      caveat:
        'Avoid vigorous indoor workouts right after frying/tadka before fumes have cleared.',
    },
  ];
}

export const INDOOR_MEASURES: IndoorMeasure[] = [
  {
    id: 'ind-wet-mop',
    category: 'dust',
    costTier: 'low_cost',
    title: 'Wet-mop floors and wipe sills daily (skip dry brooming)',
    detail:
      'Damp cloths and wet mopping trap settled PM10 and heavy dust instead of resuspending it into breathing height.',
    suitableFor: 'All households & budgets',
    budgetTiers: ['low', 'moderate', 'flexible'],
    estimatedCostInr: '₹0',
  },
  {
    id: 'ind-seal-gaps',
    category: 'ventilation',
    costTier: 'low_cost',
    title: 'Seal window & door under-gaps during smog peaks',
    detail:
      'Use rolled damp towels at night or adhesive foam weatherstripping along loose frames—especially useful for drafty or roadside homes.',
    suitableFor: 'Independent/drafty & roadside homes',
    budgetTiers: ['low', 'moderate', 'flexible'],
    estimatedCostInr: '₹0 – ₹350',
  },
  {
    id: 'ind-cooking-lid',
    category: 'cooking',
    costTier: 'low_cost',
    title: 'Cover pans, use back burners, and vent kitchen outward',
    detail:
      'High-heat oil tempering releases intense ultrafine particulate spikes; keep kitchen-to-bedroom doors closed during frying.',
    suitableFor: 'All kitchens (especially window-only/enclosed)',
    budgetTiers: ['low', 'moderate', 'flexible'],
    estimatedCostInr: '₹0',
  },
  {
    id: 'ind-no-incense',
    category: 'cleaning_combustion',
    costTier: 'low_cost',
    title: 'Stop indoor incense, dhoop, candles, and mosquito coils',
    detail:
      'Indoor burning never cleans air; switch to window mesh, non-aerosol cleaners, and fragrance-free mild detergents.',
    suitableFor: 'Essential for children, seniors & asthma',
    budgetTiers: ['low', 'moderate', 'flexible'],
    estimatedCostInr: '₹0 – ₹400',
  },
  {
    id: 'ind-indoor-zoning',
    category: 'indoor_activity',
    costTier: 'low_cost',
    title: 'Designate one low-dust sleeping/activity room away from traffic',
    detail:
      'Move indoor play and mobility routines away from street-facing balconies and kitchen fumes during peak smog.',
    suitableFor: 'Multi-member households & sensitive groups',
    budgetTiers: ['low', 'moderate', 'flexible'],
    estimatedCostInr: '₹0',
  },
  {
    id: 'ind-diy-filter',
    category: 'filtration',
    costTier: 'medium_cost',
    title: 'Build a DIY MERV-13 / HEPA fan-box filter or add kitchen exhaust',
    detail:
      'Mount a pleated MERV-13/E11 panel behind a box fan for bedroom filtration or install a basic outward exhaust fan in enclosed kitchens.',
    suitableFor: 'Low/moderate budget households needing filtration',
    budgetTiers: ['low', 'moderate'],
    estimatedCostInr: '₹1,800 – ₹4,500',
  },
  {
    id: 'ind-filter-maintenance',
    category: 'purifier_maintenance',
    costTier: 'medium_cost',
    title: 'Vacuum purifier pre-filter biweekly & budget annual HEPA replacement',
    detail:
      'Keep mesh pre-filters lint-free every 14 days, replace genuine H13 HEPA cores every 6–12 months, and keep ionizer toggles OFF.',
    suitableFor: 'Existing purifier owners',
    budgetTiers: ['moderate', 'flexible'],
    estimatedCostInr: '₹1,800 – ₹4,500 / yr',
  },
  {
    id: 'ind-hepa-unit',
    category: 'filtration',
    costTier: 'higher_cost',
    title: 'Deploy a True HEPA (H13) purifier sized for 5 ACH bedroom coverage',
    detail:
      'Match CADR to room volume with closed bedroom doors; avoid ozone-generating ionizers and keep spare pre-filter packs ready.',
    suitableFor: 'Moderate/flexible budgets & severe smog regions',
    budgetTiers: ['moderate', 'flexible'],
    estimatedCostInr: '₹7,000 – ₹18,000',
  },
];

