import type { AirQualityReading, FamilyProfile } from '../types/breathewise.ts';

export type SustainableAreaId =
  | 'private_commute'
  | 'short_distance'
  | 'public_transit'
  | 'shared_transit'
  | 'energy'
  | 'household_waste'
  | 'sustainable_shopping';

export interface SustainableAlternativeItem {
  id: string;
  area: SustainableAreaId;
  areaLabel: string;
  title: string;
  whatToChange: string;
  whyItMatters: string;
  alternative: string;
  estimatedCostOrSavings: string;
  environmentalBenefit: string;
  practicalLimitations: string;
  maxSafeAqiForOutdoor: number | null;
  defaultShift?: {
    baselineMode: 'petrol_car' | 'diesel_car' | 'two_wheeler';
    chosenMode: 'metro_rail' | 'public_bus' | 'carpool' | 'walk_cycle' | 'work_from_home';
  };
  householdActionCategory?: 'energy_household' | 'exposure_protection';
  assumptions: string;
}

export const SUSTAINABLE_AREA_LABELS: Record<SustainableAreaId, string> = {
  private_commute: 'Private Commute',
  short_distance: 'Short Distance',
  public_transit: 'Public Transit',
  shared_transit: 'Shared Transit',
  energy: 'Home Energy',
  household_waste: 'Household Waste',
  sustainable_shopping: 'Sustainable Shopping',
};

export function getPersonalizedSustainableAlternatives(
  profile: FamilyProfile,
  reading: AirQualityReading | null,
): SustainableAlternativeItem[] {
  const commuteKm = Math.max(2, profile.lifestyle.dailyCommuteKm || 12);
  const activeFuelCostEstimate =
    profile.lifestyle.primaryCommute === 'petrol_car' ||
    profile.lifestyle.primaryCommute === 'diesel_car'
      ? `Displaces ~${(commuteKm / 14).toFixed(1)} L petrol/day; net savings depend on local Metro/bus fare vs. fuel & parking`
      : 'Net savings depend on city transit fares vs. private fuel/parking expenses';

  const baselineFromProfile: 'petrol_car' | 'diesel_car' | 'two_wheeler' =
    profile.lifestyle.primaryCommute === 'diesel_car'
      ? 'diesel_car'
      : profile.lifestyle.primaryCommute === 'two_wheeler'
        ? 'two_wheeler'
        : 'petrol_car';

  const aqiNote =
    reading && reading.aqi.value !== null
      ? `Current reading is ${reading.aqi.scale === 'US_AQI' ? 'US AQI' : 'NAQI'} ${reading.aqi.value} (${reading.aqi.category}).`
      : 'Live AQI is currently unavailable; verify local air quality before choosing open-air walking/cycling.';

  return [
    {
      id: 'alt-private-commute-wfh',
      area: 'private_commute',
      areaLabel: 'Private Commute',
      title: 'Batch errands & use hybrid/remote workdays to eliminate solo car trips',
      whatToChange: `Replace recurring solo ${profile.lifestyle.primaryCommute.replace(/_/g, ' ')} trips (${commuteKm} km) with consolidated weekly errands or remote workdays when possible.`,
      whyItMatters:
        'Single-occupant urban cars emit ~135–140 g CO2e per passenger-km and keep commuters idling inside roadside NO2 and brake-dust corridors.',
      alternative:
        'Schedule 1–2 remote workdays/week or combine grocery, pharmacy, and school pickups into a single linked loop.',
      estimatedCostOrSavings:
        profile.lifestyle.primaryCommute === 'petrol_car' ||
        profile.lifestyle.primaryCommute === 'diesel_car'
          ? `Saves ~${(commuteKm / 14).toFixed(1)} L fuel per skipped ${commuteKm} km car round trip (cost varies with local fuel prices)`
          : 'No reliable single rupee estimate; depends on job flexibility and trip length',
      environmentalBenefit:
        'Eliminates 100% of that trip’s personal tailpipe CO2e, brake/tire wear particulates, and roadside exhaust exposure.',
      practicalLimitations:
        'Not feasible for field, hospital, retail, or factory roles without remote options; does not independently reduce city-wide AQI.',
      maxSafeAqiForOutdoor: null,
      defaultShift: {
        baselineMode: baselineFromProfile,
        chosenMode: 'work_from_home',
      },
      assumptions: `Calculated using documented ${baselineFromProfile.replace(/_/g, ' ')} baseline vs. 0 g/pkm work-from-home over ${commuteKm} km.`,
    },
    {
      id: 'alt-short-distance-walk-cycle',
      area: 'short_distance',
      areaLabel: 'Short Distance',
      title: 'Walk or cycle short neighborhood trips (< 3 km) during clean air windows',
      whatToChange: 'Avoid starting a car or scooter for short 1–3 km local errands when air quality is safe.',
      whyItMatters:
        'Cold vehicle engines produce disproportionately high hydrocarbon and CO emissions per km during the first few minutes of short trips.',
      alternative:
        'Walk or bicycle along quieter interior lanes away from diesel truck corridors—only when US AQI <= 100.',
      estimatedCostOrSavings:
        'Zero fare spend on short trips; minimal reliable savings figure for one-off errands',
      environmentalBenefit:
        'Zero tailpipe CO2e (0 g/pkm) and lower cold-start exhaust near residential streets.',
      practicalLimitations: `${aqiNote} Unsafe during Unhealthy/Severe smog (US AQI > 100) because higher breathing rates multiply inhaled PM2.5; lacks protected lanes in many wards.`,
      maxSafeAqiForOutdoor: 100,
      defaultShift: {
        baselineMode: baselineFromProfile,
        chosenMode: 'walk_cycle',
      },
      assumptions:
        'Applies 0 g CO2e/pkm for walking/cycling vs. baseline vehicle factor; strictly gated above US AQI 100.',
    },
    {
      id: 'alt-public-transit-metro',
      area: 'public_transit',
      areaLabel: 'Public Transit',
      title: 'Switch main arterial commute to Metro rail or AC city bus',
      whatToChange: `Replace private ${baselineFromProfile.replace(/_/g, ' ')} commutes along trunk corridors with urban rail or public buses.`,
      whyItMatters:
        'Urban Metro rail (~35 g CO2e/pkm) and buses (~40 g CO2e/pkm) carry far more commuters per unit of road space and energy than solo cars (~140 g CO2e/pkm).',
      alternative:
        'Use Metro rail with an enclosed feeder/e-rickshaw (wear a fitted N95 on open last-mile segments during smog).',
      estimatedCostOrSavings: activeFuelCostEstimate,
      environmentalBenefit:
        'Avoids ~100–105 g CO2e per passenger-km vs. petrol cars and reduces per-person fuel demand.',
      practicalLimitations:
        'Last-mile walk/wait exposure near busy roads during high smog; coverage and peak crowding vary by city.',
      maxSafeAqiForOutdoor: null,
      defaultShift: {
        baselineMode: baselineFromProfile,
        chosenMode: 'metro_rail',
      },
      assumptions:
        'Based on India GHG Program passenger-km factors (Metro 35 g/pkm vs. baseline vehicle).',
    },
    {
      id: 'alt-shared-transit-carpool',
      area: 'shared_transit',
      areaLabel: 'Shared Transit',
      title: '3-person office or school carpool / shared shuttle',
      whatToChange: 'Consolidate single-occupant daily office or school runs into a shared vehicle.',
      whyItMatters:
        'Sharing one petrol car across 3 passengers cuts per-commuter emissions from 140 g to ~47 g CO2e/pkm while keeping occupants in an enclosed cabin.',
      alternative:
        'Organize a 3-household rotating carpool or employer/school van using cabin air recirculation on smog days.',
      estimatedCostOrSavings:
        'Splits fuel and toll/parking spend 2–3 ways; exact savings depend on route and parking rates',
      environmentalBenefit:
        'Reduces per-person commute CO2e by roughly two-thirds relative to three separate solo cars.',
      practicalLimitations:
        'Requires aligned schedules and pickup points; enclosed cabins still need recirculated airflow to avoid stale CO2 buildup on long rides.',
      maxSafeAqiForOutdoor: null,
      defaultShift: {
        baselineMode: baselineFromProfile,
        chosenMode: 'carpool',
      },
      assumptions:
        'Assumes 3 occupants sharing a 140 g CO2e/pkm petrol car (~47 g/pkm per occupant).',
    },
    {
      id: 'alt-energy-efficiency',
      area: 'energy',
      areaLabel: 'Home Energy',
      title: 'Optimize water heating, cooling setpoints & clean electric cooking habits',
      whatToChange:
        'Lower electric geyser standby heating, set AC/heater thermostats sensibly, use pressure cookers/lids, and switch off idle appliances.',
      whyItMatters:
        'Household electricity and cooking fuel consumption drive indirect grid emissions and indoor kitchen combustion fumes.',
      alternative:
        'Heat water only before use (timer/manual switch), cook pulses in pressure cookers/induction with lids, and clean AC/chimney filters monthly.',
      estimatedCostOrSavings:
        'Savings vary by local electricity slab tariff and appliance wattage; no fixed rupee figure assumed',
      environmentalBenefit:
        'Lowers household energy demand, reduces kitchen fuel burn, and cuts indoor NO2/particulate accumulation.',
      practicalLimitations:
        'Upfront induction/appliance upgrades may not fit low-budget households immediately; focus first on zero-cost timer and lid habits.',
      maxSafeAqiForOutdoor: null,
      householdActionCategory: 'energy_household',
      assumptions:
        'Logged as a household sustainability action; exact kWh savings depend on local utility usage and are not fabricated.',
    },
    {
      id: 'alt-household-waste',
      area: 'household_waste',
      areaLabel: 'Household Waste',
      title: 'Segregate dry/wet waste & strictly eliminate leaf or trash burning',
      whatToChange:
        'Never burn garden leaves, cardboard, packaging, or winter trash piles outdoors or in residential alleys.',
      whyItMatters:
        'Open biomass and plastic waste burning emits dense local PM2.5, dioxins, and acrid smoke that immediately infiltrates neighboring ground-floor homes.',
      alternative:
        'Compost dry garden leaves/kitchen scraps or bag them for municipal wet/dry waste collection.',
      estimatedCostOrSavings: '₹0 for municipal segregation; basic home compost bin ~₹600 – ₹1,800',
      environmentalBenefit:
        'Prevents toxic localized smoke spikes and diverts organics from methane-emitting landfills.',
      practicalLimitations:
        'Requires consistent apartment/RWA coordination or space for composting; municipal pickup reliability varies by locality.',
      maxSafeAqiForOutdoor: null,
      householdActionCategory: 'energy_household',
      assumptions:
        'Recorded under household sustainability progress without fabricating unverified city-level AQI or tonnage numbers.',
    },
    {
      id: 'alt-sustainable-shopping',
      area: 'sustainable_shopping',
      areaLabel: 'Sustainable Shopping',
      title: 'Consolidate deliveries, repair durables & prioritize refill/local produce',
      whatToChange:
        'Avoid frequent single-item express delivery orders and excessive disposable packaging.',
      whyItMatters:
        'Split rush deliveries multiply last-mile two-wheeler/van trips in residential lanes and add packaging waste that often ends up incinerated or landfilled.',
      alternative:
        'Bundle weekly household orders into a single delivery day, carry reusable bags locally, and repair/refill home goods before replacing.',
      estimatedCostOrSavings:
        'Often reduces delivery surcharges and impulse spend; exact savings vary by household basket',
      environmentalBenefit:
        'Reduces unnecessary local delivery vehicle kilometers and single-use packaging waste.',
      practicalLimitations:
        'Urgent medicines/essentials cannot always be batched; refill stores may have limited neighborhood coverage.',
      maxSafeAqiForOutdoor: null,
      householdActionCategory: 'energy_household',
      assumptions:
        'Tracked under household sustainability habits; per-order delivery emissions vary too widely to claim a fixed gram figure.',
    },
  ];
}
