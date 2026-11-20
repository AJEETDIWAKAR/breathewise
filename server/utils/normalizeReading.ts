import {
  getUsAqiCategory,
  normalizeUsAqiCategoryLabel,
} from '../../src/domain/usAqi.ts';
import type { FreshnessStatus, PollutantKey, UsAqiCategory } from '../../src/types/breathewise.ts';
import type {
  NormalizedCurrentAirQuality,
  NormalizedPollutant,
} from '../providers/types.ts';

const PM25_SAFE_REFERENCE = 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³';

const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours per AirLive documentation

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

export interface BuildAirLiveInput {
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
}

export function buildAirLiveNormalizedReading(
  item: BuildAirLiveInput,
): NormalizedCurrentAirQuality {
  const staleness = evaluateStaleness(item.updated ?? null);

  const validUsAqi =
    typeof item.usAqi === 'number' && Number.isFinite(item.usAqi) && item.usAqi >= 0
      ? Math.round(item.usAqi)
      : null;

  const validPm25 =
    typeof item.pm25 === 'number' && Number.isFinite(item.pm25) && item.pm25 >= 0
      ? Number(item.pm25.toFixed(1))
      : null;

  // Strictly US AQI categories (never CPCB NAQI categories for AirLive data)
  let category: UsAqiCategory | 'Unavailable' = 'Unavailable';
  if (validUsAqi !== null) {
    category = getUsAqiCategory(validUsAqi);
  } else {
    const parsedCat = normalizeUsAqiCategoryLabel(item.category);
    if (parsedCat) category = parsedCat;
  }

  const rawSource = (item.source ?? '').trim().toLowerCase();
  const isGroundStation = rawSource.includes('ground');
  const stationsCount =
    isGroundStation && typeof item.stationsUsed === 'number' && Number.isFinite(item.stationsUsed)
      ? item.stationsUsed
      : null;

  const measurementType: 'ground_station' | 'modeled_forecast' = isGroundStation
    ? 'ground_station'
    : 'modeled_forecast';

  const sourceLabel = isGroundStation
    ? 'Ground Stations'
    : 'Atmospheric Model (Model-based estimate)';

  const stationName = isGroundStation
    ? stationsCount !== null
      ? `${item.name} (${stationsCount} ground station${stationsCount === 1 ? '' : 's'})`
      : `${item.name} (Ground stations)`
    : `${item.name} (Atmospheric model estimate)`;

  const pm25Pollutant: NormalizedPollutant =
    validPm25 !== null
      ? {
          key: 'pm25',
          label: 'PM2.5',
          value: validPm25,
          unit: 'µg/m³',
          subIndex: validUsAqi,
          safeReference: PM25_SAFE_REFERENCE,
          status: 'measured',
        }
      : {
          key: 'pm25',
          label: 'PM2.5',
          value: null,
          unit: 'µg/m³',
          subIndex: null,
          safeReference: PM25_SAFE_REFERENCE,
          status: 'unavailable',
        };

  const missingPollutants: PollutantKey[] = validPm25 === null ? ['pm25'] : [];

  const coverageLimitations = isGroundStation
    ? `Direct ground-station aggregation${stationsCount !== null ? ` across ${stationsCount} station(s)` : ''}; AirLive provides US AQI and PM2.5 at this endpoint.`
    : 'Model-based atmospheric estimate (not a direct local ground-station measurement); local traffic hotspots may be higher.';

  return {
    location: {
      id: item.slug,
      slug: item.slug,
      name: item.name,
      city: item.name,
      state: item.countryName ?? item.country ?? '',
      country: item.country ?? '',
      countryName: item.countryName ?? item.country ?? '',
      kind: item.kind ?? 'city',
      lat: item.lat,
      lon: item.lon,
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
    pollutants: [pm25Pollutant],
    missingPollutants,
    provenance: {
      providerId: 'airlive',
      providerName: 'AirLive',
      stationName,
      measurementType,
      sourceLabel,
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
      attributionUrl: 'https://airlive.tracsa.co.in',
      placeUrl: item.url,
      coverageLimitations,
    },
  };
}
