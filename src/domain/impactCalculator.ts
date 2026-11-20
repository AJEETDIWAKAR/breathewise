import type { ImpactLogEntry } from '../types/breathewise.ts';

export type BaselineVehicleMode = 'petrol_car' | 'diesel_car' | 'two_wheeler';
export type SustainableTransitMode =
  | 'metro_rail'
  | 'public_bus'
  | 'carpool'
  | 'walk_cycle'
  | 'work_from_home';

/**
 * Midpoint transport emission factors (g CO2e per passenger-km)
 * Grounded in India GHG Program / Shakti Sustainable Energy Foundation urban road transport studies.
 */
export const EMISSION_FACTORS_G_PER_PKM: Record<
  BaselineVehicleMode | SustainableTransitMode,
  number
> = {
  petrol_car: 140,
  diesel_car: 135,
  two_wheeler: 50,
  carpool: 47, // 3-occupant petrol car share
  public_bus: 40,
  metro_rail: 35,
  walk_cycle: 0,
  work_from_home: 0,
};

/**
 * Average urban India fuel economy assumptions (km/L) for displaced private trips.
 */
export const BASELINE_FUEL_EFFICIENCY_KM_PER_L: Record<BaselineVehicleMode, number> = {
  petrol_car: 14,
  diesel_car: 16,
  two_wheeler: 45,
};

export interface TransportShiftCalculation {
  emissionsAvoidedGrams: number;
  fuelSavedLitres: number;
  methodologyNote: string;
  assumptions: string;
}

export function calculateTransportShiftImpact(
  baselineMode: BaselineVehicleMode,
  chosenMode: SustainableTransitMode,
  distanceKm: number,
): TransportShiftCalculation {
  const safeDist = Math.max(0, Math.min(500, distanceKm));
  const baseEf = EMISSION_FACTORS_G_PER_PKM[baselineMode];
  const chosenEf = EMISSION_FACTORS_G_PER_PKM[chosenMode];
  const fuelKmPerL = BASELINE_FUEL_EFFICIENCY_KM_PER_L[baselineMode];

  const emissionsAvoidedGrams = Math.max(0, Math.round((baseEf - chosenEf) * safeDist));
  const fuelSavedLitres =
    emissionsAvoidedGrams > 0 ? Number((safeDist / fuelKmPerL).toFixed(2)) : 0;

  return {
    emissionsAvoidedGrams,
    fuelSavedLitres,
    methodologyNote: `(${baseEf} - ${chosenEf} g CO2e/pkm) × ${safeDist} km; fuel displaced at ${fuelKmPerL} km/L`,
    assumptions: `Assumes ${baselineMode.replace(/_/g, ' ')} at ${baseEf} g CO2e/pkm (${fuelKmPerL} km/L) displaced by ${chosenMode.replace(/_/g, ' ')} at ${chosenEf} g CO2e/pkm over ${safeDist} km.`,
  };
}

export interface ImpactTotals {
  totalEmissionsAvoidedKg: number;
  totalFuelSavedLitres: number;
  exposureProtectionActions: number;
  transportShiftsCount: number;
  householdEnergyActions: number;
  activeDaysCount: number;
}

export interface DailyImpactSummary {
  date: string;
  emissionsAvoidedKg: number;
  fuelSavedLitres: number;
  exposureActions: number;
  householdActions: number;
  totalEntries: number;
}

export function summarizeImpactLogs(logs: ImpactLogEntry[]): ImpactTotals {
  let totalGrams = 0;
  let totalFuel = 0;
  let exposureProtectionActions = 0;
  let transportShiftsCount = 0;
  let householdEnergyActions = 0;
  const distinctDates = new Set<string>();

  for (const entry of logs) {
    distinctDates.add(entry.date);
    if (entry.category === 'transport_shift') {
      totalGrams += entry.emissionsAvoidedGrams;
      totalFuel += entry.fuelSavedLitres;
      transportShiftsCount += 1;
    } else if (entry.category === 'exposure_protection') {
      // Exposure protection actions never fabricate CO2e or fuel savings
      exposureProtectionActions += Math.max(1, entry.exposureProtectionPoints);
    } else if (entry.category === 'energy_household') {
      totalGrams += entry.emissionsAvoidedGrams;
      householdEnergyActions += 1;
    }
  }

  return {
    totalEmissionsAvoidedKg: Number((totalGrams / 1000).toFixed(2)),
    totalFuelSavedLitres: Number(totalFuel.toFixed(2)),
    exposureProtectionActions,
    transportShiftsCount,
    householdEnergyActions,
    activeDaysCount: distinctDates.size,
  };
}

export function summarizeImpactByDate(logs: ImpactLogEntry[]): DailyImpactSummary[] {
  const byDate = new Map<
    string,
    {
      grams: number;
      fuel: number;
      exposureActions: number;
      householdActions: number;
      totalEntries: number;
    }
  >();

  for (const entry of logs) {
    const bucket = byDate.get(entry.date) ?? {
      grams: 0,
      fuel: 0,
      exposureActions: 0,
      householdActions: 0,
      totalEntries: 0,
    };

    bucket.totalEntries += 1;
    if (entry.category === 'transport_shift') {
      bucket.grams += entry.emissionsAvoidedGrams;
      bucket.fuel += entry.fuelSavedLitres;
    } else if (entry.category === 'exposure_protection') {
      bucket.exposureActions += Math.max(1, entry.exposureProtectionPoints);
    } else if (entry.category === 'energy_household') {
      bucket.grams += entry.emissionsAvoidedGrams;
      bucket.householdActions += 1;
    }

    byDate.set(entry.date, bucket);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, bucket]) => ({
      date,
      emissionsAvoidedKg: Number((bucket.grams / 1000).toFixed(2)),
      fuelSavedLitres: Number(bucket.fuel.toFixed(2)),
      exposureActions: bucket.exposureActions,
      householdActions: bucket.householdActions,
      totalEntries: bucket.totalEntries,
    }));
}

