const SENSITIVE_PARAM_PATTERN = /(api[-_]?key|token|key|secret|password)=([^&\s]+)/gi;
const GOOGLE_API_KEY_PATTERN = /AIza[0-9A-Za-z_-]{20,}/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JSON_SECRET_PATTERN =
  /("?(?:x-goog-api-key|authorization|apiKey|geminiApiKey|secret|password)"?\s*[:=]\s*)"([^"]+)"/gi;
const HEADER_SECRET_PATTERN =
  /(\b(?:x-goog-api-key|authorization|apiKey|geminiApiKey|secret|password)\b\s*[:=]\s*)([^\s"',;]+)/gi;

export function redactSensitiveText(input: string): string {
  return input
    .replace(SENSITIVE_PARAM_PATTERN, '$1=[REDACTED]')
    .replace(GOOGLE_API_KEY_PATTERN, '[REDACTED_API_KEY]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
    .replace(JSON_SECRET_PATTERN, '$1"[REDACTED]"')
    .replace(HEADER_SECRET_PATTERN, '$1[REDACTED]');
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>): void {
  const safeMeta = meta ? JSON.stringify(meta, (_k, v) => (typeof v === 'string' ? redactSensitiveText(v) : v)) : '';
  console.info(`[BreatheWise:${scope}] ${redactSensitiveText(message)}${safeMeta ? ` ${safeMeta}` : ''}`);
}

export function logWarn(scope: string, message: string, meta?: Record<string, unknown>): void {
  const safeMeta = meta ? JSON.stringify(meta, (_k, v) => (typeof v === 'string' ? redactSensitiveText(v) : v)) : '';
  console.warn(`[BreatheWise:${scope}] ${redactSensitiveText(message)}${safeMeta ? ` ${safeMeta}` : ''}`);
}

export function logError(scope: string, message: string, err?: unknown): void {
  const rawErrMsg = err instanceof Error ? err.message : err !== undefined ? String(err) : '';
  const errMsg = rawErrMsg ? redactSensitiveText(rawErrMsg) : '';
  console.error(`[BreatheWise:${scope}] ${redactSensitiveText(message)}${errMsg ? ` :: ${errMsg}` : ''}`);
}
