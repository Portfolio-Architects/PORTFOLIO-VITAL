import React from 'react';

export interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar = React.memo(function ProgressBar({
  value,
  color = 'var(--color-primary)',
  height = 6,
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const barColor =
    clampedValue >= 90
      ? 'var(--color-danger)'
      : clampedValue >= 70
      ? 'var(--color-warning)'
      : color;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 rounded-full overflow-hidden bg-slate-100" style={{ height }}>
        <div
          className="rounded-full progress-fill"
          style={{ width: `${clampedValue}%`, height: '100%', backgroundColor: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold font-mono tabular-nums text-slate-600 min-w-[36px] text-right">
          {clampedValue}%
        </span>
      )}
    </div>
  );
});
