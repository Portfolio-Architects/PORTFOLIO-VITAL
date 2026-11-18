import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  offscreenIsolate?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = '',
  hover = false,
  offscreenIsolate = false,
  onClick,
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/85 shadow-2xs ${
        hover ? 'card-hover cursor-pointer' : ''
      } ${offscreenIsolate ? 'vlds-cv-card' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  density = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  density?: 'compact' | 'default';
}) {
  const padClass = density === 'compact' ? 'px-4 py-2.5' : 'px-5 py-3.5';
  return <div className={`${padClass} border-b border-slate-100 ${className}`}>{children}</div>;
}

export function CardContent({
  children,
  className = '',
  density = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  density?: 'compact' | 'default';
}) {
  const padClass = density === 'compact' ? 'px-4 py-3' : 'px-5 py-4';
  return <div className={`${padClass} ${className}`}>{children}</div>;
}

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  noBorder?: boolean;
  titleClassName?: string;
  className?: string;
}

export const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
  badge,
  actions,
  icon,
  headingLevel = 'h2',
  noBorder = false,
  titleClassName = 'text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight',
  className = '',
}: SectionHeaderProps) {
  const HeadingTag = headingLevel;
  const borderClass = noBorder ? '' : 'pb-3.5 border-b border-slate-100';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${borderClass} ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <HeadingTag className={`${titleClassName} truncate`}>{title}</HeadingTag>
            {badge}
          </div>
          {subtitle && (
            <p
              title={subtitle}
              className="vlds-subtitle text-xs font-medium text-slate-500 mt-0.5 line-clamp-1"
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
});

export interface KpiStatCardProps {
  label: string;
  value: React.ReactNode;
  subLabel?: React.ReactNode;
  accentColorClass?: string;
  className?: string;
}

export const KpiStatCard = React.memo(function KpiStatCard({
  label,
  value,
  subLabel,
  accentColorClass = 'bg-slate-900',
  className = '',
}: KpiStatCardProps) {
  return (
    <div
      className={`bg-white border border-slate-200/85 rounded-xl px-4 py-3.5 shadow-2xs flex flex-col justify-between gap-1.5 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accentColorClass}`} />
        <span className="text-xs font-semibold text-slate-500 truncate">{label}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums tracking-tight">
          {value}
        </span>
        {subLabel && (
          <span className="text-[11px] font-medium text-slate-500 font-mono tabular-nums shrink-0">
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
});
