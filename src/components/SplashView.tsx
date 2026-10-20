'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export function SplashView() {
  return (
    <div 
      className="relative w-full min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center pointer-events-none select-none p-4"
      suppressHydrationWarning
    >
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs flex flex-col items-center gap-4 max-w-sm w-full text-center p-6 animate-in fade-in duration-200">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white shadow-2xs">
          <div className="absolute -inset-1.5 rounded-2xl border border-slate-200/80 border-t-slate-900 animate-spin duration-1000" />
          <Sparkles size={16} className="text-white" />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            VITAL Work & Wealth
          </h1>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums uppercase tracking-wider">
            Architecture Ready
          </p>
          <div className="h-px bg-slate-100 my-1 w-full max-w-[180px] mx-auto" />
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[260px] mx-auto">
            로컬 단일 진실 공급원(SSOT) 및 지능형 워크스페이스를 연결하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SplashView;
