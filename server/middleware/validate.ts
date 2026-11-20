import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { AppError } from './errorHandler.ts';

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters.', false, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        }),
      );
      return;
    }
    res.locals.validatedQuery = parsed.data;
    next();
  };
}

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload.', false, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        }),
      );
      return;
    }
    res.locals.validatedBody = parsed.data;
    next();
  };
}
