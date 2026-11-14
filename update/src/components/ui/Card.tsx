import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'surface' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'surface',
      padding = 'md',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8 sm:p-10',
    }[padding];

    const variantStyles = {
      surface: 'bg-surface border border-rule shadow-sm',
      subtle: 'bg-subtle border border-rule',
      interactive:
        'bg-surface border border-rule hover:border-brand/30 hover:shadow-sm cursor-pointer transition-colors',
    }[variant];

    const motionProps =
      variant === 'interactive'
        ? {
            whileHover: { y: -2 },
            transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
          }
        : {};

    return (
      <motion.div
        ref={ref}
        className={`rounded-[12px] relative overflow-hidden ${variantStyles} ${paddingStyles} ${className}`}
        {...motionProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';
