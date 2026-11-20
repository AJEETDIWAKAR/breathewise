import { z } from 'zod';
import { FamilyProfileSchema } from './breathewiseSchemas.ts';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;
export const COUNTRY_PATTERN = /^[a-z]{2,3}$/i;

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(SLUG_PATTERN, 'Location slug may only contain letters, numbers, and hyphens.');

export const currentQuerySchema = z
  .object({
    slug: slugField.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    locationName: z.string().trim().min(2).max(120).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.slug) ||
      (data.lat !== undefined && data.lon !== undefined) ||
      Boolean(data.city),
    {
      message: 'Provide a location slug, lat/lon coordinates, or a city name.',
    },
  );

export const placesQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .regex(COUNTRY_PATTERN, 'Country code must be a 2-3 letter ISO code.')
    .optional(),
  q: z.string().trim().max(80).optional(),
  kind: z.string().trim().max(32).optional(),
});

export const rankingQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .regex(COUNTRY_PATTERN, 'Country code must be a 2-3 letter ISO code.')
    .optional()
    .default('IN'),
  order: z.enum(['worst', 'best']).optional().default('worst'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const historyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  hours: z.coerce.number().int().min(6).max(72).optional().default(24),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
});

export const recommendationsBodySchema = z
  .object({
    slug: slugField.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    familyProfile: FamilyProfileSchema,
  })
  .refine(
    (data) =>
      Boolean(data.slug) ||
      (data.lat !== undefined && data.lon !== undefined) ||
      Boolean(data.city),
    {
      message: 'Provide a location slug, lat/lon coordinates, or a city name.',
    },
  );

export const aiChatBodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Please enter a non-empty question for the assistant.')
    .max(1000, 'Question cannot exceed 1000 characters.'),
  slug: slugField.optional(),
  city: z.string().trim().min(1).max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(4000),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  familyProfile: FamilyProfileSchema,
});

// AirLive API Response Schemas (https://airlive.tracsa.co.in/)

export const airlivePlaceItemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().optional().default('city'),
  country: z.string().optional().default(''),
  countryName: z.string().optional().default(''),
  lat: z.number(),
  lon: z.number(),
  usAqi: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  pm25: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  stationsUsed: z.number().nullable().optional(),
  modelUsAqi: z.number().nullable().optional(),
  stationToModelRatio: z.number().nullable().optional(),
  updated: z.string().nullable().optional(),
  url: z.string().optional(),
  attribution: z.string().optional(),
});

export const airliveAllPlacesSchema = z.object({
  updated: z.string().nullable().optional(),
  count: z.number().optional(),
  attribution: z.string().optional(),
  items: z.array(airlivePlaceItemSchema),
});

export const airlivePlaceSchema = airlivePlaceItemSchema;

export const airliveRankingSchema = z.object({
  updated: z.string().nullable().optional(),
  order: z.string().optional(),
  country: z.string().optional(),
  count: z.number().optional(),
  attribution: z.string().optional(),
  items: z.array(
    airlivePlaceItemSchema.extend({
      rank: z.number().int().positive().optional(),
    }),
  ),
});

// Open-Meteo Hourly Trajectory Response Schema (Modeled Diurnal Curve Only)

export const openMeteoHourlySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional().default('UTC'),
  hourly: z.object({
    time: z.array(z.string()).min(1),
    pm2_5: z.array(z.number().nullable()).optional(),
    pm10: z.array(z.number().nullable()).optional(),
    nitrogen_dioxide: z.array(z.number().nullable()).optional(),
    ozone: z.array(z.number().nullable()).optional(),
  }),
});
