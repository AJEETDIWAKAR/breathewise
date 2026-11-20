import compression from 'compression';
import express from 'express';
import type { ServerConfig } from './config/env.ts';
import { AppError, errorHandlerMiddleware } from './middleware/errorHandler.ts';
import { securityHeadersMiddleware } from './middleware/security.ts';
import { createAiRouter } from './routes/aiRoutes.ts';
import { createAirQualityRouter } from './routes/airQualityRoutes.ts';
import { createHealthRouter } from './routes/healthRoutes.ts';
import { AirQualityService } from './services/airQualityService.ts';
import { GeminiAssistantService } from './services/geminiService.ts';

export function createApiApp(
  config: ServerConfig,
  customService?: AirQualityService,
  customGeminiService?: GeminiAssistantService,
) {
  const app = express();
  const airQualityService = customService ?? new AirQualityService(config);
  const geminiService =
    customGeminiService ?? new GeminiAssistantService(config, airQualityService);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(securityHeadersMiddleware(config.appUrl, config.allowedOrigins));
  app.use(express.json({ limit: '48kb' }));

  app.use('/api', createHealthRouter(config, airQualityService));
  app.use('/api', createAirQualityRouter(airQualityService));
  app.use('/api', createAiRouter(geminiService));

  // Unmatched /api/* routes return structured JSON 404 instead of SPA HTML
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.', false));
  });

  app.use(errorHandlerMiddleware);

  return { app, airQualityService, geminiService };
}
