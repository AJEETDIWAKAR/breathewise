import type {
  AqiCategory,
  AqiScale,
  FreshnessStatus,
  NaqiCategory,
  PollutantKey,
  UsAqiCategory,
} from '../../src/types/breathewise.ts';

export type AqiProviderId = 'airlive' | 'open_meteo_cams';

export interface NormalizedPollutant {
  key: PollutantKey;
  label: string;
  value: number | null;
  unit: 'µg/m³' | 'mg/m³';
  subIndex: number | null;
  safeReference: string;
  status: 'measured' | 'unavailable';
}

export interface NormalizedCurrentAirQuality {
  location: {
    id: string;
    slug?: string;
    name: string;
    city: string;
    state?: string;
    country?: string;
    countryName?: string;
    kind?: string;
    lat: number;
    lon: number;
    distanceKm?: number;
  };
  aqi: {
    value: number | null;
    scale: AqiScale;
    category: AqiCategory | 'Unavailable';
    dominantPollutant: string;
    modelUsAqi?: number | null;
    stationToModelRatio?: number | null;
    providerReferenceAqi?: {
      scale: 'US_AQI' | 'EAQI' | 'WAQI_AQI';
      value: number;
      note: string;
    };
  };
  pollutants: NormalizedPollutant[];
  missingPollutants: PollutantKey[];
  provenance: {
    providerId: AqiProviderId;
    providerName: string;
    stationName: string;
    measurementType: 'ground_station' | 'modeled_forecast';
    sourceLabel: string;
    stationsUsed: number | null;
    observedAt: string | null;
    fetchedAt: string;
    isStale: boolean;
    freshnessStatus: FreshnessStatus;
    staleReason?: string;
    spatialResolution: string;
    attribution: string;
    attributionUrl?: string;
    placeUrl?: string;
    coverageLimitations: string;
    cacheHit?: boolean;
  };
}

export interface AirLivePlaceSummary {
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

export interface AirLiveRankingEntry extends AirLivePlaceSummary {
  rank: number;
}

export interface HourlyHistoryPoint {
  hourLabel: string;
  timestamp: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  estimatedNaqi: number | null;
  scale?: AqiScale;
  category: AqiCategory | NaqiCategory | 'Unavailable';
}

export interface NormalizedHistoryResult {
  location: {
    lat: number;
    lon: number;
    timezone: string;
  };
  hourly: HourlyHistoryPoint[];
  provenance: {
    providerId: AqiProviderId;
    providerName: string;
    measurementType: 'ground_station' | 'modeled_forecast';
    spatialResolution: string;
    attribution: string;
    coverageLimitations: string;
    fetchedAt: string;
    cacheHit?: boolean;
  };
}

export interface LocationSearchResult {
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
  source: string;
}

export interface AirQualityQuery {
  slug?: string;
  lat?: number;
  lon?: number;
  city?: string;
  locationName?: string;
}

export interface AirQualityProvider {
  readonly id: AqiProviderId;
  readonly name: string;
  isConfigured(): boolean;
}
