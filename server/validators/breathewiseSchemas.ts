import { z } from 'zod';

export const CommuteModeSchema = z.enum([
  'petrol_car',
  'diesel_car',
  'two_wheeler',
  'metro_rail',
  'public_bus',
  'carpool',
  'walk_cycle',
  'work_from_home',
]);

export const BudgetTierSchema = z.enum(['low', 'moderate', 'flexible']);
export const CookingFuelSchema = z.enum(['lpg', 'induction', 'biomass_solid']);
export const WorkScheduleSchema = z.enum([
  'morning_evening_commute',
  'flexible_hybrid',
  'shift_work',
  'home_based',
]);
export const SchoolScheduleSchema = z.enum(['morning_afternoon', 'online_or_none']);
export const HousingTypeSchema = z.enum([
  'apartment_sealed',
  'independent_leaky',
  'high_traffic_roadside',
]);
export const KitchenExhaustSchema = z.enum(['chimney_or_exhaust', 'window_only', 'none']);

export const FamilyProfileSchema = z.object({
  version: z.literal(1),
  householdName: z.string().trim().min(1).max(60),
  members: z.object({
    adults: z.number().int().min(0).max(15),
    children: z.number().int().min(0).max(15),
    seniors: z.number().int().min(0).max(15),
  }),
  sensitivities: z.object({
    hasAsthmaOrRespiratory: z.boolean(),
    hasHeartCondition: z.boolean(),
    hasPregnantMember: z.boolean(),
    hasOutdoorWorker: z.boolean(),
  }),
  lifestyle: z.object({
    primaryCommute: CommuteModeSchema,
    dailyCommuteKm: z.number().min(0).max(200),
    preferredOutdoorActivity: z.enum(['walking', 'running_sports', 'park_play', 'none']),
    outdoorExerciseTime: z.enum(['early_morning', 'midday', 'evening']),
    workSchedule: WorkScheduleSchema.optional().default('morning_evening_commute'),
    schoolSchedule: SchoolScheduleSchema.optional().default('morning_afternoon'),
  }),
  homeEnvironment: z.object({
    budgetTier: BudgetTierSchema,
    cookingFuel: CookingFuelSchema,
    hasAirPurifier: z.boolean(),
    roomAreaSqFt: z.number().int().min(50).max(2500),
    housingType: HousingTypeSchema.optional().default('apartment_sealed'),
    kitchenExhaust: KitchenExhaustSchema.optional().default('window_only'),
  }),
  updatedAt: z.string(),
});

export const AiRecommendationOutcomeSchema = z.enum([
  'reduce_personal_exposure',
  'improve_indoor_air',
  'reduce_personal_emissions',
]);

export const AiRecommendationItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(450),
  outcomeCategory: AiRecommendationOutcomeSchema,
  outcomeLabel: z.string().trim().min(1).max(120),
  estimatedCostOrBudgetNote: z.string().trim().min(1).max(180),
});

export const AiSourceAttributionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(240),
  url: z.string().trim().max(300).optional(),
});

export const AiStructuredAdviceSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  currentAirQualityContext: z.object({
    locationName: z.string().trim().min(1).max(160),
    aqiSummary: z.string().trim().min(1).max(320),
    measuredFacts: z.array(z.string().trim().min(1).max(260)).min(1).max(6),
    missingData: z.array(z.string().trim().min(1).max(220)).max(6),
  }),
  recommendations: z.array(AiRecommendationItemSchema).min(1).max(6),
  explanation: z.string().trim().min(1).max(1200),
  precautions: z.array(z.string().trim().min(1).max(320)).min(1).max(6),
  confidenceAndLimitations: z.object({
    confidenceLevel: z.enum(['high', 'moderate', 'low']),
    notes: z.string().trim().min(1).max(550),
  }),
  sources: z.array(AiSourceAttributionSchema).min(1).max(5),
  dataFreshness: z.string().trim().min(1).max(240),
});
