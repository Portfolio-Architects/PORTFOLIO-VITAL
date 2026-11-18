'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory, BudgetEntry } from '@/types';
import { ChevronDown, Columns2, LayoutList, Search, CheckSquare, Square, Lock, CornerDownRight, Pencil } from 'lucide-react';
import { CategoryStats } from '@/hooks/useBudget';
import { ExpenseBatchToolbar } from './ExpenseBatchToolbar';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  onSettle?: (plannedEntryId: string, actualAmount: number) => void;
  batchUpdateEntries?: (ids: string[] | Array<{ id: string; [key: string]: any }>, updates?: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  onOpenExpenseEntry?: (entry: BudgetEntry) => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

function sortEntriesDesc(a: BudgetEntry, b: BudgetEntry): number {
  const dateA = a.date || '';
  const dateB = b.date || '';
  return dateB > dateA ? 1 : dateB < dateA ? -1 : 0;
}

function LedgerModalComponent({
  isOpen,
  onClose,
  categories,
  entries,
  getCategoryStats,
  onSettle,
  batchDeleteEntries,
  batchSettleEntries,
  onOpenExpenseEntry
}: LedgerModalProps) {
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  
  // Split View state (false = 단일 보기 / ledger, true = 대조 모드 / split)
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const viewMode = isSplitView ? 'split' : 'ledger';
  
  // Selected category ID for the right panel in split view
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  
  // Multi-select state
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  
  // Search filter inside Ledger Modal
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Group entries by categoryId in O(E) time
  const entriesByCatId = useMemo(() => {
    const map: Record<string, BudgetEntry[]> = {};
    for (let i = 0; i < categories.length; i++) {
      map[categories[i].id] = [];
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (map[e.categoryId]) {
        map[e.categoryId].push(e);
      }
    }
    return map;
  }, [categories, entries]);

  // Single-pass filtering, id array extraction, and Set generation (Zero intermediate array)
  const { filteredEntries, allVisibleEntryIds, filteredEntryIdSet } = useMemo(() => {
    const trimmed = debouncedSearchTerm.trim();
    if (!trimmed) {
      const ids: string[] = [];
      const set = new Set<string>();
      for (let i = 0; i < entries.length; i++) {
        const id = entries[i].id;
        ids.push(id);
        set.add(id);
      }
      return { filteredEntries: entries, allVisibleEntryIds: ids, filteredEntryIdSet: set };
    }

    const term = trimmed.toLowerCase();
    const result: BudgetEntry[] = [];
    const ids: string[] = [];
    const set = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (
        (e.purpose && e.purpose.toLowerCase().includes(term)) ||
        (e.docRegNum && e.docRegNum.toLowerCase().includes(term)) ||
        (e.memo && e.memo.toLowerCase().includes(term)) ||
        e.amount.toString().includes(term)
      ) {
        result.push(e);
        ids.push(e.id);
        set.add(e.id);
      }
    }

    return { filteredEntries: result, allVisibleEntryIds: ids, filteredEntryIdSet: set };
  }, [entries, debouncedSearchTerm]);

  const selectedEntryIdsSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Pre-calculate / memoize T-Account grouping and single-pass zero-allocation sorting
  const tAccountData = useMemo(() => {
    const result: Array<{
      cat: BudgetCategory;
      stats: CategoryStats | null;
      leftItems: BudgetEntry[];
      rightItems: BudgetEntry[];
    }> = [];

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const stats = getCategoryStats(cat.id);
      const rawEntries = entriesByCatId[cat.id] || [];

      const leftItems: BudgetEntry[] = [];
      const rightItems: BudgetEntry[] = [];

      for (let j = 0; j < rawEntries.length; j++) {
        const e = rawEntries[j];
        if (!filteredEntryIdSet.has(e.id)) continue;

        if (e.isPlanned && !e.isSettled) {
          leftItems.push(e);
        } else if (!e.isPlanned && e.actionType === 'issuance') {
          leftItems.push(e);
        } else if (!e.isPlanned && e.actionType !== 'issuance') {
          rightItems.push(e);
        }
      }

      if (leftItems.length > 0 || rightItems.length > 0) {
        leftItems.sort(sortEntriesDesc);
        rightItems.sort(sortEntriesDesc);
        result.push({ cat, stats, leftItems, rightItems });
      }
    }

    return result;
  }, [categories, getCategoryStats, entriesByCatId, filteredEntryIdSet]);

  // Toggle individual selection
  const toggleSelectEntry = useCallback((id: string) => {
    setSelectedEntryIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedEntryIds.length >= allVisibleEntryIds.length && allVisibleEntryIds.length > 0) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(allVisibleEntryIds);
    }
  }, [selectedEntryIds, allVisibleEntryIds]);

  const handleSettleSubmit = (id: string) => {
    if (onSettle && settleAmount) {
      onSettle(id, Number(settleAmount.replace(/,/g, '')));
      setSettlingId(null);
      setSettleAmount('');
    }
  };

  // Batch action handlers
  const handleBatchSettleApprove = useCallback(() => {
    if (selectedEntryIds.length === 0) return;
    if (batchSettleEntries) {
      batchSettleEntries(selectedEntryIds, 'SETTLED');
    }
    setSelectedEntryIds([]);
  }, [batchSettleEntries, selectedEntryIds]);

  const handleBatchStatusChange = useCallback((status: 'SETTLED' | 'PENDING' | 'REJECTED') => {
    if (selectedEntryIds.length === 0) return;
    if (batchSettleEntries) {
      batchSettleEntries(selectedEntryIds, status);
    }
    setSelectedEntryIds([]);
  }, [batchSettleEntries, selectedEntryIds]);

  const handleBatchDelete = useCallback(() => {
    if (selectedEntryIds.length === 0) return;
    if (window.confirm(`선택한 ${selectedEntryIds.length}개 항목을 정말 삭제하시겠습니까? 삭제된 내역은 복구할 수 없습니다.`)) {
      if (batchDeleteEntries) {
        batchDeleteEntries(selectedEntryIds);
      }
      setSelectedEntryIds([]);
    }
  }, [batchDeleteEntries, selectedEntryIds]);

  const getSubItemName = (cat: BudgetCategory, subItemId?: string) => {
    if (!subItemId || !cat.subItems) return null;
    for (const s of cat.subItems) {
      if (s.id === subItemId) return s.name;
      if (s.calculations) {
        for (const c of s.calculations) {
          if (c.id === subItemId) return c.name || s.name;
        }
      }
    }
    return null;
  };

  const selectedCategory = useMemo(() => {
    return (selectedCatId ? categoriesMap.get(selectedCatId) : undefined) || categories[0];
  }, [categoriesMap, selectedCatId, categories]);

  const selectedCatStats = useMemo(() => {
    return selectedCategory ? getCategoryStats(selectedCategory.id) : null;
  }, [selectedCategory, getCategoryStats]);

  const selectedCatEntries = useMemo(() => {
    return selectedCategory ? (entriesByCatId[selectedCategory.id] || []) : [];
  }, [selectedCategory, entriesByCatId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="원장 교차 검증 (가지출/실지출 대조)" size="4xl">
      <div className="space-y-4 relative">
        
        {/* Header Controls & View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          
          {/* Left: View mode toggles */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-3xs">
            <button
              onClick={() => setIsSplitView(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150 cursor-pointer ${
                !isSplitView
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutList size={14} />
              <span>단일 보기</span>
            </button>
            <button
              onClick={() => setIsSplitView(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150 cursor-pointer ${
                isSplitView
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Columns2 size={14} />
              <span>대조 모드</span>
            </button>
          </div>

          {/* Center/Right: Search & Select All */}
          <div className="flex items-center gap-3 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="지출 목적, 문서번호, 금액 실시간 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-text"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
              )}
            </div>

            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer shrink-0 shadow-3xs"
            >
              {selectedEntryIds.length >= allVisibleEntryIds.length && allVisibleEntryIds.length > 0 ? (
                <CheckSquare size={15} className="text-indigo-600" />
              ) : (
                <Square size={15} className="text-slate-400" />
              )}
              <span>전체 {selectedEntryIds.length > 0 ? `(${selectedEntryIds.length}/${allVisibleEntryIds.length})` : '선택'}</span>
            </button>
          </div>
        </div>

        {/* Notice Bar */}
        <div className="p-3.5 bg-teal-50 border border-teal-100 rounded-lg text-[13.5px] text-teal-800 font-medium leading-relaxed flex items-center justify-between">
          <div>
            💡 일상경비 및 일반 지출 예산 과목을 교차 대조합니다. 좌우 T계정 내역을 비교하거나 듀얼패널 뷰에서 세부 산출기초 한도와 비교하세요.
          </div>
          {selectedEntryIds.length > 0 && (
            <div className="text-xs font-bold text-teal-900 bg-teal-200/80 px-2.5 py-1 rounded-md">
              {selectedEntryIds.length}개 선택중
            </div>
          )}
        </div>

        {/* MODE 1: Standard Ledger T-Account View (Single View) */}
        {!isSplitView && (
          <div className="h-[65vh] overflow-y-auto space-y-4 pr-2 scrollbar-hide">
            {tAccountData.map((data, idx) => (
                <div key={data.cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
                  <details className="group marker:content-['']" open={idx === 0}>
                    <summary className="flex items-center justify-between p-4 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors list-none">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-[17px] font-extrabold text-slate-800 tracking-tight">
                            {data.cat.detailedProject || data.cat.unitProject || '미지정 사업'}
                          </div>
                          <div className="text-[13px] font-bold text-slate-600 bg-white border border-slate-200 shadow-sm px-2.5 py-0.5 rounded">
                            {data.cat.formationItem ? `[${data.cat.formationItem}] ` : ''}{data.cat.statItem || data.cat.name}
                          </div>
                        </div>
                        <div className="flex gap-4 text-[13px] font-semibold mt-1 flex-wrap">
                          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">계획(가배정): {formatN(data.stats?.planned || 0)}</span>
                          <span className="text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">결제된 지출: {formatN(data.stats?.spent || 0)}</span>
                          <span className={`px-2 py-0.5 rounded border ${
                            (data.stats?.remaining || 0) < 0 
                              ? 'text-red-600 bg-red-50 border-red-100' 
                              : 'text-blue-700 bg-blue-50 border-blue-100'
                          }`}>
                            실사용가능 잔액: {formatN(data.stats?.remaining || 0)}
                          </span>
                        </div>
                      </div>
                      <ChevronDown size={22} className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                    </summary>

                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-gray-200 bg-white">
                      {/* Left: 품의 및 가배정 */}
                      <div>
                        <div className="text-[13px] font-bold text-amber-700 mb-3 border-b border-amber-200 pb-2 flex justify-between items-center">
                          <span>가지출 단계 (원인행위/일상경비 교부)</span>
                          <div className="flex items-center gap-2">
                            <span>합계: {formatN(data.leftItems.reduce((acc, e) => acc + e.amount, 0))}</span>
                            <span className="bg-amber-100 text-amber-800 px-2 rounded-md text-[12px]">{data.leftItems.length}건</span>
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {data.leftItems.length === 0 && <li className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</li>}
                          {data.leftItems.map(e => {
                            const isSelected = selectedEntryIds.includes(e.id);
                            return (
                              <li key={e.id} className={`flex justify-between items-center text-[13px] p-3 rounded-lg border transition-colors duration-150 ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : e.isPlanned ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                                  <button
                                    onClick={() => toggleSelectEntry(e.id)}
                                    className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                                  >
                                    {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                                  </button>

                                  <div className="flex flex-col gap-1 truncate flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${e.isPlanned ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                                        {e.isPlanned ? '원인행위(품의)' : '일상경비 교부'}
                                      </span>
                                      <span className="text-gray-500 font-semibold text-xs">{e.date.replace(/-/g, '.')}</span>
                                    </div>
                                    <div className="flex items-center mt-0.5">
                                      {getSubItemName(data.cat, e.linkedSubItemId) && <span className="text-[11px] px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-800 border border-teal-200 mr-1.5 shrink-0">↳ {getSubItemName(data.cat, e.linkedSubItemId)}</span>}
                                      <span
                                        className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-gray-800 font-bold'} truncate cursor-pointer hover:underline`}
                                        title={e.purpose}
                                        onClick={() => onOpenExpenseEntry && onOpenExpenseEntry(e)}
                                      >
                                        {e.purpose}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="font-bold text-amber-700 text-[14px] font-mono">{formatN(e.amount)}</span>
                                  {e.isPlanned && onSettle && (
                                    settlingId === e.id ? (
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="text" 
                                          className="w-20 px-2 py-1 text-xs border rounded outline-none font-bold" 
                                          placeholder="실 지출액" 
                                          value={settleAmount} 
                                          onChange={(evt) => setSettleAmount(evt.target.value.replace(/[^0-9]/g, ''))}
                                          autoFocus
                                        />
                                        <button onClick={() => handleSettleSubmit(e.id)} className="px-2 py-1 bg-green-600 text-white text-[11px] font-bold rounded hover:bg-green-700">확인</button>
                                        <button onClick={() => setSettlingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-[11px] font-bold rounded hover:bg-gray-300">취소</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setSettlingId(e.id); setSettleAmount(e.amount.toString()); }} className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1">
                                        ✓ <span>결제 완료(정산)</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Right: 진성 지출 */}
                      <div>
                        <div className="text-[13px] font-bold text-teal-700 mb-3 border-b border-teal-200 pb-2 flex justify-between items-center">
                          <span>실제 지출 (정산 완료)</span>
                          <div className="flex items-center gap-2">
                            <span>합계: {formatN(data.rightItems.reduce((acc, e) => acc + e.amount, 0))}</span>
                            <span className="bg-teal-100 text-teal-800 px-2 rounded-md text-[12px]">{data.rightItems.length}건</span>
                          </div>
                        </div>
                        
                        {data.rightItems.length === 0 && (
                          <div className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</div>
                        )}
                        
                        {data.rightItems.length > 0 && (
                          <ul className="space-y-2">
                            {data.rightItems.map(e => {
                              const isSelected = selectedEntryIds.includes(e.id);
                              return (
                                <li key={e.id} className={`flex justify-between items-center text-[13px] p-3 rounded-lg border transition-colors shadow-sm ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/50 border-indigo-300' : 'bg-teal-50 hover:bg-teal-100 border-teal-200'}`}>
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                                    <button
                                      onClick={() => toggleSelectEntry(e.id)}
                                      className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                                    >
                                      {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                                    </button>

                                    <div className="flex flex-col gap-1 truncate flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {e.relatedPlanId && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-100 text-green-700">품의 정산건</span>}
                                        {e.actionType === 'daily_expense' && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-700 border border-teal-200">일상경비 지출</span>}
                                        <span className="text-gray-500 font-semibold text-xs">{e.date.replace(/-/g, '.')}</span>
                                      </div>
                                      <div className="flex items-center mt-0.5">
                                        {getSubItemName(data.cat, e.linkedSubItemId) && <span className="text-[11px] px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-800 border border-teal-200 mr-1.5 shrink-0">↳ {getSubItemName(data.cat, e.linkedSubItemId)}</span>}
                                        <span
                                          className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-gray-800 font-bold'} truncate cursor-pointer hover:underline`}
                                          title={e.purpose}
                                          onClick={() => onOpenExpenseEntry && onOpenExpenseEntry(e)}
                                        >
                                          {e.purpose}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-bold text-teal-700 text-[14px] font-mono">{formatN(e.amount)}</span>
                                    {onOpenExpenseEntry && (
                                      <button onClick={() => onOpenExpenseEntry(e)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="수정">
                                        <Pencil size={13} />
                                      </button>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              ))}
          </div>
        )}

        {/* MODE 2: Dual-Panel Split View (Left: Ledger Entries, Right: Budget Category Target & Details) */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[65vh]">
            
            {/* Left Panel (7 cols): Ledger Entries List */}
            <div className="lg:col-span-7 border border-slate-200 rounded-xl bg-white p-3 flex flex-col h-full shadow-sm">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutList size={14} className="text-indigo-600" />
                  지출/원장 내역 ({filteredEntries.length}건)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">클릭 시 오른쪽에 예산 목표 표시</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                {filteredEntries.length === 0 && (
                  <div className="text-center py-12 text-xs text-slate-400 font-medium">검색 결과가 없습니다.</div>
                )}
                {filteredEntries.map(e => {
                  const isSelected = selectedEntryIdsSet.has(e.id);
                  const isTargetCat = selectedCatId === e.categoryId;
                  const parentCat = categoriesMap.get(e.categoryId);

                  return (
                    <div
                      key={e.id}
                      onClick={() => setSelectedCatId(e.categoryId)}
                      className={`p-3 rounded-lg border transition-colors duration-150 cursor-pointer text-xs flex items-center justify-between ${
                        isTargetCat ? 'border-indigo-500 bg-indigo-50/30 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'
                      } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                        <button
                          onClick={(evt) => { evt.stopPropagation(); toggleSelectEntry(e.id); }}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                        >
                          {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                        </button>

                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              e.isPlanned ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-teal-100 text-teal-800 border border-teal-200'
                            }`}>
                              {e.isPlanned ? '품의(계획)' : '실지출'}
                            </span>
                            <span className="text-slate-500 font-semibold">{e.date.replace(/-/g, '.')}</span>
                            {parentCat && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {parentCat.detailedProject || parentCat.name}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-800 text-xs truncate" title={e.purpose}>
                            {e.purpose}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-extrabold text-indigo-700 text-sm font-mono">{formatN(e.amount)}원</span>
                        {onOpenExpenseEntry && (
                          <button
                            onClick={(evt) => { evt.stopPropagation(); onOpenExpenseEntry(e); }}
                            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 underline"
                          >
                            수정
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel (5 cols): Focused Budget Category Targets & Details Breakdown */}
            <div className="lg:col-span-5 border border-slate-200 rounded-xl bg-slate-50 p-3 flex flex-col h-full shadow-sm overflow-hidden">
              <div className="pb-2 mb-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Columns2 size={14} className="text-teal-600" />
                  선택 과목 예산목표 대조
                </span>
                {categories.length > 0 && (
                  <select
                    value={selectedCatId}
                    onChange={evt => setSelectedCatId(evt.target.value)}
                    className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 outline-none max-w-[180px] truncate"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.detailedProject || c.name} ({formatN(c.totalBudget)}원)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedCategory && selectedCatStats ? (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide text-xs">
                  {/* Category Summary Header */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-3xs space-y-2">
                    <div className="font-extrabold text-sm text-slate-800">
                      [{selectedCategory.formationItem || '편성목'}] {selectedCategory.statItem || selectedCategory.name}
                    </div>
                    <div className="text-slate-500 font-semibold text-[11px]">
                      {selectedCategory.policyProject} &gt; {selectedCategory.unitProject} &gt; {selectedCategory.detailedProject}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-mono">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[10px] block font-sans">총 편성 예산</span>
                        <span className="font-extrabold text-slate-800 text-sm">{formatN(selectedCatStats.totalBudget)}원</span>
                      </div>
                      <div className="bg-teal-50 p-2 rounded-lg border border-teal-100">
                        <span className="text-teal-600 text-[10px] block font-sans">가용 잔액</span>
                        <span className="font-extrabold text-teal-700 text-sm">{formatN(selectedCatStats.remaining)}원</span>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="text-blue-600 text-[10px] block font-sans">실 집행액</span>
                        <span className="font-extrabold text-blue-700 text-sm">{formatN(selectedCatStats.spent)}원</span>
                      </div>
                      <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                        <span className="text-amber-600 text-[10px] block font-sans">품의 진행액</span>
                        <span className="font-extrabold text-amber-700 text-sm">{formatN(selectedCatStats.planned)}원</span>
                      </div>
                    </div>

                    {/* Usage Rate Bar */}
                    <div className="pt-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
                        <span>예산 소진율</span>
                        <span>{selectedCatStats.usageRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-[width] duration-300"
                          style={{ width: `${Math.min(100, selectedCatStats.usageRate)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SubItems Breakdown */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-3xs space-y-2">
                    <div className="font-bold text-slate-700 text-xs flex items-center justify-between">
                      <span>산출기초 세부 항목</span>
                      <span className="text-slate-400 text-[11px]">{selectedCategory.subItems?.length || 0}개 항목</span>
                    </div>

                    {(!selectedCategory.subItems || selectedCategory.subItems.length === 0) ? (
                      <div className="text-slate-400 text-center py-4 text-[11px]">등록된 세부 산출기초가 없습니다.</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedCategory.subItems.map((sub, sIdx) => (
                          <div key={sIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                {sub.isLocked && <Lock size={12} className="text-rose-500" />}
                                {sub.name}
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{formatN(sub.amount)}원</span>
                            </div>
                            {sub.calculation && (
                              <div className="text-[10px] text-slate-500 font-mono">{sub.calculation}</div>
                            )}

                            {/* Calculations list inside SubItem */}
                            {sub.calculations && sub.calculations.length > 0 && (
                              <div className="pl-2 pt-1 space-y-1 border-t border-slate-200/60 mt-1">
                                {sub.calculations.map((calc, cIdx) => (
                                  <div key={cIdx} className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-600 flex items-center gap-1">
                                      <CornerDownRight size={10} className="text-slate-400" />
                                      {calc.name || calc.calculation}
                                    </span>
                                    <span className="font-semibold text-slate-700 font-mono">{formatN(calc.amount)}원</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Entries History inside Split View Right Panel */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-3xs space-y-2">
                    <div className="font-bold text-slate-700 text-xs">
                      연결된 지출 내역 ({selectedCatEntries.length}건)
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {selectedCatEntries.length === 0 && (
                        <div className="text-slate-400 text-center py-2 text-[11px]">지출 내역이 없습니다.</div>
                      )}
                      {selectedCatEntries.map(ce => (
                        <div key={ce.id} className="flex justify-between items-center text-[11px] p-1.5 rounded bg-slate-50 hover:bg-slate-100">
                          <span className="truncate text-slate-700 font-medium max-w-[180px]" title={ce.purpose}>{ce.purpose}</span>
                          <span className="font-bold text-indigo-700 font-mono">{formatN(ce.amount)}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-12 text-xs font-medium">선택된 예산 과목이 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {/* Sticky Batch Toolbar for Multi-Select */}
        <ExpenseBatchToolbar
          selectedCount={selectedEntryIds.length}
          onSettleApprove={handleBatchSettleApprove}
          onStatusChange={handleBatchStatusChange}
          onDelete={handleBatchDelete}
          onClearSelection={() => setSelectedEntryIds([])}
        />
      </div>
    </Modal>
  );
}

LedgerModalComponent.displayName = 'LedgerModal';
export const LedgerModal = React.memo(LedgerModalComponent);
