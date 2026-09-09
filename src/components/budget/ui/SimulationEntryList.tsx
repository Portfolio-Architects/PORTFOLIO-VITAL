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
  LayoutGrid,
  Layers,
  Table as TableIcon,
} from 'lucide-react';

export interface SimulationEntryListProps {
  entries: SimulationEntry[];
  onEditEntry?: (entry: SimulationEntry) => void;
  onDeleteEntry: (id: string) => void;
  onSettleEntry?: (simId: string) => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
}

export type EntryListViewMode = 'grouped' | 'table' | 'cards';

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
  const [viewMode, setViewMode] = useState<EntryListViewMode>('grouped');

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

  // Grouped Entries by detailedProject + statItem
  const groupedEntries = useMemo(() => {
    const map = new Map<
      string,
      {
        detailedProject: string;
        statItem: string;
        items: SimulationEntry[];
        subtotalAmount: number;
      }
    >();

    for (let i = 0; i < filteredEntries.length; i++) {
      const item = filteredEntries[i];
      const key = `${item.detailedProject}|||${item.statItem}`;
      let group = map.get(key);
      if (!group) {
        group = {
          detailedProject: item.detailedProject,
          statItem: item.statItem,
          items: [],
          subtotalAmount: 0,
        };
        map.set(key, group);
      }
      group.items.push(item);
      group.subtotalAmount += (item.amount || 0);
    }

    return Array.from(map.values()).sort((a, b) => {
      const dpComp = a.detailedProject.localeCompare(b.detailedProject);
      if (dpComp !== 0) return dpComp;
      return a.statItem.localeCompare(b.statItem);
    });
  }, [filteredEntries]);

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

      {/* Filter Tabs & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        {/* Status Filter Tab Pills */}
        <div className="flex items-center gap-2">
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

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grouped'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="통계목별로 그룹화하여 목록을 확인합니다."
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>통계목별 그룹 ({groupedEntries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="간편 테이블 표 형식으로 확인합니다."
          >
            <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>테이블 뷰</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="카드 타일 형태로 확인합니다."
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
            <span>카드 뷰</span>
          </button>
        </div>
      </div>

      {/* Main Entries Content Area */}
      {filteredEntries.length > 0 ? (
        <div className="space-y-4">
          {/* 1. Grouped by Stat Item View */}
          {viewMode === 'grouped' && (
            <div className="space-y-3">
              {groupedEntries.map((group, groupIdx) => (
                <div
                  key={`sim-grp-${group.detailedProject}-${group.statItem}-${groupIdx}`}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs space-y-0"
                >
                  {/* Group Header */}
                  <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                        {group.detailedProject}
                      </span>
                      <span className="text-slate-400 text-xs">❯</span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1 font-mono">
                        <Tag className="w-3.5 h-3.5 text-slate-500" />
                        {group.statItem}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 font-sans">
                        등록 {group.items.length}건
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-500 font-sans text-xs">통계목 지출 소계:</span>
                      <span className="font-extrabold text-sm text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                        ₩{group.subtotalAmount.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>

                  {/* Group Items List */}
                  <div className="divide-y divide-slate-100">
                    {group.items.map((item, itemIdx) => {
                      const isSettled = item.status === 'SETTLED';
                      return (
                        <div
                          key={`sim-grp-item-${item.id}-${itemIdx}`}
                          className={`p-3.5 sm:px-4 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                            isSettled ? 'bg-slate-50/40 text-slate-500' : 'hover:bg-slate-50/80 text-slate-800'
                          }`}
                        >
                          {/* Left: Status, Name & Memo */}
                          <div className="flex items-start gap-3 min-w-[240px] flex-1">
                            {isSettled ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0 mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 집행 완료
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 shrink-0 mt-0.5">
                                <Clock className="w-3 h-3 text-purple-500" /> 집행 대기
                              </span>
                            )}
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className={`text-sm font-bold ${isSettled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                  {item.name}
                                </h5>
                                {item.createdAt && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {item.createdAt.split('T')[0]}
                                  </span>
                                )}
                              </div>
                              {item.memo && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{item.memo}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Middle: Unit Price x Qty */}
                          <div className="text-right font-mono text-xs text-slate-500 sm:w-44 shrink-0">
                            <span className="font-sans text-[11px]">단가 ₩{item.unitPrice.toLocaleString('ko-KR')}</span> × <span className="font-bold text-slate-700">{item.quantity}개</span>
                          </div>

                          {/* Right: Amount & Actions */}
                          <div className="flex items-center justify-end gap-3 sm:w-56 shrink-0">
                            <span className={`font-mono font-extrabold text-sm ${isSettled ? 'text-slate-400' : 'text-purple-700'}`}>
                              ₩{(item.amount || 0).toLocaleString('ko-KR')}
                            </span>

                            <div className="flex items-center gap-1">
                              {!isSettled && onSettleEntry && (
                                <button
                                  type="button"
                                  onClick={() => onSettleEntry(item.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-3xs transition-all active:scale-95"
                                  title="실제 지출로 집행 (정산)"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>정산</span>
                                </button>
                              )}
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. Compact Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-sm border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-xs">
                    <th className="py-3 px-4 min-w-[90px] text-center">상태</th>
                    <th className="py-3 px-4 min-w-[160px]">세부사업</th>
                    <th className="py-3 px-4 min-w-[140px]">통계목</th>
                    <th className="py-3 px-4 min-w-[220px]">항목명 / 비고</th>
                    <th className="py-3 px-4 text-right min-w-[130px]">단가 × 수량</th>
                    <th className="py-3 px-4 text-right min-w-[130px] text-purple-700">예정 금액</th>
                    <th className="py-3 px-4 text-center min-w-[110px]">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-mono">
                  {filteredEntries.map((item, itemIdx) => {
                    const isSettled = item.status === 'SETTLED';
                    return (
                      <tr
                        key={`sim-tbl-item-${item.id}-${itemIdx}`}
                        className={`transition-colors ${
                          isSettled ? 'bg-slate-50/40 text-slate-500' : 'hover:bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-sans">
                          {isSettled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> 완료
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> 대기
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-900">
                          {item.detailedProject}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-700">
                          {item.statItem}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <div className="space-y-0.5">
                            <span className={`font-bold ${isSettled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {item.name}
                            </span>
                            {item.memo && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 line-clamp-1">
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{item.memo}</span>
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          ₩{item.unitPrice.toLocaleString('ko-KR')} × {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-extrabold text-sm ${isSettled ? 'text-slate-400' : 'text-purple-700'}`}>
                            ₩{(item.amount || 0).toLocaleString('ko-KR')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <div className="flex items-center justify-center gap-1">
                            {!isSettled && onSettleEntry && (
                              <button
                                type="button"
                                onClick={() => onSettleEntry(item.id)}
                                className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-3xs transition-all active:scale-95"
                                title="실제 지출로 집행 (정산)"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>정산</span>
                              </button>
                            )}
                            {!isSettled && onEditEntry && (
                              <button
                                type="button"
                                onClick={() => onEditEntry(item)}
                                className="p-1 rounded-md bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 text-[10px] cursor-pointer transition-all shadow-3xs"
                                title="항목 수정"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteEntry(item.id)}
                              className="p-1 rounded-md bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-[10px] cursor-pointer transition-all shadow-3xs"
                              title="항목 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. Cards Grid View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEntries.map((item, itemIdx) => {
                const isSettled = item.status === 'SETTLED';
                return (
                  <div
                    key={`sim-card-item-${item.id}-${itemIdx}`}
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
                            <h4
                              className={`text-sm font-bold transition-colors line-clamp-2 ${
                                isSettled
                                  ? 'text-slate-500 line-through'
                                  : 'text-slate-900 group-hover:text-indigo-600'
                              }`}
                            >
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
                        <span
                          className={`font-extrabold text-sm ${
                            isSettled ? 'text-slate-400' : 'text-purple-700'
                          }`}
                        >
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
          )}
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
