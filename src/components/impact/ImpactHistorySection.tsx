import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import type { DailyImpactSummary } from '../../domain/impactCalculator';
import type { ImpactLogEntry } from '../../types/breathewise';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

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

export function ImpactHistorySection({
  dailyHistory,
  impactLogs,
  onEditEntry,
  onRemoveEntry,
}: {
  dailyHistory: DailyImpactSummary[];
  impactLogs: ImpactLogEntry[];
  onEditEntry: (entry: ImpactLogEntry) => void;
  onRemoveEntry: (id: string) => void;
}) {
  return (
    <>
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
                        onClick={() => onEditEntry(entry)}
                        aria-label={`Edit logged action ${entry.title}`}
                        className="min-w-8 min-h-8 inline-flex items-center justify-center p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveEntry(entry.id)}
                        aria-label={`Delete logged action ${entry.title}`}
                        className="min-w-8 min-h-8 inline-flex items-center justify-center p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
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
    </>
  );
}
