import { useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useAutoClearState } from '../../hooks/useAutoClearTimer';
import { useAppState } from '../../state/AppStateContext';
import { validateFamilyProfile } from '../../domain/profileValidators';
import type { FamilyProfile } from '../../types/breathewise';
import { parseBoundedInt } from '../../utils/number';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Selector } from '../ui/Selector';

export function FamilyPage() {
  const { familyProfile, updateFamilyProfile, setActivePage } = useAppState();
  const [draftState, setDraftState] = useState<{ base: FamilyProfile; value: FamilyProfile } | null>(
    null,
  );
  const draft = draftState && draftState.base === familyProfile ? draftState.value : familyProfile;
  const setDraft = (next: FamilyProfile) => setDraftState({ base: familyProfile, value: next });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [savedBanner, showSavedBanner, clearSavedBanner] = useAutoClearState(false, 4000);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = draft.householdName.trim();
    const cleanedDraft: FamilyProfile = {
      ...draft,
      householdName: trimmedName,
    };
    const parsed = validateFamilyProfile(cleanedDraft);
    if (!parsed.success) {
      setHouseholdError(
        parsed.field === 'householdName'
          ? 'Enter a household label (at least 1 character).'
          : null,
      );
      setErrorMsg(parsed.message);
      clearSavedBanner();
      return;
    }
    setDraft(parsed.data);
    setHouseholdError(null);
    setErrorMsg(null);
    updateFamilyProfile(parsed.data);
    showSavedBanner(true);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6" noValidate>
      <Card padding="lg">
        <CardHeader
          title="Household Composition & Health Sensitivities"
          subtitle="Only essential household details are stored locally in your browser to tailor outdoor safety, indoor measures, and commute advice."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Household label"
            value={draft.householdName}
            errorText={householdError ?? undefined}
            onChange={(e) => {
              setDraft({ ...draft, householdName: e.target.value });
              if (householdError) setHouseholdError(null);
            }}
            maxLength={60}
            required
          />
          <Input
            label="Primary bedroom / living area (sq ft)"
            type="number"
            min={50}
            max={2500}
            value={draft.homeEnvironment.roomAreaSqFt}
            onChange={(e) =>
              setDraft({
                ...draft,
                homeEnvironment: {
                  ...draft.homeEnvironment,
                  roomAreaSqFt: parseBoundedInt(e.target.value, 0, 2500, 0),
                },
              })
            }
            onBlur={() => {
              if (draft.homeEnvironment.roomAreaSqFt < 50) {
                setDraft({
                  ...draft,
                  homeEnvironment: { ...draft.homeEnvironment, roomAreaSqFt: 50 },
                });
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Input
            label="Adults (18–64)"
            type="number"
            min={0}
            max={15}
            value={draft.members.adults}
            onChange={(e) =>
              setDraft({
                ...draft,
                members: { ...draft.members, adults: parseBoundedInt(e.target.value, 0, 15, 0) },
              })
            }
          />
          <Input
            label="Children (0–17)"
            type="number"
            min={0}
            max={15}
            value={draft.members.children}
            onChange={(e) =>
              setDraft({
                ...draft,
                members: { ...draft.members, children: parseBoundedInt(e.target.value, 0, 15, 0) },
              })
            }
          />
          <Input
            label="Seniors (65+)"
            type="number"
            min={0}
            max={15}
            value={draft.members.seniors}
            onChange={(e) =>
              setDraft({
                ...draft,
                members: { ...draft.members, seniors: parseBoundedInt(e.target.value, 0, 15, 0) },
              })
            }
          />
        </div>

        <fieldset className="mt-6 space-y-2.5">
          <legend className="text-sm font-medium text-slate-800">
            Household exposure & health considerations
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'hasAsthmaOrRespiratory' as const,
                label: 'Asthma, bronchitis, or respiratory sensitivity',
              },
              {
                key: 'hasHeartCondition' as const,
                label: 'Cardiovascular condition in household',
              },
              {
                key: 'hasPregnantMember' as const,
                label: 'Pregnant member in household',
              },
              {
                key: 'hasOutdoorWorker' as const,
                label: 'Outdoor worker (field, delivery, transit)',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer text-sm text-slate-800"
              >
                <input
                  type="checkbox"
                  checked={draft.sensitivities[item.key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sensitivities: { ...draft.sensitivities, [item.key]: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-teal-700"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Schedules, Outdoor Habits & Commute"
          subtitle="Guides daily time-block advice across work, school, outdoor routines, and travel modes."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Selector
            label="Primary daily commute mode"
            value={draft.lifestyle.primaryCommute}
            onChange={(val) =>
              setDraft({ ...draft, lifestyle: { ...draft.lifestyle, primaryCommute: val } })
            }
            options={[
              { value: 'petrol_car', label: 'Petrol Car' },
              { value: 'diesel_car', label: 'Diesel Car' },
              { value: 'two_wheeler', label: 'Two-Wheeler (Scooter/Bike)' },
              { value: 'metro_rail', label: 'Metro / Urban Rail' },
              { value: 'public_bus', label: 'Public Bus' },
              { value: 'carpool', label: 'Carpool / Shared Cab' },
              { value: 'walk_cycle', label: 'Walk or Cycle' },
              { value: 'work_from_home', label: 'Work / Study from Home' },
            ]}
          />

          <Input
            label="Typical round-trip commute distance (km)"
            type="number"
            min={0}
            max={200}
            value={draft.lifestyle.dailyCommuteKm}
            onChange={(e) =>
              setDraft({
                ...draft,
                lifestyle: { ...draft.lifestyle, dailyCommuteKm: parseBoundedInt(e.target.value, 0, 200, 0) },
              })
            }
          />

          <Selector
            label="Work schedule pattern"
            value={draft.lifestyle.workSchedule}
            onChange={(val) =>
              setDraft({ ...draft, lifestyle: { ...draft.lifestyle, workSchedule: val } })
            }
            options={[
              { value: 'morning_evening_commute', label: 'Fixed Morning & Evening Commute' },
              { value: 'flexible_hybrid', label: 'Flexible / Hybrid Remote' },
              { value: 'shift_work', label: 'Shift / Off-Peak Schedule' },
              { value: 'home_based', label: 'Home-Based / Retired' },
            ]}
          />

          <Selector
            label="School / college schedule"
            value={draft.lifestyle.schoolSchedule}
            onChange={(val) =>
              setDraft({ ...draft, lifestyle: { ...draft.lifestyle, schoolSchedule: val } })
            }
            options={[
              { value: 'morning_afternoon', label: 'Morning Departure & Afternoon Return' },
              { value: 'online_or_none', label: 'Home Study / No School Commute' },
            ]}
          />

          <Selector
            label="Primary outdoor activity pattern"
            value={draft.lifestyle.preferredOutdoorActivity}
            onChange={(val) =>
              setDraft({
                ...draft,
                lifestyle: { ...draft.lifestyle, preferredOutdoorActivity: val },
              })
            }
            options={[
              { value: 'walking', label: 'Brisk Walking / Errands' },
              { value: 'running_sports', label: 'Running / Outdoor Sports' },
              { value: 'park_play', label: 'Children Park Play / Senior Stroll' },
              { value: 'none', label: 'Minimal Outdoor Exercise' },
            ]}
          />

          <Selector
            label="Usual outdoor activity window"
            value={draft.lifestyle.outdoorExerciseTime}
            onChange={(val) =>
              setDraft({
                ...draft,
                lifestyle: { ...draft.lifestyle, outdoorExerciseTime: val },
              })
            }
            options={[
              { value: 'early_morning', label: 'Early Morning (06:00 – 09:00)' },
              { value: 'midday', label: 'Midday (12:00 – 16:00)' },
              { value: 'evening', label: 'Evening (17:00 – 20:00)' },
            ]}
          />
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Housing Conditions, Equipment & Monthly Budget"
          subtitle="Constrains indoor air advice, kitchen smoke control, and filtration options to realistic household conditions."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Selector
            label="Monthly clean-air budget tier"
            value={draft.homeEnvironment.budgetTier}
            onChange={(val) =>
              setDraft({
                ...draft,
                homeEnvironment: { ...draft.homeEnvironment, budgetTier: val },
              })
            }
            options={[
              { value: 'low', label: 'Low (< ₹1,500 / month · Zero/low-cost measures)' },
              { value: 'moderate', label: 'Moderate (₹1,500 – ₹5,000 / month)' },
              { value: 'flexible', label: 'Flexible (> ₹5,000 / month · HEPA filtration ready)' },
            ]}
          />

          <Selector
            label="Primary cooking fuel"
            value={draft.homeEnvironment.cookingFuel}
            onChange={(val) =>
              setDraft({
                ...draft,
                homeEnvironment: { ...draft.homeEnvironment, cookingFuel: val },
              })
            }
            options={[
              { value: 'lpg', label: 'LPG Gas' },
              { value: 'induction', label: 'Electric / Induction' },
              { value: 'biomass_solid', label: 'Solid Fuel / Biomass' },
            ]}
          />

          <Selector
            label="Housing & window sealing condition"
            value={draft.homeEnvironment.housingType}
            onChange={(val) =>
              setDraft({
                ...draft,
                homeEnvironment: { ...draft.homeEnvironment, housingType: val },
              })
            }
            options={[
              { value: 'apartment_sealed', label: 'Apartment with Well-Fitted Windows' },
              { value: 'independent_leaky', label: 'Independent House / Drafty Window Gaps' },
              { value: 'high_traffic_roadside', label: 'Facing Main Road / Heavy Traffic Dust' },
            ]}
          />

          <Selector
            label="Kitchen ventilation & exhaust setup"
            value={draft.homeEnvironment.kitchenExhaust}
            onChange={(val) =>
              setDraft({
                ...draft,
                homeEnvironment: { ...draft.homeEnvironment, kitchenExhaust: val },
              })
            }
            options={[
              { value: 'chimney_or_exhaust', label: 'Electric Chimney or Outward Exhaust Fan' },
              { value: 'window_only', label: 'Window Ventilation Only' },
              { value: 'none', label: 'Enclosed Kitchen (No Direct Exhaust)' },
            ]}
          />
        </div>

        <label className="mt-4 flex items-center gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer text-sm text-slate-800">
          <input
            type="checkbox"
            checked={draft.homeEnvironment.hasAirPurifier}
            onChange={(e) =>
              setDraft({
                ...draft,
                homeEnvironment: { ...draft.homeEnvironment, hasAirPurifier: e.target.checked },
              })
            }
            className="w-4 h-4 accent-teal-700"
          />
          <span>Household already owns a HEPA air purifier</span>
        </label>

        {errorMsg && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="md">
            Save Family Profile
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={() => setActivePage('planner')}>
            <span>View Personalized Daily Plan</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          {savedBanner && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800" role="status">
              <Check className="w-4 h-4" aria-hidden="true" />
              Profile saved locally
            </span>
          )}
        </div>
      </Card>
    </form>
  );
}

