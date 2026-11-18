import React from 'react';

export function PortfolioDashboardViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        <div className="xl:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs min-h-[450px] flex flex-col justify-between">
            <div className="flex justify-between items-center pb-4 mb-5 border-b border-slate-100">
              <div className="flex flex-col gap-2">
                <div className="w-48 h-6 bg-slate-200/80 rounded-md" />
                <div className="w-40 h-3.5 bg-slate-100 rounded" />
              </div>
              <div className="w-44 h-10 bg-slate-100 border border-slate-200/80 rounded-lg" />
            </div>
            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="w-full sm:w-[47%] flex justify-center items-center">
                <div className="w-[236px] h-[236px] rounded-full border-[30px] border-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                  <div className="w-16 h-3 bg-slate-100 rounded mb-1.5" />
                  <div className="w-24 h-5 bg-slate-200/80 rounded-md" />
                </div>
              </div>
              <div className="w-full sm:w-[40%] flex flex-col gap-3.5">
                <div className="w-full h-4 bg-slate-100 rounded" />
                <div className="w-5/6 h-4 bg-slate-100 rounded" />
                <div className="w-2/3 h-4 bg-slate-100 rounded" />
                <div className="w-3/4 h-4 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 content-start">
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-2xs min-h-[78px] h-[78px] flex flex-col justify-between"
            >
              <div className="w-20 h-3.5 bg-slate-200/80 rounded" />
              <div className="flex items-end justify-between gap-2">
                <div className="w-20 h-7 bg-slate-200/80 rounded-md" />
                <div className="w-20 h-2 bg-slate-100 rounded-full" />
              </div>
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-2xs min-h-[78px] h-[78px] flex flex-col justify-between"
            >
              <div className="w-20 h-3.5 bg-slate-200/80 rounded" />
              <div className="flex items-end justify-between gap-2">
                <div className="w-20 h-7 bg-slate-200/80 rounded-md" />
                <div className="w-20 h-2 bg-slate-100 rounded-full" />
              </div>
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-2xs min-h-[78px] h-[78px] flex flex-col justify-between"
            >
              <div className="w-20 h-3.5 bg-slate-200/80 rounded" />
              <div className="w-28 h-6 bg-slate-200/80 rounded-md" />
            </div>
            <div
              data-testid="dashboard-skeleton-kpi-card"
              className="bg-white border border-slate-200/80 rounded-xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-2xs min-h-[78px] h-[78px] flex flex-col justify-between"
            >
              <div className="w-20 h-3.5 bg-slate-200/80 rounded" />
              <div className="w-28 h-6 bg-slate-200/80 rounded-md" />
            </div>
          </div>
        </div>
        <div className="xl:col-span-6 flex flex-col gap-6">
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
