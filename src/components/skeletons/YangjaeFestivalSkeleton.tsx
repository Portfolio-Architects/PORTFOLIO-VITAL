'use client';

import React from 'react';

export function YangjaeFestivalSkeleton() {
  return (
    <div
      data-testid="yangjae-festival-skeleton"
      className="w-full flex justify-center pb-16 animate-pulse"
    >
      <div className="w-full sm:max-w-md bg-white sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs overflow-hidden flex flex-col min-h-screen text-slate-900">
        {/* Top Header */}
        <div className="bg-slate-900 px-3 sm:px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="h-5 w-44 bg-slate-700 rounded-md" />
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-14 bg-slate-800 rounded-md" />
            <div className="h-6 w-12 bg-slate-800 rounded-md" />
          </div>
        </div>

        {/* Overview Card */}
        <div className="p-3.5 sm:p-4 space-y-3 bg-slate-50/40">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="h-4 w-28 bg-slate-200/80 rounded" />
              <div className="h-5 w-14 bg-slate-100 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 bg-slate-100 rounded w-full" />
              <div className="h-3.5 bg-slate-100 rounded w-4/5" />
              <div className="h-3.5 bg-slate-100 rounded w-3/5" />
            </div>
          </div>

          {/* 4-Tab Segmented Control */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <div className="h-9 bg-white rounded-lg shadow-2xs" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
            <div className="h-9 bg-slate-200/60 rounded-lg" />
          </div>

          {/* Milestone / Booth Cards */}
          <div className="space-y-2.5 pt-1">
            <div className="h-24 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
            <div className="h-24 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
            <div className="h-24 bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default YangjaeFestivalSkeleton;
