import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler.ts';

interface Bucket {
  timestamps: number[];
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number; name: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - options.windowMs;

    const existing = buckets.get(ip) ?? { timestamps: [] };
    const active = existing.timestamps.filter((ts) => ts > cutoff);
    const resetSeconds = Math.max(
      1,
      Math.ceil(((active[0] ?? now) + options.windowMs - now) / 1000),
    );

    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (active.length >= options.maxRequests) {
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(resetSeconds));
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          `Too many requests to ${options.name}. Please wait briefly before retrying.`,
          true,
        ),
      );
      return;
    }

    active.push(now);
    buckets.set(ip, { timestamps: active });
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.maxRequests - active.length)));

    if (buckets.size > 1000) {
      for (const [key, entry] of buckets.entries()) {
        if (entry.timestamps.every((ts) => ts <= cutoff)) {
          buckets.delete(key);
        }
      }
      if (buckets.size > 1000) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) buckets.delete(oldestKey);
      }
    }

    next();
  };
}
