'use client';

import React from 'react';
import dynamic from 'next/dynamic';

function YangjaeFestivalSkeleton() {
  return (
    <div className="yangjae-dashboard-container w-full max-w-md bg-white sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs overflow-hidden flex flex-col min-h-screen text-slate-900 font-sans p-3.5 sm:p-4 space-y-3.5 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-11 bg-slate-900 rounded-xl flex items-center justify-between px-3.5">
        <div className="h-4 bg-slate-700 rounded w-44"></div>
        <div className="h-6 bg-slate-800 rounded-md w-14"></div>
      </div>
      {/* Overview Skeleton */}
      <div className="border border-slate-200/80 rounded-xl p-3.5 space-y-2 shadow-2xs">
        <div className="h-4 bg-slate-200/80 rounded w-24"></div>
        <div className="h-3.5 bg-slate-100 rounded w-full"></div>
        <div className="h-3.5 bg-slate-100 rounded w-5/6"></div>
        <div className="h-3.5 bg-slate-100 rounded w-4/6"></div>
      </div>
      {/* Tabs Skeleton */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
        <div className="h-8 bg-white rounded-lg shadow-2xs"></div>
        <div className="h-8 bg-slate-200/60 rounded-lg"></div>
        <div className="h-8 bg-slate-200/60 rounded-lg"></div>
        <div className="h-8 bg-slate-200/60 rounded-lg"></div>
      </div>
      {/* Task Cards Skeleton */}
      <div className="space-y-2.5">
        <div className="h-16 bg-white border border-slate-200/80 rounded-xl shadow-2xs"></div>
        <div className="h-16 bg-white border border-slate-200/80 rounded-xl shadow-2xs"></div>
        <div className="h-16 bg-white border border-slate-200/80 rounded-xl shadow-2xs"></div>
      </div>
    </div>
  );
}

const DynamicDashboard = dynamic(
  () => import('@/components/festival/YangjaeFestivalDashboard'),
  {
    ssr: false,
    loading: () => <YangjaeFestivalSkeleton />,
  }
);

export default function YangjaeFestivalClientWrapper() {
  return <DynamicDashboard />;
}
