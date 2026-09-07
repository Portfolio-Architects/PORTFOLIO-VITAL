'use client';

import React, { useState, useMemo } from 'react';
import { SimulationEntry } from '@/types';
import {
  Pencil,
  Trash2,
  Search,
  Sparkles,
  RotateCcw,
  ListFilter,
  FileText,
  Tag,
  Boxes,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export interface SimulationEntryListProps {
  entries: SimulationEntry[];
  onEditEntry?: (entry: SimulationEntry) => void;
  onDeleteEntry: (id: string) => void;
  onSettleEntry?: (simId: string) => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
}

export const SimulationEntryList: React.FC<SimulationEntryListProps> = React.memo(({
  entries,
  onEditEntry,
  onDeleteEntry,
  onSettleEntry,
  onResetAll,
  onLoadTestPreset,
}) => {
  const [keyword, setKeyword] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'planned' | 'settled'>('all');

  // Filter entries and accumulate total in a single pass
  const { filteredEntries, totalAmountSum, plannedCount, settledCount } = useMemo(() => {
    let pCount = 0;
    let sCount = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status === 'SETTLED') sCount++;
      else pCount++;
    }

    const trimmed = keyword.trim().toLowerCase();
    const result: SimulationEntry[] = [];
    let sum = 0;

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const isSettled = item.status === 'SETTLED';

      if (statusTab === 'planned' && isSettled) continue;
      if (statusTab === 'settled' && !isSettled) continue;

      if (trimmed) {
        const matches =
          item.name.toLowerCase().includes(trimmed) ||
          item.detailedProject.toLowerCase().includes(trimmed) ||
          item.statItem.toLowerCase().includes(trimmed) ||
          (item.memo && item.memo.toLowerCase().includes(trimmed));
        if (!matches) continue;
      }

      result.push(item);
      sum += (item.amount || 0);
    }

    return { filteredEntries: result, totalAmountSum: sum, plannedCount: pCount, settledCount: sCount };
  }, [entries, keyword, statusTab]);

  return (
    <div className="space-y-4">
      {/* Top Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">
            시뮬레이션 확정 지출 목록 ({filteredEntries.length}건)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="항목명 / 세부사업 / 통계목 검색..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/80 w-48 sm:w-60 font-medium"
            />
          </div>

          {/* Quick Preset Buttons */}
          {entries.length === 0 && onLoadTestPreset && (
            <button
              type="button"
              onClick={onLoadTestPreset}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              테스트 프리셋 로드
            </button>
          )}

          {entries.length > 0 && onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-100 transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              전체 비우기
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Tab Pills */}
      <div className="flex items-center gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setStatusTab('all')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
            statusTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          전체 ({entries.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('planned')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            statusTab === 'planned'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          집행 대기 ({plannedCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('settled')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            statusTab === 'settled'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          집행 완료 ({settledCount})
        </button>
      </div>

      {/* Entry Cards Grid */}
      {filteredEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEntries.map((item) => {
            const isSettled = item.status === 'SETTLED';
            return (
              <div
                key={item.id}
                className={`border rounded-xl p-4 space-y-3 shadow-xs transition-all group flex flex-col justify-between ${
                  isSettled
                    ? 'bg-slate-50/60 border-emerald-200/80'
                    : 'bg-white border-slate-200/90 hover:border-indigo-300'
                }`}
              >
                <div className="space-y-2">
                  {/* Title & Status Badge & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSettled ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 집행 완료
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-500" /> 집행 대기
                          </span>
                        )}
                        <h4 className={`text-sm font-bold transition-colors line-clamp-2 ${isSettled ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                          {item.name}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isSettled && onEditEntry && (
                        <button
                          type="button"
                          onClick={() => onEditEntry(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all cursor-pointer border border-slate-200/60"
                          title="수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(item.id)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-all cursor-pointer border border-slate-200/60"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Category Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold flex items-center gap-1">
                      <Boxes className="w-3 h-3 text-indigo-500" />
                      {item.detailedProject}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-500" />
                      {item.statItem}
                    </span>
                  </div>

                  {/* Memo */}
                  {item.memo && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 line-clamp-2 flex items-start gap-1 font-medium">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{item.memo}</span>
                    </p>
                  )}
                </div>

                {/* Price, Amount & Settle Action */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-500 font-sans text-[11px]">
                      ₩{item.unitPrice.toLocaleString('ko-KR')} × {item.quantity}개
                    </span>
                    <span className={`font-extrabold text-sm ${isSettled ? 'text-slate-400' : 'text-purple-700'}`}>
                      ₩{(item.amount || 0).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {/* Real Expenditure Settle Button */}
                  {!isSettled && onSettleEntry && (
                    <button
                      type="button"
                      onClick={() => onSettleEntry(item.id)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="실제 집행이 이루어졌을 때 실제 지출로 정산 전환합니다."
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      실제 지출로 집행 (정산)
                    </button>
                  )}
                  {isSettled && (
                    <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                      <span>실제 e-호조 지출 반영 완료</span>
                      {item.settledDate && <span className="font-mono text-[10px]">{item.settledDate}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center gap-2">
          <h4 className="text-sm font-bold text-slate-700">등록된 시뮬레이션 항목이 없습니다.</h4>
          <p className="text-xs text-slate-400">
            상단 입력 폼에서 확정 지출 예정 내역을 등록하거나 테스트 프리셋을 로드하세요.
          </p>
          {onLoadTestPreset && (
            <button
              type="button"
              onClick={onLoadTestPreset}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              표준 8개 테스트 지출 항목 로드
            </button>
          )}
        </div>
      )}

      {/* Summary Footer */}
      {filteredEntries.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs font-bold text-slate-800">
          <span className="text-slate-600 font-medium">선택/필터된 지출 예정액 합계</span>
          <span className="font-mono text-sm font-extrabold text-purple-700">
            ₩{totalAmountSum.toLocaleString('ko-KR')} 원
          </span>
        </div>
      )}
    </div>
  );
});

SimulationEntryList.displayName = 'SimulationEntryList';
