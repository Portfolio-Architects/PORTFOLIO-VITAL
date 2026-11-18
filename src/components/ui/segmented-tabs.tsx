'use client';

import React from 'react';

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badgeCount?: number | string;
  dotIndicator?: boolean;
}

export interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<SegmentedTabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  onPreload?: (id: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

function SegmentedTabsInner<T extends string>({
  items,
  activeId,
  onChange,
  onPreload,
  size = 'md',
  className = '',
}: SegmentedTabsProps<T>) {
  const padClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[13px]';

  return (
    <div
      className={`inline-flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 gap-1 overflow-x-auto no-scrollbar ${className}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(item.id)}
            onMouseEnter={onPreload ? () => onPreload(item.id) : undefined}
            onFocus={onPreload ? () => onPreload(item.id) : undefined}
            className={`flex items-center justify-center gap-1.5 ${padClass} rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            }`}
            title={item.label}
          >
            {item.dotIndicator && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive ? 'bg-slate-900' : 'bg-slate-400'
                }`}
              />
            )}
            {Icon && (
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-500'}`}
                strokeWidth={isActive ? 2.0 : 1.75}
              />
            )}
            <span>{item.label}</span>
            {item.badgeCount !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-md text-[10.5px] font-mono tabular-nums ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {item.badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const SegmentedTabs = React.memo(SegmentedTabsInner) as typeof SegmentedTabsInner;
