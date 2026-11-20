import { isWithinIndiaBounds, toUtcIso } from '../../src/domain/airliveNormalize.ts';
import { calculatePm25UsAqi, getUsAqiCategory } from '../../src/domain/usAqi.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { fetchJsonWithRetry } from '../utils/httpClient.ts';
import { openMeteoHourlySchema } from '../validators/airQualityValidators.ts';
import type { HourlyHistoryPoint, NormalizedHistoryResult } from './types.ts';

export class OpenMeteoProvider {
  readonly id = 'open_meteo_cams' as const;
  readonly name = 'Open-Meteo (Copernicus CAMS Model)';
  readonly measurementType = 'modeled_forecast' as const;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  isConfigured(): boolean {
    return true;
  }

  async fetchHistoryAndForecast(
    lat: number,
    lon: number,
    hours = 24,
  ): Promise<NormalizedHistoryResult> {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('hourly', 'pm2_5,pm10,nitrogen_dioxide,ozone');
    url.searchParams.set('past_days', '1');
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('timezone', 'GMT');

    const raw = await fetchJsonWithRetry(url.toString(), {
      providerId: this.id,
      timeoutMs: this.timeoutMs,
    });

    const parsed = openMeteoHourlySchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        'INVALID_PROVIDER_RESPONSE',
        'Open-Meteo hourly response failed schema validation.',
        true,
      );
    }

    const useIst = isWithinIndiaBounds(parsed.data.latitude, parsed.data.longitude);
    const displayTimeZone = useIst ? 'Asia/Kolkata' : 'UTC';
    const timezoneLabel = useIst ? 'Asia/Kolkata (IST)' : 'UTC';

    const h = parsed.data.hourly;
    const nowMs = Date.now();
    const allPoints: HourlyHistoryPoint[] = h.time.map((t, idx) => {
      const iso = toUtcIso(t);
      const pm25 = h.pm2_5?.[idx] ?? null;
      const pm10 = h.pm10?.[idx] ?? null;
      const no2 = h.nitrogen_dioxide?.[idx] ?? null;
      const o3 = h.ozone?.[idx] ?? null;

      const estimatedUsAqi = typeof pm25 === 'number' ? calculatePm25UsAqi(pm25) : null;

      const dateObj = new Date(iso);
      const hourLabel = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: displayTimeZone,
      });

      return {
        hourLabel,
        timestamp: iso,
        pm25: typeof pm25 === 'number' ? Number(pm25.toFixed(1)) : null,
        pm10: typeof pm10 === 'number' ? Number(pm10.toFixed(1)) : null,
        no2: typeof no2 === 'number' ? Number(no2.toFixed(1)) : null,
        o3: typeof o3 === 'number' ? Number(o3.toFixed(1)) : null,
        estimatedNaqi: estimatedUsAqi,
        scale: 'US_AQI',
        category: estimatedUsAqi !== null ? getUsAqiCategory(estimatedUsAqi) : 'Unavailable',
      };
    });

    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < allPoints.length; i += 1) {
      const diff = Math.abs(Date.parse(allPoints[i].timestamp) - nowMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const half = Math.floor(hours / 2);
    const start = Math.max(0, closestIdx - half);
    const sliced = allPoints.slice(start, start + hours);

    return {
      location: {
        lat: parsed.data.latitude,
        lon: parsed.data.longitude,
        timezone: timezoneLabel,
      },
      hourly: sliced,
      provenance: {
        providerId: this.id,
        providerName: this.name,
        measurementType: 'modeled_forecast',
        spatialResolution: '~45 km (0.4° Copernicus CAMS Global)',
        attribution:
          'Generated using Copernicus Atmosphere Monitoring Service (CAMS) information via Open-Meteo (CC BY 4.0).',
        coverageLimitations:
          'Modeled hourly trajectory (~45 km grid) illustrating diurnal dispersion patterns, not ground station measurements.',
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}
