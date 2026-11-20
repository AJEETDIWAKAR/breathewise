import { getUsAqiCategory, normalizeUsAqiCategoryLabel } from '../../src/domain/usAqi.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { sanitizeHttpUrl } from '../utils/geo.ts';
import { fetchJsonWithRetry, UpstreamHttpError } from '../utils/httpClient.ts';
import {
  buildAirLiveNormalizedReading,
  evaluateStaleness,
} from '../utils/normalizeReading.ts';
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

const AIRLIVE_BASE_URL = 'https://airlive.tracsa.co.in';

function mapAirLivePlaceSummary(
  item: {
    slug: string;
    name: string;
    kind: string;
    country: string;
    countryName: string;
    lat: number;
    lon: number;
    usAqi?: number | null;
    category?: string | null;
    pm25?: number | null;
    source?: string | null;
    stationsUsed?: number | null;
    modelUsAqi?: number | null;
    stationToModelRatio?: number | null;
    updated?: string | null;
    url?: string;
    attribution?: string;
  },
  defaultAttribution: string,
): AirLivePlaceSummary {
  const validUsAqi =
    typeof item.usAqi === 'number' && Number.isFinite(item.usAqi) && item.usAqi >= 0
      ? Math.round(item.usAqi)
      : null;

  const validPm25 =
    typeof item.pm25 === 'number' && Number.isFinite(item.pm25) && item.pm25 >= 0
      ? Number(item.pm25.toFixed(1))
      : null;

  const category =
    validUsAqi !== null
      ? getUsAqiCategory(validUsAqi)
      : normalizeUsAqiCategoryLabel(item.category) ?? 'Unavailable';

  const rawSource = (item.source ?? '').trim().toLowerCase();
  const isGround = rawSource.includes('ground');
  const staleness = evaluateStaleness(item.updated ?? null);

  return {
    slug: item.slug,
    name: item.name,
    kind: item.kind || 'city',
    country: item.country || '',
    countryName: item.countryName || item.country || '',
    lat: item.lat,
    lon: item.lon,
    usAqi: validUsAqi,
    category,
    pm25: validPm25,
    source: isGround ? 'ground stations' : 'atmospheric model',
    measurementType: isGround ? 'ground_station' : 'modeled_forecast',
    stationsUsed:
      isGround && typeof item.stationsUsed === 'number' && Number.isFinite(item.stationsUsed)
        ? item.stationsUsed
        : null,
    modelUsAqi:
      typeof item.modelUsAqi === 'number' && Number.isFinite(item.modelUsAqi)
        ? Math.round(item.modelUsAqi)
        : null,
    stationToModelRatio:
      typeof item.stationToModelRatio === 'number' && Number.isFinite(item.stationToModelRatio)
        ? Number(item.stationToModelRatio.toFixed(3))
        : null,
    updated: item.updated ?? null,
    freshnessStatus: staleness.freshnessStatus,
    url: sanitizeHttpUrl(item.url),
    attribution: item.attribution || defaultAttribution,
  };
}

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
      parsed.data.attribution || 'Data: AirLive (https://airlive.tracsa.co.in).';

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
      parsed.data.attribution || 'Data: AirLive (https://airlive.tracsa.co.in).';

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
