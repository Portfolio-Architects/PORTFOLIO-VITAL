'use client';

import React from 'react';

export function MindMap3DSkeleton() {
  return (
    <div
      data-testid="mindmap-skeleton"
      className="w-full h-[820px] min-h-[650px] bg-slate-100/90 dark:bg-slate-950/80 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 animate-pulse flex flex-col justify-between p-6 overflow-hidden"
    >
      {/* Header Toolbar Skeleton */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-200/40 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-300 dark:bg-slate-800 rounded-xl" />
          <div className="space-y-1.5">
            <div className="w-36 h-5 bg-slate-300 dark:bg-slate-800 rounded" />
            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-9 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="w-24 h-9 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="w-9 h-9 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Canvas Area with Central Node and Connected Satellites */}
      <div className="flex-1 flex items-center justify-center relative my-8">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-96 h-96 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-600" />
        </div>
        {/* Central Core Node */}
        <div className="w-48 h-20 bg-indigo-500/20 dark:bg-indigo-500/10 border-2 border-indigo-400/40 rounded-2xl flex items-center justify-center p-4 shadow-lg">
          <div className="w-32 h-4 bg-indigo-300 dark:bg-indigo-700 rounded" />
        </div>
        {/* Satellite Nodes */}
        <div className="absolute top-12 left-16 w-36 h-14 bg-slate-200 dark:bg-slate-800/80 rounded-xl border border-slate-300/40 dark:border-slate-700/50" />
        <div className="absolute top-16 right-20 w-40 h-14 bg-slate-200 dark:bg-slate-800/80 rounded-xl border border-slate-300/40 dark:border-slate-700/50" />
        <div className="absolute bottom-14 left-24 w-40 h-14 bg-slate-200 dark:bg-slate-800/80 rounded-xl border border-slate-300/40 dark:border-slate-700/50" />
        <div className="absolute bottom-12 right-24 w-36 h-14 bg-slate-200 dark:bg-slate-800/80 rounded-xl border border-slate-300/40 dark:border-slate-700/50" />
      </div>

      {/* Bottom Footer Controls */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-200/40 dark:border-slate-800/60">
        <div className="w-48 h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
        <div className="flex gap-1.5">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default MindMap3DSkeleton;
