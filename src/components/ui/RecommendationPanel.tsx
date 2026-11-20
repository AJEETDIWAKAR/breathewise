import React from 'react';
import { ArrowRight, ShieldCheck, Sprout } from 'lucide-react';
import type { RecommendationItem } from '../../types/breathewise';

interface RecommendationPanelProps {
  items: RecommendationItem[];
  onAction?: (item: RecommendationItem) => void;
}

export function RecommendationPanel({ items, onAction }: RecommendationPanelProps) {
  return (
    <ul className="divide-y divide-slate-200">
      {items.map((item) => {
        const isExposure = item.impactType === 'Exposure Reduction';
        return (
          <li key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-medium text-teal-800">
                  {isExposure ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  ) : (
                    <Sprout className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
                  )}
                  {item.impactType}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{item.priority} priority</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.summary}</p>
            </div>
            {onAction && (
              <button
                type="button"
                onClick={() => onAction(item)}
                className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-md transition-colors shrink-0 cursor-pointer"
                aria-label={`Open details for ${item.title}`}
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
