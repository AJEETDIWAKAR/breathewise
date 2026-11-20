import {
  calculatePm25UsAqi,
  getUsAqiCategory,
  normalizeUsAqiCategoryLabel,
} from '../domain/usAqi';
import type {
  AirQualityRankingItem,
  AirQualityReading,
  FamilyProfile,
  FreshnessStatus,
  HourlyForecastPoint,
  LocationOption,
  UsAqiCategory,
} from '../types/breathewise';

const AIRLIVE_BASE_URL = 'https://airlive.tracsa.co.in';
const AIRLIVE_FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;

export class ApiClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function fetchWithTimeout(
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

async function parseApiResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errObj =
      json && typeof json === 'object' && 'error' in json
        ? (json as { error?: { code?: string; message?: string; retryable?: boolean } }).error
        : undefined;
    if (!errObj && res.status === 404) {
      throw new ApiClientError(
        'BACKEND_API_UNAVAILABLE',
        'BreatheWise /api server route returned HTTP 404 (backend is not mounted on this host).',
        false,
      );
    }
    throw new ApiClientError(
      errObj?.code ?? `HTTP_${res.status}`,
      errObj?.message ?? `Server returned HTTP ${res.status}`,
      errObj?.retryable ?? true,
    );
  }
  if (json === null || typeof json !== 'object') {
    throw new ApiClientError(
      'BACKEND_API_UNAVAILABLE',
      'BreatheWise /api route returned non-JSON content (backend is not mounted on this host).',
      false,
    );
  }
  return json as T;
}

function sanitizeSafeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return undefined;
}

function evaluateClientStaleness(observedIso: string | null | undefined): {
  isStale: boolean;
  freshnessStatus: FreshnessStatus;
  staleReason?: string;
} {
  if (!observedIso || typeof observedIso !== 'string' || !observedIso.trim()) {
    return {
      isStale: true,
      freshnessStatus: 'unavailable',
      staleReason: 'Observation timestamp is missing from the upstream feed.',
    };
  }
  const parsed = Date.parse(observedIso);
  if (Number.isNaN(parsed)) {
    return {
      isStale: true,
      freshnessStatus: 'unavailable',
      staleReason: 'Observation timestamp could not be verified.',
    };
  }
  const ageMs = Date.now() - parsed;
  if (ageMs > STALE_THRESHOLD_MS) {
    const hoursOld = Math.max(3, Math.round(ageMs / (60 * 60 * 1000)));
    return {
      isStale: true,
      freshnessStatus: 'stale',
      staleReason: `Reading is approximately ${hoursOld} hour(s) old (AirLive marks readings older than 3 hours as stale).`,
    };
  }
  return { isStale: false, freshnessStatus: 'fresh' };
}

function haversineKmClient(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RawAirLivePlaceItem {
  slug: string;
  name: string;
  kind?: string;
  country?: string;
  countryName?: string;
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
  rank?: number;
}

const directPlacesCache: {
  data: { updated: string | null; attribution: string; items: AirLivePlaceDto[] } | null;
  cachedAt: number;
} = { data: null, cachedAt: 0 };

const directCurrentCache = new Map<string, { reading: AirQualityReading; cachedAt: number }>();
const directRankingCache = new Map<
  string,
  {
    data: {
      updated: string | null;
      attribution: string;
      attributionUrl: string;
      cacheHit: boolean;
      items: AirQualityRankingItem[];
    };
    cachedAt: number;
  }
>();

function mapRawPlaceToDto(item: RawAirLivePlaceItem): AirLivePlaceDto {
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
      : (normalizeUsAqiCategoryLabel(item.category) ?? 'Unavailable');
  const rawSource = (item.source ?? '').trim().toLowerCase();
  const isGround = rawSource.includes('ground');
  const staleness = evaluateClientStaleness(item.updated ?? null);

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
    updated: item.updated ?? null,
    freshnessStatus: staleness.freshnessStatus,
    url: sanitizeSafeHttpUrl(item.url),
  };
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

async function fetchDirectAllAirLivePlaces(options?: ApiRequestOptions): Promise<{
  updated: string | null;
  attribution: string;
  items: AirLivePlaceDto[];
}> {
  if (
    directPlacesCache.data &&
    Date.now() - directPlacesCache.cachedAt < AIRLIVE_FALLBACK_CACHE_TTL_MS
  ) {
    return directPlacesCache.data;
  }
  const raw = await fetchDirectAirLiveJson<{
    updated?: string | null;
    attribution?: string;
    items?: RawAirLivePlaceItem[];
  }>(`${AIRLIVE_BASE_URL}/api/v1/aqi`, options);

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new ApiClientError(
      'AQI_PROVIDER_UNAVAILABLE',
      'AirLive returned an empty location list.',
      true,
    );
  }

  const mapped = {
    updated: raw.updated ?? null,
    attribution: raw.attribution || 'Data: AirLive (https://airlive.tracsa.co.in).',
    items: raw.items
      .filter((it): it is RawAirLivePlaceItem => Boolean(it && it.slug && it.name))
      .map(mapRawPlaceToDto),
  };
  directPlacesCache.data = mapped;
  directPlacesCache.cachedAt = Date.now();
  return mapped;
}

async function fetchDirectAirLivePlacesByCountry(
  country = 'IN',
  options?: ApiRequestOptions,
): Promise<{
  updated: string | null;
  count: number;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirLivePlaceDto[];
}> {
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

async function fetchDirectAirLiveCurrent(
  location: LocationOption,
  options?: ApiRequestOptions,
): Promise<AirQualityReading> {
  let targetSlug = location.slug?.trim().toLowerCase() ?? '';
  let distanceKm: number | undefined;

  if (!targetSlug) {
    const all = await fetchDirectAllAirLivePlaces(options);
    let matched: AirLivePlaceDto | undefined;
    if (location.city.trim()) {
      const needle = location.city.trim().toLowerCase();
      matched =
        all.items.find((p) => p.slug.toLowerCase() === needle) ??
        all.items.find((p) => p.name.toLowerCase() === needle) ??
        all.items.find(
          (p) =>
            p.country === 'IN' &&
            (p.name.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle)),
        ) ??
        all.items.find(
          (p) => p.name.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle),
        );
    }
    if (!matched && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
      let bestDist = Infinity;
      for (const item of all.items) {
        if (item.kind === 'country') continue;
        const dist = haversineKmClient(location.lat, location.lon, item.lat, item.lon);
        if (dist < bestDist) {
          bestDist = dist;
          matched = item;
        }
      }
      if (bestDist > 200) {
        matched = undefined;
      } else if (matched) {
        distanceKm = Number(bestDist.toFixed(1));
      }
    }
    if (!matched) {
      throw new ApiClientError(
        'LOCATION_NOT_FOUND',
        'Location was not found within 200 km in the AirLive monitoring directory.',
        false,
      );
    }
    targetSlug = matched.slug;
  }

  if (!SLUG_PATTERN.test(targetSlug)) {
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

  const item = await fetchDirectAirLiveJson<RawAirLivePlaceItem>(
    `${AIRLIVE_BASE_URL}/api/v1/aqi/${encodeURIComponent(targetSlug)}`,
    options,
  );
  const staleness = evaluateClientStaleness(item.updated ?? null);
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
      : (normalizeUsAqiCategoryLabel(item.category) ?? 'Unavailable');
  const rawSource = (item.source ?? '').trim().toLowerCase();
  const isGroundStation = rawSource.includes('ground');
  const stationsCount =
    isGroundStation && typeof item.stationsUsed === 'number' && Number.isFinite(item.stationsUsed)
      ? item.stationsUsed
      : null;

  const reading: AirQualityReading = {
    location: {
      id: item.slug,
      slug: item.slug,
      name: item.name,
      city: item.name,
      state: item.countryName || item.country || 'India',
      country: item.country ?? '',
      countryName: item.countryName ?? item.country ?? '',
      kind: item.kind ?? 'city',
      lat: item.lat,
      lon: item.lon,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
    },
    aqi: {
      value: validUsAqi,
      scale: 'US_AQI',
      category,
      dominantPollutant: validPm25 !== null ? 'PM2.5' : 'Unavailable',
      modelUsAqi:
        typeof item.modelUsAqi === 'number' && Number.isFinite(item.modelUsAqi)
          ? Math.round(item.modelUsAqi)
          : null,
      stationToModelRatio:
        typeof item.stationToModelRatio === 'number' && Number.isFinite(item.stationToModelRatio)
          ? Number(item.stationToModelRatio.toFixed(3))
          : null,
    },
    pollutants: [
      validPm25 !== null
        ? {
            key: 'pm25',
            label: 'PM2.5',
            value: validPm25,
            unit: 'µg/m³',
            subIndex: validUsAqi,
            safeReference: 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³',
            status: 'measured',
          }
        : {
            key: 'pm25',
            label: 'PM2.5',
            value: null,
            unit: 'µg/m³',
            subIndex: null,
            safeReference: 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³',
            status: 'unavailable',
          },
    ],
    missingPollutants: validPm25 === null ? ['pm25'] : [],
    provenance: {
      providerId: 'airlive',
      providerName: 'AirLive',
      stationName: isGroundStation
        ? stationsCount !== null
          ? `${item.name} (${stationsCount} ground station${stationsCount === 1 ? '' : 's'})`
          : `${item.name} (Ground stations)`
        : `${item.name} (Atmospheric model estimate)`,
      measurementType: isGroundStation ? 'ground_station' : 'modeled_forecast',
      sourceLabel: isGroundStation
        ? 'Ground Stations'
        : 'Atmospheric Model (Model-based estimate)',
      stationsUsed: stationsCount,
      observedAt: item.updated ?? null,
      fetchedAt: new Date().toISOString(),
      isStale: staleness.isStale,
      freshnessStatus: staleness.freshnessStatus,
      staleReason: staleness.staleReason,
      spatialResolution: isGroundStation
        ? `${stationsCount ?? 'Local'} Ground Station(s)`
        : 'Gridded Atmospheric Model Estimate',
      attribution: item.attribution || 'Data: AirLive (https://airlive.tracsa.co.in).',
      attributionUrl: AIRLIVE_BASE_URL,
      placeUrl: sanitizeSafeHttpUrl(item.url),
      coverageLimitations: isGroundStation
        ? `Direct ground-station aggregation${stationsCount !== null ? ` across ${stationsCount} station(s)` : ''}; AirLive provides US AQI and PM2.5 at this endpoint.`
        : 'Model-based atmospheric estimate (not a direct local ground-station measurement); local traffic hotspots may be higher.',
      cacheHit: false,
    },
  };

  directCurrentCache.set(targetSlug, { reading, cachedAt: Date.now() });
  return reading;
}

async function fetchDirectAirLiveRanking(
  order: 'worst' | 'best' = 'worst',
  limit = 10,
  options?: ApiRequestOptions,
): Promise<{
  updated: string | null;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirQualityRankingItem[];
}> {
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
    items?: RawAirLivePlaceItem[];
  }>(url.toString(), options);

  const items: AirQualityRankingItem[] = (raw.items ?? []).map((item, idx) => ({
    ...mapRawPlaceToDto(item),
    rank: item.rank ?? idx + 1,
  }));
  const data = {
    updated: raw.updated ?? null,
    attribution: raw.attribution || 'Data: AirLive (https://airlive.tracsa.co.in).',
    attributionUrl: AIRLIVE_BASE_URL,
    cacheHit: false,
    items,
  };
  directRankingCache.set(key, { data, cachedAt: Date.now() });
  return data;
}

async function fetchDirectOpenMeteoHistory(
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

  const lat = raw?.latitude ?? location.lat;
  const lon = raw?.longitude ?? location.lon;
  const useIst = lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98;
  const displayTz = useIst ? 'Asia/Kolkata' : 'UTC';
  const nowMs = Date.now();

  const points: HourlyForecastPoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const rawTime = times[i];
    const iso =
      rawTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(rawTime)
        ? new Date(rawTime).toISOString()
        : new Date(`${rawTime}:00Z`).toISOString();
    const pm25 = raw?.hourly?.pm2_5?.[i] ?? null;
    const pm10 = raw?.hourly?.pm10?.[i] ?? null;
    if (typeof pm25 !== 'number' || typeof pm10 !== 'number') continue;
    const estimated = calculatePm25UsAqi(pm25);
    points.push({
      hourLabel: new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: displayTz,
      }),
      timestamp: iso,
      pm25: Number(pm25.toFixed(1)),
      pm10: Number(pm10.toFixed(1)),
      estimatedNaqi: estimated,
      scale: 'US_AQI',
      category: getUsAqiCategory(estimated),
    });
  }

  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const diff = Math.abs(Date.parse(points[i].timestamp) - nowMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  const start = Math.max(0, closestIdx - 12);
  return points.slice(start, start + 24);
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

export async function fetchAirLivePlaces(
  country = 'IN',
  options?: ApiRequestOptions,
): Promise<{
  updated: string | null;
  count: number;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirLivePlaceDto[];
}> {
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  try {
    const res = await fetchWithTimeout(
      `/api/air-quality/places?${params.toString()}`,
      { signal: options?.signal },
      options?.timeoutMs,
    );
    return await parseApiResponse(res);
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      return fetchDirectAirLivePlacesByCountry(country, options);
    }
    throw err;
  }
}

export async function fetchLiveCurrentAirQuality(
  location: LocationOption,
  options?: ApiRequestOptions,
): Promise<AirQualityReading> {
  const params = new URLSearchParams();
  if (location.slug) {
    params.set('slug', location.slug);
  } else {
    if (Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
      params.set('lat', String(location.lat));
      params.set('lon', String(location.lon));
    }
    if (location.city.trim()) {
      params.set('city', location.city.trim());
    }
  }

  let data: AirQualityReading;
  try {
    const res = await fetchWithTimeout(
      `/api/air-quality/current?${params.toString()}`,
      { signal: options?.signal },
      options?.timeoutMs,
    );
    data = await parseApiResponse<AirQualityReading>(res);
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      return fetchDirectAirLiveCurrent(location, options);
    }
    throw err;
  }

  return {
    location: {
      id: data.location.slug ?? data.location.id ?? location.id,
      slug: data.location.slug ?? location.slug,
      name: data.location.name,
      city: data.location.city,
      state: data.location.state ?? data.location.countryName ?? location.state,
      country: data.location.country ?? location.country,
      countryName: data.location.countryName ?? location.countryName,
      kind: data.location.kind ?? location.kind,
      lat: data.location.lat,
      lon: data.location.lon,
      distanceKm: data.location.distanceKm,
    },
    aqi: data.aqi,
    pollutants: data.pollutants,
    missingPollutants: data.missingPollutants,
    provenance: data.provenance,
  };
}

export async function fetchIndiaRanking(
  order: 'worst' | 'best' = 'worst',
  limit = 10,
  options?: ApiRequestOptions,
): Promise<{
  updated: string | null;
  attribution: string;
  attributionUrl: string;
  cacheHit: boolean;
  items: AirQualityRankingItem[];
}> {
  const params = new URLSearchParams({
    country: 'IN',
    order,
    limit: String(limit),
  });
  try {
    const res = await fetchWithTimeout(
      `/api/air-quality/ranking?${params.toString()}`,
      { signal: options?.signal },
      options?.timeoutMs,
    );
    return await parseApiResponse(res);
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      return fetchDirectAirLiveRanking(order, limit, options);
    }
    throw err;
  }
}

export async function fetchLiveHistoryAirQuality(
  location: LocationOption,
  options?: ApiRequestOptions,
): Promise<HourlyForecastPoint[]> {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lon: String(location.lon),
    hours: '24',
  });

  let data: {
    hourly: Array<{
      hourLabel: string;
      timestamp: string;
      pm25: number | null;
      pm10: number | null;
      estimatedNaqi: number | null;
      scale?: import('../types/breathewise').AqiScale;
      category: string;
    }>;
  };
  try {
    const res = await fetchWithTimeout(
      `/api/air-quality/history?${params.toString()}`,
      { signal: options?.signal },
      options?.timeoutMs,
    );
    data = await parseApiResponse(res);
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      return fetchDirectOpenMeteoHistory(location, options);
    }
    throw err;
  }

  return data.hourly
    .filter(
      (pt): pt is typeof pt & { pm25: number; pm10: number; estimatedNaqi: number } =>
        pt.pm25 !== null &&
        pt.pm10 !== null &&
        pt.estimatedNaqi !== null &&
        pt.category !== 'Unavailable',
    )
    .map((pt) => ({
      hourLabel: pt.hourLabel,
      timestamp: pt.timestamp,
      pm25: pt.pm25,
      pm10: pt.pm10,
      estimatedNaqi: pt.estimatedNaqi,
      scale: pt.scale ?? 'US_AQI',
      category: pt.category as HourlyForecastPoint['category'],
    }));
}

export async function searchLocationsApi(
  query: string,
  options?: ApiRequestOptions,
): Promise<LocationOption[]> {
  const params = new URLSearchParams({ q: query, limit: '20' });
  try {
    const res = await fetchWithTimeout(
      `/api/air-quality/search?${params.toString()}`,
      { signal: options?.signal },
      options?.timeoutMs,
    );
    const data = await parseApiResponse<{
      locations: Array<{
        id: string;
        slug: string;
        name: string;
        city: string;
        state: string;
        country: string;
        countryName: string;
        kind: string;
        lat: number;
        lon: number;
      }>;
    }>(res);

    return data.locations.map((loc) => ({
      id: loc.slug || loc.id,
      slug: loc.slug || loc.id,
      name: loc.name,
      city: loc.city || loc.name,
      state: loc.countryName || loc.state || loc.country,
      country: loc.country,
      countryName: loc.countryName,
      kind: loc.kind,
      lat: loc.lat,
      lon: loc.lon,
    }));
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      const all = await fetchDirectAllAirLivePlaces(options);
      const needle = query.trim().toLowerCase();
      return all.items
        .filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            item.slug.toLowerCase().includes(needle) ||
            item.countryName.toLowerCase().includes(needle),
        )
        .sort((a, b) => {
          const aIn = a.country === 'IN' ? 0 : 1;
          const bIn = b.country === 'IN' ? 0 : 1;
          if (aIn !== bIn) return aIn - bIn;
          const aPrefix = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
          const bPrefix = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
          if (aPrefix !== bPrefix) return aPrefix - bPrefix;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 20)
        .map((loc) => ({
          id: loc.slug,
          slug: loc.slug,
          name: loc.name,
          city: loc.name,
          state: loc.countryName || loc.country || 'India',
          country: loc.country,
          countryName: loc.countryName,
          kind: loc.kind,
          lat: loc.lat,
          lon: loc.lon,
        }));
    }
    throw err;
  }
}

export interface AiChatResult {
  reply: string;
  structured: import('../types/breathewise').AiStructuredAdvice;
  model: string;
  responseSource: 'gemini' | 'rule_based_fallback';
  aiAvailable: boolean;
  aiUnavailableReason?: string;
  fallbackReasonCode?: import('../types/breathewise').AiFallbackReasonCode;
  liveDataAvailable: boolean;
  liveDataUnavailableReason?: string;
  contextSentSummary?: {
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

export async function sendAiChatMessage(
  payload: {
    message: string;
    slug?: string;
    city?: string;
    lat?: number;
    lon?: number;
    history: Array<{ role: 'user' | 'assistant'; text: string }>;
    familyProfile: FamilyProfile;
  },
  options?: ApiRequestOptions,
): Promise<AiChatResult> {
  try {
    const res = await fetchWithTimeout(
      '/api/ai/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options?.signal,
      },
      options?.timeoutMs ?? 25_000,
    );
    return await parseApiResponse<AiChatResult>(res);
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'BACKEND_API_UNAVAILABLE') {
      throw new ApiClientError(
        'BACKEND_API_UNAVAILABLE',
        'BreatheWise AI Assistant requires the Node/Express server ("npm start") for server-side Gemini calls. Live air-quality readings and deterministic household tools remain active.',
        false,
      );
    }
    throw err;
  }
}
