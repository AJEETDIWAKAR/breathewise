import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { getNaqiVisualTokens } from '../../domain/naqi';
import { getUsAqiVisualTokens, normalizeUsAqiCategoryLabel } from '../../domain/usAqi';
import type { AqiCategory, AqiScale, NaqiCategory, UsAqiCategory } from '../../types/breathewise';

interface PollutionStatusBadgeProps {
  category: AqiCategory | 'Unavailable';
  scale?: AqiScale;
  compact?: boolean;
}

export function PollutionStatusBadge({
  category,
  scale,
  compact = false,
}: PollutionStatusBadgeProps) {
  const isUsCategory = normalizeUsAqiCategoryLabel(category) !== null;
  const resolvedScale: AqiScale =
    scale ?? (isUsCategory ? 'US_AQI' : 'INDIA_CPCB_NAQI');

  const tokens =
    resolvedScale === 'US_AQI'
      ? getUsAqiVisualTokens((normalizeUsAqiCategoryLabel(category) ?? 'Unavailable') as UsAqiCategory | 'Unavailable')
      : getNaqiVisualTokens(category as NaqiCategory | 'Unavailable');

  const Icon =
    tokens.tone === 'success'
      ? CheckCircle2
      : tokens.tone === 'info'
        ? Info
        : tokens.tone === 'warning'
          ? AlertTriangle
          : AlertOctagon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold border rounded ${tokens.bgClass} ${tokens.textClass} ${tokens.borderClass} ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{category}</span>
    </span>
  );
}
