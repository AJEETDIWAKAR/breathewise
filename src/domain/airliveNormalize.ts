import type {
  AirQualityReading,
  FreshnessStatus,
  HourlyForecastPoint,
  LocationOption,
  PollutantMetric,
  UsAqiCategory,
} from '../types/breathewise.ts';
import {
  calculatePm25UsAqi,
  getUsAqiCategory,
  normalizeUsAqiCategoryLabel,
} from './usAqi.ts';

export const AIRLIVE_BASE_URL = 'https://airlive.tracsa.co.in';
export const AIRLIVE_DEFAULT_ATTRIBUTION = 'Data: AirLive (https://airlive.tracsa.co.in).';
export const PM25_SAFE_REFERENCE = 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³';
export const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;
export const AIRLIVE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;

export interface RawAirLivePlaceInput {
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

export interface NormalizedPlaceSummary {
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
  modelUsAqi: number | null;
  stationToModelRatio: number | null;
  updated: string | null;
  freshnessStatus: FreshnessStatus;
  url?: string;
  attribution: string;
}

export function sanitizeHttpUrl(rawUrl: unknown): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateStaleness(observedIso: string | null | undefined): {
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

  return {
    isStale: false,
    freshnessStatus: 'fresh',
  };
}

function parseNonNegativeRounded(val: number | null | undefined): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.round(val) : null;
}

function parseNonNegativeFixed(val: number | null | undefined, digits: number): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0
    ? Number(val.toFixed(digits))
    : null;
}

export function mapAirLivePlaceSummary(
  item: RawAirLivePlaceInput,
  defaultAttribution = AIRLIVE_DEFAULT_ATTRIBUTION,
): NormalizedPlaceSummary {
  const validUsAqi = parseNonNegativeRounded(item.usAqi);
  const validPm25 = parseNonNegativeFixed(item.pm25, 1);
  const category =
    validUsAqi !== null
      ? getUsAqiCategory(validUsAqi)
      : (normalizeUsAqiCategoryLabel(item.category) ?? 'Unavailable');

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
    modelUsAqi: parseNonNegativeRounded(item.modelUsAqi),
    stationToModelRatio: parseNonNegativeFixed(item.stationToModelRatio, 3),
    updated: item.updated ?? null,
    freshnessStatus: staleness.freshnessStatus,
    url: sanitizeHttpUrl(item.url),
    attribution: item.attribution || defaultAttribution,
  };
}

function resolveStationName(
  placeName: string,
  isGroundStation: boolean,
  stationsCount: number | null,
): string {
  if (!isGroundStation) {
    return `${placeName} (Atmospheric model estimate)`;
  }
  if (stationsCount === null) {
    return `${placeName} (Ground stations)`;
  }
  return `${placeName} (${stationsCount} ground station${stationsCount === 1 ? '' : 's'})`;
}

function buildPm25Pollutant(
  validPm25: number | null,
  validUsAqi: number | null,
): PollutantMetric & { status: 'measured' | 'unavailable' } {
  if (validPm25 !== null) {
    return {
      key: 'pm25',
      label: 'PM2.5',
      value: validPm25,
      unit: 'µg/m³',
      subIndex: validUsAqi,
      safeReference: PM25_SAFE_REFERENCE,
      status: 'measured',
    };
  }
  return {
    key: 'pm25',
    label: 'PM2.5',
    value: null,
    unit: 'µg/m³',
    subIndex: null,
    safeReference: PM25_SAFE_REFERENCE,
    status: 'unavailable',
  };
}

function buildAirLiveLocation(
  item: RawAirLivePlaceInput,
  options: { distanceKm?: number; stateFallback?: string },
): AirQualityReading['location'] {
  return {
    id: item.slug,
    slug: item.slug,
    name: item.name,
    city: item.name,
    state: item.countryName || item.country || options.stateFallback || '',
    country: item.country ?? '',
    countryName: item.countryName ?? item.country ?? '',
    kind: item.kind ?? 'city',
    lat: item.lat,
    lon: item.lon,
    ...(options.distanceKm !== undefined ? { distanceKm: options.distanceKm } : {}),
  };
}

function buildAirLiveProvenance(params: {
  item: RawAirLivePlaceInput;
  isGroundStation: boolean;
  stationsCount: number | null;
  staleness: ReturnType<typeof evaluateStaleness>;
  cacheHit?: boolean;
}): AirQualityReading['provenance'] {
  const { item, isGroundStation, stationsCount, staleness, cacheHit } = params;
  const stationCountSuffix = stationsCount !== null ? ` across ${stationsCount} station(s)` : '';

  return {
    providerId: 'airlive',
    providerName: 'AirLive',
    stationName: resolveStationName(item.name, isGroundStation, stationsCount),
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
    attribution: item.attribution || AIRLIVE_DEFAULT_ATTRIBUTION,
    attributionUrl: AIRLIVE_BASE_URL,
    placeUrl: sanitizeHttpUrl(item.url),
    coverageLimitations: isGroundStation
      ? `Direct ground-station aggregation${stationCountSuffix}; AirLive provides US AQI and PM2.5 at this endpoint.`
      : 'Model-based atmospheric estimate (not a direct local ground-station measurement); local traffic hotspots may be higher.',
    ...(cacheHit !== undefined ? { cacheHit } : {}),
  };
}

export function buildAirLiveReading(
  item: RawAirLivePlaceInput,
  options: { distanceKm?: number; cacheHit?: boolean; stateFallback?: string } = {},
): AirQualityReading {
  const staleness = evaluateStaleness(item.updated ?? null);
  const validUsAqi = parseNonNegativeRounded(item.usAqi);
  const validPm25 = parseNonNegativeFixed(item.pm25, 1);

  const category: UsAqiCategory | 'Unavailable' =
    validUsAqi !== null
      ? getUsAqiCategory(validUsAqi)
      : (normalizeUsAqiCategoryLabel(item.category) ?? 'Unavailable');

  const rawSource = (item.source ?? '').trim().toLowerCase();
  const isGroundStation = rawSource.includes('ground');
  const stationsCount =
    isGroundStation && typeof item.stationsUsed === 'number' && Number.isFinite(item.stationsUsed)
      ? item.stationsUsed
      : null;

  return {
    location: buildAirLiveLocation(item, options),
    aqi: {
      value: validUsAqi,
      scale: 'US_AQI',
      category,
      dominantPollutant: validPm25 !== null ? 'PM2.5' : 'Unavailable',
      modelUsAqi: parseNonNegativeRounded(item.modelUsAqi),
      stationToModelRatio: parseNonNegativeFixed(item.stationToModelRatio, 3),
    },
    pollutants: [buildPm25Pollutant(validPm25, validUsAqi)],
    missingPollutants: validPm25 === null ? ['pm25'] : [],
    provenance: buildAirLiveProvenance({
      item,
      isGroundStation,
      stationsCount,
      staleness,
      cacheHit: options.cacheHit,
    }),
  };
}

export function filterAndSortLocationSearch<
  T extends { slug: string; name: string; country: string; countryName: string },
>(items: T[], query: string, limit: number): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return items
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
    .slice(0, limit);
}

export function mapPlaceToLocationOption(place: {
  slug: string;
  name: string;
  country: string;
  countryName: string;
  kind: string;
  lat: number;
  lon: number;
}): LocationOption {
  return {
    id: place.slug,
    slug: place.slug,
    name: place.name,
    city: place.name,
    state: place.countryName || place.country || 'India',
    country: place.country,
    countryName: place.countryName,
    kind: place.kind,
    lat: place.lat,
    lon: place.lon,
  };
}

export function resolveNearestOrMatchingPlace<
  T extends { slug: string; name: string; country: string; kind: string; lat: number; lon: number },
>(
  items: T[],
  query: { city?: string; lat?: number; lon?: number },
  maxRadiusKm = 200,
): { slug: string; distanceKm?: number } | null {
  let matched: T | undefined;
  let matchedDistanceKm: number | undefined;

  if (query.city && query.city.trim()) {
    const needle = query.city.trim().toLowerCase();
    matched =
      items.find((p) => p.slug.toLowerCase() === needle) ??
      items.find((p) => p.name.toLowerCase() === needle) ??
      items.find(
        (p) =>
          p.country === 'IN' &&
          (p.name.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle)),
      ) ??
      items.find(
        (p) => p.name.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle),
      );
  }

  if (
    !matched &&
    query.lat !== undefined &&
    query.lon !== undefined &&
    Number.isFinite(query.lat) &&
    Number.isFinite(query.lon)
  ) {
    let bestDist = Infinity;
    for (const item of items) {
      if (item.kind === 'country') continue;
      const dist = haversineKm(query.lat, query.lon, item.lat, item.lon);
      if (dist < bestDist) {
        bestDist = dist;
        matched = item;
      }
    }
    if (bestDist > maxRadiusKm) {
      matched = undefined;
    } else if (matched) {
      matchedDistanceKm = Number(bestDist.toFixed(1));
    }
  }

  if (!matched) {
    return null;
  }

  return { slug: matched.slug, distanceKm: matchedDistanceKm };
}

export function isWithinIndiaBounds(lat: number, lon: number): boolean {
  return lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98;
}

export function toUtcIso(rawTime: string): string {
  if (rawTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(rawTime)) {
    return new Date(rawTime).toISOString();
  }
  return new Date(`${rawTime}:00Z`).toISOString();
}

export function sliceOpenMeteoWindow(
  times: string[],
  pm25Arr: Array<number | null> | undefined,
  pm10Arr: Array<number | null> | undefined,
  lat: number,
  lon: number,
  hours = 24,
): HourlyForecastPoint[] {
  const useIst = isWithinIndiaBounds(lat, lon);
  const displayTimeZone = useIst ? 'Asia/Kolkata' : 'UTC';
  const nowMs = Date.now();
  const points: HourlyForecastPoint[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const pm25 = pm25Arr?.[i] ?? null;
    const pm10 = pm10Arr?.[i] ?? null;
    if (typeof pm25 !== 'number' || typeof pm10 !== 'number') continue;

    const iso = toUtcIso(times[i]);
    const estimated = calculatePm25UsAqi(pm25);
    points.push({
      hourLabel: new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: displayTimeZone,
      }),
      timestamp: iso,
      pm25: Number(pm25.toFixed(1)),
      pm10: Number(pm10.toFixed(1)),
      estimatedNaqi: estimated,
      scale: 'US_AQI',
      category: getUsAqiCategory(estimated),
    });
  }

  if (points.length === 0) return [];

  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const diff = Math.abs(Date.parse(points[i].timestamp) - nowMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const half = Math.floor(hours / 2);
  const start = Math.max(0, closestIdx - half);
  return points.slice(start, start + hours);
}
