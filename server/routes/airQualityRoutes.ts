import { Router } from 'express';
import { AirQualityController } from '../controllers/airQualityController.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';
import { validateBody, validateQuery } from '../middleware/validate.ts';
import type { AirQualityService } from '../services/airQualityService.ts';
import {
  currentQuerySchema,
  historyQuerySchema,
  placesQuerySchema,
  rankingQuerySchema,
  recommendationsBodySchema,
  searchQuerySchema,
} from '../validators/airQualityValidators.ts';

export function createAirQualityRouter(service: AirQualityService): Router {
  const router = Router();
  const controller = new AirQualityController(service);

  const aqiRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 90,
    name: 'air-quality API',
  });

  router.use(aqiRateLimit);

  router.get('/air-quality/places', validateQuery(placesQuerySchema), controller.getPlaces);
  router.get('/air-quality/current', validateQuery(currentQuerySchema), controller.getCurrent);
  router.get('/air-quality/ranking', validateQuery(rankingQuerySchema), controller.getRanking);
  router.get('/air-quality/history', validateQuery(historyQuerySchema), controller.getHistory);
  router.get('/air-quality/search', validateQuery(searchQuerySchema), controller.searchLocations);
  router.post(
    '/air-quality/recommendations',
    validateBody(recommendationsBodySchema),
    controller.postRecommendations,
  );

  return router;
}
