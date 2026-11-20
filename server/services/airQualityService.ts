import {
  AIRLIVE_BASE_URL,
  filterAndSortLocationSearch,
  mapPlaceToLocationOption,
  resolveNearestOrMatchingPlace,
} from '../../src/domain/airliveNormalize.ts';
import {
  generateDailyPlan,
  getDailyRecommendations,
  getFamilySafetySummary,
} from '../../src/domain/plannerRules.ts';
import { findBestVentilationWindow } from '../../src/domain/indoorRules.ts';
import type {
  AirQualityReading,
  FamilyProfile,
  HourlyForecastPoint,
} from '../../src/types/breathewise.ts';
import type { ServerConfig } from '../config/env.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AirQualityProviderRegistry } from '../providers/providerRegistry.ts';
import type {
  AirLivePlaceSummary,
  AirLiveRankingEntry,
  AirQualityQuery,
  LocationSearchResult,
  NormalizedCurrentAirQuality,
  NormalizedHistoryResult,
} from '../providers/types.ts';
import { TtlCache } from '../utils/cache.ts';

interface CachedPlacesDirectory {
  updated: string | null;
  attribution: string;
  items: AirLivePlaceSummary[];
}

interface CachedRankingResult {
  updated: string | null;
  attribution: string;
  items: AirLiveRankingEntry[];
}

function toClientAirQualityReading(norm: NormalizedCurrentAirQuality): AirQualityReading {
  return {
    location: {
      id: norm.location.slug ?? norm.location.id,
      slug: norm.location.slug,
      name: norm.location.name,
      city: norm.location.city,
      state: norm.location.state ?? norm.location.countryName ?? '',
      country: norm.location.country,
      countryName: norm.location.countryName,
      kind: norm.location.kind,
      lat: norm.location.lat,
      lon: norm.location.lon,
      distanceKm: norm.location.distanceKm,
    },
    aqi: norm.aqi,
    pollutants: norm.pollutants,
    missingPollutants: norm.missingPollutants,
    provenance: norm.provenance,
  };
}

export class AirQualityService {
  private readonly registry: AirQualityProviderRegistry;
  private readonly placesCache: TtlCache<CachedPlacesDirectory>;
  private readonly currentCache: TtlCache<NormalizedCurrentAirQuality>;
  private readonly rankingCache: TtlCache<CachedRankingResult>;
  private readonly historyCache: TtlCache<NormalizedHistoryResult>;
  private inflightDirectory: Promise<CachedPlacesDirectory> | null = null;
  private readonly inflightCurrent = new Map<string, Promise<NormalizedCurrentAirQuality>>();
  private readonly inflightRanking = new Map<string, Promise<CachedRankingResult>>();
  private readonly inflightHistory = new Map<string, Promise<NormalizedHistoryResult>>();

  constructor(config: ServerConfig, registry?: AirQualityProviderRegistry) {
    this.registry = registry ?? new AirQualityProviderRegistry(config);
    this.placesCache = new TtlCache<CachedPlacesDirectory>(config.aqiCacheTtlMs);
    this.currentCache = new TtlCache<NormalizedCurrentAirQuality>(config.aqiCacheTtlMs);
    this.rankingCache = new TtlCache<CachedRankingResult>(config.aqiCacheTtlMs);
    this.historyCache = new TtlCache<NormalizedHistoryResult>(config.historyCacheTtlMs);
  }

  getCapabilities() {
    return this.registry.getCapabilities();
  }

  private async getDirectory(): Promise<{ data: CachedPlacesDirectory; cacheHit: boolean }> {
    const cached = this.placesCache.get('all');
    if (cached) {
      return { data: cached.value, cacheHit: true };
    }
    if (!this.inflightDirectory) {
      this.inflightDirectory = this.registry.airlive
        .fetchAllPlaces()
        .then((fresh) => {
          this.placesCache.set('all', fresh);
          return fresh;
        })
        .finally(() => {
          this.inflightDirectory = null;
        });
    }
    const fresh = await this.inflightDirectory;
    return { data: fresh, cacheHit: false };
  }

  async getPlaces(options: { country?: string; q?: string; kind?: string } = {}) {
    const { data, cacheHit } = await this.getDirectory();
    let items = data.items;

    if (options.country) {
      const cc = options.country.trim().toUpperCase();
      items = items.filter((item) => item.country.toUpperCase() === cc);
    }

    if (options.kind) {
      const k = options.kind.trim().toLowerCase();
      items = items.filter((item) => item.kind.toLowerCase() === k);
    }

    if (options.q && options.q.trim()) {
      const needle = options.q.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          item.slug.toLowerCase().includes(needle) ||
          item.countryName.toLowerCase().includes(needle),
      );
    }

    return {
      updated: data.updated,
      count: items.length,
      attribution: data.attribution,
      attributionUrl: AIRLIVE_BASE_URL,
      cacheHit,
      items,
    };
  }

  async searchLocations(query: string, limit = 15): Promise<LocationSearchResult[]> {
    const { data } = await this.getDirectory();
    const matches = filterAndSortLocationSearch(data.items, query, limit);

    return matches.map((item) => ({
      ...mapPlaceToLocationOption(item),
      country: item.country,
      countryName: item.countryName,
      kind: item.kind,
      source: 'AirLive',
    }));
  }

  private async resolveSlugFromQuery(
    query: AirQualityQuery,
  ): Promise<{ slug: string; distanceKm?: number }> {
    if (query.slug) {
      return { slug: query.slug.trim().toLowerCase() };
    }

    const { data } = await this.getDirectory();
    const resolved = resolveNearestOrMatchingPlace(data.items, {
      city: query.city,
      lat: query.lat,
      lon: query.lon,
    });

    if (!resolved) {
      throw new AppError(
        404,
        'LOCATION_NOT_FOUND',
        `Location "${query.city ?? `${query.lat}, ${query.lon}`}" is not in the supported AirLive locations directory.`,
        false,
      );
    }

    return resolved;
  }

  async getCurrent(query: AirQualityQuery): Promise<NormalizedCurrentAirQuality> {
    const { slug, distanceKm } = await this.resolveSlugFromQuery(query);
    const cacheKey = `slug:${slug}`;

    const attachDistance = (
      reading: NormalizedCurrentAirQuality,
      cacheHit: boolean,
    ): NormalizedCurrentAirQuality => ({
      ...reading,
      location:
        distanceKm !== undefined ? { ...reading.location, distanceKm } : reading.location,
      provenance: {
        ...reading.provenance,
        cacheHit,
      },
    });

    const cached = this.currentCache.get(cacheKey);
    if (cached) {
      return attachDistance(cached.value, true);
    }

    let pending = this.inflightCurrent.get(cacheKey);
    if (!pending) {
      pending = this.registry.airlive
        .fetchPlaceBySlug(slug)
        .then((reading) => {
          this.currentCache.set(cacheKey, reading);
          return reading;
        })
        .finally(() => {
          this.inflightCurrent.delete(cacheKey);
        });
      this.inflightCurrent.set(cacheKey, pending);
    }

    const reading = await pending;
    return attachDistance(reading, false);
  }

  async getRanking(
    country = 'IN',
    order: 'worst' | 'best' = 'worst',
    limit = 10,
  ) {
    const cacheKey = `${country.toUpperCase()}::${order}::${limit}`;
    const cached = this.rankingCache.get(cacheKey);
    if (cached) {
      return {
        ...cached.value,
        attributionUrl: 'https://airlive.tracsa.co.in',
        cacheHit: true,
      };
    }

    let pending = this.inflightRanking.get(cacheKey);
    if (!pending) {
      pending = this.registry.airlive
        .fetchRanking(country, order, limit)
        .then((ranking) => {
          this.rankingCache.set(cacheKey, ranking);
          return ranking;
        })
        .finally(() => {
          this.inflightRanking.delete(cacheKey);
        });
      this.inflightRanking.set(cacheKey, pending);
    }

    const ranking = await pending;
    return {
      ...ranking,
      attributionUrl: 'https://airlive.tracsa.co.in',
      cacheHit: false,
    };
  }

  async getHistory(lat: number, lon: number, hours = 24): Promise<NormalizedHistoryResult> {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}::h=${hours}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached) {
      return {
        ...cached.value,
        provenance: {
          ...cached.value.provenance,
          cacheHit: true,
        },
      };
    }

    let pending = this.inflightHistory.get(cacheKey);
    if (!pending) {
      pending = this.registry.openMeteo
        .fetchHistoryAndForecast(lat, lon, hours)
        .then((result) => {
          this.historyCache.set(cacheKey, result);
          return result;
        })
        .finally(() => {
          this.inflightHistory.delete(cacheKey);
        });
      this.inflightHistory.set(cacheKey, pending);
    }

    const result = await pending;
    return {
      ...result,
      provenance: {
        ...result.provenance,
        cacheHit: false,
      },
    };
  }

  async buildRecommendations(
    query: AirQualityQuery,
    familyProfile: FamilyProfile,
  ) {
    const current = await this.getCurrent(query);

    const history = await this.getHistory(current.location.lat, current.location.lon, 24).catch(
      () => null,
    );
    const clientReading = toClientAirQualityReading(current);
    const hourlyPoints: HourlyForecastPoint[] = (history?.hourly ?? [])
      .filter(
        (h): h is typeof h & { pm25: number; pm10: number; estimatedNaqi: number } =>
          h.pm25 !== null &&
          h.pm10 !== null &&
          h.estimatedNaqi !== null &&
          h.category !== 'Unavailable',
      )
      .map((h) => ({
        hourLabel: h.hourLabel,
        timestamp: h.timestamp,
        pm25: h.pm25,
        pm10: h.pm10,
        estimatedNaqi: h.estimatedNaqi,
        category: h.category as HourlyForecastPoint['category'],
      }));

    return {
      airQuality: current,
      safetySummary: getFamilySafetySummary(clientReading, familyProfile),
      recommendations: getDailyRecommendations(clientReading, familyProfile),
      dailySchedule: generateDailyPlan(clientReading, hourlyPoints, familyProfile),
      bestVentilationWindow: findBestVentilationWindow(hourlyPoints, clientReading),
    };
  }
}
