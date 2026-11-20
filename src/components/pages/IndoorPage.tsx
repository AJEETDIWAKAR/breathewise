import React, { useEffect, useState } from 'react';
import { CheckSquare, ShieldAlert, Square } from 'lucide-react';
import {
  INDOOR_EVIDENCE_BOUNDARIES,
  INDOOR_MEASURES,
  calculateCadr,
  findBestVentilationWindow,
  generateTailoredIndoorGuide,
  type CostGuideTier,
} from '../../domain/indoorRules';
import { useAppState } from '../../state/AppStateContext';
import { createEntryId } from '../../utils/id';
import { parseBoundedInt } from '../../utils/number';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { SegmentedTabs } from '../ui/Selector';

type CostTabFilter = 'all' | CostGuideTier;

const COST_TIER_LABELS: Record<CostGuideTier, string> = {
  low_cost: 'Low-Cost (₹0 – ₹1,500)',
  medium_cost: 'Medium-Cost (₹1,500 – ₹5,000)',
  higher_cost: 'Higher-Cost (> ₹5,000)',
};

export function IndoorPage() {
  const {
    currentReading,
    hourlyForecast,
    familyProfile,
    completedIndoorIds,
    toggleIndoorCompleted,
    addImpactLog,
    setActivePage,
  } = useAppState();

  const [roomAreaInput, setRoomAreaInput] = useState<number>(
    familyProfile.homeEnvironment.roomAreaSqFt,
  );
  const [costTab, setCostTab] = useState<CostTabFilter>('all');

  useEffect(() => {
    setRoomAreaInput(familyProfile.homeEnvironment.roomAreaSqFt);
  }, [familyProfile.homeEnvironment.roomAreaSqFt]);

  const ventWindow = findBestVentilationWindow(hourlyForecast, currentReading);
  const cadr = calculateCadr(Math.max(50, roomAreaInput));
  const tailoredTopics = generateTailoredIndoorGuide(
    familyProfile,
    currentReading,
    hourlyForecast,
  );
  const filteredMeasures =
    costTab === 'all'
      ? INDOOR_MEASURES
      : INDOOR_MEASURES.filter((m) => m.costTier === costTab);
  const totalMembers =
    familyProfile.members.adults +
    familyProfile.members.children +
    familyProfile.members.seniors;

  const handleToggleMeasure = (id: string, title: string) => {
    const wasDone = completedIndoorIds.includes(id);
    toggleIndoorCompleted(id);
    if (!wasDone) {
      addImpactLog({
        id: createEntryId('ind'),
        date: new Date().toISOString().slice(0, 10),
        category: 'exposure_protection',
        title: `Indoor air habit: ${title}`,
        emissionsAvoidedGrams: 0,
        fuelSavedLitres: 0,
        exposureProtectionPoints: 1,
        methodologyNote: 'Exposure protection action only (0 g CO2e claimed)',
        assumptions:
          'Tracked as personal/indoor exposure reduction; does not reduce outdoor emissions.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tailored Context Strip */}
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900">
              Tailored Indoor Air Quality Advisor
            </h2>
            <p className="text-sm text-slate-700">
              Configured for <strong>{familyProfile.householdName}</strong> ({totalMembers}{' '}
              member(s)),{' '}
              <span className="capitalize">
                {familyProfile.homeEnvironment.housingType.replace(/_/g, ' ')}
              </span>
              ,{' '}
              <span className="capitalize">
                {familyProfile.homeEnvironment.kitchenExhaust.replace(/_/g, ' ')}
              </span>{' '}
              kitchen exhaust, <strong>{familyProfile.homeEnvironment.budgetTier}</strong> budget,
              and{' '}
              {familyProfile.homeEnvironment.hasAirPurifier
                ? 'existing HEPA purifier'
                : 'no retail HEPA purifier'}
              .
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setActivePage('family')}>
            Adjust home profile
          </Button>
        </div>
      </Card>

      {/* Ventilation Window + CADR Sizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader
            title="Ventilation vs. Outdoor AQI Balance"
            subtitle="Ventilation effectiveness depends on both outdoor PM2.5 and indoor sources"
          />
          {ventWindow ? (
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-md flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-600">Lowest hourly outdoor PM2.5 interval</p>
                  <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    {ventWindow.startLabel} – {ventWindow.endLabel}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-sm font-semibold text-teal-800">
                    Min {ventWindow.scale === 'US_AQI' ? 'Est. US AQI' : 'Est. NAQI'}{' '}
                    {ventWindow.minNaqi}
                  </p>
                  <p className="text-xs text-slate-600">PM2.5 {ventWindow.minPm25} µg/m³</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{ventWindow.guidance}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              Hourly outdoor trajectory data is currently unavailable. BreatheWise does not assume
              an afternoon or morning window is cleaner without hourly measurements—keep roadside
              windows mostly closed and vent kitchens outward during cooking.
            </p>
          )}
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Room Purifier & CADR Sizer"
            subtitle="Sized for 5 Air Changes/Hour (2.7 m ceiling) without unsupported % guarantees"
          />
          <div className="space-y-4">
            <Input
              label="Primary room floor area (sq ft)"
              type="number"
              min={50}
              max={2500}
              value={roomAreaInput}
              onChange={(e) => setRoomAreaInput(parseBoundedInt(e.target.value, 0, 2500, 0))}
              onBlur={() => {
                if (roomAreaInput < 50) setRoomAreaInput(50);
              }}
            />
            <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 rounded-md py-3">
              <div className="px-3">
                <p className="text-xs text-slate-600">Min CADR</p>
                <p className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  {cadr.recommendedMinCadrM3h} m³/h
                </p>
              </div>
              <div className="px-3">
                <p className="text-xs text-slate-600">Equivalent CFM</p>
                <p className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  {cadr.recommendedCfm} CFM
                </p>
              </div>
              <div className="px-3">
                <p className="text-xs text-slate-600">Est. HEPA range</p>
                <p className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                  {cadr.estimatedFilterBudgetInr}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 7-Topic Tailored Indoor Guidance */}
      <Card padding="lg">
        <CardHeader
          title="7-Area Household Indoor Air Guide"
          subtitle="Actionable guidance across ventilation, cooking smoke, dust, cleaning/combustion, purifier maintenance, filtration, and room zoning"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tailoredTopics.map((topic) => (
            <div
              key={topic.id}
              className="p-4 bg-white border border-slate-200 rounded-lg space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{topic.topicLabel}</h3>
                <span className="text-xs font-mono text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                  {COST_TIER_LABELS[topic.costTier]}
                </span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{topic.actionSummary}</p>
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                <p>
                  <strong>Why it helps:</strong> {topic.tailoredReason}
                </p>
                <p>
                  <strong>Household fit:</strong> {topic.householdFitNote} · Est. spend:{' '}
                  <span className="font-mono">{topic.estimatedCostInr}</span>
                </p>
                <p className="text-slate-600">
                  <strong>Limitation:</strong> {topic.caveat}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Practical Low / Medium / Higher Cost Checklist */}
      <Card padding="lg">
        <CardHeader
          title="Practical Cost-Tier Improvement Guide"
          subtitle="Filter by low-cost, medium-cost, or higher-cost steps and log completed exposure habits"
          action={
            <SegmentedTabs
              ariaLabel="Filter indoor measures by cost tier"
              value={costTab}
              onChange={setCostTab}
              options={[
                { value: 'all', label: 'All Tiers' },
                { value: 'low_cost', label: 'Low-Cost' },
                { value: 'medium_cost', label: 'Medium-Cost' },
                { value: 'higher_cost', label: 'Higher-Cost' },
              ]}
            />
          }
        />

        <ul className="divide-y divide-slate-200">
          {filteredMeasures.map((measure) => {
            const done = completedIndoorIds.includes(measure.id);
            return (
              <li
                key={measure.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium text-teal-800">
                      {COST_TIER_LABELS[measure.costTier]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Est. cost: {measure.estimatedCostInr}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Best for: {measure.suitableFor}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{measure.title}</h3>
                  <p className="text-sm text-slate-600">{measure.detail}</p>
                </div>
                <Button
                  variant={done ? 'secondary' : 'primary'}
                  size="sm"
                  className="shrink-0 self-start"
                  onClick={() => handleToggleMeasure(measure.id, measure.title)}
                  aria-pressed={done}
                >
                  {done ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Done</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Mark done</span>
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Evidence Boundaries Card */}
      <Card padding="lg">
        <div className="flex items-start gap-2.5 mb-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Evidence Boundaries &amp; Indoor Safety Rules
            </h3>
            <p className="text-xs text-slate-600">
              What BreatheWise explicitly avoids recommending indoors
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INDOOR_EVIDENCE_BOUNDARIES.map((rule) => (
            <div
              key={rule.id}
              className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-md space-y-1"
            >
              <h4 className="text-sm font-semibold text-slate-900">{rule.title}</h4>
              <p className="text-xs text-slate-700 leading-relaxed">{rule.explanation}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

