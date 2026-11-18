'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';
import { CategoryStats } from '@/hooks/useBudget';
import { ChevronDown, Pencil, Trash2, ArrowUp, ArrowDown, FileCheck } from 'lucide-react';
import { InlineEditCell } from './InlineEditCell';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export interface BudgetCategoryCardItemProps {
  cat: BudgetCategory;
  stats: CategoryStats | null;
  catEntries: BudgetEntry[];
  isFirst: boolean;
  isLast: boolean;
  onSwapCat?: (catId: string, dir: -1 | 1) => void;
  onEditCat: (cat: BudgetCategory) => void;
  onDeleteCat: (id: string) => void;
  onEditEntry: (entry: BudgetEntry) => void;
  updateCategory?: (id: string, updates: Partial<BudgetCategory>) => void;
  updateEntry?: (id: string, updates: Partial<BudgetEntry>) => void;
}

function areBudgetCategoryCardItemPropsEqual(
  prevProps: BudgetCategoryCardItemProps,
  nextProps: BudgetCategoryCardItemProps
): boolean {
  if (prevProps.isFirst !== nextProps.isFirst) return false;
  if (prevProps.isLast !== nextProps.isLast) return false;
  if (prevProps.onSwapCat !== nextProps.onSwapCat) return false;
  if (prevProps.onEditCat !== nextProps.onEditCat) return false;
  if (prevProps.onDeleteCat !== nextProps.onDeleteCat) return false;
  if (prevProps.onEditEntry !== nextProps.onEditEntry) return false;
  if (prevProps.updateCategory !== nextProps.updateCategory) return false;
  if (prevProps.updateEntry !== nextProps.updateEntry) return false;

  const pCat = prevProps.cat;
  const nCat = nextProps.cat;
  if (
    pCat.id !== nCat.id ||
    pCat.name !== nCat.name ||
    pCat.totalBudget !== nCat.totalBudget ||
    pCat.sortOrder !== nCat.sortOrder ||
    pCat.budgetType !== nCat.budgetType ||
    pCat.fundingSource !== nCat.fundingSource ||
    pCat.color !== nCat.color ||
    pCat.formationItem !== nCat.formationItem ||
    pCat.statItem !== nCat.statItem ||
    pCat.managementProject !== nCat.managementProject ||
    pCat.policyProject !== nCat.policyProject ||
    pCat.unitProject !== nCat.unitProject ||
    pCat.detailedProject !== nCat.detailedProject
  ) {
    return false;
  }

  const pSub = pCat.subItems || [];
  const nSub = nCat.subItems || [];
  if (pSub.length !== nSub.length) return false;
  for (let i = 0; i < pSub.length; i++) {
    if (pSub[i].name !== nSub[i].name || pSub[i].amount !== nSub[i].amount) return false;
  }

  const pSplits = pCat.fundingSplits || [];
  const nSplits = nCat.fundingSplits || [];
  if (pSplits.length !== nSplits.length) return false;
  for (let i = 0; i < pSplits.length; i++) {
    if (pSplits[i].source !== nSplits[i].source || pSplits[i].amount !== nSplits[i].amount) return false;
  }

  const pStats = prevProps.stats;
  const nStats = nextProps.stats;
  if (pStats === null && nStats !== null) return false;
  if (pStats !== null && nStats === null) return false;
  if (pStats && nStats) {
    if (
      pStats.totalBudget !== nStats.totalBudget ||
      pStats.spent !== nStats.spent ||
      pStats.planned !== nStats.planned ||
      pStats.remaining !== nStats.remaining ||
      pStats.usageRate !== nStats.usageRate ||
      pStats.generalSpent !== nStats.generalSpent ||
      pStats.dailyExpenseIssued !== nStats.dailyExpenseIssued ||
      pStats.dailyExpenseSpent !== nStats.dailyExpenseSpent ||
      pStats.dailyExpenseRemaining !== nStats.dailyExpenseRemaining
    ) {
      return false;
    }
  }

  const pEntries = prevProps.catEntries;
  const nEntries = nextProps.catEntries;
  if (pEntries.length !== nEntries.length) return false;
  for (let i = 0; i < pEntries.length; i++) {
    if (
      pEntries[i].id !== nEntries[i].id ||
      pEntries[i].amount !== nEntries[i].amount ||
      pEntries[i].date !== nEntries[i].date ||
      pEntries[i].purpose !== nEntries[i].purpose ||
      pEntries[i].isPlanned !== nEntries[i].isPlanned ||
      pEntries[i].isSettled !== nEntries[i].isSettled ||
      pEntries[i].actionType !== nEntries[i].actionType
    ) {
      return false;
    }
  }

  return true;
}

const BudgetCategoryCardItemComponent = ({
  cat,
  stats,
  catEntries,
  isFirst,
  isLast,
  onSwapCat,
  onEditCat,
  onDeleteCat,
  onEditEntry,
  updateCategory,
  updateEntry
}: BudgetCategoryCardItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const isVisible = useDocumentVisibility();

  const { generalEntries, dailyExpenseEntries, totalIssuance, totalDailyExpense, dailyRemaining } = useMemo(() => {
    const gen: BudgetEntry[] = [];
    const combinedDaily: BudgetEntry[] = [];
    let totIssuance = 0;
    let totDailyExp = 0;

    for (let i = 0; i < catEntries.length; i++) {
      const e = catEntries[i];
      if (e.actionType === 'issuance') {
        combinedDaily.push(e);
        totIssuance += e.amount;
      } else if (e.actionType === 'daily_expense') {
        combinedDaily.push(e);
        totDailyExp += e.amount;
      } else {
        gen.push(e);
      }
    }

    const sortByDateDesc = (a: BudgetEntry, b: BudgetEntry) => {
      const tsA = Date.parse(a.date) || 0;
      const tsB = Date.parse(b.date) || 0;
      return tsB - tsA;
    };

    gen.sort(sortByDateDesc);
    combinedDaily.sort(sortByDateDesc);

    return {
      generalEntries: gen,
      dailyExpenseEntries: combinedDaily,
      totalIssuance: totIssuance,
      totalDailyExpense: totDailyExp,
      dailyRemaining: totIssuance - totDailyExp
    };
  }, [catEntries]);

  const { cellIdList, cellIdIndexMap } = useMemo(() => {
    const list: string[] = [`${cat.id}:statItem`];
    if (isExpanded) {
      list.push(`${cat.id}:totalBudget`);
      if (cat.subItems) {
        for (let idx = 0; idx < cat.subItems.length; idx++) {
          list.push(`${cat.id}:sub:${idx}:name`);
          list.push(`${cat.id}:sub:${idx}:amount`);
        }
      }
      for (let i = 0; i < generalEntries.length; i++) {
        list.push(`${generalEntries[i].id}:cat_purpose`);
        list.push(`${generalEntries[i].id}:cat_amount`);
      }
      for (let i = 0; i < dailyExpenseEntries.length; i++) {
        list.push(`${dailyExpenseEntries[i].id}:cat_daily_purpose`);
        list.push(`${dailyExpenseEntries[i].id}:cat_daily_amount`);
      }
    }
    const map = new Map<string, number>();
    for (let i = 0; i < list.length; i++) {
      map.set(list[i], i);
    }
    return { cellIdList: list, cellIdIndexMap: map };
  }, [cat.id, cat.subItems, isExpanded, generalEntries, dailyExpenseEntries]);

  const handleCellNavigate = useCallback((currentCellId: string, direction: 'next' | 'prev') => {
    const index = cellIdIndexMap.get(currentCellId) ?? -1;
    if (index === -1) return;
    let targetIndex = direction === 'next' ? index + 1 : index - 1;
    if (targetIndex >= cellIdList.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = cellIdList.length - 1;
    setActiveCellId(cellIdList[targetIndex]);
  }, [cellIdList, cellIdIndexMap]);

  const handleSubItemUpdate = useCallback((subIdx: number, field: 'name' | 'amount', newValue: string | number) => {
    if (!updateCategory || !cat.subItems) return;
    const newSubItems = [];
    for (let i = 0; i < cat.subItems.length; i++) {
      const sub = cat.subItems[i];
      if (i !== subIdx) {
        newSubItems.push(sub);
      } else if (field === 'amount') {
        const cleaned = String(newValue).replace(/,/g, '').replace(/원/g, '').trim();
        const numAmt = isNaN(Number(cleaned)) ? 0 : Number(cleaned);
        newSubItems.push({ ...sub, amount: numAmt });
      } else {
        newSubItems.push({ ...sub, name: String(newValue) });
      }
    }
    updateCategory(cat.id, { subItems: newSubItems });
  }, [cat.id, cat.subItems, updateCategory]);

  if (!stats) return null;

  return (
    <div className="group/item relative bg-white border border-slate-200/80 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className={`flex items-center justify-between gap-2 ${isExpanded ? 'mb-3' : 'mb-0'}`}>
        <div 
          className="text-[15px] font-bold flex items-center gap-2.5 text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors select-none min-w-0 flex-1" 
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#4A6CF7' }} />
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            {cat.formationItem && <span className="text-slate-400 font-mono text-[13px]">[{cat.formationItem}]</span>}
            <InlineEditCell
              cellId={`${cat.id}:statItem`}
              value={cat.statItem || cat.name}
              type="text"
              isEditing={activeCellId === `${cat.id}:statItem`}
              onStartEdit={() => setActiveCellId(`${cat.id}:statItem`)}
              onCancelEdit={() => setActiveCellId(null)}
              onSave={(newVal) => updateCategory && updateCategory(cat.id, { statItem: String(newVal) })}
              onNavigate={(dir) => handleCellNavigate(`${cat.id}:statItem`, dir)}
              className="font-bold text-slate-800 hover:text-indigo-600 text-[15px]"
            />
            {cat.managementProject && <span className="text-slate-500 font-semibold text-[13px]">({cat.managementProject})</span>}

            {/* Minimalist summary pill: total budget, execution rate, remaining rate, remaining won */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-600 text-xs sm:text-[13px] font-mono tabular-nums flex-wrap" title="예산 총액 / 집행률 / 미집행률 / 잔여액">
              <span>예산 {formatN(cat.totalBudget)}원</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-indigo-600">집행 {(stats.usageRate || 0).toFixed(1)}%</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-emerald-700">미집행 {(cat.totalBudget > 0 ? (stats.remaining / cat.totalBudget * 100) : 0).toFixed(1)}%</span>
              <span className="text-slate-300">|</span>
              <span className="font-black text-slate-900">잔여 {formatN(stats.remaining)}원</span>
            </span>

            <div className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={15} />
            </div>
          </div>
          {cat.budgetType && cat.budgetType !== '본예산' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ml-1 flex-shrink-0 border ${cat.budgetType === '간주예산' ? 'bg-purple-50/70 text-purple-700 border-purple-200/60' : 'bg-rose-50/70 text-rose-700 border-rose-200/60'}`}>
              {cat.budgetType}
            </span>
          )}
          {cat.fundingSource && cat.fundingSource.replace(/구비\(자체\)/g, '구비') !== '구비' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded ml-0.5 flex-shrink-0 border bg-slate-50 text-slate-600 border-slate-200/80">
              {cat.fundingSource.replace(/구비\(자체\)/g, '구비')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0">
          {onSwapCat && !isFirst && (
            <button onClick={(e) => { e.stopPropagation(); onSwapCat(cat.id, -1); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="위로 이동"><ArrowUp size={13} /></button>
          )}
          {onSwapCat && !isLast && (
            <button onClick={(e) => { e.stopPropagation(); onSwapCat(cat.id, 1); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="아래로 이동"><ArrowDown size={13} /></button>
          )}
          <button onClick={() => onEditCat(cat)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="수정"><Pencil size={13} /></button>
          <button onClick={() => onDeleteCat(cat.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="삭제"><Trash2 size={13} /></button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-100">
          {/* Minimalist Execution & Remaining Summary Strip */}
          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/60 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-slate-500 font-semibold text-[13px]">사용 (집행+품의)</span>
                  <span className="text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded bg-white border border-slate-200/80 text-indigo-600" title="통계목 집행률">
                    집행 {(stats.usageRate || 0).toFixed(1)}%
                  </span>
                </div>
                <span className="text-slate-800 font-bold tracking-tight text-base font-mono tabular-nums">
                  {formatN(stats.spent + stats.planned)} <span className="text-slate-300 font-normal mx-0.5">/</span>{' '}
                  <InlineEditCell
                    cellId={`${cat.id}:totalBudget`}
                    value={cat.totalBudget}
                    type="number"
                    isEditing={activeCellId === `${cat.id}:totalBudget`}
                    onStartEdit={() => setActiveCellId(`${cat.id}:totalBudget`)}
                    onCancelEdit={() => setActiveCellId(null)}
                    onSave={(newVal) => {
                      const cleanNum = Number(String(newVal).replace(/,/g, '').trim());
                      if (updateCategory) updateCategory(cat.id, { totalBudget: isNaN(cleanNum) ? 0 : cleanNum });
                    }}
                    onNavigate={(dir) => handleCellNavigate(`${cat.id}:totalBudget`, dir)}
                    displayFormatter={(v) => formatN(Number(v))}
                    className="inline-block text-slate-900 font-bold font-mono tabular-nums"
                    inputClassName="w-32 text-right"
                  />
                </span>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded bg-white border border-slate-200/80 text-emerald-700" title="통계목 미집행률(잔여율)">
                    미집행 {(cat.totalBudget > 0 ? (stats.remaining / cat.totalBudget * 100) : 0).toFixed(1)}%
                  </span>
                  <span className="text-slate-500 font-semibold text-[13px]">잔여금액</span>
                </div>
                <span className={`font-black tracking-tight text-[17px] font-mono tabular-nums ${stats.remaining < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatN(stats.remaining)}원
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-2 bg-slate-200/70 rounded-full overflow-hidden flex" title={`집행률: ${(stats.usageRate || 0).toFixed(1)}% | 미집행률: ${(cat.totalBudget > 0 ? (stats.remaining / cat.totalBudget * 100) : 0).toFixed(1)}%`}>
                <div 
                  className={`h-full ${isVisible ? 'transition-[width] duration-500 ease-out' : ''} ${(stats.usageRate || 0) >= 95 ? 'bg-rose-500' : (stats.usageRate || 0) >= 80 ? 'bg-amber-500' : 'bg-slate-800'}`} 
                  style={{ width: `${Math.min(100, stats.usageRate || 0)}%` }} 
                />
                <div 
                  className={`h-full bg-emerald-500/60 ${isVisible ? 'transition-[width] duration-500' : ''}`} 
                  style={{ width: `${Math.max(0, Math.min(100 - Math.min(100, stats.usageRate || 0), cat.totalBudget > 0 ? (stats.remaining / cat.totalBudget * 100) : 0))}%` }} 
                />
              </div>
              <span className="text-[12.5px] font-bold text-slate-600 w-12 text-right font-mono tabular-nums">{(stats.usageRate || 0).toFixed(1)}%</span>
            </div>
          </div>

          {/* Calculation Basis (Sub-Items) */}
          {cat.subItems && cat.subItems.length > 0 && (
            <div className="bg-white border border-slate-200/70 rounded-xl p-4">
              <div className="text-[15px] font-bold text-slate-600 mb-2.5 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-slate-400 rounded-full"/> 산출 기초 (세부 항목)
              </div>
              <div className="divide-y divide-slate-100">
                {cat.subItems.map((sub, subIdx) => (
                  <div key={subIdx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                    <div className="flex flex-col">
                      <div className="flex justify-between items-baseline gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {sub.prefix && <span className="text-[15px] bg-slate-100 border border-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded shrink-0">{sub.prefix}</span>}
                          <InlineEditCell
                            cellId={`${cat.id}:sub:${subIdx}:name`}
                            value={sub.name}
                            type="text"
                            isEditing={activeCellId === `${cat.id}:sub:${subIdx}:name`}
                            onStartEdit={() => setActiveCellId(`${cat.id}:sub:${subIdx}:name`)}
                            onCancelEdit={() => setActiveCellId(null)}
                            onSave={(newVal) => handleSubItemUpdate(subIdx, 'name', newVal)}
                            onNavigate={(dir) => handleCellNavigate(`${cat.id}:sub:${subIdx}:name`, dir)}
                            className="text-[18px] text-slate-800 font-black tracking-tight"
                          />
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <InlineEditCell
                            cellId={`${cat.id}:sub:${subIdx}:amount`}
                            value={sub.amount}
                            type="number"
                            isEditing={activeCellId === `${cat.id}:sub:${subIdx}:amount`}
                            onStartEdit={() => setActiveCellId(`${cat.id}:sub:${subIdx}:amount`)}
                            onCancelEdit={() => setActiveCellId(null)}
                            onSave={(newVal) => handleSubItemUpdate(subIdx, 'amount', newVal)}
                            onNavigate={(dir) => handleCellNavigate(`${cat.id}:sub:${subIdx}:amount`, dir)}
                            displayFormatter={(v) => Number(v) > 0 ? `${formatN(Number(v))}원` : '-'}
                            className="font-black text-slate-900 tracking-tight text-[17px] font-mono tabular-nums"
                            inputClassName="w-32 text-right"
                          />
                        </div>
                      </div>
                      
                      {!sub.calculations || sub.calculations.length === 0 ? (
                        sub.calculation && <div className="text-[13px] text-slate-500 font-mono tracking-tight mt-1 pl-0.5">{sub.calculation}</div>
                      ) : (
                        <div className="mt-2 bg-slate-50/70 border-l-2 border-slate-300 rounded-r-lg py-2 flex flex-col gap-1.5 ml-1 text-[13px] text-slate-600">
                          {sub.calculations.map((calc, cIdx) => (
                            <div key={cIdx} className="flex flex-col px-3 py-1 border-b border-slate-200/40 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex gap-2 items-center flex-1 min-w-0">
                                  {calc.name && <span className="font-semibold text-slate-700 truncate">{calc.name}</span>}
                                  {calc.calculation && <span className="font-mono text-[12px] text-slate-400 truncate">({calc.calculation})</span>}
                                </div>
                                <span className="font-mono font-bold text-slate-700 tabular-nums shrink-0">{formatN(calc.amount)}원</span>
                              </div>
                              {calc.isCustomFunding && calc.fundingSplits && calc.fundingSplits.length > 0 && (
                                <div className="inline-flex w-fit items-center gap-1.5 mt-1 bg-white px-2 py-0.5 rounded border border-slate-200/80 whitespace-nowrap text-xs">
                                  <span className="text-slate-500 font-semibold">개별재원</span>
                                  {calc.fundingSplits.map((fs, fsIdx) => (
                                    <span key={fsIdx} className="text-slate-700 font-medium flex items-center gap-1 border-r border-slate-200 last:border-0 pr-1.5 last:pr-0">
                                      <span className="text-slate-500">{fs.source.replace('구비(자체)', '구비')}</span>
                                      <span className="font-mono font-semibold tabular-nums">{formatN(fs.amount)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {sub.isCustomFunding && sub.fundingSplits && sub.fundingSplits.length > 0 && (
                      <div className="inline-flex w-fit items-center gap-1.5 mt-1 bg-slate-50 px-2.5 py-1 rounded border border-slate-200/80 whitespace-nowrap text-xs">
                        <span className="text-slate-500 font-semibold">개별재원</span>
                        {sub.fundingSplits.map((fs, fsIdx) => (
                          <span key={fsIdx} className="text-slate-700 font-medium flex items-center gap-1 border-r border-slate-200 last:border-0 pr-1.5 last:pr-0">
                            <span className="text-slate-500">{fs.source.replace('구비(자체)', '구비')}</span>
                            <span className="font-mono font-semibold tabular-nums">{formatN(fs.amount)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Expenditure Entries */}
          {generalEntries.length > 0 && (
            <div className="bg-slate-50/50 border border-slate-200/70 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5 pb-2 border-b border-slate-200/60">
                <div className="text-[14px] sm:text-[15px] font-bold text-slate-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"/> 일반 지출 (품의 및 집행) 현황
                </div>
                <div className="flex bg-white px-2.5 py-1 rounded border border-slate-200/80 text-[13px] gap-2 items-center flex-wrap font-mono tabular-nums">
                  <span className="text-slate-600">진행중 품의: <strong className="text-slate-900">{formatN(stats.planned)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-600">완료된 지출: <strong className="text-indigo-600">{formatN(stats.generalSpent)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700">일반 잔액: <strong className="text-slate-900">{formatN(stats.remaining)}</strong></span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                {generalEntries.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-[15.5px] hover:bg-white py-2 px-2.5 rounded-md transition-colors border border-transparent hover:border-slate-200/80">
                    <div className="flex gap-2.5 items-center truncate pr-2 min-w-0 flex-1">
                      <span onClick={() => onEditEntry(e)} title="상세 모달 수정" className={`font-bold px-2 py-0.5 rounded text-xs cursor-pointer hover:opacity-80 shrink-0 ${e.isPlanned && !e.isSettled ? 'bg-amber-50 text-amber-700 border border-amber-200/80' : 'bg-slate-100 text-slate-700 border border-slate-200/80'}`}>
                        {e.isPlanned && !e.isSettled ? '품의(원인행위)' : '실지출'}
                      </span>
                      <span className="text-slate-400 font-mono text-[13px] shrink-0">{e.date.replace(/-/g, '.')}</span>
                      <InlineEditCell
                        cellId={`${e.id}:cat_purpose`}
                        value={e.purpose || ''}
                        type="text"
                        isEditing={activeCellId === `${e.id}:cat_purpose`}
                        onStartEdit={() => setActiveCellId(`${e.id}:cat_purpose`)}
                        onCancelEdit={() => setActiveCellId(null)}
                        onSave={(newVal) => updateEntry && updateEntry(e.id, { purpose: String(newVal) })}
                        onNavigate={(dir) => handleCellNavigate(`${e.id}:cat_purpose`, dir)}
                        className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-amber-700 font-bold' : 'text-slate-800 font-semibold'} truncate`}
                      />
                    </div>
                    <InlineEditCell
                      cellId={`${e.id}:cat_amount`}
                      value={e.amount}
                      type="number"
                      isEditing={activeCellId === `${e.id}:cat_amount`}
                      onStartEdit={() => setActiveCellId(`${e.id}:cat_amount`)}
                      onCancelEdit={() => setActiveCellId(null)}
                      onSave={(newVal) => {
                        const cleanNum = Number(String(newVal).replace(/,/g, '').trim());
                        if (updateEntry) updateEntry(e.id, { amount: isNaN(cleanNum) ? 0 : cleanNum });
                      }}
                      onNavigate={(dir) => handleCellNavigate(`${e.id}:cat_amount`, dir)}
                      displayFormatter={(v) => `${formatN(Number(v))}원`}
                      className="font-bold text-slate-900 tabular-nums shrink-0 font-mono"
                      inputClassName="w-32 text-right"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Expense Entries */}
          {(totalIssuance > 0 || totalDailyExpense > 0) && (
            <div className="bg-slate-50/50 border border-slate-200/70 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5 pb-2 border-b border-slate-200/60">
                <div className="text-[14px] sm:text-[15px] font-bold text-slate-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"/> 일상경비 (교부액) 집행 현황
                </div>
                <div className="flex bg-white px-2.5 py-1 rounded border border-slate-200/80 text-[13px] gap-2 items-center flex-wrap font-mono tabular-nums">
                  <span className="text-slate-600">총 교부액: <strong className="text-slate-900">{formatN(totalIssuance)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-600">집행액: <strong className="text-rose-600">{formatN(totalDailyExpense)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700">교부잔액: <strong className="text-emerald-700">{formatN(dailyRemaining)}</strong></span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                {dailyExpenseEntries.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-[15px] hover:bg-white py-2 px-2.5 rounded-md transition-colors border border-transparent hover:border-slate-200/80">
                    <div className="flex gap-2.5 items-center truncate pr-2 min-w-0 flex-1">
                      <span onClick={() => onEditEntry(e)} title="상세 모달 수정" className={`font-bold px-2 py-0.5 rounded text-xs cursor-pointer hover:opacity-80 shrink-0 ${e.actionType === 'issuance' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-rose-50/70 text-rose-700 border border-rose-200/70'}`}>
                        {e.actionType === 'issuance' ? '교부' : '지출'}
                      </span>
                      <span className="text-slate-400 font-mono text-[13px] shrink-0">{e.date.replace(/-/g, '.')}</span>
                      <InlineEditCell
                        cellId={`${e.id}:cat_daily_purpose`}
                        value={e.purpose || ''}
                        type="text"
                        isEditing={activeCellId === `${e.id}:cat_daily_purpose`}
                        onStartEdit={() => setActiveCellId(`${e.id}:cat_daily_purpose`)}
                        onCancelEdit={() => setActiveCellId(null)}
                        onSave={(newVal) => updateEntry && updateEntry(e.id, { purpose: String(newVal) })}
                        onNavigate={(dir) => handleCellNavigate(`${e.id}:cat_daily_purpose`, dir)}
                        className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-amber-700 font-bold' : 'text-slate-800 font-semibold'} truncate`}
                      />
                    </div>
                    <InlineEditCell
                      cellId={`${e.id}:cat_daily_amount`}
                      value={e.amount}
                      type="number"
                      isEditing={activeCellId === `${e.id}:cat_daily_amount`}
                      onStartEdit={() => setActiveCellId(`${e.id}:cat_daily_amount`)}
                      onCancelEdit={() => setActiveCellId(null)}
                      onSave={(newVal) => {
                        const cleanNum = Number(String(newVal).replace(/,/g, '').trim());
                        if (updateEntry) updateEntry(e.id, { amount: isNaN(cleanNum) ? 0 : cleanNum });
                      }}
                      onNavigate={(dir) => handleCellNavigate(`${e.id}:cat_daily_amount`, dir)}
                      displayFormatter={(v) => `${formatN(Number(v))}원`}
                      className="font-bold text-slate-900 tabular-nums shrink-0 font-mono"
                      inputClassName="w-32 text-right"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Funding Splits */}
          {cat.fundingSplits && cat.fundingSplits.length > 0 && (
            <div className="bg-slate-50/50 border border-slate-200/70 rounded-xl p-4">
              <div className="text-[14px] font-bold text-slate-600 mb-2 flex items-center gap-1.5"><FileCheck size={14} className="text-slate-400"/> 재원 분할 내역</div>
              <div className="divide-y divide-slate-200/50">
                {cat.fundingSplits.map((split, splitIdx) => {
                  const splitRatio = cat.totalBudget > 0 ? (split.amount / cat.totalBudget) * 100 : 0;
                  return (
                    <div key={splitIdx} className="flex justify-between items-center text-[13px] py-1.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="font-semibold text-slate-700">{split.source.replace('구비(자체)', '구비')}</span>
                        <span className="text-xs bg-white border border-slate-200/80 text-slate-500 px-2 py-0.5 rounded font-mono tabular-nums">{splitRatio.toFixed(1)}%</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{formatN(split.amount)}원</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const BudgetCategoryCardItem = React.memo<BudgetCategoryCardItemProps>(
  BudgetCategoryCardItemComponent,
  areBudgetCategoryCardItemPropsEqual
);

BudgetCategoryCardItem.displayName = 'BudgetCategoryCardItem';
