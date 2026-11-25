import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Home,
  Leaf,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { AiChatResult } from '../../services/airQualityApi';
import type { AiRecommendationOutcome, AiStructuredAdvice } from '../../types/breathewise';
import { isSafeHttpUrl } from '../../utils/number';
import { Button } from '../ui/Button';

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: AiStructuredAdvice;
  responseSource?: 'gemini' | 'rule_based_fallback';
  aiAvailable?: boolean;
  aiUnavailableReason?: string;
  model?: string;
  groundedReading?: AiChatResult['groundedReading'];
  liveDataAvailable?: boolean;
  promptQuestion?: string;
}

function getOutcomeBadge(outcome: AiRecommendationOutcome) {
  switch (outcome) {
    case 'reduce_personal_exposure':
      return {
        label: 'Personal Exposure',
        classes: 'bg-sky-50 text-sky-900 border-sky-200',
        Icon: ShieldCheck,
      };
    case 'improve_indoor_air':
      return {
        label: 'Indoor Air',
        classes: 'bg-teal-50 text-teal-900 border-teal-200',
        Icon: Home,
      };
    case 'reduce_personal_emissions':
      return {
        label: 'Personal Emissions',
        classes: 'bg-green-50 text-green-900 border-green-200',
        Icon: Leaf,
      };
  }
}

function getConfidenceClasses(level: 'high' | 'moderate' | 'low'): string {
  if (level === 'high') return 'bg-green-50 text-green-800 border-green-200';
  if (level === 'moderate') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-slate-100 text-slate-800 border-slate-300';
}

export function AssistantMessageCard({
  msg,
  sending,
  onRetryWithGemini,
}: {
  msg: AssistantChatMessage;
  sending: boolean;
  onRetryWithGemini: (question: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="p-3.5 rounded-lg border border-teal-200 bg-teal-50 text-slate-900 text-sm leading-relaxed ml-6 sm:ml-12">
        <p className="text-xs font-semibold text-teal-900 mb-1">You</p>
        <p className="whitespace-pre-line">{msg.text}</p>
      </div>
    );
  }

  const isFallback = msg.responseSource === 'rule_based_fallback';
  const s = msg.structured;

  return (
    <div
      className={`p-4 rounded-lg border text-sm leading-relaxed mr-2 sm:mr-6 space-y-3.5 ${
        isFallback
          ? 'bg-amber-50/40 border-amber-300 text-slate-900'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Bot className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>BreatheWise AI Assistant</span>
          </span>
          {msg.responseSource === 'gemini' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-teal-50 text-teal-900 border-teal-200">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              <span>Gemini ({msg.model})</span>
            </span>
          )}
          {isFallback && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-amber-100 text-amber-950 border-amber-300">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              <span>Rule-Based Fallback (AI Unavailable)</span>
            </span>
          )}
        </div>

        {isFallback && msg.promptQuestion && (
          <Button
            variant="secondary"
            size="sm"
            disabled={sending}
            onClick={() => onRetryWithGemini(msg.promptQuestion ?? '')}
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Retry with Gemini</span>
          </Button>
        )}
      </div>

      {isFallback && msg.aiUnavailableReason && (
        <div
          role="status"
          className="px-3 py-2 rounded-md bg-amber-100/80 border border-amber-300 text-xs text-amber-950"
        >
          {msg.aiUnavailableReason}
        </div>
      )}

      {!s ? (
        <p className="whitespace-pre-line">{msg.text}</p>
      ) : (
        <div className="space-y-3.5">
          <p className="text-sm font-medium text-slate-900 leading-relaxed">{s.summary}</p>

          <div className="p-3 rounded-md bg-white border border-slate-200 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                Air-Quality Context · {s.currentAirQualityContext.locationName}
              </span>
              <span className="font-mono text-slate-700">
                {s.currentAirQualityContext.aqiSummary}
              </span>
            </div>

            <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
              {s.currentAirQualityContext.measuredFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>

            {s.currentAirQualityContext.missingData.length > 0 && (
              <div className="pt-1 border-t border-slate-100 text-slate-600">
                <span className="font-semibold">Missing data: </span>
                {s.currentAirQualityContext.missingData.join('; ')}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Actionable Recommendations by Outcome
            </p>
            <div className="space-y-2">
              {s.recommendations.map((rec, idx) => {
                const badge = getOutcomeBadge(rec.outcomeCategory);
                const OutcomeIcon = badge.Icon;
                return (
                  <div
                    key={`${rec.title}-${idx}`}
                    className="p-3 rounded-md bg-white border border-slate-200 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{rec.title}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded ${badge.classes}`}
                      >
                        <OutcomeIcon className="w-3 h-3" aria-hidden="true" />
                        <span>{badge.label}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{rec.action}</p>
                    <p className="text-[11px] font-mono text-slate-600">
                      Cost / budget: {rec.estimatedCostOrBudgetNote}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700">Explanation</p>
            <p className="text-xs text-slate-700 leading-relaxed">{s.explanation}</p>
          </div>

          <div className="p-3 rounded-md bg-white border border-slate-200 space-y-1">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
              <span>Precautions & Medical Boundaries</span>
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-700">
              {s.precautions.map((prec) => (
                <li key={prec}>{prec}</li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 font-semibold border rounded uppercase ${getConfidenceClasses(
                  s.confidenceAndLimitations.confidenceLevel,
                )}`}
              >
                Confidence: {s.confidenceAndLimitations.confidenceLevel}
              </span>
              <span>{s.confidenceAndLimitations.notes}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
              <span>Freshness: {s.dataFreshness}</span>
              <div className="flex flex-wrap items-center gap-3">
                {s.sources.map((src) =>
                  isSafeHttpUrl(src.url) ? (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-6 px-1 rounded inline-flex items-center gap-1 text-teal-800 hover:underline font-sans font-medium"
                    >
                      <span>{src.name}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span key={src.name} className="font-sans">
                      {src.name}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
