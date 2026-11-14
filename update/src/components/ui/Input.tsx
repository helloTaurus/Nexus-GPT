import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-muted pointer-events-none shrink-0 flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-[7px] bg-subtle text-ink border transition-colors duration-150 px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1 placeholder:text-muted/60 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error ? 'border-danger focus-visible:outline-danger' : 'border-rule hover:border-brand/40'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-muted shrink-0 flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-xs font-medium text-danger flex items-center gap-1 mt-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-muted mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
