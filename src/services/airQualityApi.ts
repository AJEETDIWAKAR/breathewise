import type {
  AiFallbackReasonCode,
  AiStructuredAdvice,
  AirQualityReading,
  AqiScale,
  FamilyProfile,
  HourlyForecastPoint,
  LocationOption,
} from '../types/breathewise';
import {
  ApiClientError,
  fetchDirectAirLiveCurrent,
  fetchDirectAirLivePlacesByCountry,
  fetchDirectAirLiveRanking,
  fetchDirectOpenMeteoHistory,
  fetchWithTimeout,
  searchDirectAirLiveLocations,
  type AirLivePlaceDto,
  type AirLivePlacesResponse,
  type AirLiveRankingResponse,
  type ApiRequestOptions,
} from './airliveClientFallback';

export { ApiClientError, type AirLivePlaceDto, type ApiRequestOptions };

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

export async function fetchAirLivePlaces(
  country = 'IN',
  options?: ApiRequestOptions,
): Promise<AirLivePlacesResponse> {
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
): Promise<AirLiveRankingResponse> {
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
      scale?: AqiScale;
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
      return searchDirectAirLiveLocations(query, options);
    }
    throw err;
  }
}

export interface AiChatResult {
  reply: string;
  structured: AiStructuredAdvice;
  model: string;
  responseSource: 'gemini' | 'rule_based_fallback';
  aiAvailable: boolean;
  aiUnavailableReason?: string;
  fallbackReasonCode?: AiFallbackReasonCode;
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
        'The AI Assistant backend service is unavailable on this host. Live AirLive readings and deterministic household tools remain active.',
        false,
      );
    }
    throw err;
  }
}
