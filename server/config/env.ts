import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  appUrl: string;
  allowedOrigins: string[];
  aqiCacheTtlMs: number;
  historyCacheTtlMs: number;
  providerTimeoutMs: number;
  geminiTimeoutMs: number;
  geminiApiKey: string | null;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function normalizeOptionalSecret(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed.startsWith('YOUR_')
  ) {
    return null;
  }
  return trimmed;
}

function parseOriginsList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter((item) => /^https?:\/\//i.test(item));
}

export function loadServerConfig(): ServerConfig {
  return {
    port: parsePositiveInt(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    allowedOrigins: parseOriginsList(process.env.ALLOWED_ORIGINS),
    // AirLive requires at least 5 minutes caching; default is 10 minutes (600,000 ms)
    aqiCacheTtlMs: Math.max(300_000, parsePositiveInt(process.env.AQI_CACHE_TTL_MS, 600_000)),
    historyCacheTtlMs: 30 * 60 * 1000,
    providerTimeoutMs: parsePositiveInt(process.env.PROVIDER_TIMEOUT_MS, 10_000),
    geminiTimeoutMs: parsePositiveInt(process.env.GEMINI_TIMEOUT_MS, 20_000),
    geminiApiKey: normalizeOptionalSecret(process.env.GEMINI_API_KEY),
  };
}
