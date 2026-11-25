import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, PlusCircle } from 'lucide-react';
import {
  calculateTransportShiftImpact,
  summarizeImpactByDate,
  summarizeImpactLogs,
  type BaselineVehicleMode,
  type SustainableTransitMode,
} from '../../domain/impactCalculator';
import { useAppState } from '../../state/AppStateContext';
import type { ImpactLogEntry } from '../../types/breathewise';
import { createEntryId } from '../../utils/id';
import { parseBoundedInt } from '../../utils/number';
import { ImpactHistorySection } from '../impact/ImpactHistorySection';
import { EditImpactModal, MethodologyModal } from '../impact/ImpactModals';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Selector } from '../ui/Selector';

const MODE_LABELS: Record<BaselineVehicleMode | SustainableTransitMode, string> = {
  petrol_car: 'Petrol Car',
  diesel_car: 'Diesel Car',
  two_wheeler: 'Two-Wheeler',
  metro_rail: 'Metro Rail',
  public_bus: 'Public Bus',
  carpool: 'Carpool',
  walk_cycle: 'Walk / Cycle',
  work_from_home: 'Work from Home',
};

export function ImpactPage() {
  const { impactLogs, addImpactLog, updateImpactLog, removeImpactLog, familyProfile } =
    useAppState();

  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));

  // Form 1: Transport Shift
  const [baselineMode, setBaselineMode] = useState<BaselineVehicleMode>('petrol_car');
  const [chosenMode, setChosenMode] = useState<SustainableTransitMode>('metro_rail');
  const [distanceKm, setDistanceKm] = useState<number>(
    Math.max(1, familyProfile.lifestyle.dailyCommuteKm || 12),
  );
  const [shiftDate, setShiftDate] = useState<string>(todayIso);
  const distanceTouchedRef = useRef(false);

  useEffect(() => {
    if (!distanceTouchedRef.current) {
      setDistanceKm(Math.max(1, familyProfile.lifestyle.dailyCommuteKm || 12));
    }
  }, [familyProfile.lifestyle.dailyCommuteKm]);

  // Form 2: Exposure-Management / Household Sustainability Action
  const [habitCategory, setHabitCategory] = useState<'exposure_protection' | 'energy_household'>(
    'exposure_protection',
  );
  const [habitTitle, setHabitTitle] = useState<string>('');
  const [habitDate, setHabitDate] = useState<string>(todayIso);
  const [habitAssumptions, setHabitAssumptions] = useState<string>('');
  const [habitError, setHabitError] = useState<string | null>(null);

  // Edit Modal state
  const [editingEntry, setEditingEntry] = useState<ImpactLogEntry | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>(todayIso);
  const [editBaselineMode, setEditBaselineMode] = useState<BaselineVehicleMode>('petrol_car');
  const [editChosenMode, setEditChosenMode] = useState<SustainableTransitMode>('metro_rail');
  const [editDistanceKm, setEditDistanceKm] = useState<number>(10);
  const [editAssumptions, setEditAssumptions] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const totals = summarizeImpactLogs(impactLogs);
  const dailyHistory = summarizeImpactByDate(impactLogs);
  const previewCalc = calculateTransportShiftImpact(baselineMode, chosenMode, distanceKm);

  const handleLogShift = (e: FormEvent) => {
    e.preventDefault();
    if (distanceKm <= 0) return;

    addImpactLog({
      id: createEntryId('shift'),
      date: shiftDate || todayIso,
      category: 'transport_shift',
      title: `Chose ${MODE_LABELS[chosenMode]} over ${MODE_LABELS[baselineMode]} (${distanceKm} km)`,
      baselineMode,
      chosenMode,
      distanceKm,
      emissionsAvoidedGrams: previewCalc.emissionsAvoidedGrams,
      fuelSavedLitres: previewCalc.fuelSavedLitres,
      exposureProtectionPoints: 0,
      methodologyNote: previewCalc.methodologyNote,
      assumptions: previewCalc.assumptions,
    });
  };

  const handleLogHabit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = habitTitle.trim();
    if (!trimmed) {
      setHabitError('Please describe the exposure-management or household sustainability action.');
      return;
    }
    setHabitError(null);

    const isExposure = habitCategory === 'exposure_protection';
    addImpactLog({
      id: createEntryId(isExposure ? 'exp' : 'hh'),
      date: habitDate || todayIso,
      category: habitCategory,
      title: trimmed,
      emissionsAvoidedGrams: 0,
      fuelSavedLitres: 0,
      exposureProtectionPoints: isExposure ? 1 : 0,
      methodologyNote: isExposure
        ? 'Exposure protection action only (0 g CO2e claimed)'
        : 'Household sustainability habit logged without fabricated CO2e or city-AQI claims',
      assumptions:
        habitAssumptions.trim() ||
        (isExposure
          ? 'Tracked strictly as personal/indoor health protection (no emissions reduction claimed).'
          : 'Tracked under household sustainability progress; exact utility/waste grams vary locally.'),
    });

    setHabitTitle('');
    setHabitAssumptions('');
  };

  const openEditModal = (entry: ImpactLogEntry) => {
    setEditingEntry(entry);
    setEditTitle(entry.title);
    setEditDate(entry.date);
    setEditBaselineMode(entry.baselineMode ?? 'petrol_car');
    setEditChosenMode(entry.chosenMode ?? 'metro_rail');
    setEditDistanceKm(entry.distanceKm ?? 10);
    setEditAssumptions(entry.assumptions ?? '');
    setEditError(null);
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError('Action title cannot be empty.');
      return;
    }
    setEditError(null);

    if (editingEntry.category === 'transport_shift') {
      const recalc = calculateTransportShiftImpact(
        editBaselineMode,
        editChosenMode,
        Math.max(1, editDistanceKm),
      );
      updateImpactLog(editingEntry.id, {
        ...editingEntry,
        title: trimmedTitle,
        date: editDate || editingEntry.date,
        baselineMode: editBaselineMode,
        chosenMode: editChosenMode,
        distanceKm: Math.max(1, editDistanceKm),
        emissionsAvoidedGrams: recalc.emissionsAvoidedGrams,
        fuelSavedLitres: recalc.fuelSavedLitres,
        methodologyNote: recalc.methodologyNote,
        assumptions: editAssumptions.trim() || recalc.assumptions,
      });
    } else {
      updateImpactLog(editingEntry.id, {
        ...editingEntry,
        title: trimmedTitle,
        date: editDate || editingEntry.date,
        emissionsAvoidedGrams: 0,
        fuelSavedLitres: 0,
        assumptions: editAssumptions.trim() || editingEntry.assumptions,
      });
    }

    setEditingEntry(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide">
            A. Personal Emissions Avoided
          </p>
          <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totals.totalEmissionsAvoidedKg} kg
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {totals.totalFuelSavedLitres} L fuel displaced across {totals.transportShiftsCount}{' '}
            transport shift(s)
          </p>
        </Card>

        <Card>
          <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
            B. Exposure-Management Actions
          </p>
          <p className="text-3xl font-bold text-teal-800 font-mono tabular-nums mt-1">
            {totals.exposureProtectionActions}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Health protection habits only (strictly 0 g CO2e claimed)
          </p>
        </Card>

        <Card>
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
            C. Household Sustainability Progress
          </p>
          <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totals.householdEnergyActions}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Energy, waste &amp; shopping habits across {totals.activeDaysCount} active day(s)
          </p>
        </Card>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-sky-950">
        <span>
          Avoided personal transport emissions do <strong>not</strong> equal a measurable drop in
          city-wide AQI readings. All estimates display documented assumptions and never turn
          unmeasured actions into fabricated CO2e figures.
        </span>
        <Button variant="secondary" size="sm" onClick={() => setMethodologyOpen(true)}>
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          View calculation methodology
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader
            title="Log Personal Transport Shift (Pillar A)"
            subtitle="Accounts for baseline vehicle, chosen transit mode, and distance using India GHG Program factors"
          />
          <form onSubmit={handleLogShift} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Selector
                label="Displaced baseline vehicle"
                value={baselineMode}
                onChange={setBaselineMode}
                options={[
                  { value: 'petrol_car', label: 'Petrol Car (140 g/pkm)' },
                  { value: 'diesel_car', label: 'Diesel Car (135 g/pkm)' },
                  { value: 'two_wheeler', label: 'Two-Wheeler (50 g/pkm)' },
                ]}
              />
              <Selector
                label="Chosen lower-emission mode"
                value={chosenMode}
                onChange={setChosenMode}
                options={[
                  { value: 'metro_rail', label: 'Metro Rail (35 g/pkm)' },
                  { value: 'public_bus', label: 'Public Bus (40 g/pkm)' },
                  { value: 'carpool', label: '3-Person Carpool (47 g/pkm)' },
                  { value: 'walk_cycle', label: 'Walk / Cycle (0 g/pkm)' },
                  { value: 'work_from_home', label: 'Work from Home (0 g/pkm)' },
                ]}
              />
              <Input
                label="Distance (km)"
                type="number"
                min={1}
                max={500}
                value={distanceKm}
                onChange={(e) => {
                  distanceTouchedRef.current = true;
                  setDistanceKm(parseBoundedInt(e.target.value, 1, 500, 1));
                }}
              />
              <Input
                label="Date"
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5">
              <strong>Recorded assumption:</strong> {previewCalc.assumptions}
            </p>

            <Button type="submit" variant="primary" size="md" className="w-full">
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Log shift ({(previewCalc.emissionsAvoidedGrams / 1000).toFixed(2)} kg CO2e ·{' '}
              {previewCalc.fuelSavedLitres} L)
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Log Exposure or Household Action (Pillars B & C)"
            subtitle="Record indoor protection habits or energy/waste/shopping actions without fabricated CO2e"
          />
          <form onSubmit={handleLogHabit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Selector
                label="Tracking pillar"
                value={habitCategory}
                onChange={setHabitCategory}
                options={[
                  {
                    value: 'exposure_protection',
                    label: 'B. Exposure-Management (0 g CO2e)',
                  },
                  {
                    value: 'energy_household',
                    label: 'C. Household Sustainability Progress',
                  },
                ]}
              />
              <Input
                label="Date"
                type="date"
                value={habitDate}
                onChange={(e) => setHabitDate(e.target.value)}
              />
            </div>

            <Input
              label="Action description"
              placeholder="e.g., Ran bedroom HEPA purifier overnight or composted garden leaves"
              value={habitTitle}
              errorText={habitError ?? undefined}
              onChange={(e) => {
                setHabitTitle(e.target.value);
                if (habitError) setHabitError(null);
              }}
              maxLength={140}
            />

            <Input
              label="Assumptions / notes (optional)"
              placeholder="e.g., Closed balcony doors and avoided incense"
              value={habitAssumptions}
              onChange={(e) => setHabitAssumptions(e.target.value)}
              maxLength={250}
            />

            <Button type="submit" variant="secondary" size="md" className="w-full">
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Add action to tracker
            </Button>
          </form>
        </Card>
      </div>

      <ImpactHistorySection
        dailyHistory={dailyHistory}
        impactLogs={impactLogs}
        onEditEntry={openEditModal}
        onRemoveEntry={removeImpactLog}
      />

      <EditImpactModal
        editingEntry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSubmit={handleSaveEdit}
        editTitle={editTitle}
        onChangeTitle={(value) => {
          setEditTitle(value);
          if (editError) setEditError(null);
        }}
        editDate={editDate}
        onChangeDate={setEditDate}
        editBaselineMode={editBaselineMode}
        onChangeBaselineMode={setEditBaselineMode}
        editChosenMode={editChosenMode}
        onChangeChosenMode={setEditChosenMode}
        editDistanceKm={editDistanceKm}
        onChangeDistanceKm={setEditDistanceKm}
        editAssumptions={editAssumptions}
        onChangeAssumptions={setEditAssumptions}
        editError={editError}
      />

      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  );
}
