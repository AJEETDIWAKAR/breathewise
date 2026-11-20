import { Router } from 'express';
import type { ServerConfig } from '../config/env.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';
import type { AirQualityService } from '../services/airQualityService.ts';

export function createHealthRouter(config: ServerConfig, service: AirQualityService): Router {
  const router = Router();
  const healthRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 180,
    name: 'health API',
  });

  router.get('/health', healthRateLimit, (_req, res) => {
    const capabilities = service.getCapabilities();
    res.json({
      status: 'ok',
      service: 'breathewise-api',
      timestamp: new Date().toISOString(),
      capabilities: {
        ...capabilities,
        aiAssistant: {
          geminiConfigured: Boolean(config.geminiApiKey),
        },
      },
    });
  });

  return router;
}
