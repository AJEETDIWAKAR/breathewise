import {
  AIRLIVE_BASE_URL,
  AIRLIVE_DEFAULT_ATTRIBUTION,
  AIRLIVE_SLUG_PATTERN,
  buildAirLiveReading,
  filterAndSortLocationSearch,
  mapAirLivePlaceSummary,
  mapPlaceToLocationOption,
  resolveNearestOrMatchingPlace,
  sliceOpenMeteoWindow,
  type RawAirLivePlaceInput,
} from '../domain/airliveNormalize';
import type {
  AirQualityRankingItem,
  AirQualityReading,
  HourlyForecastPoint,
  LocationOption,
  UsAqiCategory,
} from '../types/breathewise';

const AIRLIVE_FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000;

export class ApiClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    retryable = true,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AirLivePlaceDto {
  slug: string;
  name: string;
  kind: string;
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  usAqi: number | null;
  category: UsAqiCategory | 'Unavailable';
  pm25: number | null;
  source: string;
  measurementType: 'ground_station' | 'modeled_forecast';
  stationsUsed: number | null;
  updated: string | null;
  freshnessStatus: 'fresh' | 'stale' | 'unavailable';
  url?: string;
}

export interface AirLiveRankingResponse {
  updated: string | null;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirQualityRankingItem[];
}

export interface AirLivePlacesResponse {
  updated: string | null;
  count: number;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirLivePlaceDto[];
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiClientError(
      'OFFLINE',
      'Your device appears to be offline. Connect to the internet or switch to the labeled preview fixture.',
      true,
    );
  }

  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if (timedOut) {
      throw new ApiClientError(
        'TIMEOUT',
        'Request to BreatheWise server timed out. Check your connection and retry.',
        true,
      );
    }
    if (init.signal?.aborted) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      'Network error while reaching BreatheWise server. Check your connection or view the labeled preview fixture.',
      true,
    );
  } finally {
    globalThis.clearTimeout(timer);
    init.signal?.removeEventListener('abort', onExternalAbort);
  }
}

const directPlacesCache: {
  data: { updated: string | null; attribution: string; items: AirLivePlaceDto[] } | null;
  cachedAt: number;
} = { data: null, cachedAt: 0 };

const directCurrentCache = new Map<string, { reading: AirQualityReading; cachedAt: number }>();
const directRankingCache = new Map<string, { data: AirLiveRankingResponse; cachedAt: number }>();

export function clearDirectFallbackCaches(): void {
  directPlacesCache.data = null;
  directPlacesCache.cachedAt = 0;
  directCurrentCache.clear();
  directRankingCache.clear();
}

async function fetchDirectAirLiveJson<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  const res = await fetchWithTimeout(
    url,
    { headers: { Accept: 'application/json' }, signal: options?.signal },
    options?.timeoutMs ?? 12_000,
  );
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      throw new ApiClientError(
        'LOCATION_NOT_FOUND',
        'Requested location was not found in the AirLive monitoring directory.',
        false,
      );
    }
    throw new ApiClientError(
      'AQI_PROVIDER_UNAVAILABLE',
      `AirLive API is currently unavailable (HTTP ${res.status}). Please try again shortly.`,
      true,
    );
  }
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json || typeof json !== 'object') {
    throw new ApiClientError(
      'AQI_PROVIDER_UNAVAILABLE',
      'AirLive returned an invalid payload.',
      true,
    );
  }
  return json;
}

async function fetchDirectAllAirLivePlaces(options?: ApiRequestOptions) {
  if (
    directPlacesCache.data &&
    Date.now() - directPlacesCache.cachedAt < AIRLIVE_FALLBACK_CACHE_TTL_MS
  ) {
    return directPlacesCache.data;
  }

  const raw = await fetchDirectAirLiveJson<{
    updated?: string | null;
    attribution?: string;
    items?: RawAirLivePlaceInput[];
  }>(`${AIRLIVE_BASE_URL}/api/v1/aqi`, options);

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new ApiClientError(
      'AQI_PROVIDER_UNAVAILABLE',
      'AirLive returned an empty location list.',
      true,
    );
  }

  const defaultAttribution = raw.attribution || AIRLIVE_DEFAULT_ATTRIBUTION;
  const mapped = {
    updated: raw.updated ?? null,
    attribution: defaultAttribution,
    items: raw.items
      .filter((it): it is RawAirLivePlaceInput => Boolean(it && it.slug && it.name))
      .map((it) => mapAirLivePlaceSummary(it, defaultAttribution)),
  };
  directPlacesCache.data = mapped;
  directPlacesCache.cachedAt = Date.now();
  return mapped;
}

export async function fetchDirectAirLivePlacesByCountry(
  country = 'IN',
  options?: ApiRequestOptions,
): Promise<AirLivePlacesResponse> {
  const wasCached =
    directPlacesCache.data !== null &&
    Date.now() - directPlacesCache.cachedAt < AIRLIVE_FALLBACK_CACHE_TTL_MS;
  const all = await fetchDirectAllAirLivePlaces(options);
  const cc = country.trim().toUpperCase();
  const filtered = cc ? all.items.filter((it) => it.country.toUpperCase() === cc) : all.items;
  return {
    updated: all.updated,
    count: filtered.length,
    attribution: all.attribution,
    attributionUrl: AIRLIVE_BASE_URL,
    cacheHit: wasCached,
    items: filtered,
  };
}

export async function fetchDirectAirLiveCurrent(
  location: LocationOption,
  options?: ApiRequestOptions,
): Promise<AirQualityReading> {
  let targetSlug = location.slug?.trim().toLowerCase() ?? '';
  let distanceKm: number | undefined;

  if (!targetSlug) {
    const all = await fetchDirectAllAirLivePlaces(options);
    const resolved = resolveNearestOrMatchingPlace(all.items, {
      city: location.city,
      lat: location.lat,
      lon: location.lon,
    });
    if (!resolved) {
      throw new ApiClientError(
        'LOCATION_NOT_FOUND',
        'Location was not found within 200 km in the AirLive monitoring directory.',
        false,
      );
    }
    targetSlug = resolved.slug;
    distanceKm = resolved.distanceKm;
  }

  if (!AIRLIVE_SLUG_PATTERN.test(targetSlug)) {
    throw new ApiClientError(
      'VALIDATION_ERROR',
      'Location slug may only contain letters, numbers, and hyphens.',
      false,
    );
  }

  const cached = directCurrentCache.get(targetSlug);
  if (cached && Date.now() - cached.cachedAt < AIRLIVE_FALLBACK_CACHE_TTL_MS) {
    return {
      ...cached.reading,
      location:
        distanceKm !== undefined
          ? { ...cached.reading.location, distanceKm }
          : cached.reading.location,
      provenance: { ...cached.reading.provenance, cacheHit: true },
    };
  }

  const item = await fetchDirectAirLiveJson<RawAirLivePlaceInput>(
    `${AIRLIVE_BASE_URL}/api/v1/aqi/${encodeURIComponent(targetSlug)}`,
    options,
  );
  const reading = buildAirLiveReading(item, {
    distanceKm,
    cacheHit: false,
    stateFallback: 'India',
  });
  directCurrentCache.set(targetSlug, { reading, cachedAt: Date.now() });
  return reading;
}

export async function fetchDirectAirLiveRanking(
  order: 'worst' | 'best' = 'worst',
  limit = 10,
  options?: ApiRequestOptions,
): Promise<AirLiveRankingResponse> {
  const key = `IN::${order}::${limit}`;
  const cached = directRankingCache.get(key);
  if (cached && Date.now() - cached.cachedAt < AIRLIVE_FALLBACK_CACHE_TTL_MS) {
    return { ...cached.data, cacheHit: true };
  }

  const url = new URL(`${AIRLIVE_BASE_URL}/api/v1/ranking`);
  url.searchParams.set('country', 'IN');
  url.searchParams.set('order', order);
  url.searchParams.set('limit', String(limit));

  const raw = await fetchDirectAirLiveJson<{
    updated?: string | null;
    attribution?: string;
    items?: RawAirLivePlaceInput[];
  }>(url.toString(), options);

  const defaultAttr = raw.attribution || AIRLIVE_DEFAULT_ATTRIBUTION;
  const items: AirQualityRankingItem[] = (raw.items ?? []).map((item, idx) => ({
    ...mapAirLivePlaceSummary(item, defaultAttr),
    rank: item.rank ?? idx + 1,
  }));

  const data: AirLiveRankingResponse = {
    updated: raw.updated ?? null,
    attribution: defaultAttr,
    attributionUrl: AIRLIVE_BASE_URL,
    cacheHit: false,
    items,
  };
  directRankingCache.set(key, { data, cachedAt: Date.now() });
  return data;
}

export async function fetchDirectOpenMeteoHistory(
  location: LocationOption,
  options?: ApiRequestOptions,
): Promise<HourlyForecastPoint[]> {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(location.lat));
  url.searchParams.set('longitude', String(location.lon));
  url.searchParams.set('hourly', 'pm2_5,pm10');
  url.searchParams.set('past_days', '1');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'GMT');

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { Accept: 'application/json' }, signal: options?.signal },
    options?.timeoutMs ?? 12_000,
  );
  if (!res.ok) return [];

  const raw = (await res.json().catch(() => null)) as {
    latitude?: number;
    longitude?: number;
    hourly?: { time?: string[]; pm2_5?: Array<number | null>; pm10?: Array<number | null> };
  } | null;

  const times = raw?.hourly?.time;
  if (!Array.isArray(times) || times.length === 0) return [];

  return sliceOpenMeteoWindow(
    times,
    raw?.hourly?.pm2_5,
    raw?.hourly?.pm10,
    raw?.latitude ?? location.lat,
    raw?.longitude ?? location.lon,
    24,
  );
}

export async function searchDirectAirLiveLocations(
  query: string,
  options?: ApiRequestOptions,
): Promise<LocationOption[]> {
  const all = await fetchDirectAllAirLivePlaces(options);
  return filterAndSortLocationSearch(all.items, query, 20).map(mapPlaceToLocationOption);
}
