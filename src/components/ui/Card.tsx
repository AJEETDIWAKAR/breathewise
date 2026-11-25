import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
};

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const padClass = PADDING_CLASSES[padding];

  return (
    <section
      className={`bg-white border border-slate-200 rounded-lg ${padClass} ${className}`}
    >
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 leading-snug">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
