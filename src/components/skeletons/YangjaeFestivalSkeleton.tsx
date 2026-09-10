'use client';

import React from 'react';

export function YangjaeFestivalSkeleton() {
  return (
    <div
      data-testid="yangjae-festival-skeleton"
      className="w-full flex justify-center pb-16 animate-pulse"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-800 sm:shadow-lg overflow-hidden flex flex-col min-h-screen text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <div className="bg-slate-900 px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="h-6 w-48 bg-slate-700 rounded-lg" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 bg-slate-800 rounded-lg" />
            <div className="h-7 w-14 bg-emerald-800/60 rounded-lg" />
          </div>
        </div>

        {/* KPI Banner / Meta Card */}
        <div className="p-4 space-y-4 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="h-5 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-6 w-20 bg-indigo-100 dark:bg-indigo-950/80 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/5" />
            </div>
          </div>

          {/* Sub-Tabs Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-200 dark:bg-slate-800 p-1.5 rounded-xl">
            <div className="h-10 bg-white dark:bg-slate-900 rounded-lg shadow-xs" />
            <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-lg" />
          </div>

          {/* KPI Matrix / Metric Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3" />
            <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3" />
            <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3" />
            <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3" />
          </div>

          {/* Milestone / Booth Cards */}
          <div className="space-y-3 pt-1">
            <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs" />
            <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs" />
            <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default YangjaeFestivalSkeleton;
