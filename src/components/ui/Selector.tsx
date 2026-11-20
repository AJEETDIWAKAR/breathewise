import React, { useId } from 'react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectorProps<T extends string = string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  helperText?: string;
  className?: string;
  id?: string;
  hideLabel?: boolean;
}

export function Selector<T extends string = string>({
  label,
  value,
  options,
  onChange,
  helperText,
  className = '',
  id,
  hideLabel = false,
}: SelectorProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helperId = `${selectId}-helper`;
  const hasVisibleHelper = Boolean(helperText && !hideLabel);

  return (
    <div className={hideLabel ? '' : 'space-y-1.5'}>
      <label
        htmlFor={selectId}
        className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-slate-800'}
      >
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        aria-describedby={hasVisibleHelper ? helperId : undefined}
        onChange={(e) => onChange(e.target.value as T)}
        className={`w-full min-h-[40px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md hover:border-slate-400 transition-colors cursor-pointer ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasVisibleHelper && (
        <p id={helperId} className="text-xs text-slate-600">
          {helperText}
        </p>
      )}
    </div>
  );
}

interface SegmentedTabsProps<T extends string = string> {
  ariaLabel: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string = string>({
  ariaLabel,
  value,
  options,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md w-full sm:w-auto"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
