import type { NaqiCategory, PollutantKey } from '../types/breathewise.ts';

interface Breakpoint {
  bLo: number;
  bHi: number;
  iLo: number;
  iHi: number;
}

const CPCB_BREAKPOINTS: Record<PollutantKey, Breakpoint[]> = {
  pm25: [
    { bLo: 0, bHi: 30, iLo: 0, iHi: 50 },
    { bLo: 31, bHi: 60, iLo: 51, iHi: 100 },
    { bLo: 61, bHi: 90, iLo: 101, iHi: 200 },
    { bLo: 91, bHi: 120, iLo: 201, iHi: 300 },
    { bLo: 121, bHi: 250, iLo: 301, iHi: 400 },
    { bLo: 251, bHi: 500, iLo: 401, iHi: 500 },
  ],
  pm10: [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 51, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 101, bHi: 250, iLo: 101, iHi: 200 },
    { bLo: 251, bHi: 350, iLo: 201, iHi: 300 },
    { bLo: 351, bHi: 430, iLo: 301, iHi: 400 },
    { bLo: 431, bHi: 700, iLo: 401, iHi: 500 },
  ],
  no2: [
    { bLo: 0, bHi: 40, iLo: 0, iHi: 50 },
    { bLo: 41, bHi: 80, iLo: 51, iHi: 100 },
    { bLo: 81, bHi: 180, iLo: 101, iHi: 200 },
    { bLo: 181, bHi: 280, iLo: 201, iHi: 300 },
    { bLo: 281, bHi: 400, iLo: 301, iHi: 400 },
    { bLo: 401, bHi: 600, iLo: 401, iHi: 500 },
  ],
  o3: [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 51, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 101, bHi: 168, iLo: 101, iHi: 200 },
    { bLo: 169, bHi: 208, iLo: 201, iHi: 300 },
    { bLo: 209, bHi: 748, iLo: 301, iHi: 400 },
    { bLo: 749, bHi: 1000, iLo: 401, iHi: 500 },
  ],
  co: [
    { bLo: 0, bHi: 1.0, iLo: 0, iHi: 50 },
    { bLo: 1.1, bHi: 2.0, iLo: 51, iHi: 100 },
    { bLo: 2.1, bHi: 10.0, iLo: 101, iHi: 200 },
    { bLo: 10.1, bHi: 17.0, iLo: 201, iHi: 300 },
    { bLo: 17.1, bHi: 34.0, iLo: 301, iHi: 400 },
    { bLo: 34.1, bHi: 50.0, iLo: 401, iHi: 500 },
  ],
  so2: [
    { bLo: 0, bHi: 40, iLo: 0, iHi: 50 },
    { bLo: 41, bHi: 80, iLo: 51, iHi: 100 },
    { bLo: 81, bHi: 380, iLo: 101, iHi: 200 },
    { bLo: 381, bHi: 800, iLo: 201, iHi: 300 },
    { bLo: 801, bHi: 1600, iLo: 301, iHi: 400 },
    { bLo: 1601, bHi: 2400, iLo: 401, iHi: 500 },
  ],
  nh3: [
    { bLo: 0, bHi: 200, iLo: 0, iHi: 50 },
    { bLo: 201, bHi: 400, iLo: 51, iHi: 100 },
    { bLo: 401, bHi: 800, iLo: 101, iHi: 200 },
    { bLo: 801, bHi: 1200, iLo: 201, iHi: 300 },
    { bLo: 1201, bHi: 1800, iLo: 301, iHi: 400 },
    { bLo: 1801, bHi: 2400, iLo: 401, iHi: 500 },
  ],
};

export function calculatePollutantSubIndex(pollutant: PollutantKey, concentration: number): number {
  if (!Number.isFinite(concentration) || concentration <= 0) {
    return 0;
  }

  const ranges = CPCB_BREAKPOINTS[pollutant];
  for (let i = 0; i < ranges.length; i += 1) {
    const bp = ranges[i];
    const next = ranges[i + 1];
    // Handle fractional gaps between discrete integer breakpoints cleanly
    const upperBound = next ? next.bLo : bp.bHi;
    if (concentration <= bp.bHi) {
      const span = bp.bHi - bp.bLo || 1;
      const ratio = (concentration - bp.bLo) / span;
      return Math.round(bp.iLo + ratio * (bp.iHi - bp.iLo));
    }
    if (next && concentration < upperBound) {
      const span = upperBound - bp.bHi || 1;
      const ratio = (concentration - bp.bHi) / span;
      return Math.round(bp.iHi + ratio * (next.iLo - bp.iHi));
    }
  }

  return 500;
}

export function getNaqiCategory(naqi: number): NaqiCategory {
  if (naqi <= 50) return 'Good';
  if (naqi <= 100) return 'Satisfactory';
  if (naqi <= 200) return 'Moderately Polluted';
  if (naqi <= 300) return 'Poor';
  if (naqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function computeOverallNaqi(
  readings: Partial<Record<PollutantKey, number>>,
): { value: number; category: NaqiCategory; dominantPollutant: string } {
  const labelMap: Record<PollutantKey, string> = {
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO2',
    so2: 'SO2',
    co: 'CO',
    o3: 'O3',
    nh3: 'NH3',
  };

  let maxSubIndex = 0;
  let dominant = 'UNKNOWN';

  for (const [key, val] of Object.entries(readings) as [PollutantKey, number | undefined][]) {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      const sub = calculatePollutantSubIndex(key, val);
      if (sub >= maxSubIndex) {
        maxSubIndex = sub;
        dominant = labelMap[key];
      }
    }
  }

  return {
    value: maxSubIndex,
    category: getNaqiCategory(maxSubIndex),
    dominantPollutant: dominant,
  };
}

export interface NaqiVisualTokens {
  category: NaqiCategory | 'Unavailable';
  tone: 'success' | 'info' | 'warning' | 'critical';
  textClass: string;
  bgClass: string;
  borderClass: string;
  barColor: string;
  healthSummary: string;
}

export function getNaqiVisualTokens(category: NaqiCategory | 'Unavailable'): NaqiVisualTokens {
  switch (category) {
    case 'Good':
      return {
        category,
        tone: 'success',
        textClass: 'text-green-800',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-200',
        barColor: '#15803d',
        healthSummary: 'Minimal respiratory impact; normal outdoor routines are safe.',
      };
    case 'Satisfactory':
      return {
        category,
        tone: 'info',
        textClass: 'text-teal-800',
        bgClass: 'bg-teal-50',
        borderClass: 'border-teal-200',
        barColor: '#0f766e',
        healthSummary: 'Acceptable air quality; unusually sensitive individuals should monitor symptoms.',
      };
    case 'Moderately Polluted':
      return {
        category,
        tone: 'warning',
        textClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        barColor: '#b45309',
        healthSummary: 'May trigger breathing discomfort for children, seniors, and people with asthma.',
      };
    case 'Poor':
      return {
        category,
        tone: 'warning',
        textClass: 'text-amber-900',
        bgClass: 'bg-amber-100/70',
        borderClass: 'border-amber-300',
        barColor: '#d97706',
        healthSummary: 'Breathing discomfort on prolonged exposure; shift strenuous exercise indoors.',
      };
    case 'Very Poor':
      return {
        category,
        tone: 'critical',
        textClass: 'text-red-800',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        barColor: '#b91c1c',
        healthSummary: 'High risk of respiratory illness on prolonged exposure; avoid outdoor exertion.',
      };
    case 'Severe':
      return {
        category,
        tone: 'critical',
        textClass: 'text-red-900',
        bgClass: 'bg-red-100/80',
        borderClass: 'border-red-300',
        barColor: '#991b1b',
        healthSummary: 'Affects healthy adults and severely impacts sensitive groups. Minimize outdoor exposure.',
      };
    case 'Unavailable':
      return {
        category,
        tone: 'info',
        textClass: 'text-slate-700',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        barColor: '#64748b',
        healthSummary: 'CPCB NAQI could not be computed because PM2.5 and PM10 measurements are unavailable.',
      };
  }
}
