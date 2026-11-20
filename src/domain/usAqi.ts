import type { UsAqiCategory } from '../types/breathewise.ts';

export function getUsAqiCategory(usAqi: number): UsAqiCategory {
  if (usAqi <= 50) return 'Good';
  if (usAqi <= 100) return 'Moderate';
  if (usAqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (usAqi <= 200) return 'Unhealthy';
  if (usAqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function normalizeUsAqiCategoryLabel(raw: string | undefined | null): UsAqiCategory | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  if (norm === 'good') return 'Good';
  if (norm === 'moderate') return 'Moderate';
  if (norm === 'unhealthy for sensitive groups') return 'Unhealthy for Sensitive Groups';
  if (norm === 'unhealthy') return 'Unhealthy';
  if (norm === 'very unhealthy') return 'Very Unhealthy';
  if (norm === 'hazardous') return 'Hazardous';
  return null;
}

/**
 * US EPA PM2.5 24-hour concentration -> US AQI linear breakpoint interpolation
 * Used solely for optional hourly trajectory charts (never overrides AirLive usAqi).
 */
export function calculatePm25UsAqi(pm25: number): number {
  if (!Number.isFinite(pm25) || pm25 <= 0) return 0;
  const bps = [
    { cLo: 0.0, cHi: 9.0, iLo: 0, iHi: 50 },
    { cLo: 9.1, cHi: 35.4, iLo: 51, iHi: 100 },
    { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
    { cLo: 55.5, cHi: 125.4, iLo: 151, iHi: 200 },
    { cLo: 125.5, cHi: 225.4, iLo: 201, iHi: 300 },
    { cLo: 225.5, cHi: 325.4, iLo: 301, iHi: 400 },
    { cLo: 325.5, cHi: 500.4, iLo: 401, iHi: 500 },
  ];

  const truncated = Math.floor(pm25 * 10) / 10;
  for (let i = 0; i < bps.length; i += 1) {
    const bp = bps[i];
    const next = bps[i + 1];
    if (truncated <= bp.cHi) {
      return Math.round(((bp.iHi - bp.iLo) / (bp.cHi - bp.cLo)) * (truncated - bp.cLo) + bp.iLo);
    }
    if (next && truncated < next.cLo) {
      return Math.round(((next.iLo - bp.iHi) / (next.cLo - bp.cHi)) * (truncated - bp.cHi) + bp.iHi);
    }
  }
  return 500;
}

export interface UsAqiVisualTokens {
  category: UsAqiCategory | 'Unavailable';
  tone: 'success' | 'info' | 'warning' | 'critical';
  textClass: string;
  bgClass: string;
  borderClass: string;
  barColor: string;
  healthSummary: string;
}

export function getUsAqiVisualTokens(
  category: UsAqiCategory | 'Unavailable',
): UsAqiVisualTokens {
  switch (category) {
    case 'Good':
      return {
        category,
        tone: 'success',
        textClass: 'text-green-800',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-200',
        barColor: '#15803d',
        healthSummary: 'Air quality is satisfactory, and air pollution poses little or no risk.',
      };
    case 'Moderate':
      return {
        category,
        tone: 'info',
        textClass: 'text-teal-800',
        bgClass: 'bg-teal-50',
        borderClass: 'border-teal-200',
        barColor: '#0f766e',
        healthSummary: 'Acceptable air quality; unusually sensitive individuals should consider limiting prolonged outdoor exertion.',
      };
    case 'Unhealthy for Sensitive Groups':
      return {
        category,
        tone: 'warning',
        textClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        barColor: '#b45309',
        healthSummary: 'Children, seniors, and people with heart or lung disease may experience health effects.',
      };
    case 'Unhealthy':
      return {
        category,
        tone: 'warning',
        textClass: 'text-amber-900',
        bgClass: 'bg-amber-100/70',
        borderClass: 'border-amber-300',
        barColor: '#d97706',
        healthSummary: 'Some members of the general public may experience health effects; sensitive groups face more serious risk.',
      };
    case 'Very Unhealthy':
      return {
        category,
        tone: 'critical',
        textClass: 'text-red-800',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        barColor: '#b91c1c',
        healthSummary: 'Health alert: risk of respiratory effects is increased for everyone. Avoid strenuous outdoor activity.',
      };
    case 'Hazardous':
      return {
        category,
        tone: 'critical',
        textClass: 'text-red-900',
        bgClass: 'bg-red-100/80',
        borderClass: 'border-red-300',
        barColor: '#991b1b',
        healthSummary: 'Health warning of emergency conditions: everyone is more likely to be affected. Stay indoors with clean air.',
      };
    case 'Unavailable':
      return {
        category,
        tone: 'info',
        textClass: 'text-slate-700',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        barColor: '#64748b',
        healthSummary: 'Live AQI could not be determined because AQI readings are unavailable for this location.',
      };
  }
}

export const US_AQI_SCALE_GUIDE: Array<{
  category: UsAqiCategory;
  range: string;
  guidance: string;
}> = [
  {
    category: 'Good',
    range: '0 – 50',
    guidance: 'Minimal risk; normal outdoor routines and active commuting are safe.',
  },
  {
    category: 'Moderate',
    range: '51 – 100',
    guidance: 'Acceptable; unusually sensitive individuals should monitor prolonged outdoor exertion.',
  },
  {
    category: 'Unhealthy for Sensitive Groups',
    range: '101 – 150',
    guidance: 'Children, seniors, and asthma-prone members should reduce prolonged or heavy outdoor exertion.',
  },
  {
    category: 'Unhealthy',
    range: '151 – 200',
    guidance: 'Sensitive groups should avoid prolonged outdoor exertion; general public should limit heavy exertion.',
  },
  {
    category: 'Very Unhealthy',
    range: '201 – 300',
    guidance: 'Health alert for all; shift exercise indoors, seal gaps, and wear N95 protection outdoors.',
  },
  {
    category: 'Hazardous',
    range: '301 – 500',
    guidance: 'Emergency conditions; remain indoors with air filtration and avoid unnecessary outdoor exposure.',
  },
];
