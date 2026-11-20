# BreatheWise – Data Models & Calculation Specifications

All data structures are defined in TypeScript and validated at runtime boundaries using **Zod**.

---

## 1. Air Quality Domain Models

### `NaqiCategory` (CPCB India 6-Band Standard)
```ts
export type NaqiCategory =
  | 'Good'                 // 0–50
  | 'Satisfactory'         // 51–100
  | 'Moderately Polluted'  // 101–200
  | 'Poor'                 // 201–300
  | 'Very Poor'            // 301–400
  | 'Severe';              // 401–500
```

### `AirQualityReading`
```ts
export interface PollutantMetric {
  value: number;       // concentration
  unit: 'µg/m³' | 'mg/m³';
  subIndex?: number;   // CPCB NAQI sub-index (0–500)
}

export interface AirQualityReading {
  location: {
    name: string;
    lat: number;
    lon: number;
    distanceKm?: number;
  };
  aqi: {
    value: number;                  // max(subIndices) per CPCB worst-pollutant rule
    scale: 'INDIA_CPCB_NAQI';
    category: NaqiCategory;
    dominantPollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3' | 'NH3' | 'UNKNOWN';
  };
  pollutants: {
    pm25?: PollutantMetric;
    pm10?: PollutantMetric;
    no2?: PollutantMetric;
    so2?: PollutantMetric;
    co?: PollutantMetric;
    o3?: PollutantMetric;
    nh3?: PollutantMetric;
  };
  provenance: {
    providerId: 'openaq_v3' | 'cpcb_data_gov' | 'waqi' | 'open_meteo_cams';
    providerName: string;
    stationName?: string;
    measurementType: 'ground_station' | 'modeled_forecast';
    observedAt: string;             // ISO-8601 UTC
    fetchedAt: string;              // ISO-8601 UTC
    isStale: boolean;               // true if observedAt > 3 hours old
    attribution: string;            // Mandatory provider/agency credit
  };
}
```

### CPCB NAQI Linear Segmented Interpolation Formula
For any pollutant concentration $C_p$ within breakpoint $[B_{\text{lo}}, B_{\text{hi}}]$ and corresponding index $[I_{\text{lo}}, I_{\text{hi}}]$:
$$I_p = \text{round}\left( \frac{I_{\text{hi}} - I_{\text{lo}}}{B_{\text{hi}} - B_{\text{lo}}} \cdot (C_p - B_{\text{lo}}) + I_{\text{lo}} \right)$$
Overall NAQI = $\max(I_p)$ across valid pollutants (requiring PM2.5 or PM10).

---

## 2. Family Profile Model

```ts
export type BudgetTier = 'low' | 'moderate' | 'flexible';
export type CommuteMode =
  | 'petrol_car'
  | 'diesel_car'
  | 'two_wheeler'
  | 'metro_rail'
  | 'public_bus'
  | 'carpool'
  | 'walk_cycle'
  | 'work_from_home';

export interface FamilyProfile {
  version: 1;
  householdName?: string;
  members: {
    adults: number;        // 0–15
    children: number;      // 0–15 (ages 0–17)
    seniors: number;       // 0–15 (ages 65+)
  };
  sensitivities: {
    hasAsthmaOrRespiratory: boolean;
    hasHeartCondition: boolean;
    hasPregnantMember: boolean;
    hasOutdoorWorker: boolean;
  };
  lifestyle: {
    primaryCommute: CommuteMode;
    dailyCommuteKm: number;         // round-trip km, 0–200
    preferredOutdoorActivity: 'walking' | 'running_sports' | 'park_play' | 'none';
    outdoorExerciseTime: 'early_morning' | 'midday' | 'evening';
  };
  homeEnvironment: {
    budgetTier: BudgetTier;
    cookingFuel: 'lpg' | 'induction' | 'biomass_solid';
    hasAirPurifier: boolean;
    roomAreaSqFt?: number;          // used for CADR sizing
  };
  updatedAt: string;
}
```

---

## 3. Smart Planner & Indoor Advisor Models

```ts
export interface DailyTimeBlock {
  period: 'morning' | 'midday' | 'evening' | 'night';
  timeRange: string;                // e.g., "06:00 – 10:00"
  outdoorRisk: 'low' | 'moderate' | 'high' | 'severe';
  recommendedActivity: string;
  maskGuidance: 'none' | 'optional_n95' | 'n95_recommended' | 'n95_essential_minimize_outdoor';
  ventilationAction: 'open_windows' | 'brief_cross_vent' | 'keep_sealed';
  commuteNote: string;
}

export interface CadrRecommendation {
  roomAreaSqFt: number;
  recommendedMinCadrM3h: number;    // 5 Air Changes/Hour at 2.7m ceiling height
  estimatedFilterBudgetInr: string;
  lowCostAlternatives: string[];
}
```

### CADR Formula (5 Air Changes per Hour for Severe Pollution)
$$\text{CADR}_{\text{m}^3/\text{h}} = (\text{Area}_{\text{sq ft}} \times 0.092903) \times 2.7\,\text{m} \times 5\,\text{ACH}$$

---

## 4. Environmental Impact Tracker Models

```ts
export type ImpactActionCategory =
  | 'transport_shift'     // emits CO2e reduction + optional fuel saving
  | 'exposure_protection' // counts protective health habits ONLY (0 CO2e claim)
  | 'energy_household';   // household energy / zero-burning habit

export interface ImpactLogEntry {
  id: string;
  date: string;                     // YYYY-MM-DD
  category: ImpactActionCategory;
  title: string;
  // Transport shift fields (only when category === 'transport_shift')
  baselineMode?: 'petrol_car' | 'diesel_car' | 'two_wheeler';
  chosenMode?: 'metro_rail' | 'public_bus' | 'carpool' | 'walk_cycle' | 'work_from_home';
  distanceKm?: number;
  // Computed transparent outputs
  emissionsAvoidedGrams: number;
  fuelSavedLitres: number;
  exposureProtectionPoints: number; // discrete count (1 per verified protective habit)
  methodologyNote: string;
}
```

### Transparent Transport Emission Factors (India GHG Program / Shakti Foundation Midpoints)
- **Petrol Car (solo/avg occupancy):** `140 g CO2e / passenger-km` (mid-size urban India driving cycle; fuel efficiency assumption `14 km/L`).
- **Diesel Car:** `135 g CO2e / passenger-km` (fuel efficiency assumption `16 km/L`).
- **Two-Wheeler (petrol scooter/motorcycle):** `50 g CO2e / passenger-km` (fuel efficiency assumption `45 km/L`).
- **Metro / Urban Electric Rail:** `35 g CO2e / passenger-km` (accounts for Indian grid electricity mix).
- **Public Bus (CNG/Diesel city bus):** `40 g CO2e / passenger-km`.
- **Carpool (3 occupants in petrol car):** `47 g CO2e / passenger-km` (`140 / 3`).
- **Walk / Cycle / WFH:** `0 g CO2e / passenger-km`.

**Formula:**
$$\text{CO}_2\text{e Avoided (g)} = \max\left(0, (\text{EF}_{\text{baseline}} - \text{EF}_{\text{chosen}}) \times \text{Distance}_{\text{km}}\right)$$

---

## 5. Client Persistence Schema (LocalStorage)

All client state is stored under versioned keys with safe JSON parsing + Zod validation on hydration:
- `breathewise.v1.profile` → `FamilyProfile`
- `breathewise.v1.location` → `{ id, name, lat, lon }`
- `breathewise.v1.impactLogs` → `ImpactLogEntry[]`
- `breathewise.v1.cachedAqi` → Last successful `AirQualityReading` (for offline display, strictly flagged as offline/stale).

No user PII (names, phone numbers, email addresses, exact home addresses) is required or stored on the server.
