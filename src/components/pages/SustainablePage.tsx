import { useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { calculateTransportShiftImpact } from '../../domain/impactCalculator';
import {
  SUSTAINABLE_AREA_LABELS,
  getPersonalizedSustainableAlternatives,
  type SustainableAlternativeItem,
  type SustainableAreaId,
} from '../../domain/sustainableRules';
import { useAutoClearState } from '../../hooks/useAutoClearTimer';
import { useAppState } from '../../state/AppStateContext';
import { createEntryId } from '../../utils/id';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { SegmentedTabs } from '../ui/Selector';

type AreaFilter = 'all' | SustainableAreaId;

export function SustainablePage() {
  const { currentReading, familyProfile, addImpactLog, setActivePage } = useAppState();
  const [filter, setFilter] = useState<AreaFilter>('all');
  const [loggedId, triggerLoggedId] = useAutoClearState<string | null>(null, 2500);

  const activeAqi = currentReading?.aqi.value ?? null;
  const isUsAqi = !currentReading || currentReading.aqi.scale === 'US_AQI';

  const catalog = getPersonalizedSustainableAlternatives(familyProfile, currentReading);
  const filtered = filter === 'all' ? catalog : catalog.filter((item) => item.area === filter);

  const handleLogChoice = (item: SustainableAlternativeItem) => {
    const distance = Math.max(2, familyProfile.lifestyle.dailyCommuteKm || 10);
    if (item.defaultShift) {
      const calc = calculateTransportShiftImpact(
        item.defaultShift.baselineMode,
        item.defaultShift.chosenMode,
        distance,
      );
      addImpactLog({
        id: createEntryId('choice'),
        date: new Date().toISOString().slice(0, 10),
        category: 'transport_shift',
        title: `${item.title} (${distance} km)`,
        baselineMode: item.defaultShift.baselineMode,
        chosenMode: item.defaultShift.chosenMode,
        distanceKm: distance,
        emissionsAvoidedGrams: calc.emissionsAvoidedGrams,
        fuelSavedLitres: calc.fuelSavedLitres,
        exposureProtectionPoints: 0,
        methodologyNote: calc.methodologyNote,
        assumptions: item.assumptions,
      });
    } else {
      addImpactLog({
        id: createEntryId('choice'),
        date: new Date().toISOString().slice(0, 10),
        category: item.householdActionCategory ?? 'energy_household',
        title: item.title,
        emissionsAvoidedGrams: 0,
        fuelSavedLitres: 0,
        exposureProtectionPoints: 0,
        methodologyNote:
          'Household sustainability progress logged without fabricated g CO2e or city-AQI claims',
        assumptions: item.assumptions,
      });
    }
    triggerLoggedId(item.id);
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader
          title="Sustainable Household & Mobility Alternatives"
          subtitle="Covers private commuting, short trips, public & shared transit, home energy, waste, and shopping—with transparent costs and limitations"
        />

        <div className="mb-4 overflow-x-auto">
          <SegmentedTabs
            ariaLabel="Filter sustainable alternatives by area"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All 7 Areas' },
              { value: 'private_commute', label: SUSTAINABLE_AREA_LABELS.private_commute },
              { value: 'short_distance', label: SUSTAINABLE_AREA_LABELS.short_distance },
              { value: 'public_transit', label: SUSTAINABLE_AREA_LABELS.public_transit },
              { value: 'shared_transit', label: SUSTAINABLE_AREA_LABELS.shared_transit },
              { value: 'energy', label: SUSTAINABLE_AREA_LABELS.energy },
              { value: 'household_waste', label: SUSTAINABLE_AREA_LABELS.household_waste },
              { value: 'sustainable_shopping', label: SUSTAINABLE_AREA_LABELS.sustainable_shopping },
            ]}
          />
        </div>

        <div className="mb-5 bg-sky-50 border border-sky-200 rounded-md px-3.5 py-2.5 text-xs text-sky-950 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Walking and cycling suggestions are automatically gated when AQI exceeds safe thresholds
            (US AQI &gt; 100). Personal shifts reduce personal emissions and waste—they do not
            independently lower city-wide AQI.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const safeCeiling =
              item.maxSafeAqiForOutdoor !== null
                ? isUsAqi
                  ? item.maxSafeAqiForOutdoor
                  : 150
                : null;
            const unsafeNow =
              safeCeiling !== null && activeAqi !== null && activeAqi > safeCeiling;
            const justLogged = loggedId === item.id;

            return (
              <div
                key={item.id}
                className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-teal-800">
                        {item.areaLabel}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                        {item.title}
                      </h3>
                    </div>
                    {unsafeNow && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                        Unsafe at {isUsAqi ? 'US AQI' : 'NAQI'} {activeAqi}
                      </span>
                    )}
                  </div>

                  <dl className="space-y-2 text-xs text-slate-700">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-slate-600">
                        What to change
                      </dt>
                      <dd className="text-slate-800 mt-0.5">{item.whatToChange}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-slate-600">
                        Why it matters
                      </dt>
                      <dd className="mt-0.5">{item.whyItMatters}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-slate-600">
                        Alternative
                      </dt>
                      <dd className="text-slate-900 mt-0.5">{item.alternative}</dd>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-600">
                          Estimated cost or savings
                        </dt>
                        <dd className="text-slate-800 mt-0.5">{item.estimatedCostOrSavings}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-600">
                          Environmental benefits
                        </dt>
                        <dd className="text-teal-900 mt-0.5">{item.environmentalBenefit}</dd>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <dt className="font-semibold uppercase tracking-wide text-slate-600">
                        Practical limitations
                      </dt>
                      <dd className="text-slate-600 mt-0.5">{item.practicalLimitations}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant={justLogged ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={unsafeNow}
                    onClick={() => handleLogChoice(item)}
                  >
                    {justLogged ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Logged to tracker</span>
                      </>
                    ) : unsafeNow ? (
                      'Deferred (high AQI)'
                    ) : (
                      'Log this action'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setActivePage('impact')}
                    className="min-h-6 px-2 py-1 inline-flex items-center rounded text-xs font-medium text-slate-700 hover:text-teal-800 hover:bg-slate-100 cursor-pointer"
                  >
                    View impact tracker
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

