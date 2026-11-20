import type { NextFunction, Request, Response } from 'express';
import { logError, redactSensitiveText } from '../utils/logger.ts';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'LOCATION_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AQI_PROVIDER_UNAVAILABLE'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(redactSensitiveText(message));
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: redactSensitiveText(err.message),
        retryable: err.retryable,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle malformed JSON bodies from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON request body.',
        retryable: false,
      },
    });
    return;
  }

  logError('UnhandledError', 'Unexpected server failure', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred.',
      retryable: true,
    },
  });
}
