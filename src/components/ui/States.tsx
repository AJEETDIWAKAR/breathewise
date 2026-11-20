import type React from 'react';
import { AlertCircle, AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading air quality information"
      className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="h-5 w-24 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-12 w-32 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-20 bg-slate-100 rounded border border-slate-200 animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Loading air quality data...</span>
    </div>
  );
}

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  secondaryAction?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function ErrorMessage({
  title = 'Unable to load air quality data',
  message,
  onRetry,
  secondaryAction,
  headingLevel = 'h3',
}: ErrorMessageProps) {
  const Heading = headingLevel;
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-start gap-4"
    >
      <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-2">
        <Heading className="text-sm font-semibold text-red-900">{title}</Heading>
        <p className="text-sm text-red-800">{message}</p>
        {(onRetry || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Retry check
              </Button>
            )}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

interface UnavailableNoticeProps {
  title: string;
  message: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function UnavailableNotice({
  title,
  message,
  primaryAction,
  secondaryAction,
  headingLevel = 'h3',
}: UnavailableNoticeProps) {
  const Heading = headingLevel;
  return (
    <div
      role="status"
      className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-start gap-4"
    >
      <CloudOff className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-2">
        <Heading className="text-sm font-semibold text-amber-950">{title}</Heading>
        <p className="text-sm text-amber-900">{message}</p>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  headingLevel = 'h3',
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
      <div className="mx-auto w-10 h-10 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
        {icon ?? <AlertTriangle className="w-5 h-5" aria-hidden="true" />}
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <Heading className="text-base font-semibold text-slate-900">{title}</Heading>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
