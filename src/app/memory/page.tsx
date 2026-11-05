import React from 'react';
import Link from 'next/link';
import { ArrowLeft, StickyNote } from 'lucide-react';
import { WorkingMemoryPage } from '@/components/memory/WorkingMemoryPage';

export const metadata = {
  title: 'VITAL 작업기억 보조 보드 | Working Memory Workspace',
  description: '다중 동시 업무(예산편성·행정감사·양재천행사·팀장님지시) 1초 캡처 및 수치·기한 대조 보드',
};

export default function DedicatedWorkingMemoryRoutePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] pb-16">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-amber-600 shrink-0">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                VITAL 작업기억 보조 보드
              </h1>
              <p className="text-xs sm:text-[13px] font-medium text-slate-500 mt-0.5">
                2027 예산편성 · 행정사무감사 · 양재천 페스티벌 · 팀장님 지시사항 통합 인지 보조 워크스페이스
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs transition-colors w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>통합 대시보드로 돌아가기</span>
          </Link>
        </header>

        <WorkingMemoryPage />
      </div>
    </main>
  );
}
