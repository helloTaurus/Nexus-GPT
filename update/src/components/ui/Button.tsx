import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-[7px] transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-brand focus-visible:outline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

    const sizeStyles = {
      sm: 'px-3.5 py-1.5 text-xs min-h-[36px] gap-1.5',
      md: 'px-5 py-2.5 text-sm min-h-[44px] gap-2',
      lg: 'px-7 py-3.5 text-base min-h-[50px] gap-2.5',
    }[size];

    const variantStyles = {
      primary: 'bg-action hover:bg-action-hover text-on-action shadow-sm active:bg-action-hover',
      secondary: 'bg-subtle hover:bg-subtle text-ink border border-rule hover:border-brand/40',
      outline: 'bg-transparent text-ink border border-rule hover:border-brand hover:text-brand',
      ghost: 'bg-transparent hover:bg-subtle text-muted hover:text-ink',
      danger: 'bg-danger text-white hover:opacity-90',
      success: 'bg-success text-white hover:opacity-90',
    }[variant];

    return (
      <motion.button
        ref={ref}
        whileHover={disabled || isLoading ? undefined : { scale: 1.015 }}
        whileTap={disabled || isLoading ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
