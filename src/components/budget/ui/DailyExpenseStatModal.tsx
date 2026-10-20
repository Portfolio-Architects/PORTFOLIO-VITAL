'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory } from '@/types';
import { BarChart3, Info } from 'lucide-react';

import { CategoryStats } from '@/hooks/useBudget';

interface DailyExpenseStatModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  getCategoryStats: (id: string) => CategoryStats | null;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

function DailyExpenseStatModalComponent({ isOpen, onClose, categories, getCategoryStats }: DailyExpenseStatModalProps) {
  const { statSummary, totals } = React.useMemo(() => {
    if (!isOpen) {
      return { statSummary: [], totals: { issued: 0, spent: 0, remaining: 0 } };
    }

    const statsMap: Record<string, { detailedProject: string; statItem: string; issued: number; spent: number; remaining: number }> = {};
    
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const catStats = getCategoryStats(cat.id);
      if (!catStats) continue;

      const detailedProject = cat.detailedProject || '미지정 세부사업';
      const stat = cat.statItem || '기타 (미지정)';
      const key = `${detailedProject}::${stat}`;
      
      let entry = statsMap[key];
      if (!entry) {
        entry = { detailedProject, statItem: stat, issued: 0, spent: 0, remaining: 0 };
        statsMap[key] = entry;
      }
      entry.issued += catStats.dailyExpenseIssued;
      entry.spent += catStats.dailyExpenseSpent;
      entry.remaining += catStats.dailyExpenseRemaining;
    }
    
    const summaryList: Array<{ detailedProject: string; statItem: string; issued: number; spent: number; remaining: number }> = [];
    const totalAcc = { issued: 0, spent: 0, remaining: 0 };

    const keys = Object.keys(statsMap);
    for (let i = 0; i < keys.length; i++) {
      const item = statsMap[keys[i]];
      if (item.issued > 0 || item.spent > 0) {
        summaryList.push(item);
        totalAcc.issued += item.issued;
        totalAcc.spent += item.spent;
        totalAcc.remaining += item.remaining;
      }
    }

    summaryList.sort((a, b) => {
      if (a.detailedProject !== b.detailedProject) {
        return a.detailedProject > b.detailedProject ? 1 : a.detailedProject < b.detailedProject ? -1 : 0;
      }
      return b.issued - a.issued;
    });

    return {
      statSummary: summaryList,
      totals: totalAcc
    };
  }, [isOpen, categories, getCategoryStats]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="세부사업 및 통계목별 일상경비 이체내역" size="2xl">
      <div className="space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-start gap-2.5">
          <Info className="text-slate-500 mt-0.5 shrink-0" size={16} />
          <div className="text-xs text-slate-600 leading-relaxed font-medium">
            각 세부사업 하위의 통계목별로 교부된 일상경비와 실제 지출액, 가용 잔액 현황입니다.
          </div>
        </div>

        {statSummary.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm font-medium">
            교부되거나 지출된 일상경비 내역이 없습니다.
          </div>
        ) : (
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">세부사업명</th>
                    <th className="py-3 px-4">통계목</th>
                    <th className="py-3 px-4 text-right">교부액 (원금)</th>
                    <th className="py-3 px-4 text-right">실지출액</th>
                    <th className="py-3 px-4 text-right">가용 잔액</th>
                    <th className="py-3 px-4 text-center">집행률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statSummary.map((item, idx) => {
                    const pct = item.issued > 0 ? (item.spent / item.issued) * 100 : 0;
                    return (
                      <tr key={`${item.detailedProject}_${item.statItem}_${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-medium">{item.detailedProject}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.statItem}</td>
                        <td className="py-3 px-4 text-right text-slate-700 font-medium tabular-nums">{formatN(item.issued)}원</td>
                        <td className="py-3 px-4 text-right text-slate-700 font-medium tabular-nums">{formatN(item.spent)}원</td>
                        <td className="py-3 px-4 text-right font-semibold text-amber-700 bg-amber-50/20 tabular-nums">{formatN(item.remaining)}원</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 w-9 text-right tabular-nums">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* 합계 행 */}
                  <tr className="bg-slate-50/90 border-t border-slate-200 font-semibold">
                    <td colSpan={2} className="py-3.5 px-4 text-slate-900 font-bold">
                      <div className="flex items-center gap-1.5">
                        <BarChart3 size={15} className="text-slate-600" /> 합계
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-900 font-bold tabular-nums">{formatN(totals.issued)}원</td>
                    <td className="py-3.5 px-4 text-right text-slate-900 font-bold tabular-nums">{formatN(totals.spent)}원</td>
                    <td className="py-3.5 px-4 text-right text-amber-700 font-bold bg-amber-50/30 tabular-nums">{formatN(totals.remaining)}원</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-slate-800 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(totals.issued > 0 ? (totals.spent / totals.issued) * 100 : 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-800 w-9 text-right tabular-nums">
                          {(totals.issued > 0 ? (totals.spent / totals.issued) * 100 : 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-xs cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}

DailyExpenseStatModalComponent.displayName = 'DailyExpenseStatModal';
export const DailyExpenseStatModal = React.memo(DailyExpenseStatModalComponent);
