'use client';

import React from 'react';

export function YangjaeFestivalSkeleton() {
  return (
    <div
      data-testid="yangjae-festival-skeleton"
      className="w-full pb-12 animate-pulse"
    >
      <div className="w-full bg-white sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs overflow-hidden flex flex-col text-slate-900">
        {/* Top Header */}
        <div className="bg-slate-900 px-3 sm:px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="h-5 w-48 bg-slate-700 rounded-md" />
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-24 bg-slate-800 rounded-md" />
            <div className="h-6 w-14 bg-slate-800 rounded-md" />
            <div className="h-6 w-12 bg-slate-800 rounded-md" />
          </div>
        </div>

        {/* Wide-View KPI + 5-Tab + 8:4 Content */}
        <div className="p-4 sm:p-5 lg:p-6 space-y-5 bg-slate-50/40">
          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs" />
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs" />
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs" />
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs" />
          </div>

          {/* 5-Tab Segmented Control */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <div className="h-9 bg-white rounded-lg shadow-2xs" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
          </div>

          {/* 8:4 Wide Content Skeleton */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8 space-y-3">
              <div className="h-24 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
              <div className="h-36 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
              <div className="h-36 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
            </div>
            <div className="xl:col-span-4 space-y-3">
              <div className="h-52 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
              <div className="h-44 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YangjaeFestivalSkeleton;
