import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  AiFallbackReasonCode,
  AiStructuredAdvice,
} from '../../src/types/breathewise.ts';
import type { ServerConfig } from '../config/env.ts';
import type { NormalizedCurrentAirQuality } from '../providers/types.ts';
import { TtlCache } from '../utils/cache.ts';
import { logWarn } from '../utils/logger.ts';
import { AiStructuredAdviceSchema } from '../validators/breathewiseSchemas.ts';
import type { AirQualityService } from './airQualityService.ts';
import {
  buildMinimizedFamilyContext,
  buildRuleBasedFallbackAdvice,
  buildServerVerifiedContext,
  formatAdviceAsPlainText,
  formatFallbackNotice,
  sanitizeStructuredAdvice,
} from './aiAdvisorFallback.ts';
import {
  GEMINI_MODEL,
  GEMINI_STRUCTURED_RESPONSE_SCHEMA,
  GEMINI_SYSTEM_INSTRUCTION,
  buildGeminiChatPrompt,
  classifyGeminiFailure,
  formatGroundedAirQualityContext,
  normalizeClientReadingFallback,
  normalizeOutcomeLabel,
  withTimeout,
  type AiChatRequest,
  type AiChatTurn,
  type ClientAirQualityFallback,
} from './geminiPromptBuilder.ts';

export type { AiChatRequest, AiChatTurn, ClientAirQualityFallback };

export interface AiChatResponse {
  reply: string;
  structured: AiStructuredAdvice;
  model: string;
  responseSource: 'gemini' | 'rule_based_fallback';
  aiAvailable: boolean;
  aiUnavailableReason?: string;
  fallbackReasonCode?: AiFallbackReasonCode;
  liveDataAvailable: boolean;
  liveDataUnavailableReason?: string;
  contextSentSummary: {
    questionDomain: string;
    minimizedFields: string[];
  };
  groundedReading: {
    locationName: string;
    slug: string;
    usAqi: number | null;
    category: string;
    pm25: number | null;
    sourceLabel: string;
    stationsUsed: number | null;
    observedAt: string | null;
    freshnessStatus: string;
    attributionUrl?: string;
  } | null;
}

export interface GeminiContentClient {
  generateStructuredJson(params: {
    model: string;
    systemInstruction: string;
    contents: string;
    timeoutMs: number;
  }): Promise<string>;
}

function buildRealGeminiClient(apiKey: string): GeminiContentClient {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return {
    async generateStructuredJson({ model, systemInstruction, contents }) {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_STRUCTURED_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });
      return (response.text ?? '').trim();
    },
  };
}

export class GeminiAssistantService {
  private readonly config: ServerConfig;
  private readonly airQualityService: AirQualityService;
  private readonly customClient?: GeminiContentClient;
  private readonly singleTurnCache = new TtlCache<AiStructuredAdvice>(5 * 60 * 1000, 100);
  private readonly inflightSingleTurn = new Map<string, Promise<string>>();
  private sharedRealClient: GeminiContentClient | null = null;

  constructor(
    config: ServerConfig,
    airQualityService: AirQualityService,
    customClient?: GeminiContentClient,
  ) {
    this.config = config;
    this.airQualityService = airQualityService;
    this.customClient = customClient;
  }

  private getClient(): GeminiContentClient | null {
    if (this.customClient) return this.customClient;
    if (!this.config.geminiApiKey) return null;
    if (!this.sharedRealClient) {
      this.sharedRealClient = buildRealGeminiClient(this.config.geminiApiKey);
    }
    return this.sharedRealClient;
  }

  isConfigured(): boolean {
    return Boolean(this.customClient || this.config.geminiApiKey);
  }

  private async resolveReadingForChat(
    req: AiChatRequest,
  ): Promise<{ reading: NormalizedCurrentAirQuality | null; unavailableReason: string | null }> {
    try {
      const reading = await this.airQualityService.getCurrent({
        slug: req.slug,
        city: req.city,
        lat: req.lat,
        lon: req.lon,
      });
      return { reading, unavailableReason: null };
    } catch (err) {
      const serverErrMessage =
        err instanceof Error ? err.message : 'Live AirLive reading could not be retrieved.';
      const clientFallback = normalizeClientReadingFallback(req);
      if (clientFallback) {
        logWarn(
          'GeminiAssistantService',
          'Server AirLive fetch unavailable; using validated browser-fetched AirLive reading',
          {
            slug: clientFallback.location.slug ?? clientFallback.location.id,
            reason: serverErrMessage,
          },
        );
        return { reading: clientFallback, unavailableReason: null };
      }
      logWarn('GeminiAssistantService', 'Proceeding with unavailable live reading context', {
        reason: serverErrMessage,
      });
      return { reading: null, unavailableReason: serverErrMessage };
    }
  }

  private buildSingleTurnCacheKey(
    req: AiChatRequest,
    reading: NormalizedCurrentAirQuality | null,
    minimizedContextText: string,
  ): string | null {
    if (req.history.length !== 0 || reading === null) {
      return null;
    }
    return [
      reading.location.slug ?? reading.location.id,
      reading.provenance.observedAt ?? 'no-ts',
      req.message.trim().toLowerCase().replace(/\s+/g, ' '),
      minimizedContextText,
    ].join('|');
  }

  private resolveGroundedConfidenceLevel(
    sanitizedLevel: AiStructuredAdvice['confidenceAndLimitations']['confidenceLevel'],
    reading: NormalizedCurrentAirQuality | null,
  ): AiStructuredAdvice['confidenceAndLimitations']['confidenceLevel'] {
    if (reading === null) return 'low';
    const isDegradedSource =
      reading.provenance.measurementType === 'modeled_forecast' ||
      reading.provenance.freshnessStatus !== 'fresh';
    if (isDegradedSource && sanitizedLevel === 'high') {
      return 'moderate';
    }
    return sanitizedLevel;
  }

  private async requestAdviceJson(
    client: GeminiContentClient,
    prompt: string,
    cacheKey: string | null,
  ): Promise<{ rawJson: string } | { fallbackReason: AiFallbackReasonCode }> {
    const attemptGemini = () => {
      const invoke = () =>
        withTimeout(
          client.generateStructuredJson({
            model: GEMINI_MODEL,
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            contents: prompt,
            timeoutMs: this.config.geminiTimeoutMs,
          }),
          this.config.geminiTimeoutMs,
        );

      if (!cacheKey) return invoke();
      const existing = this.inflightSingleTurn.get(cacheKey);
      if (existing) return existing;
      const created = invoke().finally(() => {
        this.inflightSingleTurn.delete(cacheKey);
      });
      this.inflightSingleTurn.set(cacheKey, created);
      return created;
    };

    try {
      return { rawJson: await attemptGemini() };
    } catch (firstErr) {
      const code = classifyGeminiFailure(firstErr);
      if (code !== 'UPSTREAM_ERROR') {
        logWarn('GeminiAssistantService', 'Gemini failed; returning rule-based fallback', {
          reasonCode: code,
        });
        return { fallbackReason: code };
      }

      logWarn('GeminiAssistantService', 'Retrying Gemini once after transient upstream failure');
      try {
        await new Promise((r) => setTimeout(r, 250));
        return { rawJson: await attemptGemini() };
      } catch (retryErr) {
        const retryCode = classifyGeminiFailure(retryErr);
        logWarn('GeminiAssistantService', 'Gemini retry failed; returning rule-based fallback', {
          reasonCode: retryCode,
        });
        return { fallbackReason: retryCode };
      }
    }
  }

  private parseAndGroundAdvice(
    rawJson: string,
    reading: NormalizedCurrentAirQuality | null,
    verifiedProvenance: ReturnType<typeof buildServerVerifiedContext>,
  ): AiStructuredAdvice | null {
    if (!rawJson) {
      logWarn('GeminiAssistantService', 'Gemini returned empty payload; falling back');
      return null;
    }

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(rawJson);
    } catch {
      logWarn('GeminiAssistantService', 'Gemini returned malformed JSON; falling back');
      return null;
    }

    const mergedForValidation =
      typeof parsedUnknown === 'object' && parsedUnknown !== null && !Array.isArray(parsedUnknown)
        ? {
            ...(parsedUnknown as Record<string, unknown>),
            currentAirQualityContext: {
              locationName: verifiedProvenance.locationName,
              aqiSummary: verifiedProvenance.aqiSummary,
              measuredFacts: verifiedProvenance.measuredFacts,
              missingData: verifiedProvenance.missingData,
            },
            sources: verifiedProvenance.sources,
            dataFreshness: verifiedProvenance.dataFreshness,
          }
        : parsedUnknown;

    const validated = AiStructuredAdviceSchema.safeParse(mergedForValidation);
    if (!validated.success) {
      logWarn('GeminiAssistantService', 'Gemini JSON failed Zod schema validation; falling back', {
        issues: validated.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return null;
    }

    const sanitized = sanitizeStructuredAdvice(validated.data);
    return {
      ...sanitized,
      recommendations: sanitized.recommendations.map((rec) => ({
        ...rec,
        outcomeLabel: normalizeOutcomeLabel(rec.outcomeCategory),
      })),
      confidenceAndLimitations: {
        confidenceLevel: this.resolveGroundedConfidenceLevel(
          sanitized.confidenceAndLimitations.confidenceLevel,
          reading,
        ),
        notes: sanitized.confidenceAndLimitations.notes,
      },
    };
  }

  async chat(req: AiChatRequest): Promise<AiChatResponse> {
    const { reading, unavailableReason } = await this.resolveReadingForChat(req);
    const requestedLabel = req.slug || req.city || 'selected location';
    const airContext = formatGroundedAirQualityContext(reading, unavailableReason, requestedLabel);
    const minimizedFamily = buildMinimizedFamilyContext(req.familyProfile, req.message);
    const verifiedProvenance = buildServerVerifiedContext(
      reading,
      unavailableReason,
      requestedLabel,
    );

    const buildFallbackResponse = (reasonCode: AiFallbackReasonCode): AiChatResponse => {
      const notice = formatFallbackNotice(reasonCode);
      const fallbackStructured = buildRuleBasedFallbackAdvice({
        question: req.message,
        reading,
        unavailableReason,
        requestedLocation: requestedLabel,
        profile: req.familyProfile,
      });
      return this.finalizeResponse({
        structured: fallbackStructured,
        model: 'rule-based-fallback',
        responseSource: 'rule_based_fallback',
        aiAvailable: false,
        aiUnavailableReason: notice,
        fallbackReasonCode: reasonCode,
        reading,
        unavailableReason,
        minimizedFamily,
      });
    };

    const client = this.getClient();
    if (!client) {
      logWarn('GeminiAssistantService', 'GEMINI_API_KEY not configured; returning rule-based fallback');
      return buildFallbackResponse('MISSING_API_KEY');
    }

    const cacheKey = this.buildSingleTurnCacheKey(req, reading, minimizedFamily.contextText);
    const cachedAdvice = cacheKey ? this.singleTurnCache.get(cacheKey) : undefined;
    if (cachedAdvice) {
      return this.finalizeResponse({
        structured: cachedAdvice.value,
        model: GEMINI_MODEL,
        responseSource: 'gemini',
        aiAvailable: true,
        reading,
        unavailableReason,
        minimizedFamily,
      });
    }

    const prompt = buildGeminiChatPrompt({
      airContext,
      minimizedFamilyContext: minimizedFamily.contextText,
      history: req.history,
      message: req.message,
    });

    const outcome = await this.requestAdviceJson(client, prompt, cacheKey);
    if ('fallbackReason' in outcome) {
      return buildFallbackResponse(outcome.fallbackReason);
    }

    const groundedStructured = this.parseAndGroundAdvice(
      outcome.rawJson,
      reading,
      verifiedProvenance,
    );
    if (!groundedStructured) {
      return buildFallbackResponse('MALFORMED_AI_RESPONSE');
    }

    if (cacheKey) {
      this.singleTurnCache.set(cacheKey, groundedStructured);
    }

    return this.finalizeResponse({
      structured: groundedStructured,
      model: GEMINI_MODEL,
      responseSource: 'gemini',
      aiAvailable: true,
      reading,
      unavailableReason,
      minimizedFamily,
    });
  }

  private finalizeResponse(params: {
    structured: AiStructuredAdvice;
    model: string;
    responseSource: 'gemini' | 'rule_based_fallback';
    aiAvailable: boolean;
    aiUnavailableReason?: string;
    fallbackReasonCode?: AiFallbackReasonCode;
    reading: NormalizedCurrentAirQuality | null;
    unavailableReason: string | null;
    minimizedFamily: { primaryTopic: string; minimizedFields: string[] };
  }): AiChatResponse {
    const {
      structured,
      model,
      responseSource,
      aiAvailable,
      aiUnavailableReason,
      fallbackReasonCode,
      reading,
      unavailableReason,
      minimizedFamily,
    } = params;

    const pm25Metric = reading?.pollutants.find((p) => p.key === 'pm25');

    return {
      reply: formatAdviceAsPlainText(structured),
      structured,
      model,
      responseSource,
      aiAvailable,
      ...(aiUnavailableReason ? { aiUnavailableReason } : {}),
      ...(fallbackReasonCode ? { fallbackReasonCode } : {}),
      liveDataAvailable: reading !== null,
      ...(unavailableReason ? { liveDataUnavailableReason: unavailableReason } : {}),
      contextSentSummary: {
        questionDomain: minimizedFamily.primaryTopic,
        minimizedFields: minimizedFamily.minimizedFields,
      },
      groundedReading: reading
        ? {
            locationName: reading.location.name,
            slug: reading.location.slug ?? reading.location.id,
            usAqi: reading.aqi.value,
            category: reading.aqi.category,
            pm25: pm25Metric?.value ?? null,
            sourceLabel: reading.provenance.sourceLabel,
            stationsUsed: reading.provenance.stationsUsed,
            observedAt: reading.provenance.observedAt,
            freshnessStatus: reading.provenance.freshnessStatus,
            attributionUrl: reading.provenance.attributionUrl,
          }
        : null,
    };
  }
}
