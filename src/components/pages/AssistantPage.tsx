import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import {
  buildRuleBasedFallbackAdvice,
  formatAdviceAsPlainText,
} from '../../domain/aiRuleBasedAdvice';
import { ApiClientError, sendAiChatMessage } from '../../services/airQualityApi';
import { useAppState } from '../../state/AppStateContext';
import { createEntryId } from '../../utils/id';
import { AssistantContextSidebar } from '../assistant/AssistantContextSidebar';
import {
  AssistantMessageCard,
  type AssistantChatMessage,
} from '../assistant/AssistantMessageCard';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ErrorMessage, UnavailableNotice } from '../ui/States';

const MAX_QUESTION_LENGTH = 1000;

function validateAssistantQuestion(trimmed: string): string | null {
  if (!trimmed) {
    return 'Please enter a question before sending.';
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return `Question is too long (${trimmed.length}/${MAX_QUESTION_LENGTH} characters).`;
  }
  return null;
}

function resolveClientReadingFallback(
  currentReading: ReturnType<typeof useAppState>['currentReading'],
  locationSlug: string,
) {
  if (!currentReading || currentReading.provenance.providerId !== 'airlive') {
    return undefined;
  }
  const type = currentReading.provenance.measurementType;
  if (type !== 'ground_station' && type !== 'modeled_forecast') {
    return undefined;
  }
  const readingSlug = currentReading.location.slug ?? currentReading.location.id;
  return readingSlug === locationSlug ? currentReading : undefined;
}

export function AssistantPage() {
  const { currentReading, familyProfile, location, isOffline, setActivePage } = useAppState();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatErrorCode, setChatErrorCode] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [messagesBySlug, setMessagesBySlug] = useState<{
    slug: string;
    items: AssistantChatMessage[];
  }>(() => ({
    slug: location.slug,
    items: [
      {
        id: 'intro-1',
        role: 'assistant',
        text: `Ask any question about outdoor safety, school play, indoor filtration, ₹500 budget actions, or daily commutes for ${location.name}. Answers are grounded in live AirLive telemetry and anonymized household context.`,
      },
    ],
  }));

  const inFlightRef = useRef<{ slug: string; controller: AbortController } | null>(null);
  const activeSlug = location.slug;

  const messages: AssistantChatMessage[] =
    messagesBySlug.slug === activeSlug
      ? messagesBySlug.items
      : [
          {
            id: 'intro-1',
            role: 'assistant',
            text: `Location switched to ${location.name}. Ask any question about outdoor safety, school play, indoor filtration, ₹500 budget actions, or daily commutes grounded in live AirLive telemetry for ${location.name}.`,
          },
        ];

  useEffect(() => {
    if (inFlightRef.current && inFlightRef.current.slug !== activeSlug) {
      inFlightRef.current.controller.abort();
      inFlightRef.current = null;
    }
    return () => {
      inFlightRef.current?.controller.abort();
      inFlightRef.current = null;
    };
  }, [activeSlug]);

  const appendMessage = (msg: AssistantChatMessage) => {
    setMessagesBySlug((prev) => {
      const base =
        prev.slug === activeSlug
          ? prev.items
          : [
              {
                id: 'intro-1',
                role: 'assistant' as const,
                text: `Location switched to ${location.name}. Ask any question about outdoor safety, school play, indoor filtration, ₹500 budget actions, or daily commutes grounded in live AirLive telemetry for ${location.name}.`,
              },
            ];
      return { slug: activeSlug, items: [...base, msg] };
    });
  };

  const handleSubmit = async (questionText: string, options?: { skipUserBubble?: boolean }) => {
    const trimmed = questionText.trim();
    const validationMsg = validateAssistantQuestion(trimmed);
    if (validationMsg) {
      setValidationError(validationMsg);
      return;
    }
    if (sending && messagesBySlug.slug === activeSlug) return;

    setValidationError(null);
    setChatError(null);
    setChatErrorCode(null);
    setLastFailedQuestion(null);

    const historyPayload = messages
      .filter((m) => m.id !== 'intro-1')
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    if (!options?.skipUserBubble) {
      appendMessage({
        id: createEntryId('u'),
        role: 'user',
        text: trimmed,
      });
      setInput('');
    }

    inFlightRef.current?.controller.abort();
    const controller = new AbortController();
    inFlightRef.current = { slug: activeSlug, controller };
    setSending(true);

    try {
      const liveAirLiveFallback = resolveClientReadingFallback(currentReading, location.slug);

      const result = await sendAiChatMessage(
        {
          message: trimmed,
          slug: location.slug,
          city: location.city,
          lat: location.lat,
          lon: location.lon,
          history: historyPayload,
          familyProfile,
          ...(liveAirLiveFallback ? { clientReading: liveAirLiveFallback } : {}),
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;

      appendMessage({
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
      });
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
      if (inFlightRef.current?.controller === controller) {
        inFlightRef.current = null;
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
    appendMessage({
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
    });
    setChatError(null);
    setChatErrorCode(null);
    setLastFailedQuestion(null);
  };

  const handleClearHistory = () => {
    inFlightRef.current?.controller.abort();
    inFlightRef.current = null;
    setSending(false);
    setChatError(null);
    setChatErrorCode(null);
    setValidationError(null);
    setLastFailedQuestion(null);
    setMessagesBySlug({
      slug: activeSlug,
      items: [
        {
          id: 'intro-1',
          role: 'assistant',
          text: `Conversation cleared. Ask any air quality question for ${location.name} to receive structured, AirLive-grounded guidance.`,
        },
      ],
    });
  };

  const showChatError = chatError && messagesBySlug.slug === activeSlug;

  return (
    <div className="space-y-6">
      {showChatError && (
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
            {messages.map((msg) => (
              <AssistantMessageCard
                key={msg.id}
                msg={msg}
                sending={sending}
                onRetryWithGemini={(q) => void handleSubmit(q, { skipUserBubble: true })}
              />
            ))}

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
              <span>
                Only anonymized household & lifestyle fields needed for your question are sent.
              </span>
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

        <AssistantContextSidebar
          location={location}
          currentReading={currentReading}
          familyProfile={familyProfile}
          sending={sending}
          onSelectQuestion={(q) => void handleSubmit(q)}
        />
      </div>
    </div>
  );
}
