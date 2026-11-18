import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'general'
  | 'daily'
  | 'directive'
  | 'audit';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 border border-slate-200/80',
  primary: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
  general: 'bg-slate-100 text-slate-800 border border-slate-200',
  daily: 'bg-amber-50 text-amber-900 border border-amber-200',
  directive: 'bg-rose-50 text-rose-800 border border-rose-200',
  audit: 'bg-sky-50 text-sky-800 border border-sky-200',
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge = React.memo(function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full leading-tight ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
});
