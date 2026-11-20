import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary:
      'bg-teal-700 text-white hover:bg-teal-800 border border-teal-700 disabled:bg-slate-300 disabled:border-slate-300',
    secondary:
      'bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 disabled:text-slate-400',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent disabled:text-slate-400',
    danger:
      'bg-red-700 text-white hover:bg-red-800 border border-red-700 disabled:bg-slate-300 disabled:border-slate-300',
  }[variant];

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs min-h-[34px]',
    md: 'px-4 py-2 text-sm min-h-[40px]',
    lg: 'px-5 py-2.5 text-sm min-h-[44px]',
  }[size];

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
