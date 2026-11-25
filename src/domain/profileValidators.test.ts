import { describe, expect, it } from 'vitest';
import { DEFAULT_FAMILY_PROFILE } from '../data/previewFixtures';
import {
  parseStoredImpactLogs,
  parseStoredLocationOption,
  parseStoredSettings,
  parseStoredStringArray,
  validateFamilyProfile,
} from './profileValidators';

describe('validateFamilyProfile', () => {
  it('accepts a valid household profile and trims householdName', () => {
    const res = validateFamilyProfile({
      ...DEFAULT_FAMILY_PROFILE,
      householdName: '  Sharma Family  ',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.householdName).toBe('Sharma Family');
    }
  });

  it('applies defaults for optional enum fields when omitted', () => {
    const profileWithoutOptionals = {
      ...DEFAULT_FAMILY_PROFILE,
      lifestyle: {
        primaryCommute: 'metro_rail',
        dailyCommuteKm: 12,
        preferredOutdoorActivity: 'walking',
        outdoorExerciseTime: 'midday',
      },
      homeEnvironment: {
        budgetTier: 'low',
        cookingFuel: 'lpg',
        hasAirPurifier: false,
        roomAreaSqFt: 160,
      },
    };
    const res = validateFamilyProfile(profileWithoutOptionals);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.lifestyle.workSchedule).toBe('morning_evening_commute');
      expect(res.data.lifestyle.schoolSchedule).toBe('morning_afternoon');
      expect(res.data.homeEnvironment.housingType).toBe('apartment_sealed');
      expect(res.data.homeEnvironment.kitchenExhaust).toBe('window_only');
    }
  });

  it('rejects non-object, wrong version, invalid name, and invalid timestamp', () => {
    expect(validateFamilyProfile(null).success).toBe(false);
    expect(validateFamilyProfile([]).success).toBe(false);
    expect(validateFamilyProfile({ ...DEFAULT_FAMILY_PROFILE, version: 2 }).success).toBe(false);

    const badName = validateFamilyProfile({ ...DEFAULT_FAMILY_PROFILE, householdName: '   ' });
    expect(badName.success).toBe(false);
    if (!badName.success) {
      expect(badName.field).toBe('householdName');
    }

    expect(
      validateFamilyProfile({ ...DEFAULT_FAMILY_PROFILE, updatedAt: 12345 }).success,
    ).toBe(false);
  });

  it('rejects invalid members, sensitivities, lifestyle, and homeEnvironment sections', () => {
    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        members: { adults: -1, children: 1, seniors: 0 },
      }).success,
    ).toBe(false);

    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        sensitivities: { ...DEFAULT_FAMILY_PROFILE.sensitivities, hasOutdoorWorker: 'yes' },
      }).success,
    ).toBe(false);

    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        lifestyle: { ...DEFAULT_FAMILY_PROFILE.lifestyle, dailyCommuteKm: 999 },
      }).success,
    ).toBe(false);

    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        lifestyle: { ...DEFAULT_FAMILY_PROFILE.lifestyle, workSchedule: 'invalid_sched' },
      }).success,
    ).toBe(false);

    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        homeEnvironment: { ...DEFAULT_FAMILY_PROFILE.homeEnvironment, roomAreaSqFt: 10 },
      }).success,
    ).toBe(false);

    expect(
      validateFamilyProfile({
        ...DEFAULT_FAMILY_PROFILE,
        homeEnvironment: { ...DEFAULT_FAMILY_PROFILE.homeEnvironment, housingType: 'tent' },
      }).success,
    ).toBe(false);
  });
});

describe('storage validators', () => {
  it('parses valid locations and migrates legacy slugs', () => {
    expect(parseStoredLocationOption(null)).toBeNull();
    expect(parseStoredLocationOption({ id: 'delhi', name: 'Delhi' })).toBeNull();

    const migrated = parseStoredLocationOption({
      id: 'delhi-anand-vihar',
      name: 'Anand Vihar',
      city: 'Delhi',
      state: 'India',
      country: 'IN',
      countryName: 'India',
      kind: 'city',
      lat: 28.6469,
      lon: 77.3164,
    });
    expect(migrated?.slug).toBe('anand-vihar-delhi');
    expect(migrated?.country).toBe('IN');
  });

  it('parses settings and normalizes legacy naqi preference to aqi', () => {
    expect(parseStoredSettings('bad')).toBeNull();
    expect(
      parseStoredSettings({
        preferredUnit: 'naqi',
        enableThresholdAlerts: true,
        dataModePreference: 'live',
      }),
    ).toEqual({
      preferredUnit: 'aqi',
      enableThresholdAlerts: true,
      dataModePreference: 'live',
    });
    expect(
      parseStoredSettings({
        preferredUnit: 'invalid',
        enableThresholdAlerts: true,
        dataModePreference: 'live',
      }),
    ).toBeNull();
  });

  it('parses valid impact logs and rejects malformed entries', () => {
    expect(parseStoredImpactLogs('not-array')).toBeNull();
    expect(parseStoredImpactLogs([{ id: 'x', title: '' }])).toBeNull();

    const valid = parseStoredImpactLogs([
      {
        id: 'log-1',
        date: '2026-11-24',
        category: 'transport_shift',
        title: 'Took Metro instead of car',
        baselineMode: 'petrol_car',
        chosenMode: 'metro_rail',
        distanceKm: 14,
        emissionsAvoidedGrams: 1470,
        fuelSavedLitres: 1.0,
        exposureProtectionPoints: 0,
        methodologyNote: 'India GHG Program factors',
        assumptions: '14 km urban commute',
        updatedAt: '2026-11-24T08:00:00Z',
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid?.[0].chosenMode).toBe('metro_rail');

    expect(
      parseStoredImpactLogs([
        {
          id: 'log-2',
          date: '2026-11-24',
          category: 'exposure_protection',
          title: 'Wet mop',
          emissionsAvoidedGrams: -5,
          fuelSavedLitres: 0,
          exposureProtectionPoints: 10,
          methodologyNote: 'Zero cost',
        },
      ]),
    ).toBeNull();

    expect(
      parseStoredImpactLogs([
        {
          id: 'log-3',
          date: '2026-11-24',
          category: 'exposure_protection',
          title: 'Wet mop',
          baselineMode: 'rocket',
          emissionsAvoidedGrams: 0,
          fuelSavedLitres: 0,
          exposureProtectionPoints: 10,
          methodologyNote: 'Zero cost',
        },
      ]),
    ).toBeNull();
  });

  it('parses string arrays strictly', () => {
    expect(parseStoredStringArray('not-array')).toBeNull();
    expect(parseStoredStringArray(['a', 123])).toBeNull();
    expect(parseStoredStringArray(['morning', 'evening'])).toEqual(['morning', 'evening']);
  });
});
