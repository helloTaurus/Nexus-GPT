import React from 'react';
import { CheckCircle, Clock, XCircle, Info } from '@phosphor-icons/react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'approved' | 'pending' | 'rejected' | 'draft' | 'brand' | 'neutral';
  size?: 'sm' | 'md';
  icon?: boolean | React.ReactNode;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon = true,
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }[size];

  const variantStyles = {
    approved:
      'bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/20 dark:border-[#69D3B0]/30',
    pending:
      'bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] border border-[#865600]/20 dark:border-[#F3CE87]/30',
    rejected:
      'bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 dark:border-[#FFACA9]/30',
    draft: 'bg-subtle text-muted border border-rule',
    brand: 'bg-accent-soft text-brand border border-brand/25',
    neutral: 'bg-subtle text-ink border border-rule',
  }[variant];

  const defaultIcons = {
    approved: <CheckCircle className="w-3.5 h-3.5 shrink-0" weight="regular" />,
    pending: <Clock className="w-3.5 h-3.5 shrink-0" weight="regular" />,
    rejected: <XCircle className="w-3.5 h-3.5 shrink-0" weight="regular" />,
    draft: <Info className="w-3.5 h-3.5 shrink-0" weight="regular" />,
    brand: null,
    neutral: null,
  };

  const renderIcon = typeof icon === 'boolean' ? (icon ? defaultIcons[variant] : null) : icon;

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full uppercase tracking-wider select-none shrink-0 ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {renderIcon}
      <span>{children}</span>
    </span>
  );
};
