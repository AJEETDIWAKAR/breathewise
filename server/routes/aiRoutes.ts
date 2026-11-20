import { Router } from 'express';
import { AiController } from '../controllers/aiController.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';
import { validateBody } from '../middleware/validate.ts';
import type { GeminiAssistantService } from '../services/geminiService.ts';
import { aiChatBodySchema } from '../validators/airQualityValidators.ts';

export function createAiRouter(service: GeminiAssistantService): Router {
  const router = Router();
  const controller = new AiController(service);

  const aiRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    name: 'AI assistant API',
  });

  router.use(aiRateLimit);
  router.post('/ai/chat', validateBody(aiChatBodySchema), controller.postChat);

  return router;
}
