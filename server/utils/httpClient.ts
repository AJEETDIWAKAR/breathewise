import { AppError } from '../middleware/errorHandler.ts';
import { logWarn, redactSensitiveText } from './logger.ts';

export class UpstreamHttpError extends Error {
  readonly status: number;
  readonly providerId: string;
  readonly retryable: boolean;

  constructor(providerId: string, status: number, message: string) {
    super(redactSensitiveText(message));
    this.name = 'UpstreamHttpError';
    this.providerId = providerId;
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

export interface FetchJsonOptions {
  providerId: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options: FetchJsonOptions,
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxRetries = options.maxRetries ?? 1;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = new UpstreamHttpError(
          options.providerId,
          res.status,
          `Upstream ${options.providerId} responded with HTTP ${res.status}`,
        );
        if (err.retryable && attempt < maxRetries) {
          const backoffMs = 350 * 2 ** attempt;
          logWarn('HttpClient', `Retrying ${options.providerId} after HTTP ${res.status}`, {
            attempt: attempt + 1,
            backoffMs,
          });
          await sleep(backoffMs);
          lastError = err;
          continue;
        }
        throw err;
      }

      const rawText = await res.text();
      try {
        return JSON.parse(rawText) as T;
      } catch {
        throw new AppError(
          502,
          'INVALID_PROVIDER_RESPONSE',
          `Upstream ${options.providerId} returned invalid JSON.`,
          false,
        );
      }
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      if (err instanceof UpstreamHttpError && !err.retryable) {
        throw err;
      }
      lastError = err;
      if (attempt < maxRetries) {
        const backoffMs = 350 * 2 ** attempt;
        logWarn('HttpClient', `Retrying ${options.providerId} after network/timeout error`, {
          attempt: attempt + 1,
          backoffMs,
        });
        await sleep(backoffMs);
        continue;
      }
    }
  }

  if (lastError instanceof UpstreamHttpError) {
    throw lastError;
  }
  if (lastError instanceof Error) {
    throw new UpstreamHttpError(
      options.providerId,
      503,
      `Upstream ${options.providerId} failed: ${redactSensitiveText(lastError.message)}`,
    );
  }
  throw new UpstreamHttpError(options.providerId, 503, `Upstream ${options.providerId} failed`);
}
