import {
  AIRLIVE_BASE_URL,
  AIRLIVE_DEFAULT_ATTRIBUTION,
  mapAirLivePlaceSummary,
  sanitizeHttpUrl,
} from '../../src/domain/airliveNormalize.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { fetchJsonWithRetry, UpstreamHttpError } from '../utils/httpClient.ts';
import { buildAirLiveNormalizedReading } from '../utils/normalizeReading.ts';
import {
  SLUG_PATTERN,
  airliveAllPlacesSchema,
  airlivePlaceSchema,
  airliveRankingSchema,
} from '../validators/airQualityValidators.ts';
import type {
  AirLivePlaceSummary,
  AirLiveRankingEntry,
  AirQualityProvider,
  NormalizedCurrentAirQuality,
} from './types.ts';

export class AirliveProvider implements AirQualityProvider {
  readonly id = 'airlive' as const;
  readonly name = 'AirLive';
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  isConfigured(): boolean {
    return true;
  }

  private mapUpstreamError(err: unknown, contextLabel: string): AppError {
    if (err instanceof AppError) {
      return err;
    }
    if (err instanceof UpstreamHttpError) {
      if (err.status === 404 || err.status === 400) {
        return new AppError(
          404,
          'LOCATION_NOT_FOUND',
          `${contextLabel} was not found in the AirLive monitoring directory.`,
          false,
        );
      }
      return new AppError(
        503,
        'AQI_PROVIDER_UNAVAILABLE',
        `AirLive API is currently unavailable (HTTP ${err.status}). Please try again shortly.`,
        true,
        { upstreamStatus: err.status },
      );
    }
    return new AppError(
      503,
      'AQI_PROVIDER_UNAVAILABLE',
      'Unable to reach AirLive API due to a temporary network or timeout error.',
      true,
    );
  }

  async fetchAllPlaces(): Promise<{
    updated: string | null;
    attribution: string;
    items: AirLivePlaceSummary[];
  }> {
    let raw: unknown;
    try {
      raw = await fetchJsonWithRetry(`${AIRLIVE_BASE_URL}/api/v1/aqi`, {
        providerId: this.id,
        timeoutMs: this.timeoutMs,
      });
    } catch (err) {
      throw this.mapUpstreamError(err, 'AirLive directory');
    }

    const parsed = airliveAllPlacesSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_PROVIDER_RESPONSE',
        'AirLive places directory returned an unexpected schema.',
        false,
      );
    }

    if (parsed.data.items.length === 0) {
      throw new AppError(
        503,
        'AQI_PROVIDER_UNAVAILABLE',
        'AirLive returned an empty location list.',
        true,
      );
    }

    const defaultAttr =
      parsed.data.attribution || AIRLIVE_DEFAULT_ATTRIBUTION;

    return {
      updated: parsed.data.updated ?? null,
      attribution: defaultAttr,
      items: parsed.data.items.map((item) => mapAirLivePlaceSummary(item, defaultAttr)),
    };
  }

  async fetchPlaceBySlug(slug: string): Promise<NormalizedCurrentAirQuality> {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !SLUG_PATTERN.test(cleanSlug)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Location slug may only contain letters, numbers, and hyphens.',
        false,
      );
    }

    let raw: unknown;
    try {
      raw = await fetchJsonWithRetry(
        `${AIRLIVE_BASE_URL}/api/v1/aqi/${encodeURIComponent(cleanSlug)}`,
        {
          providerId: this.id,
          timeoutMs: this.timeoutMs,
        },
      );
    } catch (err) {
      throw this.mapUpstreamError(err, `Location "${cleanSlug}"`);
    }

    const parsed = airlivePlaceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_PROVIDER_RESPONSE',
        `AirLive place response for "${cleanSlug}" failed schema validation.`,
        false,
      );
    }

    const normalized = buildAirLiveNormalizedReading(parsed.data);
    return {
      ...normalized,
      provenance: {
        ...normalized.provenance,
        placeUrl: sanitizeHttpUrl(parsed.data.url),
      },
    };
  }

  async fetchRanking(
    country = 'IN',
    order: 'worst' | 'best' = 'worst',
    limit = 10,
  ): Promise<{
    updated: string | null;
    attribution: string;
    items: AirLiveRankingEntry[];
  }> {
    const url = new URL(`${AIRLIVE_BASE_URL}/api/v1/ranking`);
    url.searchParams.set('country', country.toUpperCase());
    url.searchParams.set('order', order);
    url.searchParams.set('limit', String(limit));

    let raw: unknown;
    try {
      raw = await fetchJsonWithRetry(url.toString(), {
        providerId: this.id,
        timeoutMs: this.timeoutMs,
      });
    } catch (err) {
      throw this.mapUpstreamError(err, 'AirLive ranking');
    }

    const parsed = airliveRankingSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_PROVIDER_RESPONSE',
        'AirLive ranking response failed schema validation.',
        false,
      );
    }

    const defaultAttr =
      parsed.data.attribution || AIRLIVE_DEFAULT_ATTRIBUTION;

    return {
      updated: parsed.data.updated ?? null,
      attribution: defaultAttr,
      items: parsed.data.items.map((item, idx) => ({
        ...mapAirLivePlaceSummary(item, defaultAttr),
        rank: item.rank ?? idx + 1,
      })),
    };
  }
}
