import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import type { GeminiAssistantService } from '../services/geminiService.ts';
import type { aiChatBodySchema } from '../validators/airQualityValidators.ts';

type AiChatBody = z.infer<typeof aiChatBodySchema>;

export class AiController {
  private readonly service: GeminiAssistantService;

  constructor(service: GeminiAssistantService) {
    this.service = service;
  }

  postChat = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = res.locals.validatedBody as AiChatBody;
      const result = await this.service.chat({
        message: body.message,
        slug: body.slug,
        city: body.city,
        lat: body.lat,
        lon: body.lon,
        history: body.history,
        familyProfile: body.familyProfile,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
