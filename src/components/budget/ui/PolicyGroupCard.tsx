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
    const pCat = pCats[i];
    const nCat = nCats[i];
    if (pCat !== nCat) {
      if (
        pCat.id !== nCat.id ||
        pCat.totalBudget !== nCat.totalBudget ||
        pCat.sortOrder !== nCat.sortOrder ||
        pCat.name !== nCat.name ||
        pCat.statItem !== nCat.statItem ||
        pCat.formationItem !== nCat.formationItem ||
        pCat.managementProject !== nCat.managementProject ||
        pCat.unitProject !== nCat.unitProject ||
        pCat.detailedProject !== nCat.detailedProject ||
        pCat.color !== nCat.color ||
        pCat.budgetType !== nCat.budgetType ||
        pCat.fundingSource !== nCat.fundingSource ||
        pCat.subItems !== nCat.subItems ||
        pCat.fundingSplits !== nCat.fundingSplits
      ) {
        return false;
      }
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
        p.docRegNum !== n.docRegNum ||
        p.isPlanned !== n.isPlanned ||
        p.isSettled !== n.isSettled ||
        p.actionType !== n.actionType
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
    <div className={`mb-3 last:mb-0 transition-colors ${hidePolicyHeader ? '' : 'bg-white rounded-xl shadow-2xs border border-slate-200/80 hover:border-slate-300'}`}>
      {!hidePolicyHeader && (
        <div 
          className="px-5 py-4 flex flex-col gap-3 cursor-pointer group"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Policy Title & Metadata */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cats[0]?.color || 'var(--color-primary)' }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[15px] text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {policyName}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">단위사업 {cats.length}개 그룹</span>
                  {groupTypes.map(t => (
                    <span key={t} className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${t === '간주예산' ? 'bg-purple-50/60 text-purple-700 border-purple-200/60' : 'bg-rose-50/60 text-rose-700 border-rose-200/60'}`}>{t}</span>
                  ))}
                  {groupFunding.map(f => (
                    <span key={f} className="text-[11px] font-medium px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200/80">{f}</span>
                  ))}
                  {planned > 0 && (
                    <span className="text-[11px] text-amber-700 font-medium bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200/60 font-mono tabular-nums">
                      품의 진행/예정: {formatN(planned)}원
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Financial Metrics & Expand Toggle */}
            <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <div className="flex items-center gap-4 sm:gap-6 text-xs">
                <div className="flex flex-col lg:items-end">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                    <span>총 예산 대비 사용액</span>
                    <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]" title="정책사업 집행률">
                      집행 {usageRate.toFixed(1)}%
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800 font-mono tabular-nums text-sm">
                    {formatN(spent + planned)} <span className="text-slate-300 font-normal mx-0.5">/</span> <span className="text-slate-500 font-medium">{formatN(totalBudget)}</span>
                  </span>
                </div>

                <div className="h-7 w-px bg-slate-100 hidden sm:block" />

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                    <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]" title="정책사업 미집행률(잔여율)">
                      미집행 {(totalBudget > 0 ? (remaining / totalBudget * 100) : 0).toFixed(1)}%
                    </span>
                    <span>총 잔여액</span>
                  </div>
                  <span className="font-bold text-slate-900 text-sm sm:text-base font-mono tabular-nums">
                    {formatN(remaining)}<span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
                  </span>
                </div>
              </div>

              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${isOpen ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                {isOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
              </div>
            </div>
          </div>
          
          {/* Minimalist Thin Progress Bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex" title={`집행률: ${usageRate.toFixed(1)}% | 미집행률: ${(totalBudget > 0 ? (remaining / totalBudget * 100) : 0).toFixed(1)}%`}>
            <div 
              className={`h-full ${isVisible ? 'transition-all duration-500 ease-out' : ''} ${
                usageRate >= 95 
                  ? 'bg-rose-500' 
                  : usageRate >= 80 
                    ? 'bg-amber-500' 
                    : 'bg-slate-800'
              }`} 
              style={{ width: `${Math.min(100, usageRate)}%` }} 
            />
            <div 
              className={`h-full bg-emerald-500/60 ${isVisible ? 'transition-all duration-500' : ''}`} 
              style={{ width: `${Math.max(0, Math.min(100 - Math.min(100, usageRate), totalBudget > 0 ? (remaining / totalBudget * 100) : 0))}%` }} 
            />
          </div>
        </div>
      )}
      
      {(hidePolicyHeader || isOpen) && (
        <div ref={containerRef} className={`transition-all duration-200 divide-y divide-slate-100 ${hidePolicyHeader ? 'px-4 py-3 border border-slate-200/80 rounded-xl bg-white shadow-2xs' : 'px-5 py-3 border-t border-slate-100 bg-slate-50/30 rounded-b-xl'}`}>
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

            const detailRemaining = detailTotalBudget - detailTotalUsed;
            const detailRemainingRate = detailTotalBudget > 0 ? (detailRemaining / detailTotalBudget) * 100 : 0;
            
            return (
              <div key={detailName} className="py-3.5 first:pt-1 last:pb-1">
                {/* Minimalist 2-Zone Detail Project Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200/60">
                  {/* Zone 1: Detail Project Name, Hierarchy Tags & Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-1.5 h-4 rounded-full bg-slate-800 shrink-0" />
                    <span className="font-bold text-slate-900 text-sm tracking-tight">
                      {detailName}
                    </span>
                    {policyName && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        정책: {policyName}
                      </span>
                    )}
                    {detailCats[0]?.unitProject && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        단위: {detailCats[0].unitProject}
                      </span>
                    )}
                    {detailTypes.map(t => (
                      <span key={t} className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${t === '간주예산' ? 'bg-purple-50/70 text-purple-700 border-purple-200/60' : 'bg-rose-50/70 text-rose-700 border-rose-200/60'}`}>{t}</span>
                    ))}
                    {detailFunding.map(f => (
                      <span key={f} className="text-[11px] font-medium px-1.5 py-0.5 rounded border bg-white text-slate-600 border-slate-200/80">{f}</span>
                    ))}

                    <div className="flex items-center gap-1 ml-1">
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
                          className="p-1 rounded-md cursor-pointer hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 transition-colors"
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
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-white text-slate-600 border-slate-200/90 cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1"
                          title="이 세부사업 내 모든 통계목에 동일한 재원비율 일괄 할당"
                        >
                          <Pencil size={10} /> 비율 일괄 설정
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Zone 2: Clean Financial Summary Strip */}
                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono tabular-nums">
                    <span className="text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                      예산 {formatN(detailTotalBudget)}원
                    </span>

                    <span className="text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 flex items-center gap-1.5">
                      <span>집행 {formatN(detailTotalUsed)}원</span>
                      <span className={`font-bold ${
                        detailUsageRate >= 95 ? 'text-rose-600' : detailUsageRate >= 80 ? 'text-amber-600' : 'text-indigo-600'
                      }`}>
                        {detailUsageRate.toFixed(1)}%
                      </span>
                    </span>

                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 bg-white ${
                      detailRemaining < 0 ? 'text-rose-700 border-rose-200' : 'text-slate-800 border-slate-200/80'
                    }`}>
                      <span className="font-semibold">잔여 {formatN(detailRemaining)}원</span>
                      <span className={detailRemaining < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}>
                        미집행 {detailRemainingRate.toFixed(1)}%
                      </span>
                    </span>

                    {/* Compact Progress Bar */}
                    <div className="w-14 h-1.5 bg-slate-200/70 rounded-full overflow-hidden inline-flex items-center shrink-0" title={`집행률: ${detailUsageRate.toFixed(1)}% | 미집행률: ${detailRemainingRate.toFixed(1)}%`}>
                      <div 
                        className={`h-full transition-all duration-300 ${
                          detailUsageRate >= 95 ? 'bg-rose-500' : detailUsageRate >= 80 ? 'bg-amber-500' : 'bg-slate-800'
                        }`} 
                        style={{ width: `${Math.min(100, detailUsageRate)}%` }} 
                      />
                      <div 
                        className="h-full bg-emerald-500/70 transition-all duration-300" 
                        style={{ width: `${Math.max(0, Math.min(100 - Math.min(100, detailUsageRate), detailRemainingRate))}%` }} 
                      />
                    </div>

                    {detailDailyIssued > 0 && (
                      <span className="text-[11px] font-medium text-amber-800 bg-amber-50/80 border border-amber-200/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                        일상경비: 교부 {formatN(detailDailyIssued)}원 | 지출 {formatN(detailDailySpent)}원 (잔액 <strong className="text-amber-900">{formatN(detailDailyRemaining)}원</strong>)
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
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
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  지출 내역 {groupEntries.length > 6 ? `(총 ${groupEntries.length}건)` : ''}
                </div>
                {groupEntries.length > 6 && (
                  <button 
                    onClick={() => setShowAllEntries(prev => !prev)}
                    className="text-xs bg-white border border-slate-200/90 text-slate-700 px-2.5 py-1 rounded-md cursor-pointer hover:bg-slate-50 font-semibold transition-colors"
                  >
                    {showAllEntries ? '간략히 보기' : '모두 보기'}
                  </button>
                )}
              </div>
              
              <div className={`space-y-1.5 ${showAllEntries ? 'max-h-[600px] overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
                {visibleGroupEntries.map(entry => {
                  const cfg = ACTION_TYPE_CONFIG[entry.actionType || 'general'] || ACTION_TYPE_CONFIG['general'];
                  const parentCat = catMap[entry.categoryId];
                  return (
                    <div key={entry.id} className="flex items-center text-xs sm:text-[13px] group bg-white py-2 px-3 rounded-lg border border-slate-200/70 hover:border-slate-300 transition-colors relative">
                      <div className="w-[70px] flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${cfg.badge === '경비지출' ? 'bg-teal-50/70 text-teal-700 border-teal-200/70' : cfg.badge === '교부' ? 'bg-amber-50/70 text-amber-700 border-amber-200/70' : 'bg-slate-50 text-slate-700 border-slate-200/80'}`}>{cfg.badge}</span>
                      </div>
                      <div className="w-[180px] hidden sm:flex flex-col justify-center flex-shrink-0 pr-3 leading-tight">
                        <span className="text-xs font-semibold text-slate-800 whitespace-nowrap truncate" title={parentCat ? `${parentCat.unitProject} > ${parentCat.detailedProject}` : ''}>
                          {parentCat?.detailedProject || parentCat?.unitProject || '알수없음'}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap truncate">
                          {parentCat?.statItem || parentCat?.name || ''}
                        </span>
                      </div>
                      <div className="w-[85px] flex items-center flex-shrink-0 pr-2">
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
                          className="text-xs text-slate-500 font-mono whitespace-nowrap"
                          inputClassName="w-full min-w-0"
                        />
                      </div>
                      <div className="w-[135px] hidden lg:flex items-center flex-shrink-0 pr-2">
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
                            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                              {String(v)}
                            </span>
                          ) : <span className="text-[11px] text-slate-300">+문서번호</span>}
                          inputClassName="w-full min-w-0"
                        />
                      </div>
                      <div className="flex-1 min-w-[140px] pr-2">
                        <InlineEditCell
                          cellId={`${entry.id}:purpose`}
                          value={entry.purpose || ''}
                          type="text"
                          isEditing={activeCellId === `${entry.id}:purpose`}
                          onStartEdit={() => setActiveCellId(`${entry.id}:purpose`)}
                          onCancelEdit={() => setActiveCellId(null)}
                          onSave={(newVal) => updateEntry && updateEntry(entry.id, { purpose: String(newVal) })}
                          onNavigate={(dir) => handleCellNavigate(`${entry.id}:purpose`, dir)}
                          className={`${entry.purpose?.includes('(일상경비 교부)') ? 'text-amber-700 font-semibold' : 'text-slate-800 font-medium'} tracking-tight line-clamp-1 text-[13px]`}
                          inputClassName="w-full min-w-0"
                        />
                      </div>
                      <div className="w-[130px] sm:w-[155px] flex items-center justify-end gap-2 flex-shrink-0">
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
                          className="font-semibold text-slate-900 font-mono tabular-nums whitespace-nowrap text-[13px]"
                          inputClassName="w-full max-w-[105px] text-right"
                        />
                        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEditEntry(entry)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="수정"><Pencil size={12} /></button>
                          <button onClick={() => { if(window.confirm('이 지출 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) deleteEntry(entry.id) }} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="삭제"><Trash2 size={12} /></button>
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
