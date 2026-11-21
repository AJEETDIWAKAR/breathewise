import type { FamilyProfile } from '../../src/types/breathewise.ts';
import {
  buildRuleBasedFallbackAdvice,
  buildVerifiedAirQualityContext,
  classifyQuestionTopics,
  formatAdviceAsPlainText,
  formatFallbackNotice,
  sanitizeStructuredAdvice,
  stripUnsafeHtml,
  type QuestionTopic,
} from '../../src/domain/aiRuleBasedAdvice.ts';

export {
  buildRuleBasedFallbackAdvice,
  buildVerifiedAirQualityContext as buildServerVerifiedContext,
  classifyQuestionTopics,
  formatAdviceAsPlainText,
  formatFallbackNotice,
  sanitizeStructuredAdvice,
  stripUnsafeHtml,
  type QuestionTopic,
};

export function buildMinimizedFamilyContext(
  profile: FamilyProfile,
  question: string,
): {
  contextText: string;
  primaryTopic: QuestionTopic;
  minimizedFields: string[];
} {
  const topics = classifyQuestionTopics(question);
  const minimizedFields: string[] = ['members', 'sensitivities'];

  const sensitivities = [
    profile.sensitivities.hasAsthmaOrRespiratory ? 'asthma/respiratory sensitivity' : null,
    profile.sensitivities.hasHeartCondition ? 'cardiovascular sensitivity' : null,
    profile.sensitivities.hasPregnantMember ? 'pregnant household member' : null,
    profile.sensitivities.hasOutdoorWorker ? 'outdoor worker in household' : null,
  ].filter(Boolean);

  const lines: string[] = [
    `HOUSEHOLD COMPOSITION (anonymized): ${profile.members.adults} adult(s), ${profile.members.children} child(ren), ${profile.members.seniors} senior(s)`,
    `HEALTH SENSITIVITIES: ${sensitivities.length > 0 ? sensitivities.join(', ') : 'none flagged'}`,
  ];

  if (topics.includeOutdoorHabit) {
    minimizedFields.push('outdoorActivity', 'outdoorExerciseTime');
    lines.push(
      `OUTDOOR HABIT: ${profile.lifestyle.preferredOutdoorActivity.replace(/_/g, ' ')} typically during ${profile.lifestyle.outdoorExerciseTime.replace(/_/g, ' ')}`,
    );
  }

  if (topics.includeCommute) {
    minimizedFields.push('primaryCommute', 'dailyCommuteKm');
    lines.push(
      `DAILY COMMUTE: ${profile.lifestyle.primaryCommute.replace(/_/g, ' ')} (${profile.lifestyle.dailyCommuteKm} km/day)`,
    );
  }

  if (topics.includeIndoor) {
    minimizedFields.push('cookingFuel', 'hasAirPurifier', 'roomAreaSqFt');
    lines.push(
      `INDOOR ENVIRONMENT: cooking fuel=${profile.homeEnvironment.cookingFuel}, HEPA purifier=${profile.homeEnvironment.hasAirPurifier ? 'yes' : 'no'}, primary room=${profile.homeEnvironment.roomAreaSqFt} sq ft`,
    );
  }

  if (topics.includeBudget) {
    minimizedFields.push('budgetTier');
    lines.push(`BUDGET TIER: ${profile.homeEnvironment.budgetTier}`);
  }

  return {
    contextText: lines.join('\n'),
    primaryTopic: topics.primaryTopic,
    minimizedFields,
  };
}
