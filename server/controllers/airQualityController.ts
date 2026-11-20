import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import type { AirQualityService } from '../services/airQualityService.ts';
import type {
  currentQuerySchema,
  historyQuerySchema,
  placesQuerySchema,
  rankingQuerySchema,
  recommendationsBodySchema,
  searchQuerySchema,
} from '../validators/airQualityValidators.ts';

type CurrentQuery = z.infer<typeof currentQuerySchema>;
type PlacesQuery = z.infer<typeof placesQuerySchema>;
type RankingQuery = z.infer<typeof rankingQuerySchema>;
type HistoryQuery = z.infer<typeof historyQuerySchema>;
type SearchQuery = z.infer<typeof searchQuerySchema>;
type RecommendationsBody = z.infer<typeof recommendationsBodySchema>;

export class AirQualityController {
  private readonly service: AirQualityService;

  constructor(service: AirQualityService) {
    this.service = service;
  }

  getPlaces = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = res.locals.validatedQuery as PlacesQuery;
      const result = await this.service.getPlaces({
        country: q.country,
        q: q.q,
        kind: q.kind,
      });
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getCurrent = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = res.locals.validatedQuery as CurrentQuery;
      const result = await this.service.getCurrent({
        slug: q.slug,
        lat: q.lat,
        lon: q.lon,
        city: q.city,
        locationName: q.locationName,
      });
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getRanking = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = res.locals.validatedQuery as RankingQuery;
      const result = await this.service.getRanking(q.country, q.order, q.limit);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = res.locals.validatedQuery as HistoryQuery;
      const result = await this.service.getHistory(q.lat, q.lon, q.hours);
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  searchLocations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = res.locals.validatedQuery as SearchQuery;
      const locations = await this.service.searchLocations(q.q, q.limit);
      res.json({ locations });
    } catch (err) {
      next(err);
    }
  };

  postRecommendations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = res.locals.validatedBody as RecommendationsBody;
      const result = await this.service.buildRecommendations(
        {
          slug: body.slug,
          lat: body.lat,
          lon: body.lon,
          city: body.city,
        },
        body.familyProfile,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
