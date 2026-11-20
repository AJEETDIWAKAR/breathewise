import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarDays, Pencil, PlusCircle, Trash2 } from 'lucide-react';
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
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Selector } from '../ui/Selector';
import { EmptyState } from '../ui/States';

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

const PILLAR_BADGES: Record<ImpactLogEntry['category'], { label: string; className: string }> = {
  transport_shift: {
    label: 'A. Emissions Avoided',
    className: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  exposure_protection: {
    label: 'B. Exposure Management',
    className: 'bg-teal-50 text-teal-900 border-teal-200',
  },
  energy_household: {
    label: 'C. Household Sustainability',
    className: 'bg-green-50 text-green-900 border-green-200',
  },
};

export function ImpactPage() {
  const { impactLogs, addImpactLog, updateImpactLog, removeImpactLog, familyProfile } =
    useAppState();

  const todayIso = new Date().toISOString().slice(0, 10);

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

  const handleLogShift = (e: React.FormEvent) => {
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

  const handleLogHabit = (e: React.FormEvent) => {
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

  const handleSaveEdit = (e: React.FormEvent) => {
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
      {/* Strict 3-Pillar Separation */}
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

      {/* Honest Scope Disclaimer */}
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

      {/* Dual Logger: Transport Shifts + Exposure/Sustainability Habits */}
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

      {/* Historical Progress by Date */}
      {dailyHistory.length > 0 && (
        <Card>
          <CardHeader
            title="Historical Progress by Date"
            subtitle="Daily breakdown keeping personal emissions avoided, exposure management, and household sustainability distinct"
            action={<CalendarDays className="w-4 h-4 text-teal-700" aria-hidden="true" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dailyHistory.map((day) => (
              <div
                key={day.date}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900">
                  <span>{day.date}</span>
                  <span className="text-slate-600">{day.totalEntries} log(s)</span>
                </div>
                <p className="text-sky-900 font-mono">
                  CO2e avoided: <strong>{day.emissionsAvoidedKg} kg</strong> ({day.fuelSavedLitres} L)
                </p>
                <p className="text-teal-900">
                  Exposure actions: <strong>{day.exposureActions}</strong>
                </p>
                <p className="text-green-900">
                  Household sustainability: <strong>{day.householdActions}</strong>
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity Ledger with Edit & Remove */}
      <Card>
        <CardHeader
          title="Household Action Ledger"
          subtitle="Add, edit, or remove entries anytime—persisted locally across sessions"
        />
        {impactLogs.length === 0 ? (
          <EmptyState
            title="No household actions logged yet"
            description="Log a commute shift or exposure/sustainability habit above to start tracking transparent progress."
          />
        ) : (
          <div>
            <div className="hidden md:grid md:grid-cols-12 gap-4 pb-2.5 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <div className="col-span-2">Date</div>
              <div className="col-span-6">Pillar &amp; Action</div>
              <div className="col-span-1 text-right">CO2e</div>
              <div className="col-span-1 text-right">Fuel</div>
              <div className="col-span-2 text-right">Manage</div>
            </div>

            <ul className="divide-y divide-slate-100">
              {impactLogs.map((entry) => {
                const pillar = PILLAR_BADGES[entry.category];
                return (
                  <li
                    key={entry.id}
                    className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-start hover:bg-slate-50 rounded px-1 -mx-1"
                  >
                    <div className="md:col-span-2 flex items-center justify-between md:block">
                      <span className="font-mono tabular-nums text-xs text-slate-600">
                        {entry.date}
                      </span>
                      <span
                        className={`md:hidden inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${pillar.className}`}
                      >
                        {pillar.label}
                      </span>
                    </div>

                    <div className="md:col-span-6 space-y-1 min-w-0">
                      <span
                        className={`hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${pillar.className}`}
                      >
                        {pillar.label}
                      </span>
                      <p className="text-sm font-medium text-slate-900 break-words">{entry.title}</p>
                      <p className="text-xs text-slate-600">{entry.methodologyNote}</p>
                      {entry.assumptions && (
                        <p className="text-xs text-slate-600">
                          <strong>Assumptions:</strong> {entry.assumptions}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center gap-4 md:grid md:grid-cols-2 md:gap-2 text-xs font-mono tabular-nums md:text-right pt-1 md:pt-0">
                      <span className="text-slate-900 font-semibold">
                        <span className="md:hidden text-slate-600 font-sans font-normal mr-1">
                          CO2e:
                        </span>
                        {(entry.emissionsAvoidedGrams / 1000).toFixed(2)} kg
                      </span>
                      <span className="text-slate-700">
                        <span className="md:hidden text-slate-600 font-sans font-normal mr-1">
                          Fuel:
                        </span>
                        {entry.fuelSavedLitres.toFixed(2)} L
                      </span>
                    </div>

                    <div className="md:col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        aria-label={`Edit logged action ${entry.title}`}
                        className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImpactLog(entry.id)}
                        aria-label={`Delete logged action ${entry.title}`}
                        className="p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      {/* Edit Action Modal */}
      <Modal
        open={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        title="Edit Logged Action"
        description={
          editingEntry?.category === 'transport_shift'
            ? 'Updating mode or distance automatically recalculates CO2e and fuel displaced.'
            : 'Update title, date, or recorded assumptions.'
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-impact-form" variant="primary" size="sm">
              Save changes
            </Button>
          </>
        }
      >
        {editingEntry && (
          <form id="edit-impact-form" onSubmit={handleSaveEdit} className="space-y-4" noValidate>
            <Input
              label="Action title"
              value={editTitle}
              errorText={editError ?? undefined}
              onChange={(e) => {
                setEditTitle(e.target.value);
                if (editError) setEditError(null);
              }}
              maxLength={140}
              required
            />
            <Input
              label="Date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              required
            />

            {editingEntry.category === 'transport_shift' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Selector
                  label="Baseline vehicle"
                  value={editBaselineMode}
                  onChange={setEditBaselineMode}
                  options={[
                    { value: 'petrol_car', label: 'Petrol Car' },
                    { value: 'diesel_car', label: 'Diesel Car' },
                    { value: 'two_wheeler', label: 'Two-Wheeler' },
                  ]}
                />
                <Selector
                  label="Chosen mode"
                  value={editChosenMode}
                  onChange={setEditChosenMode}
                  options={[
                    { value: 'metro_rail', label: 'Metro Rail' },
                    { value: 'public_bus', label: 'Public Bus' },
                    { value: 'carpool', label: 'Carpool' },
                    { value: 'walk_cycle', label: 'Walk / Cycle' },
                    { value: 'work_from_home', label: 'Work from Home' },
                  ]}
                />
                <Input
                  label="Distance (km)"
                  type="number"
                  min={1}
                  max={500}
                  value={editDistanceKm}
                  onChange={(e) => setEditDistanceKm(parseBoundedInt(e.target.value, 1, 500, 1))}
                />
              </div>
            )}

            <Input
              label="Assumptions / notes"
              value={editAssumptions}
              onChange={(e) => setEditAssumptions(e.target.value)}
              maxLength={400}
            />
          </form>
        )}
      </Modal>

      {/* Methodology Modal */}
      <Modal
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        title="Transparent Calculation Methodology"
        description="Documented emission factors & strict attribution boundaries"
        footer={
          <Button variant="primary" size="sm" onClick={() => setMethodologyOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            Transport emission factors use urban India passenger-km midpoint estimates (India GHG
            Program / Shakti Sustainable Energy Foundation):
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-slate-700">
            <li>Petrol Car: 140 g CO2e/pkm (assumed 14 km/L fuel economy)</li>
            <li>Diesel Car: 135 g CO2e/pkm (assumed 16 km/L fuel economy)</li>
            <li>Two-Wheeler: 50 g CO2e/pkm (assumed 45 km/L fuel economy)</li>
            <li>3-Person Carpool: 47 g CO2e/pkm</li>
            <li>Public City Bus: 40 g CO2e/pkm</li>
            <li>Metro / Urban Electric Rail: 35 g CO2e/pkm</li>
            <li>Walk / Cycle / Work from Home: 0 g CO2e/pkm direct tailpipe</li>
          </ul>
          <p>
            <strong>Three Separate Pillars:</strong> Avoided tailpipe emissions (Pillar A),
            pollution exposure-management habits (Pillar B: <strong>0 g CO2e claimed</strong>), and
            household sustainability actions (Pillar C) are never blended together or reported as
            a measured reduction in city-wide AQI.
          </p>
        </div>
      </Modal>
    </div>
  );
}

