import { ExternalLink, Info } from 'lucide-react';
import type { AirQualityReading, FamilyProfile, LocationOption } from '../../types/breathewise';
import { Card, CardHeader } from '../ui/Card';

export const SUGGESTED_QUESTIONS = [
  'Is it safe to jog outside today?',
  'Should I send my child to play outside?',
  'How can I improve indoor air quality?',
  "What is causing today's pollution?",
  'Should I use public transport?',
  'What can I do with a ₹500 monthly budget?',
  'What changes should I make to my daily routine?',
  'What should my family do during severe smog?',
];

export function AssistantContextSidebar({
  location,
  currentReading,
  familyProfile,
  sending,
  onSelectQuestion,
}: {
  location: LocationOption;
  currentReading: AirQualityReading | null;
  familyProfile: FamilyProfile;
  sending: boolean;
  onSelectQuestion: (question: string) => void;
}) {
  const pm25Metric = currentReading?.pollutants.find((p) => p.key === 'pm25');

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Grounded Context & Prompts"
        subtitle="Every prompt anchors to verified AirLive telemetry"
      />
      <div className="p-3 bg-slate-50 rounded-md text-xs text-slate-700 space-y-1.5 border border-slate-200">
        <p className="font-semibold text-slate-900">Active Context Snapshot</p>
        <p>
          Location: {location.name}, {location.countryName || 'India'}
        </p>
        <p>
          Reading:{' '}
          {currentReading
            ? `${currentReading.aqi.scale === 'US_AQI' ? 'US AQI' : 'NAQI'} ${currentReading.aqi.value ?? 'N/A'} (${currentReading.aqi.category}) · PM2.5 ${pm25Metric?.value !== null && pm25Metric?.value !== undefined ? `${pm25Metric.value} µg/m³` : 'Unavailable'}`
            : 'Unavailable'}
        </p>
        {currentReading && (
          <>
            <p>
              Source: {currentReading.provenance.sourceLabel ?? currentReading.provenance.providerName}
            </p>
            <p className="font-mono text-[11px] text-slate-600">
              Freshness:{' '}
              {currentReading.provenance.freshnessStatus ??
                (currentReading.provenance.isStale ? 'stale' : 'fresh')}
            </p>
          </>
        )}
        <p>
          Household: {familyProfile.members.adults} adults, {familyProfile.members.children}{' '}
          children, {familyProfile.members.seniors} seniors ({familyProfile.homeEnvironment.budgetTier}{' '}
          budget)
        </p>
        <a
          href="https://airlive.tracsa.co.in"
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-6 px-1 rounded inline-flex items-center gap-1 text-teal-800 hover:underline font-medium"
        >
          <span>Data by AirLive</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-700">Suggested questions</p>
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending}
            onClick={() => onSelectQuestion(q)}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Exposure protection, indoor air cleanup, and personal emissions avoidance are tracked as
          distinct outcomes. Informational guidance only; never a substitute for medical care.
        </span>
      </div>
    </Card>
  );
}
