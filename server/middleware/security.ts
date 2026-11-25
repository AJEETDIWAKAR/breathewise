import type { NextFunction, Request, Response } from 'express';

function resolveForwardedProto(req: Request): string {
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim().toLowerCase();
  }
  return req.secure ? 'https' : 'http';
}

function isSameHostOrigin(origin: string, req: Request): boolean {
  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') {
      return false;
    }
    const rawHost =
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host'].split(',')[0]
        : req.headers.host) ?? '';
    const requestHost = rawHost.trim().toLowerCase();
    if (!requestHost) return false;

    const rawProto = resolveForwardedProto(req);
    return originUrl.host.toLowerCase() === requestHost && originUrl.protocol === `${rawProto}:`;
  } catch {
    return false;
  }
}

export function securityHeadersMiddleware(appUrl: string, extraAllowedOrigins: string[] = []) {
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  if (appUrl && appUrl.startsWith('http')) {
    allowedOrigins.add(appUrl.replace(/\/$/, ''));
  }
  for (const extra of extraAllowedOrigins) {
    if (extra.startsWith('http')) {
      allowedOrigins.add(extra.replace(/\/$/, ''));
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');

    const isAllowedOrigin = !origin || allowedOrigins.has(origin) || isSameHostOrigin(origin, req);
    if (origin && isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const isProd = process.env.NODE_ENV === 'production';
    const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'";
    const connectSrc = isProd
      ? "connect-src 'self' https://airlive.tracsa.co.in https://air-quality-api.open-meteo.com"
      : "connect-src 'self' https://airlive.tracsa.co.in https://air-quality-api.open-meteo.com ws://localhost:* ws://127.0.0.1:*";
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data:",
        connectSrc,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
      ].join('; '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');

    if (
      req.path.startsWith('/api/ai/') ||
      req.path === '/api/air-quality/recommendations'
    ) {
      res.setHeader('Cache-Control', 'no-store');
    }

    if (req.method === 'OPTIONS') {
      if (!isAllowedOrigin) {
        res.status(403).json({
          error: {
            code: 'CORS_ORIGIN_FORBIDDEN',
            message: 'Origin is not permitted for cross-origin API requests.',
            retryable: false,
          },
        });
        return;
      }
      res.status(204).end();
      return;
    }

    if (origin && !isAllowedOrigin && req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(403).json({
        error: {
          code: 'CORS_ORIGIN_FORBIDDEN',
          message: 'Cross-origin request from this origin is not permitted.',
          retryable: false,
        },
      });
      return;
    }

    next();
  };
}
