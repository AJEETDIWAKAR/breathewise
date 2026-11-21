import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Home,
  Info,
  Leaf,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  buildRuleBasedFallbackAdvice,
  formatAdviceAsPlainText,
} from '../../domain/aiRuleBasedAdvice';
import { ApiClientError, sendAiChatMessage, type AiChatResult } from '../../services/airQualityApi';
import { useAppState } from '../../state/AppStateContext';
import type { AiRecommendationOutcome, AiStructuredAdvice } from '../../types/breathewise';
import { createEntryId } from '../../utils/id';
import { isSafeHttpUrl } from '../../utils/number';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ErrorMessage, UnavailableNotice } from '../ui/States';

interface ChatMessage {
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

const MAX_QUESTION_LENGTH = 1000;

const SUGGESTED_QUESTIONS = [
  'Is it safe to jog outside today?',
  'Should I send my child to play outside?',
  'How can I improve indoor air quality?',
  "What is causing today's pollution?",
  'Should I use public transport?',
  'What can I do with a ₹500 monthly budget?',
  'What changes should I make to my daily routine?',
  'What should my family do during severe smog?',
];

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

export function AssistantPage() {
  const { currentReading, familyProfile, location, isOffline, setActivePage } = useAppState();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatErrorCode, setChatErrorCode] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro-1',
      role: 'assistant',
      text: `Ask any question about outdoor safety, school play, indoor filtration, ₹500 budget actions, or daily commutes for ${location.name}. Answers are grounded in live AirLive telemetry and anonymized household context.`,
    },
  ]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeLocationSlugRef = useRef<string>(location.slug);

  useEffect(() => {
    if (activeLocationSlugRef.current !== location.slug) {
      activeLocationSlugRef.current = location.slug;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setSending(false);
      setChatError(null);
      setChatErrorCode(null);
      setValidationError(null);
      setLastFailedQuestion(null);
      setMessages([
        {
          id: 'intro-1',
          role: 'assistant',
          text: `Location switched to ${location.name}. Ask any question about outdoor safety, school play, indoor filtration, ₹500 budget actions, or daily commutes grounded in live AirLive telemetry for ${location.name}.`,
        },
      ]);
    }
  }, [location.name, location.slug]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleSubmit = async (questionText: string, options?: { skipUserBubble?: boolean }) => {
    const trimmed = questionText.trim();
    if (!trimmed) {
      setValidationError('Please enter a question before sending.');
      return;
    }
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      setValidationError(`Question is too long (${trimmed.length}/${MAX_QUESTION_LENGTH} characters).`);
      return;
    }
    if (sending) return;

    setValidationError(null);
    setChatError(null);
    setChatErrorCode(null);
    setLastFailedQuestion(null);

    const historyPayload = messages
      .filter((m) => m.id !== 'intro-1')
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    if (!options?.skipUserBubble) {
      const userMsg: ChatMessage = {
        id: createEntryId('u'),
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSending(true);

    try {
      const result = await sendAiChatMessage(
        {
          message: trimmed,
          slug: location.slug,
          city: location.city,
          lat: location.lat,
          lon: location.lon,
          history: historyPayload,
          familyProfile,
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;

      const assistantMsg: ChatMessage = {
        id: createEntryId('a'),
        role: 'assistant',
        text: result.reply,
        structured: result.structured,
        responseSource: result.responseSource,
        aiAvailable: result.aiAvailable,
        aiUnavailableReason: result.aiUnavailableReason,
        model: result.model,
        groundedReading: result.groundedReading,
        liveDataAvailable: result.liveDataAvailable,
        promptQuestion: trimmed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to reach BreatheWise AI assistant endpoint.';
      setChatError(message);
      setChatErrorCode(err instanceof ApiClientError ? err.code : null);
      setLastFailedQuestion(trimmed);
    } finally {
      if (!controller.signal.aborted) {
        setSending(false);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleUseDeterministicFallback = () => {
    const question = lastFailedQuestion?.trim();
    if (!question) return;
    const structured = buildRuleBasedFallbackAdvice({
      question,
      reading: currentReading,
      unavailableReason: currentReading
        ? null
        : 'Live AirLive reading is unavailable for the selected location.',
      requestedLocation: location.name,
      profile: familyProfile,
    });
    const fallbackMsg: ChatMessage = {
      id: createEntryId('a'),
      role: 'assistant',
      text: formatAdviceAsPlainText(structured),
      structured,
      responseSource: 'rule_based_fallback',
      aiAvailable: false,
      aiUnavailableReason:
        'The AI Assistant backend service is unavailable on this host. Showing deterministic rule-based AQI guidance instead (not generated by Gemini).',
      model: 'rule-based-fallback',
      liveDataAvailable: currentReading !== null,
      promptQuestion: question,
    };
    setMessages((prev) => [...prev, fallbackMsg]);
    setChatError(null);
    setChatErrorCode(null);
    setLastFailedQuestion(null);
  };

  const handleClearHistory = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSending(false);
    setChatError(null);
    setChatErrorCode(null);
    setValidationError(null);
    setLastFailedQuestion(null);
    setMessages([
      {
        id: 'intro-1',
        role: 'assistant',
        text: `Conversation cleared. Ask any air quality question for ${location.name} to receive structured, AirLive-grounded guidance.`,
      },
    ]);
  };

  const pm25Metric = currentReading?.pollutants.find((p) => p.key === 'pm25');

  return (
    <div className="space-y-6">
      {chatError && (
        <ErrorMessage
          headingLevel="h2"
          title={
            chatErrorCode === 'BACKEND_API_UNAVAILABLE'
              ? 'AI server endpoint unavailable'
              : 'Assistant request failed'
          }
          message={chatError}
          onRetry={
            lastFailedQuestion
              ? () => {
                  void handleSubmit(lastFailedQuestion, { skipUserBubble: true });
                }
              : undefined
          }
          secondaryAction={
            chatErrorCode === 'BACKEND_API_UNAVAILABLE' && lastFailedQuestion ? (
              <>
                <Button variant="primary" size="sm" onClick={handleUseDeterministicFallback}>
                  Show rule-based guidance (No AI)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setActivePage('planner')}>
                  Open Daily Planner
                </Button>
              </>
            ) : undefined
          }
        />
      )}

      {isOffline && (
        <UnavailableNotice
          headingLevel="h2"
          title="You appear to be offline"
          message="Sending new AI assistant questions requires an active connection to the BreatheWise server."
        />
      )}

      {!currentReading && !isOffline && (
        <UnavailableNotice
          headingLevel="h2"
          title="Live AirLive telemetry unavailable for selected location"
          message="You can still ask protective questions—the assistant will report that live AQI data is currently unavailable instead of inventing numbers."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col min-h-[560px]">
          <CardHeader
            title="AI Air Quality Assistant"
            subtitle={`Grounded in AirLive (${location.name}) · Minimized household context`}
            action={
              messages.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear chat</span>
                </Button>
              ) : undefined
            }
          />

          <div
            className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4"
            role="log"
            aria-live="polite"
            aria-label="Assistant conversation"
          >
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-lg border border-teal-200 bg-teal-50 text-slate-900 text-sm leading-relaxed ml-6 sm:ml-12"
                  >
                    <p className="text-xs font-semibold text-teal-900 mb-1">You</p>
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                );
              }

              const isFallback = msg.responseSource === 'rule_based_fallback';
              const s = msg.structured;

              return (
                <div
                  key={msg.id}
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
                        onClick={() =>
                          void handleSubmit(msg.promptQuestion ?? '', { skipUserBubble: true })
                        }
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
                      {/* Summary */}
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">
                        {s.summary}
                      </p>

                      {/* Current Air-Quality Context */}
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
                          {s.currentAirQualityContext.measuredFacts.map((fact, i) => (
                            <li key={i}>{fact}</li>
                          ))}
                        </ul>

                        {s.currentAirQualityContext.missingData.length > 0 && (
                          <div className="pt-1 border-t border-slate-100 text-slate-600">
                            <span className="font-semibold">Missing data: </span>
                            {s.currentAirQualityContext.missingData.join('; ')}
                          </div>
                        )}
                      </div>

                      {/* Recommendations clearly separated by outcome */}
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
                                  <span className="text-xs font-semibold text-slate-900">
                                    {rec.title}
                                  </span>
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

                      {/* Explanation */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700">Explanation</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{s.explanation}</p>
                      </div>

                      {/* Precautions */}
                      <div className="p-3 rounded-md bg-white border border-slate-200 space-y-1">
                        <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                          <span>Precautions & Medical Boundaries</span>
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-700">
                          {s.precautions.map((prec, idx) => (
                            <li key={idx}>{prec}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Confidence, Sources & Freshness */}
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
                            {s.sources.map((src, idx) =>
                              isSafeHttpUrl(src.url) ? (
                                <a
                                  key={idx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-6 px-1 rounded inline-flex items-center gap-1 text-teal-800 hover:underline font-sans font-medium"
                                >
                                  <span>{src.name}</span>
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              ) : (
                                <span key={idx} className="font-sans">
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
            })}

            {sending && (
              <div
                role="status"
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 mr-6 flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin text-teal-700" aria-hidden="true" />
                <span>Consulting Gemini with live AirLive telemetry for {location.name}...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(input);
            }}
            className="space-y-2 pt-3 border-t border-slate-200"
            noValidate
          >
            {validationError && (
              <p className="text-xs text-red-700 font-medium" role="alert">
                {validationError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="assistant-question-input" className="sr-only">
                Ask an air quality question
              </label>
              <input
                id="assistant-question-input"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Ask about outdoor play, ₹500 budget, indoor air, or commute choices..."
                disabled={sending}
                aria-invalid={Boolean(validationError)}
                className="flex-1 min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-md placeholder:text-slate-500 focus:outline-none focus:border-teal-700 disabled:bg-slate-50"
              />
              <Button type="submit" variant="primary" size="md" disabled={sending}>
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{sending ? 'Sending...' : 'Send'}</span>
              </Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>Only anonymized household & lifestyle fields needed for your question are sent.</span>
              <span
                className={`font-mono tabular-nums ${
                  input.trim().length > MAX_QUESTION_LENGTH ? 'text-red-700 font-semibold' : ''
                }`}
              >
                {input.trim().length}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
          </form>
        </Card>

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
                  Freshness: {currentReading.provenance.freshnessStatus ?? (currentReading.provenance.isStale ? 'stale' : 'fresh')}
                </p>
              </>
            )}
            <p>
              Household: {familyProfile.members.adults} adults, {familyProfile.members.children} children,{' '}
              {familyProfile.members.seniors} seniors ({familyProfile.homeEnvironment.budgetTier} budget)
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
                onClick={() => void handleSubmit(q)}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Exposure protection, indoor air cleanup, and personal emissions avoidance are tracked as distinct outcomes. Informational guidance only; never a substitute for medical care.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
