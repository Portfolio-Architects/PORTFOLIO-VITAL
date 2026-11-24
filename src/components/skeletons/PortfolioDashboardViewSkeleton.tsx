import React from 'react';

export function PortfolioDashboardViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] gap-6">
        <div className="min-w-0 flex flex-col gap-4 sm:gap-5">
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs min-h-[420px] flex flex-col justify-between">
            <div className="flex justify-between items-center pb-4 mb-5 border-b border-slate-100">
              <div className="flex flex-col gap-2">
                <div className="w-40 h-6 bg-slate-200/80 rounded-md" />
              </div>
              <div className="w-36 h-9 bg-slate-100 border border-slate-200/80 rounded-lg" />
            </div>
            <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center justify-between">
              <div className="w-full sm:w-auto flex justify-center items-center shrink-0">
                <div className="w-[236px] h-[236px] rounded-full border-[30px] border-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                  <div className="w-16 h-3 bg-slate-100 rounded mb-1.5" />
                  <div className="w-24 h-5 bg-slate-200/80 rounded-md" />
                </div>
              </div>
              <div className="w-full sm:flex-1 flex flex-col gap-4">
                <div className="w-full h-4 bg-slate-100 rounded" />
                <div className="w-5/6 h-4 bg-slate-100 rounded" />
                <div className="w-2/3 h-4 bg-slate-100 rounded" />
                <div className="w-3/4 h-4 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 content-start">
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xs min-h-[72px] h-[72px] flex flex-col justify-between"
            >
              <div className="w-20 h-3 bg-slate-200/80 rounded" />
              <div className="flex items-end justify-between gap-2">
                <div className="w-20 h-6 bg-slate-200/80 rounded-md" />
                <div className="w-20 h-1.5 bg-slate-100 rounded-full" />
              </div>
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xs min-h-[72px] h-[72px] flex flex-col justify-between"
            >
              <div className="w-20 h-3 bg-slate-200/80 rounded" />
              <div className="flex items-end justify-between gap-2">
                <div className="w-20 h-6 bg-slate-200/80 rounded-md" />
                <div className="w-20 h-1.5 bg-slate-100 rounded-full" />
              </div>
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xs min-h-[72px] h-[72px] flex flex-col justify-between"
            >
              <div className="w-20 h-3 bg-slate-200/80 rounded" />
              <div className="w-28 h-5 bg-slate-200/80 rounded-md" />
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xs min-h-[72px] h-[72px] flex flex-col justify-between"
            >
              <div className="w-20 h-3 bg-slate-200/80 rounded" />
              <div className="w-28 h-5 bg-slate-200/80 rounded-md" />
            </div>
          </div>
        </div>
        <div className="min-w-0 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs h-full flex flex-col justify-between">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex flex-col gap-2">
                <div className="w-44 h-6 bg-slate-200/80 rounded-md" />
                <div className="w-56 h-3.5 bg-slate-100 rounded" />
              </div>
              <div className="w-36 h-9 bg-slate-100 border border-slate-200/80 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70">
              <div className="h-11 bg-slate-200/60 rounded" />
              <div className="h-11 bg-slate-200/60 rounded" />
              <div className="h-11 bg-slate-200/60 rounded" />
            </div>
            <div className="flex-1 mt-5 w-full bg-slate-50/70 border border-slate-100 rounded-xl flex items-end gap-3 p-4 min-h-[325px] h-[325px]">
              <div className="flex-grow bg-slate-200/70 rounded-t h-[50%]" />
              <div className="flex-grow bg-slate-200/70 rounded-t h-[70%]" />
              <div className="flex-grow bg-slate-200/70 rounded-t h-[90%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortfolioDashboardViewSkeleton;
