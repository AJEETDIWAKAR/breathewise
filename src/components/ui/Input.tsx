import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  errorText?: string;
}

export function Input({
  label,
  helperText,
  errorText,
  id,
  className = '',
  'aria-describedby': callerDescribedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const describedByIds = [
    callerDescribedBy,
    errorText ? errorId : helperText ? helperId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(errorText)}
        aria-describedby={describedByIds || undefined}
        className={`w-full min-h-[42px] px-3 py-2 text-sm text-slate-900 bg-white border rounded-md transition-colors placeholder:text-slate-500 ${
          errorText ? 'border-red-600' : 'border-slate-300 hover:border-slate-400'
        } ${className}`}
        {...props}
      />
      {errorText ? (
        <p id={errorId} className="text-xs text-red-700" role="alert">
          {errorText}
        </p>
      ) : (
        helperText && (
          <p id={helperId} className="text-xs text-slate-600">
            {helperText}
          </p>
        )
      )}
    </div>
  );
}
