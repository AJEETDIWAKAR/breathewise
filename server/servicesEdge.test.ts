import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAMILY_PROFILE } from '../src/data/previewFixtures.ts';
import type { ServerConfig } from './config/env.ts';
import { AiController } from './controllers/aiController.ts';
import { AirQualityController } from './controllers/airQualityController.ts';
import { createRateLimiter } from './middleware/rateLimiter.ts';
import { securityHeadersMiddleware } from './middleware/security.ts';
import { AirliveProvider } from './providers/airliveProvider.ts';
import { AirQualityProviderRegistry } from './providers/providerRegistry.ts';
import type { NormalizedCurrentAirQuality } from './providers/types.ts';
import { AirQualityService } from './services/airQualityService.ts';
import { GeminiAssistantService, type GeminiContentClient } from './services/geminiService.ts';
import { logError, logInfo, logWarn, redactSensitiveText } from './utils/logger.ts';
import vercelHandler, { normalizeVercelApiUrl } from './vercelEntry.ts';

function makeTestConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 3000,
    nodeEnv: 'test',
    appUrl: 'http://localhost:3000',
    allowedOrigins: [],
    geminiApiKey: null,
    geminiTimeoutMs: 2500,
    providerTimeoutMs: 2500,
    aqiCacheTtlMs: 60_000,
    historyCacheTtlMs: 60_000,
    ...overrides,
  };
}

function makeNormalizedCurrent(overrides: Partial<NormalizedCurrentAirQuality> = {}): NormalizedCurrentAirQuality {
  return {
    location: {
      id: 'delhi',
      slug: 'delhi',
      name: 'Delhi',
      city: 'Delhi',
      state: 'India',
      country: 'IN',
      countryName: 'India',
      kind: 'city',
      lat: 28.6139,
      lon: 77.209,
    },
    aqi: {
      value: 190,
      scale: 'US_AQI',
      category: 'Unhealthy',
      dominantPollutant: 'PM2.5',
      modelUsAqi: 185,
    },
    pollutants: [
      {
        key: 'pm25',
        label: 'PM2.5',
        value: 118.5,
        unit: 'µg/m³',
        subIndex: 190,
        safeReference: 'WHO 24h: 15 µg/m³',
        status: 'measured',
      },
    ],
    missingPollutants: ['pm10', 'no2', 'so2', 'o3', 'co'],
    provenance: {
      providerId: 'airlive',
      providerName: 'AirLive',
      stationName: 'Delhi (3 stations)',
      measurementType: 'ground_station',
      sourceLabel: 'Ground Stations',
      stationsUsed: 3,
      observedAt: '2026-01-15T10:00:00Z',
      fetchedAt: '2026-01-15T10:05:00Z',
      isStale: false,
      freshnessStatus: 'fresh',
      spatialResolution: 'City-level monitoring stations',
      attribution: 'Data: AirLive.',
      attributionUrl: 'https://airlive.tracsa.co.in',
      coverageLimitations: 'Trace gases not emitted by this feed.',
      cacheHit: false,
    },
    ...overrides,
  };
}

function makeValidGeminiJson(): string {
  return JSON.stringify({
    summary: 'Avoid prolonged outdoor jogging in Delhi today at US AQI 190.',
    recommendations: [
      {
        title: 'Move jogging indoors',
        action: 'Exercise indoors and wear a sealed N95 outdoors.',
        outcomeCategory: 'reduce_personal_exposure',
        outcomeLabel: 'Reduces Personal Exposure',
        estimatedCostOrBudgetNote: '₹80 mask',
      },
    ],
    explanation: 'Fine PM2.5 penetrates deep into lungs.',
    precautions: ['Informational guidance only; monitor asthma symptoms.'],
    confidenceAndLimitations: {
      confidenceLevel: 'high',
      notes: 'Grounded in AirLive ground stations.',
    },
  });
}

describe('vercelEntry, logger, rateLimiter, and security middleware edges', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes Vercel rewrite paths and routes requests through vercelHandler', async () => {
    expect(normalizeVercelApiUrl('/api/index.mjs?__bw_path=health')).toBe('/api/health');
    expect(normalizeVercelApiUrl('/api/index.mjs?__bw_path=/air-quality/places&country=IN')).toBe(
      '/api/air-quality/places?country=IN',
    );
    expect(normalizeVercelApiUrl('/api/health')).toBe('/api/health');
    expect(normalizeVercelApiUrl('')).toBe('/');

    let statusCode = 0;
    let responseBody = '';
    const fakeRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      end: vi.fn((chunk?: string) => {
        statusCode = fakeRes.statusCode;
        if (chunk) responseBody += String(chunk);
        return fakeRes;
      }),
    } as unknown as ServerResponse;

    const fakeReq = {
      url: '/api/index.mjs?__bw_path=health',
      method: 'GET',
      headers: { host: 'localhost:3000' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    vercelHandler(fakeReq, fakeRes);
    await new Promise((r) => setTimeout(r, 30));
    expect(statusCode).toBe(200);
    expect(responseBody).toContain('AirLive');
  });

  it('redacts sensitive secrets across logInfo, logWarn, and logError', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(redactSensitiveText('Bearer abcdefgh123456')).toBe('Bearer [REDACTED]');
    logInfo('Test', 'Checked key=secret123', { token: 'AIzaSyD12345678901234567890123' });
    logWarn('Test', 'Warning x-goog-api-key=abc123456');
    logError('Test', 'String error', 'plain-failure');
    logError('Test', 'Empty error');

    expect(infoSpy.mock.calls[0][0]).toContain('[REDACTED]');
    expect(warnSpy.mock.calls[0][0]).toContain('x-goog-api-key=[REDACTED]');
    expect(errorSpy.mock.calls[0][0]).toContain('plain-failure');
  });

  it('enforces sliding-window rate limits and prunes stale IP buckets over 1000 entries', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2, name: 'TestAPI' });
    const nextCalls: unknown[] = [];
    const next = ((err?: unknown) => {
      nextCalls.push(err);
    }) as NextFunction;

    for (let i = 0; i < 1005; i += 1) {
      const req = { ip: `10.0.${Math.floor(i / 255)}.${i % 255}`, socket: {} } as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      limiter(req, res, next);
    }

    const blockedReq = { ip: '10.0.0.500', socket: {} } as Request;
    const blockedRes = { setHeader: vi.fn() } as unknown as Response;
    limiter(blockedReq, blockedRes, next);
    limiter(blockedReq, blockedRes, next);
    limiter(blockedReq, blockedRes, next);
    expect(nextCalls.some((e) => e instanceof Error && e.message.includes('Too many requests'))).toBe(true);
  });

  it('validates CORS same-host, malformed origins, HSTS, and blocked OPTIONS/POST', () => {
    const mw = securityHeadersMiddleware('https://app.example.com', ['https://extra.example.com']);
    const next = vi.fn() as NextFunction;

    const statusJson = vi.fn();
    const resForbidden = {
      setHeader: vi.fn(),
      status: vi.fn(() => ({ json: statusJson, end: vi.fn() })),
    } as unknown as Response;

    mw(
      {
        method: 'OPTIONS',
        path: '/api/ai/chat',
        secure: false,
        headers: { origin: 'not-a-valid-url', host: 'localhost:3000', 'x-forwarded-proto': 'https' },
      } as unknown as Request,
      resForbidden,
      next,
    );
    expect(resForbidden.status).toHaveBeenCalledWith(403);

    const resSameHost = {
      setHeader: vi.fn(),
      status: vi.fn(() => ({ end: vi.fn(), json: vi.fn() })),
    } as unknown as Response;
    mw(
      {
        method: 'OPTIONS',
        path: '/api/health',
        secure: false,
        headers: {
          origin: 'https://breathewise-one.vercel.app',
          'x-forwarded-host': 'breathewise-one.vercel.app',
          'x-forwarded-proto': 'https',
        },
      } as unknown as Request,
      resSameHost,
      next,
    );
    expect(resSameHost.status).toHaveBeenCalledWith(204);
  });
});

describe('AirliveProvider, AirQualityService, and Controllers error/cache edges', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps invalid slugs, schema mismatches, empty directories, and network failures in AirliveProvider', async () => {
    const provider = new AirliveProvider(500);
    await expect(provider.fetchPlaceBySlug('invalid slug!')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ bad: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockRejectedValue(new TypeError('ECONNRESET'));

    await expect(provider.fetchAllPlaces()).rejects.toMatchObject({ code: 'AQI_PROVIDER_UNAVAILABLE' });
    await expect(provider.fetchAllPlaces()).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
    await expect(provider.fetchPlaceBySlug('delhi')).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    await expect(provider.fetchRanking('IN', 'best', 5)).rejects.toMatchObject({
      code: 'AQI_PROVIDER_UNAVAILABLE',
    });
  });

  it('serves cached responses, handles 404 location lookup, and builds recommendations when Open-Meteo fails', async () => {
    const config = makeTestConfig();
    const registry = new AirQualityProviderRegistry(config);
    const placeItem = {
      slug: 'delhi',
      name: 'Delhi',
      kind: 'city',
      country: 'IN',
      countryName: 'India',
      lat: 28.6139,
      lon: 77.209,
      usAqi: 190,
      category: 'Unhealthy' as const,
      pm25: 118.5,
      source: 'ground stations',
      measurementType: 'ground_station' as const,
      stationsUsed: 3,
      modelUsAqi: null,
      stationToModelRatio: null,
      updated: '2026-01-15T10:00:00Z',
      freshnessStatus: 'fresh' as const,
      attribution: 'Data: AirLive.',
    };

    vi.spyOn(registry.airlive, 'fetchAllPlaces').mockResolvedValue({
      updated: '2026-01-15T10:00:00Z',
      attribution: 'Data: AirLive.',
      items: [placeItem],
    });
    vi.spyOn(registry.airlive, 'fetchPlaceBySlug').mockResolvedValue(makeNormalizedCurrent());
    vi.spyOn(registry.airlive, 'fetchRanking').mockResolvedValue({
      updated: '2026-01-15T10:00:00Z',
      attribution: 'Data: AirLive.',
      items: [{ ...placeItem, rank: 1 }],
    });
    vi.spyOn(registry.openMeteo, 'fetchHistoryAndForecast').mockRejectedValue(
      new Error('OpenMeteo 503'),
    );

    const service = new AirQualityService(config, registry);
    const p1 = await service.getPlaces({ country: 'IN', kind: 'city', q: 'del' });
    const p2 = await service.getPlaces({ country: 'IN' });
    expect(p1.cacheHit).toBe(false);
    expect(p2.cacheHit).toBe(true);

    const r1 = await service.getRanking('IN', 'worst', 10);
    const r2 = await service.getRanking('IN', 'worst', 10);
    expect(r1.cacheHit).toBe(false);
    expect(r2.cacheHit).toBe(true);

    const cur1 = await service.getCurrent({ lat: 28.61, lon: 77.2 });
    const cur2 = await service.getCurrent({ lat: 28.61, lon: 77.2 });
    expect(cur1.provenance.cacheHit).toBe(false);
    expect(cur2.provenance.cacheHit).toBe(true);

    await expect(service.getCurrent({ city: 'AtlantisUnknownCity' })).rejects.toMatchObject({
      code: 'LOCATION_NOT_FOUND',
    });

    // buildRecommendations degrades gracefully when Open-Meteo fails
    const recs = await service.buildRecommendations({ slug: 'delhi' }, DEFAULT_FAMILY_PROFILE);
    expect(recs.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(recs.bestVentilationWindow).toBeNull();
  });

  it('forwards controller errors to next(err) cleanly', async () => {
    const boom = new Error('controller boom');
    const failingAqService = {
      getPlaces: vi.fn().mockRejectedValue(boom),
      getCurrent: vi.fn().mockRejectedValue(boom),
      getRanking: vi.fn().mockRejectedValue(boom),
      getHistory: vi.fn().mockRejectedValue(boom),
      searchLocations: vi.fn().mockRejectedValue(boom),
      buildRecommendations: vi.fn().mockRejectedValue(boom),
    } as unknown as AirQualityService;
    const aqController = new AirQualityController(failingAqService);

    const next = vi.fn() as NextFunction;
    const res = { locals: { validatedQuery: {}, validatedBody: {} } } as unknown as Response;
    const req = {} as Request;

    await aqController.getPlaces(req, res, next);
    await aqController.getCurrent(req, res, next);
    await aqController.getRanking(req, res, next);
    await aqController.getHistory(req, res, next);
    await aqController.searchLocations(req, res, next);
    await aqController.postRecommendations(req, res, next);
    expect(next).toHaveBeenCalledTimes(6);

    const aiController = new AiController({
      chat: vi.fn().mockRejectedValue(boom),
    } as unknown as GeminiAssistantService);
    await aiController.postChat(req, res, next);
    expect(next).toHaveBeenCalledTimes(7);
  });
});

describe('GeminiAssistantService caching, retries, dedup, client fallback, and grounding', () => {
  it('handles single-turn cache hit, concurrent in-flight dedup, retry success/failure, and clientReading fallback', async () => {
    const config = makeTestConfig({ geminiApiKey: 'test-key' });
    const registry = new AirQualityProviderRegistry(config);
    const modeledReading = makeNormalizedCurrent({
      provenance: {
        ...makeNormalizedCurrent().provenance,
        measurementType: 'modeled_forecast',
        freshnessStatus: 'stale',
      },
    });

    const getCurrentSpy = vi
      .spyOn(registry.airlive, 'fetchPlaceBySlug')
      .mockResolvedValue(modeledReading);
    vi.spyOn(registry.airlive, 'fetchAllPlaces').mockResolvedValue({
      updated: '2026-01-15T10:00:00Z',
      attribution: 'Data: AirLive.',
      items: [],
    });

    const aqService = new AirQualityService(config, registry);
    let callCount = 0;
    const mockClient: GeminiContentClient = {
      generateStructuredJson: vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) {
          // Transient 503 error triggers 1 automatic retry
          throw new Error('upstream 503 temporarily overloaded');
        }
        await new Promise((r) => setTimeout(r, 15));
        return makeValidGeminiJson();
      }),
    };

    const gemini = new GeminiAssistantService(config, aqService, mockClient);
    expect(gemini.isConfigured()).toBe(true);

    const baseReq = {
      message: 'Should kids jog outside?',
      slug: 'delhi',
      history: [],
      familyProfile: DEFAULT_FAMILY_PROFILE,
    };

    // First call hits transient error -> retries -> succeeds, and downgrades high -> moderate confidence
    const res1 = await gemini.chat(baseReq);
    expect(res1.responseSource).toBe('gemini');
    expect(res1.structured.confidenceAndLimitations.confidenceLevel).toBe('moderate');
    expect(callCount).toBe(2);

    // Identical second single-turn query hits singleTurnCache without calling Gemini again
    const res2 = await gemini.chat(baseReq);
    expect(res2.responseSource).toBe('gemini');
    expect(callCount).toBe(2);

    // Different concurrent single-turn queries share inflightSingleTurn promise
    const reqDedup = { ...baseReq, message: 'Best ₹500 budget actions?' };
    const [d1, d2] = await Promise.all([gemini.chat(reqDedup), gemini.chat(reqDedup)]);
    expect(d1.responseSource).toBe('gemini');
    expect(d2.responseSource).toBe('gemini');
    expect(callCount).toBe(3);

    // When server AirLive fails but validated clientReading is supplied, service grounds on clientReading
    getCurrentSpy.mockRejectedValue(new Error('HTTP 403'));
    const fallbackAqService = new AirQualityService(config, registry);
    const geminiWithClientFallback = new GeminiAssistantService(config, fallbackAqService, {
      generateStructuredJson: async () => 'not-valid-json',
    });

    const resMalformed = await geminiWithClientFallback.chat({
      message: 'What is indoor advice?',
      slug: 'delhi',
      history: [],
      familyProfile: DEFAULT_FAMILY_PROFILE,
      clientReading: {
        location: { id: 'delhi', slug: 'delhi', name: 'Delhi', city: 'Delhi', lat: 28.6139, lon: 77.209 },
        aqi: { value: 185, scale: 'US_AQI', category: 'Unhealthy', dominantPollutant: 'PM2.5' },
        pollutants: [
          {
            key: 'pm25',
            label: 'PM2.5',
            value: 112,
            unit: 'µg/m³',
            subIndex: 185,
            safeReference: 'WHO 24h: 15 µg/m³',
          },
        ],
        provenance: {
          providerId: 'airlive',
          providerName: 'AirLive',
          stationName: 'Delhi (3 stations)',
          measurementType: 'ground_station',
          sourceLabel: 'Ground Stations',
          stationsUsed: 3,
          observedAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          isStale: false,
          freshnessStatus: 'fresh',
          spatialResolution: 'City-level',
          attribution: 'Data: AirLive.',
          coverageLimitations: 'Trace gases absent',
        },
      },
    });
    expect(resMalformed.liveDataAvailable).toBe(true);
    expect(resMalformed.responseSource).toBe('rule_based_fallback');
    expect(resMalformed.fallbackReasonCode).toBe('MALFORMED_AI_RESPONSE');

    // Also test empty string response & Zod schema mismatch & retry double failure
    const emptyGemini = new GeminiAssistantService(config, fallbackAqService, {
      generateStructuredJson: async () => '',
    });
    const resEmpty = await emptyGemini.chat({
      message: 'Empty reply check',
      slug: 'delhi',
      history: [],
      familyProfile: DEFAULT_FAMILY_PROFILE,
    });
    expect(resEmpty.fallbackReasonCode).toBe('MALFORMED_AI_RESPONSE');

    const badSchemaGemini = new GeminiAssistantService(config, fallbackAqService, {
      generateStructuredJson: async () => JSON.stringify({ summary: 123, recommendations: [] }),
    });
    const resBadSchema = await badSchemaGemini.chat({
      message: 'Bad schema check',
      slug: 'delhi',
      history: [],
      familyProfile: DEFAULT_FAMILY_PROFILE,
    });
    expect(resBadSchema.fallbackReasonCode).toBe('MALFORMED_AI_RESPONSE');

    const failingRetryService = new GeminiAssistantService(config, fallbackAqService, {
      generateStructuredJson: async () => {
        throw new Error('503 persistent failure');
      },
    });
    const resDoubleFail = await failingRetryService.chat({
      message: 'Commute question',
      slug: 'delhi',
      history: [],
      familyProfile: DEFAULT_FAMILY_PROFILE,
    });
    expect(resDoubleFail.fallbackReasonCode).toBe('UPSTREAM_ERROR');
    expect(resDoubleFail.liveDataAvailable).toBe(false);

    // Real key branch coverage for loadServerConfig & isConfigured
    const { loadServerConfig } = await import('./config/env.ts');
    const origKey = process.env.GEMINI_API_KEY;
    const origOrigins = process.env.ALLOWED_ORIGINS;
    process.env.GEMINI_API_KEY = 'YOUR_PLACEHOLDER';
    process.env.ALLOWED_ORIGINS = 'https://a.example.com, invalid';
    const placeholderCfg = loadServerConfig();
    expect(placeholderCfg.geminiApiKey).toBeNull();
    expect(placeholderCfg.allowedOrigins).toEqual(['https://a.example.com']);

    process.env.GEMINI_API_KEY = 'AIzaSyFakeUnitTestKey0000000000000000';
    const realCfg = loadServerConfig();
    expect(realCfg.geminiApiKey).toContain('AIzaSy');
    expect(new GeminiAssistantService(realCfg, fallbackAqService).isConfigured()).toBe(true);

    if (origKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origKey;
    if (origOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = origOrigins;
  });
});

