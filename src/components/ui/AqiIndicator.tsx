import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Info,
  MapPin,
  Radio,
} from 'lucide-react';
import { getNaqiVisualTokens } from '../../domain/naqi';
import { getUsAqiVisualTokens, normalizeUsAqiCategoryLabel } from '../../domain/usAqi';
import type { AirQualityReading, NaqiCategory, UsAqiCategory } from '../../types/breathewise';
import { PollutionStatusBadge } from './PollutionStatusBadge';

interface AqiIndicatorProps {
  reading: AirQualityReading;
  preferredUnit?: 'aqi' | 'ugm3';
}

function resolveFreshnessStatus(reading: AirQualityReading) {
  if (reading.provenance.freshnessStatus) {
    return reading.provenance.freshnessStatus;
  }
  if (!reading.provenance.observedAt) {
    return 'unavailable';
  }
  return reading.provenance.isStale ? 'stale' : 'fresh';
}

function getFreshnessBadge(reading: AirQualityReading) {
  const status = resolveFreshnessStatus(reading);

  if (status === 'fresh') {
    return {
      status,
      label: 'Fresh',
      classes: 'bg-green-50 text-green-800 border-green-200',
    };
  }
  if (status === 'stale') {
    return {
      status,
      label: 'Stale (>3h)',
      classes: 'bg-amber-50 text-amber-900 border-amber-200',
    };
  }
  return {
    status,
    label: 'Unavailable',
    classes: 'bg-slate-100 text-slate-700 border-slate-300',
  };
}

function resolveSourceDetailLabel(reading: AirQualityReading): string {
  const { measurementType, stationsUsed } = reading.provenance;
  if (measurementType === 'preview_fixture') {
    return 'Preview Fixture';
  }
  if (measurementType === 'ground_station') {
    if (stationsUsed !== null && stationsUsed !== undefined) {
      return `Ground Stations (${stationsUsed} station${stationsUsed === 1 ? '' : 's'})`;
    }
    return 'Ground Stations';
  }
  return 'Atmospheric Model (Model-based estimate)';
}

function formatObservedTimestamp(observedAt: string | null): string {
  if (!observedAt) return 'Timestamp unavailable';
  const ms = Date.parse(observedAt);
  if (Number.isNaN(ms)) return 'Timestamp unavailable';
  return new Date(ms).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function resolveLocationDisplay(reading: AirQualityReading): string {
  const { name, countryName } = reading.location;
  if (countryName && !name.toLowerCase().includes(countryName.toLowerCase())) {
    return `${name}, ${countryName}`;
  }
  return name;
}

function AqiScaleLegend({ isUsAqi }: { isUsAqi: boolean }) {
  if (isUsAqi) {
    return (
      <div className="flex justify-between gap-1 text-[10px] sm:text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
        <span>0 Good</span>
        <span>50 Mod</span>
        <span>100 USG</span>
        <span>150 Unh</span>
        <span>200 V.Unh</span>
        <span>300+ Haz</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-1 text-[10px] sm:text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
      <span>0 Good</span>
      <span>100 Sat</span>
      <span>200 Mod</span>
      <span>300 Poor</span>
      <span>400 V.Poor</span>
      <span>500 Sev</span>
    </div>
  );
}

function AqiPrimaryMetric({
  reading,
  isUsAqi,
  freshness,
  preferredUnit,
}: {
  reading: AirQualityReading;
  isUsAqi: boolean;
  freshness: ReturnType<typeof getFreshnessBadge>;
  preferredUnit: 'aqi' | 'ugm3';
}) {
  const pm25Metric = reading.pollutants.find((p) => p.key === 'pm25');
  const hasPm25 = pm25Metric !== undefined && pm25Metric.value !== null;
  const showPm25Primary = preferredUnit === 'ugm3' && hasPm25;
  const aqiText = reading.aqi.value !== null ? reading.aqi.value : 'N/A';

  return (
    <div className="flex flex-wrap items-baseline gap-4 pt-1">
      {showPm25Primary ? (
        <div>
          <span
            className="text-5xl font-bold tracking-tight text-slate-900 font-mono tabular-nums"
            data-testid="pm25-value"
          >
            {pm25Metric.value}
          </span>
          <span className="ml-2 text-xs font-mono text-slate-600">
            {pm25Metric.unit} PM2.5
          </span>
        </div>
      ) : (
        <div>
          <span
            className="text-5xl font-bold tracking-tight text-slate-900 font-mono tabular-nums"
            data-testid="aqi-value"
          >
            {aqiText}
          </span>
          <span className="ml-2 text-xs font-mono text-slate-600">
            {isUsAqi ? 'US AQI (0–500)' : 'INDIA CPCB NAQI (0–500)'}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <PollutionStatusBadge category={reading.aqi.category} scale={reading.aqi.scale} />
          <span
            data-testid="freshness-badge"
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold border rounded ${freshness.classes}`}
          >
            {freshness.status === 'fresh' ? (
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            )}
            <span>{freshness.label}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          {showPm25Primary ? (
            <span>
              {isUsAqi ? 'US AQI:' : 'NAQI:'}{' '}
              <strong className="font-mono font-semibold text-slate-900" data-testid="aqi-value">
                {aqiText}
              </strong>
            </span>
          ) : (
            <span>
              PM2.5:{' '}
              <strong className="font-mono font-semibold text-slate-900" data-testid="pm25-value">
                {hasPm25 ? `${pm25Metric.value} ${pm25Metric.unit}` : 'Unavailable'}
              </strong>
            </span>
          )}
          {typeof reading.aqi.modelUsAqi === 'number' && (
            <span className="text-slate-600 font-mono">
              Model baseline: US AQI {reading.aqi.modelUsAqi}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AqiProvenanceHeader({ reading }: { reading: AirQualityReading }) {
  const isModel = reading.provenance.measurementType === 'modeled_forecast';
  const formattedTimestamp = formatObservedTimestamp(reading.provenance.observedAt);

  return (
    <div className="shrink-0 text-left sm:text-right text-xs text-slate-600 space-y-1">
      <div className="flex sm:justify-end items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
        <span>{reading.provenance.providerName}</span>
        {reading.provenance.cacheHit !== undefined && (
          <span className="text-[11px] font-mono text-slate-600">
            ({reading.provenance.cacheHit ? 'cached' : 'live fetch'})
          </span>
        )}
      </div>
      <div className="flex sm:justify-end items-center gap-1.5 font-mono tabular-nums">
        <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
        <span data-testid="last-updated-text">Updated: {formattedTimestamp}</span>
      </div>
      {isModel && (
        <p className="text-[11px] text-amber-800 font-medium">
          Model-based estimate (no local ground station)
        </p>
      )}
    </div>
  );
}

export function AqiIndicator({ reading, preferredUnit = 'aqi' }: AqiIndicatorProps) {
  const isUsAqi = reading.aqi.scale === 'US_AQI';
  const tokens = isUsAqi
    ? getUsAqiVisualTokens(
        (normalizeUsAqiCategoryLabel(reading.aqi.category) ?? 'Unavailable') as
          | UsAqiCategory
          | 'Unavailable',
      )
    : getNaqiVisualTokens(reading.aqi.category as NaqiCategory | 'Unavailable');

  const progressPct =
    reading.aqi.value !== null
      ? Math.min(100, Math.max(2, Math.round((reading.aqi.value / 500) * 100)))
      : 0;

  const freshness = getFreshnessBadge(reading);
  const sourceDetailLabel = resolveSourceDetailLabel(reading);
  const locationDisplay = resolveLocationDisplay(reading);
  const hasStaleNotice =
    freshness.status === 'stale' ||
    freshness.status === 'unavailable' ||
    reading.provenance.isStale;
  const hasAttributionUrl =
    Boolean(reading.provenance.attributionUrl) &&
    /^https?:\/\//i.test(reading.provenance.attributionUrl ?? '');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-slate-900">{locationDisplay}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Radio className="w-3.5 h-3.5 text-sky-700 shrink-0" aria-hidden="true" />
              {sourceDetailLabel}
            </span>
          </div>

          <AqiPrimaryMetric
            reading={reading}
            isUsAqi={isUsAqi}
            freshness={freshness}
            preferredUnit={preferredUnit}
          />
        </div>

        <AqiProvenanceHeader reading={reading} />
      </div>

      {hasStaleNotice && (
        <div
          role="status"
          className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>
              {freshness.status === 'unavailable' ? 'Freshness unavailable:' : 'Stale reading notice:'}
            </strong>{' '}
            {reading.provenance.staleReason ??
              'Observation timestamp is older than 3 hours or unavailable.'}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <div
          className="h-2.5 w-full bg-slate-100 border border-slate-200 rounded-sm overflow-hidden"
          role="progressbar"
          aria-valuenow={reading.aqi.value ?? undefined}
          aria-valuemin={0}
          aria-valuemax={500}
          aria-valuetext={`${isUsAqi ? 'US AQI' : 'CPCB NAQI'} ${reading.aqi.value ?? 'unavailable'}, ${reading.aqi.category}`}
          aria-label={`${isUsAqi ? 'US AQI' : 'CPCB NAQI'} ${reading.aqi.value ?? 'unavailable'} out of 500, category ${reading.aqi.category}`}
        >
          <div
            className="h-full transition-all duration-200"
            style={{ width: `${progressPct}%`, backgroundColor: tokens.barColor }}
          />
        </div>
        <AqiScaleLegend isUsAqi={isUsAqi} />
      </div>

      <p className="text-sm text-slate-700 leading-relaxed">{tokens.healthSummary}</p>

      <div className="text-xs text-slate-600 border-t border-slate-100 pt-2.5 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{reading.provenance.attribution}</span>
          {hasAttributionUrl && (
            <a
              href={reading.provenance.attributionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-6 px-1 inline-flex items-center gap-1 font-medium text-teal-800 hover:text-teal-900 underline"
            >
              <span>Data by AirLive</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {reading.provenance.coverageLimitations && (
          <p className="flex items-start gap-1.5 text-slate-600">
            <Info className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{reading.provenance.coverageLimitations}</span>
          </p>
        )}
      </div>
    </div>
  );
}
