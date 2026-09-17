'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType } from '@/types';
import { ChevronDown, ChevronUp, Pencil, Trash2, FileCheck, FilePlus2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { CategoryStats } from '@/hooks/useBudget';
import { BudgetCategoryCardItem } from './BudgetCategoryCardItem';
import { InlineEditCell } from './InlineEditCell';
import { useVirtualList } from '@/hooks/useVirtualList';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export const ACTION_TYPE_CONFIG: Record<BudgetActionType, { label: string; badge: string; badgeBg: string; icon: React.ElementType }> = {
  general: { label: '일반 지출', badge: '일반', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
  issuance: { label: '일상경비 교부', badge: '교부', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  daily_expense: { label: '일상경비 지출', badge: '경비지출', badgeBg: 'bg-teal-100 text-teal-700', icon: FileCheck },
  transfer: { label: '이용/전용', badge: '이용/전용', badgeBg: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  correction: { label: '정정', badge: '정정', badgeBg: 'bg-orange-100 text-orange-700', icon: Pencil },
  settle: { label: '정산(결산)', badge: '정산', badgeBg: 'bg-gray-100 text-gray-700', icon: CheckCircle2 }
};

interface PolicyGroupCardProps {
  group: { policyName: string; cats: BudgetCategory[] };
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  deleteCategory: (id: string) => void;
  deleteEntry: (id: string) => void;
  openEditCat: (cat: BudgetCategory) => void;
  openAddCat?: (template: Partial<BudgetCategory>) => void;
  openEditEntry: (entry: BudgetEntry) => void;
  openBatchEdit?: (title: string, cats: BudgetCategory[]) => void;
  updateCategory?: (id: string, updates: Partial<BudgetCategory>) => void;
  updateEntry?: (id: string, updates: Partial<BudgetEntry>) => void;
  hidePolicyHeader?: boolean;
}

function arePolicyGroupCardPropsEqual(
  prevProps: PolicyGroupCardProps,
  nextProps: PolicyGroupCardProps
): boolean {
  if (prevProps === nextProps) return true;
  if (prevProps.hidePolicyHeader !== nextProps.hidePolicyHeader) return false;
  if (prevProps.deleteCategory !== nextProps.deleteCategory) return false;
  if (prevProps.deleteEntry !== nextProps.deleteEntry) return false;
  if (prevProps.openEditCat !== nextProps.openEditCat) return false;
  if (prevProps.openAddCat !== nextProps.openAddCat) return false;
  if (prevProps.openEditEntry !== nextProps.openEditEntry) return false;
  if (prevProps.openBatchEdit !== nextProps.openBatchEdit) return false;
  if (prevProps.updateCategory !== nextProps.updateCategory) return false;
  if (prevProps.updateEntry !== nextProps.updateEntry) return false;

  if (prevProps.group === nextProps.group && prevProps.entries === nextProps.entries) return true;
  if (prevProps.group.policyName !== nextProps.group.policyName) return false;
  
  const pCats = prevProps.group.cats;
  const nCats = nextProps.group.cats;
  if (pCats.length !== nCats.length) return false;
  for (let i = 0; i < pCats.length; i++) {
    if (
      pCats[i].id !== nCats[i].id ||
      pCats[i].totalBudget !== nCats[i].totalBudget ||
      pCats[i].sortOrder !== nCats[i].sortOrder ||
      pCats[i].name !== nCats[i].name ||
      pCats[i].budgetType !== nCats[i].budgetType ||
      pCats[i].fundingSource !== nCats[i].fundingSource
    ) {
      return false;
    }
  }

  if (prevProps.entries === nextProps.entries) return true;

  const catIdSet = new Set<string>();
  for (let i = 0; i < nCats.length; i++) {
    catIdSet.add(nCats[i].id);
  }

  // Count relevant entries without intermediate array allocations
  let pCount = 0;
  for (let i = 0; i < prevProps.entries.length; i++) {
    if (catIdSet.has(prevProps.entries[i].categoryId)) pCount++;
  }
  let nCount = 0;
  for (let i = 0; i < nextProps.entries.length; i++) {
    if (catIdSet.has(nextProps.entries[i].categoryId)) nCount++;
  }
  if (pCount !== nCount) return false;

  // Stream two-pointer comparison (Zero-Allocation)
  let pIdx = 0;
  let nIdx = 0;
  while (pIdx < prevProps.entries.length && nIdx < nextProps.entries.length) {
    while (pIdx < prevProps.entries.length && !catIdSet.has(prevProps.entries[pIdx].categoryId)) pIdx++;
    while (nIdx < nextProps.entries.length && !catIdSet.has(nextProps.entries[nIdx].categoryId)) nIdx++;
    if (pIdx < prevProps.entries.length && nIdx < nextProps.entries.length) {
      const p = prevProps.entries[pIdx];
      const n = nextProps.entries[nIdx];
      if (
        p.id !== n.id ||
        p.amount !== n.amount ||
        p.date !== n.date ||
        p.purpose !== n.purpose ||
        p.docRegNum !== n.docRegNum
      ) {
        return false;
      }
      pIdx++;
      nIdx++;
    }
  }

  return true;
}

const PolicyGroupCardComponent = ({
  group,
  entries,
  getCategoryStats,
  deleteCategory,
  deleteEntry,
  openEditCat,
  openAddCat,
  openEditEntry,
  openBatchEdit,
  updateCategory,
  updateEntry,
  hidePolicyHeader = false
}: PolicyGroupCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useDocumentVisibility();

  const { policyName, cats } = group;

  const { totalBudget, spent, planned, remaining, usageRate, groupEntries, entriesByCatId, groupedByDetail, groupFunding, groupTypes, catMap } = useMemo(() => {
    let tBudget = 0;
    let tSpent = 0;
    let tPlanned = 0;
    let tRemaining = 0;

    const catIdSet = new Set<string>();
    const entriesByCatMap: Record<string, BudgetEntry[]> = {};
    const categoryLookupMap: Record<string, BudgetCategory> = {};
    const groupsMap: Record<string, BudgetCategory[]> = {};
    const groupFundingSet = new Set<string>();
    const groupTypesSet = new Set<string>();

    for (let i = 0; i < cats.length; i++) {
      const c = cats[i];
      tBudget += c.totalBudget;
      catIdSet.add(c.id);
      entriesByCatMap[c.id] = [];
      categoryLookupMap[c.id] = c;

      const st = getCategoryStats(c.id);
      if (st) {
        tSpent += st.spent;
        tPlanned += st.planned;
        tRemaining += st.remaining;
      }

      const detail = c.detailedProject || '분류되지 않은 세부사업';
      let gList = groupsMap[detail];
      if (!gList) {
        gList = [];
        groupsMap[detail] = gList;
      }
      gList.push(c);

      if (c.fundingSource) {
        const clean = c.fundingSource.replace(/\([^)]+\)/g, '');
        const parts = clean.split(',');
        for (let p = 0; p < parts.length; p++) {
          const t = parts[p].trim();
          if (t && t !== '구비') groupFundingSet.add(t);
        }
      }

      if (c.budgetType && c.budgetType !== '본예산') {
        groupTypesSet.add(c.budgetType);
      }
    }

    const rate = tBudget > 0 ? ((tSpent + tPlanned) / tBudget) * 100 : 0;

    const gEntries: BudgetEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (catIdSet.has(e.categoryId)) {
        gEntries.push(e);
        entriesByCatMap[e.categoryId]?.push(e);
      }
    }

    gEntries.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

    const groups = Object.keys(groupsMap).map(detail => {
      const detailCats = groupsMap[detail];
      detailCats.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

      let detailTotalBudget = 0;
      let detailTotalSpent = 0;
      let detailTotalPlanned = 0;
      let detailDailyIssued = 0;
      let detailDailySpent = 0;
      let detailDailyRemaining = 0;

      const detailFundingSet = new Set<string>();
      const detailTypesSet = new Set<string>();

      for (let i = 0; i < detailCats.length; i++) {
        const c = detailCats[i];
        detailTotalBudget += c.totalBudget;

        const st = getCategoryStats(c.id);
        if (st) {
          detailTotalSpent += st.spent;
          detailTotalPlanned += st.planned;
          detailDailyIssued += st.dailyExpenseIssued;
          detailDailySpent += st.dailyExpenseSpent;
          detailDailyRemaining += st.dailyExpenseRemaining;
        }

        if (c.fundingSource) {
          const clean = c.fundingSource.replace(/구비\(자체\)/g, '구비').replace(/\([^)]+\)/g, '');
          const parts = clean.split(',');
          for (let p = 0; p < parts.length; p++) {
            const t = parts[p].trim();
            if (t && t !== '구비') {
              detailFundingSet.add(t);
            }
          }
        }

        if (c.budgetType && c.budgetType !== '본예산') {
          detailTypesSet.add(c.budgetType);
        }
      }

      const detailTotalUsed = detailTotalSpent + detailTotalPlanned;
      const detailUsageRate = detailTotalBudget > 0 ? (detailTotalUsed / detailTotalBudget) * 100 : 0;

      return {
        detailName: detail,
        cats: detailCats,
        detailTotalBudget,
        detailTotalSpent,
        detailTotalPlanned,
        detailTotalUsed,
        detailUsageRate,
        detailDailyIssued,
        detailDailySpent,
        detailDailyRemaining,
        detailFunding: Array.from(detailFundingSet),
        detailTypes: Array.from(detailTypesSet)
      };
    });

    const groupFunding = Array.from(groupFundingSet);
    const groupTypes = Array.from(groupTypesSet);

    return { 
      totalBudget: tBudget, 
      spent: tSpent, 
      planned: tPlanned, 
      remaining: tRemaining, 
      usageRate: rate, 
      groupEntries: gEntries, 
      entriesByCatId: entriesByCatMap, 
      groupedByDetail: groups, 
      groupFunding, 
      groupTypes, 
      catMap: categoryLookupMap 
    };
  }, [cats, entries, getCategoryStats]);

  // Stable swap callback function passed down to BudgetCategoryCardItem instances
  const handleSwapCat = useCallback((catId: string, dir: -1 | 1) => {
    if (!updateCategory) return;
    for (const detailGroup of groupedByDetail) {
      const idx = detailGroup.cats.findIndex(c => c.id === catId);
      if (idx !== -1) {
        const targetIdx = idx + dir;
        if (targetIdx < 0 || targetIdx >= detailGroup.cats.length) return;
        const currentCat = detailGroup.cats[idx];
        const targetCat = detailGroup.cats[targetIdx];
        if (currentCat && targetCat) {
          updateCategory(currentCat.id, { sortOrder: targetIdx });
          updateCategory(targetCat.id, { sortOrder: idx });
        }
        break;
      }
    }
  }, [updateCategory, groupedByDetail]);

  const visibleGroupEntries = useMemo(() => {
    return showAllEntries ? groupEntries : groupEntries.slice(0, 6);
  }, [groupEntries, showAllEntries]);

  const entryCellIdList = useMemo(() => {
    const list: string[] = [];
    visibleGroupEntries.forEach(entry => {
      list.push(`${entry.id}:date`);
      list.push(`${entry.id}:docRegNum`);
      list.push(`${entry.id}:purpose`);
      list.push(`${entry.id}:amount`);
    });
    return list;
  }, [visibleGroupEntries]);

  const handleCellNavigate = useCallback((currentCellId: string, direction: 'next' | 'prev') => {
    const index = entryCellIdList.indexOf(currentCellId);
    if (index === -1) return;
    let targetIndex = direction === 'next' ? index + 1 : index - 1;
    if (targetIndex >= entryCellIdList.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = entryCellIdList.length - 1;
    setActiveCellId(entryCellIdList[targetIndex]);
  }, [entryCellIdList]);

  // Window virtualization for detailed groups when list is long (> 3 groups)
  const isVirtualizationActive = groupedByDetail.length > 3;
  const { startIndex, endIndex, topPadding, bottomPadding } = useVirtualList({
    totalItems: groupedByDetail.length,
    itemHeight: 200,
    overscan: 2,
    containerRef
  });

  const visibleDetailGroups = useMemo(() => {
    if (!isVirtualizationActive) return groupedByDetail;
    return groupedByDetail.slice(startIndex, endIndex);
  }, [groupedByDetail, isVirtualizationActive, startIndex, endIndex]);

  return (
    <div className={`glass-panel rounded-[2rem] mb-5 last:mb-0 transition-all duration-300 shadow-2xs ${hidePolicyHeader ? '' : 'border border-slate-200/60 hover:border-indigo-400/50 hover:shadow-md hover:shadow-indigo-500/5'}`}>
      {!hidePolicyHeader && (
        <div 
          className="px-5 py-4 flex flex-col gap-3 cursor-pointer group"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-100 shadow-3xs" style={{ backgroundColor: cats[0]?.color ? `${cats[0].color}15` : '#f8fafc' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cats[0]?.color || 'var(--color-primary)' }} />
              </div>
              <div>
                 <h3 className="font-bold text-[18px] text-gray-800 tracking-tight group-hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 flex-wrap">
                   {policyName}
                   {groupTypes.map(t => (
                     <span key={t} className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${t === '간주예산' ? 'bg-purple-50/80 text-purple-700 border-purple-200/60 shadow-3xs' : 'bg-rose-50/80 text-rose-700 border-rose-200/60 shadow-3xs'}`}>{t}</span>
                   ))}
                   {groupFunding.map(f => (
                     <span key={f} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border bg-teal-50/80 text-teal-700 border-teal-200/60 shadow-3xs">{f}</span>
                   ))}
                 </h3>
                 <div className="text-[12px] text-gray-500 font-semibold mt-0.5 tracking-tight">단위사업 {cats.length}개 그룹</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-indigo-50 text-indigo-500' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                 {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
               </div>
            </div>
          </div>
          
          <div className="bg-slate-50/60 rounded-2xl p-4 flex flex-col gap-3 border border-slate-200/20">
            <div className="flex justify-between items-end flex-wrap gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-500 font-bold text-[14px]">총 예산 대비 사용액</span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-3xs" title="정책사업 집행률">
                    집행 {usageRate.toFixed(1)}%
                  </span>
                </div>
                <span className="font-extrabold text-slate-800 font-mono tracking-tight text-[21px]">{formatN(spent + planned)} <span className="text-[14px] text-slate-400 font-medium mx-1">/</span> <span className="text-slate-600 font-bold text-[18px]">{formatN(totalBudget)}</span></span>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-3xs" title="정책사업 미집행률(잔여율)">
                    미집행 {(totalBudget > 0 ? (remaining / totalBudget * 100) : 0).toFixed(1)}%
                  </span>
                  <span className="text-slate-500 font-bold text-[14px]">총 잔여액</span>
                </div>
                <span className="font-extrabold text-[var(--color-primary)] text-[25px] font-mono tracking-tight">{formatN(remaining)}<span className="text-[15px] font-bold ml-0.5">원</span></span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-200/40 rounded-full overflow-hidden border border-slate-100 flex relative" title={`집행률: ${usageRate.toFixed(1)}% | 미집행률: ${(totalBudget > 0 ? (remaining / totalBudget * 100) : 0).toFixed(1)}%`}>
               <div 
                 className={`h-full transition-all duration-500 ease-out relative overflow-hidden ${
                   usageRate >= 95 
                     ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                     : usageRate >= 80 
                       ? 'bg-gradient-to-r from-amber-400 to-amber-600' 
                       : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                 }`} 
                 style={{ width: `${Math.min(100, usageRate)}%` }} 
               >
                 <div className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent ${isVisible ? 'animate-shimmer' : ''}`} style={{ backgroundSize: '200% 100%' }} />
               </div>
               <div 
                 className="h-full bg-emerald-400/80 transition-all duration-500" 
                 style={{ width: `${Math.max(0, Math.min(100 - Math.min(100, usageRate), totalBudget > 0 ? (remaining / totalBudget * 100) : 0))}%` }} 
               />
            </div>
            {planned > 0 && <div className="text-[11px] text-amber-700 font-bold bg-amber-50/80 px-2 py-1 rounded-lg inline-block self-start border border-amber-200/60 shadow-3xs">📋 품의 진행/예정: {formatN(planned)}원</div>}
          </div>
        </div>
      )}
      
      {(hidePolicyHeader || isOpen) && (
        <div ref={containerRef} className={`px-5 py-3 transition-all duration-300 ease-in-out divide-y divide-gray-100 ${hidePolicyHeader ? 'px-1 pt-1 border border-slate-200 rounded-xl bg-white shadow-sm' : ''}`}>
          {isVirtualizationActive && topPadding > 0 && (
            <div style={{ height: `${topPadding}px` }} aria-hidden="true" />
          )}

          {visibleDetailGroups.map(detailGroup => {
            const {
              detailName,
              cats: detailCats,
              detailTotalBudget,
              detailTotalUsed,
              detailUsageRate,
              detailDailyIssued,
              detailDailySpent,
              detailDailyRemaining,
              detailFunding,
              detailTypes
            } = detailGroup;
            
            return (
              <div key={detailName} className="py-3 first:pt-0">
                <div className={`flex items-center gap-2 ${hidePolicyHeader ? 'mb-4 border-b border-slate-100 pb-4 px-3 pt-2' : 'mb-2.5'}`}>
                  <div className={`${hidePolicyHeader ? 'w-8 h-8' : 'w-5 h-5'} rounded bg-[var(--color-primary)]/10 flex items-center justify-center`}>
                    <div className={`${hidePolicyHeader ? 'w-3.5 h-3.5' : 'w-2 h-2'} rounded-full bg-[var(--color-primary)]`} />
                  </div>
                  <div className={`flex items-center gap-2 font-semibold text-gray-800 flex-wrap ${hidePolicyHeader ? 'text-xl tracking-tight' : 'text-[17px]'}`}>
                    {detailName}
                    {policyName && (
                      <span className={`font-bold rounded-lg border bg-indigo-50/80 text-indigo-700 border-indigo-200/60 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>
                        정책: {policyName}
                      </span>
                    )}
                    {detailCats[0]?.unitProject && (
                      <span className={`font-bold rounded-lg border bg-slate-50 text-slate-600 border-slate-200 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>
                        단위: {detailCats[0].unitProject}
                      </span>
                    )}
                    {detailTypes.map(t => (
                      <span key={t} className={`font-semibold rounded-lg border shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'} ${t === '간주예산' ? 'bg-purple-50/80 text-purple-700 border-purple-200/60' : 'bg-rose-50/80 text-rose-700 border-rose-200/60'}`}>{t}</span>
                    ))}
                    {detailFunding.map(f => (
                      <span key={f} className={`font-semibold rounded-lg border bg-teal-50/80 text-teal-700 border-teal-200/60 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>{f}</span>
                    ))}
                    <span className={`font-bold text-blue-700 bg-blue-50/80 rounded-lg border border-blue-100/60 font-mono tabular-nums shadow-3xs ${hidePolicyHeader ? 'text-sm px-2.5 py-0.5' : 'text-[13px] px-2 py-0.5'}`}>
                      예산 {formatN(detailTotalBudget)}원
                    </span>

                    {/* 세부사업별 총예산 대비 사용액 & 집행률 */}
                    <span className={`font-extrabold rounded-lg border font-mono tabular-nums shadow-3xs flex items-center gap-1.5 ${
                      detailUsageRate >= 95 
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80' 
                        : detailUsageRate >= 80 
                          ? 'bg-amber-50 text-amber-700 border-amber-200/80' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                    } ${hidePolicyHeader ? 'text-xs px-2.5 py-0.5' : 'text-[12px] px-2 py-0.5'}`}>
                      <span>집행 {formatN(detailTotalUsed)}원</span>
                      <span className={`font-black px-1.5 py-0.2 rounded shadow-3xs ${
                        detailUsageRate >= 95 
                          ? 'bg-rose-100 text-rose-800' 
                          : detailUsageRate >= 80 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {detailUsageRate.toFixed(1)}%
                      </span>
                    </span>

                    {/* 세부사업별 미집행액 & 잔여율 뱃지 */}
                    {(() => {
                      const detailRemaining = detailTotalBudget - detailTotalUsed;
                      const detailRemainingRate = detailTotalBudget > 0 ? (detailRemaining / detailTotalBudget) * 100 : 0;
                      return (
                        <span className={`font-extrabold rounded-lg border font-mono tabular-nums shadow-3xs flex items-center gap-1.5 ${
                          detailRemaining < 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-200/80' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        } ${hidePolicyHeader ? 'text-xs px-2.5 py-0.5' : 'text-[12px] px-2 py-0.5'}`}>
                          <span>잔여 {formatN(detailRemaining)}원</span>
                          <span className={`font-black px-1.5 py-0.2 rounded shadow-3xs ${
                            detailRemaining < 0 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            미집행 {detailRemainingRate.toFixed(1)}%
                          </span>
                        </span>
                      );
                    })()}

                    {/* 세부사업 투톤 듀얼 프로그래스 바 */}
                    <div className="w-16 h-2 bg-slate-200/70 rounded-full overflow-hidden border border-slate-200/50 inline-flex items-center align-middle shrink-0 mr-1" title={`집행률: ${detailUsageRate.toFixed(1)}% | 미집행률: ${(detailTotalBudget > 0 ? ((detailTotalBudget - detailTotalUsed) / detailTotalBudget * 100) : 0).toFixed(1)}%`}>
                      <div 
                        className={`h-full transition-all duration-300 ${
                          detailUsageRate >= 95 
                            ? 'bg-rose-500' 
                            : detailUsageRate >= 80 
                              ? 'bg-amber-500' 
                              : 'bg-indigo-500'
                        }`} 
                        style={{ width: `${Math.min(100, detailUsageRate)}%` }} 
                      />
                      <div 
                        className="h-full bg-emerald-400 transition-all duration-300" 
                        style={{ width: `${Math.max(0, Math.min(100 - Math.min(100, detailUsageRate), detailTotalBudget > 0 ? ((detailTotalBudget - detailTotalUsed) / detailTotalBudget * 100) : 0))}%` }} 
                      />
                    </div>

                    {detailDailyIssued > 0 && (
                      <span className={`font-bold text-amber-700 bg-amber-50 border border-amber-200 mr-2 font-mono tabular-nums shadow-3xs flex items-center gap-1 ${hidePolicyHeader ? 'text-xs px-2.5 py-0.5' : 'text-[12px] px-2 py-0.5'}`}>
                        🪙 일상경비: 교부 {formatN(detailDailyIssued)}원 | 지출 {formatN(detailDailySpent)}원 (잔액 <strong className="text-amber-800">{formatN(detailDailyRemaining)}원</strong>)
                      </span>
                    )}
                    {openAddCat && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openAddCat({ 
                            policyProject: policyName, 
                            unitProject: detailCats[0]?.unitProject, 
                            detailedProject: detailName,
                            budgetType: (detailTypes[0] as '본예산' | '추경') || '본예산',
                            fundingSource: detailFunding[0] || '구비'
                          }); 
                        }} 
                        className="p-1 rounded cursor-pointer hover:bg-slate-200 text-gray-500 hover:text-blue-600 transition-colors"
                        title="이 세부사업에 새 통계목 추가"
                      >
                        <FilePlus2 size={13} />
                      </button>
                    )}
                    {openBatchEdit && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openBatchEdit(detailName, detailCats);
                        }} 
                        className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm"
                        title="이 세부사업 내 모든 통계목에 동일한 재원비율 일괄 할당"
                      >
                        <Pencil size={11} /> 비율 모괄 설정
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3 pl-2">
                  {detailCats.map((cat, catIdx) => {
                    const stats = getCategoryStats(cat.id);
                    const isFirst = catIdx === 0;
                    const isLast = catIdx === detailCats.length - 1;
                    const catEntries = entriesByCatId[cat.id] || [];

                    return (
                      <BudgetCategoryCardItem
                        key={cat.id}
                        cat={cat}
                        stats={stats}
                        catEntries={catEntries}
                        isFirst={isFirst}
                        isLast={isLast}
                        onSwapCat={updateCategory ? handleSwapCat : undefined}
                        onEditCat={openEditCat}
                        onDeleteCat={deleteCategory}
                        onEditEntry={openEditEntry}
                        updateCategory={updateCategory}
                        updateEntry={updateEntry}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isVirtualizationActive && bottomPadding > 0 && (
            <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />
          )}
          
          {groupEntries.length > 0 && (
            <div className="pt-3 space-y-2 mt-2">
              <div className="flex items-center justify-between mb-2 ml-1">
                <div className="text-[15px] font-bold text-gray-500 uppercase tracking-wider">
                  지출 내역 {groupEntries.length > 6 ? `(총 ${groupEntries.length}건)` : ''}
                </div>
                {groupEntries.length > 6 && (
                  <button 
                    onClick={() => setShowAllEntries(prev => !prev)}
                    className="text-[13px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded cursor-pointer hover:bg-blue-100 hover:text-blue-800 font-bold transition-colors"
                  >
                    {showAllEntries ? '간략히 보기' : '모두 보기'}
                  </button>
                )}
              </div>
              
              <div className={`space-y-2 ${showAllEntries ? 'max-h-[600px] overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
                {visibleGroupEntries.map(entry => {
                  const cfg = ACTION_TYPE_CONFIG[entry.actionType || 'general'] || ACTION_TYPE_CONFIG['general'];
                  const parentCat = catMap[entry.categoryId];
                  return (
                    <div key={entry.id} className="flex items-center text-[15px] group bg-white py-2.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors relative">
                      <div className="w-[70px] flex-shrink-0">
                        <span className={`px-2 py-1 rounded-md text-[13px] font-bold border whitespace-nowrap ${cfg.badge === '경비지출' ? 'bg-teal-50 text-teal-700 border-teal-200' : cfg.badge === '교부' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{cfg.badge}</span>
                      </div>
                      <div className="w-[190px] hidden sm:flex flex-col justify-center flex-shrink-0 pr-3 leading-tight">
                        <span className="text-xs font-bold text-slate-800 whitespace-nowrap truncate" title={parentCat ? `${parentCat.unitProject} > ${parentCat.detailedProject}` : ''}>
                          {parentCat?.detailedProject || parentCat?.unitProject || '알수없음'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap truncate">
                          {parentCat?.statItem || parentCat?.name || ''}
                        </span>
                      </div>
                      <div className="w-[90px] flex items-center flex-shrink-0 pr-3">
                        <InlineEditCell
                          cellId={`${entry.id}:date`}
                          value={entry.date}
                          type="date"
                          isEditing={activeCellId === `${entry.id}:date`}
                          onStartEdit={() => setActiveCellId(`${entry.id}:date`)}
                          onCancelEdit={() => setActiveCellId(null)}
                          onSave={(newVal) => updateEntry && updateEntry(entry.id, { date: String(newVal) })}
                          onNavigate={(dir) => handleCellNavigate(`${entry.id}:date`, dir)}
                          displayFormatter={(v) => String(v).replace(/-/g, '.')}
                          className="text-[13.5px] text-gray-500 font-medium tracking-tight whitespace-nowrap"
                        />
                      </div>
                      <div className="w-[140px] hidden lg:flex items-center flex-shrink-0 pr-3">
                        <InlineEditCell
                          cellId={`${entry.id}:docRegNum`}
                          value={entry.docRegNum || ''}
                          type="text"
                          placeholder="문서번호 입력"
                          isEditing={activeCellId === `${entry.id}:docRegNum`}
                          onStartEdit={() => setActiveCellId(`${entry.id}:docRegNum`)}
                          onCancelEdit={() => setActiveCellId(null)}
                          onSave={(newVal) => updateEntry && updateEntry(entry.id, { docRegNum: String(newVal) })}
                          onNavigate={(dir) => handleCellNavigate(`${entry.id}:docRegNum`, dir)}
                          displayFormatter={(v) => v ? (
                            <span className="text-[13px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md whitespace-nowrap">
                              {String(v)}
                            </span>
                          ) : <span className="text-[12px] text-slate-300 font-light">+문서번호</span>}
                        />
                      </div>
                      <div className="flex-1 min-w-[150px] pr-2">
                        <InlineEditCell
                          cellId={`${entry.id}:purpose`}
                          value={entry.purpose || ''}
                          type="text"
                          isEditing={activeCellId === `${entry.id}:purpose`}
                          onStartEdit={() => setActiveCellId(`${entry.id}:purpose`)}
                          onCancelEdit={() => setActiveCellId(null)}
                          onSave={(newVal) => updateEntry && updateEntry(entry.id, { purpose: String(newVal) })}
                          onNavigate={(dir) => handleCellNavigate(`${entry.id}:purpose`, dir)}
                          className={`${entry.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-gray-800 font-semibold'} tracking-tight line-clamp-1 text-[15px]`}
                        />
                      </div>
                      <div className="w-[130px] sm:w-[160px] flex items-center justify-end gap-3 flex-shrink-0">
                        <InlineEditCell
                          cellId={`${entry.id}:amount`}
                          value={entry.amount}
                          type="number"
                          isEditing={activeCellId === `${entry.id}:amount`}
                          onStartEdit={() => setActiveCellId(`${entry.id}:amount`)}
                          onCancelEdit={() => setActiveCellId(null)}
                          onSave={(newVal) => {
                            const cleanStr = String(newVal).replace(/,/g, '').trim();
                            const numVal = Number(cleanStr);
                            if (updateEntry) updateEntry(entry.id, { amount: isNaN(numVal) ? 0 : numVal });
                          }}
                          onNavigate={(dir) => handleCellNavigate(`${entry.id}:amount`, dir)}
                          displayFormatter={(v) => `${formatN(Number(v))}원`}
                          className="font-semibold text-gray-800 tracking-tight tabular-nums whitespace-nowrap text-[15px]"
                        />
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 absolute right-2 top-2 sm:relative sm:top-0 sm:right-0 bg-white sm:bg-transparent rounded p-1 sm:p-0 border border-slate-200 sm:border-none z-10 w-auto sm:w-[56px] justify-end flex-shrink-0">
                          <button onClick={() => openEditEntry(entry)} className="p-1 rounded hover:bg-slate-100 text-gray-500" title="수정"><Pencil size={13} /></button>
                          <button onClick={() => { if(window.confirm('이 지출 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) deleteEntry(entry.id) }} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500" title="삭제"><Trash2 size={13} /></button>
                        </div>
                      </div>
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

export const PolicyGroupCard = React.memo(PolicyGroupCardComponent, arePolicyGroupCardPropsEqual);
PolicyGroupCard.displayName = "PolicyGroupCard";
