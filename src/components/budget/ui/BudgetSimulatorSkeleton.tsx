'use client';

import React from 'react';

export const BudgetSimulatorSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Header Title Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="h-6 w-56 bg-slate-200 rounded-md" />
          <div className="h-3.5 w-80 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-36 h-8 bg-slate-200 rounded-lg" />
          <div className="w-28 h-8 bg-slate-200 rounded-lg" />
          <div className="w-20 h-8 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Summary Cards Skeleton (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200/80 rounded-xl p-4 h-32 flex flex-col justify-between shadow-2xs"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-4 h-4 bg-slate-200 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Burn-Up Chart Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="space-y-1.5">
            <div className="h-4 w-56 bg-slate-200 rounded" />
            <div className="h-3 w-72 bg-slate-100 rounded" />
          </div>
          <div className="w-40 h-8 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-[280px] bg-slate-50 rounded-xl border border-slate-200/80" />
      </div>

      {/* Input Form Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="space-y-1.5">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-64 bg-slate-100 rounded" />
          </div>
          <div className="w-28 h-7 bg-slate-100 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-4 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-4 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-3 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-2 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-4 h-9 bg-slate-100 rounded-lg" />
          <div className="lg:col-span-3 h-9 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Result Table Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex gap-2">
            <div className="w-32 h-8 bg-slate-200 rounded-lg" />
            <div className="w-32 h-8 bg-slate-100 rounded-lg" />
          </div>
          <div className="w-48 h-8 bg-slate-100 rounded-lg" />
        </div>

        <div className="h-64 bg-slate-50 rounded-xl border border-slate-200/80" />
      </div>
    </div>
  );
};

export default BudgetSimulatorSkeleton;

