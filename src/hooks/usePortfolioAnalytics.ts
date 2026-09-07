import { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';

export function usePortfolioAnalytics(budgetCategories: BudgetCategory[], budgetEntries: BudgetEntry[]) {
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [predictionModel, setPredictionModel] = useState<'conservative' | 'baseline' | 'aggressive'>('baseline');
  const [routineSpend, setRoutineSpend] = useState<number>(0); // 월 고정/루틴 지출액

  const detailedProjects = useMemo(() => {
    const projects = new Set<string>();
    for (let i = 0; i < budgetCategories.length; i++) {
      const dp = budgetCategories[i].detailedProject;
      if (dp) projects.add(dp);
    }
    return Array.from(projects);
  }, [budgetCategories]);

  // Filter categories for the pie chart
  const filteredCategories = useMemo(() => {
    return selectedProject === 'ALL' 
      ? budgetCategories 
      : budgetCategories.filter(c => c.detailedProject === selectedProject);
  }, [budgetCategories, selectedProject]);

  // Calculate Budget Stats
  const totalBudget = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < filteredCategories.length; i++) {
      sum += filteredCategories[i].totalBudget;
    }
    return sum;
  }, [filteredCategories]);
  
  const executedBudget = useMemo(() => {
    const validCategoryIds = new Set<string>();
    for (let i = 0; i < filteredCategories.length; i++) {
      validCategoryIds.add(filteredCategories[i].id);
    }
    let sum = 0;
    for (let i = 0; i < budgetEntries.length; i++) {
      const e = budgetEntries[i];
      if (!e.isPlanned && e.actionType !== 'settle' && e.actionType !== 'daily_expense' && validCategoryIds.has(e.categoryId)) {
        sum += e.actionType === 'transfer' ? -e.amount : e.amount;
      }
    }
    return sum;
  }, [budgetEntries, filteredCategories]);

  const remainingBudget = totalBudget - executedBudget;
  const executionRate = totalBudget > 0 ? (executedBudget / totalBudget) * 100 : 0;

  // Asset Allocation
  const pieData = useMemo(() => [
    { name: '집행 완료', value: executedBudget, color: '#3B82F6' },
    { name: '잔여 예산', value: Math.max(0, remainingBudget), color: '#E2E8F0' }
  ], [executedBudget, remainingBudget]);

  const breakdownData = useMemo<{ name: string; total: number; executed: number; rate: number; formationItem?: string }[]>(() => {
    // Pre-group categories by detailedProject in a single O(C) pass using Map
    const catsByDetailedProject = new Map<string, BudgetCategory[]>();
    for (let i = 0; i < budgetCategories.length; i++) {
      const c = budgetCategories[i];
      if (!c.detailedProject) continue;
      let list = catsByDetailedProject.get(c.detailedProject);
      if (!list) {
        list = [];
        catsByDetailedProject.set(c.detailedProject, list);
      }
      list.push(c);
    }

    // Aggregate executed amount by categoryId in O(E)
    const executedByCatId: Record<string, number> = {};
    for (let i = 0; i < budgetCategories.length; i++) {
      executedByCatId[budgetCategories[i].id] = 0;
    }
    for (let i = 0; i < budgetEntries.length; i++) {
      const e = budgetEntries[i];
      if (!e.isPlanned && e.actionType !== 'settle' && e.actionType !== 'daily_expense' && executedByCatId[e.categoryId] !== undefined) {
        if (e.actionType === 'transfer') {
          executedByCatId[e.categoryId] -= e.amount;
        } else {
          executedByCatId[e.categoryId] += e.amount;
        }
      }
    }

    if (selectedProject === 'ALL') {
      const projectsData: { name: string; total: number; executed: number; rate: number }[] = [];
      for (let i = 0; i < detailedProjects.length; i++) {
        const dp = detailedProjects[i];
        const cats = catsByDetailedProject.get(dp) || [];
        let total = 0;
        let executed = 0;
        for (let j = 0; j < cats.length; j++) {
          total += cats[j].totalBudget;
          executed += (executedByCatId[cats[j].id] || 0);
        }
        const rate = total > 0 ? (executed / total) * 100 : 0;
        projectsData.push({ name: dp, total, executed, rate });
      }
      return projectsData.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const cats = catsByDetailedProject.get(selectedProject) || [];
      const result: { name: string; formationItem?: string; total: number; executed: number; rate: number }[] = [];
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        const executed = executedByCatId[cat.id] || 0;
        const rate = cat.totalBudget > 0 ? (executed / cat.totalBudget) * 100 : 0;
        result.push({ name: cat.name, formationItem: cat.formationItem, total: cat.totalBudget, executed, rate });
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [budgetCategories, budgetEntries, selectedProject, detailedProjects]);


  // Monthly Execution Trend Analysis & Target Spend-down Planner
  const { 
    monthlyExecutionData, 
    maxSpendMonth, 
    avgMonthlySpend, 
    remainingTargetAmount, 
    recommendedMonthlySpendForTarget,
    exhaustionMonthName,
    projectedEoyExecutionRate,
    totalPlannedInDraft,
    unplannedRemainingAmount,
    totalVirtualAdjustment
  } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 동적으로 현재 월 반영 (예: 6월이면 6)
    const validCategoryIds = new Set<string>();
    for (let i = 0; i < filteredCategories.length; i++) {
      validCategoryIds.add(filteredCategories[i].id);
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyAmounts = new Array<number>(12).fill(0);
    const plannedMonthlyAmounts = new Array<number>(12).fill(0);
    const executedNoIssuanceByCatId: Record<string, number> = {};
    for (let i = 0; i < filteredCategories.length; i++) {
      executedNoIssuanceByCatId[filteredCategories[i].id] = 0;
    }

    for (let i = 0; i < budgetEntries.length; i++) {
      const e = budgetEntries[i];
      if (!validCategoryIds.has(e.categoryId)) continue;

      // Zero-allocation fast month index parsing (format: 'YYYY-MM-DD')
      let monthIdx = -1;
      if (e.date && e.date.length >= 7 && e.date.charCodeAt(4) === 45) {
        monthIdx = (e.date.charCodeAt(5) - 48) * 10 + (e.date.charCodeAt(6) - 48) - 1;
      }

      if (!e.isPlanned && e.actionType !== 'settle') {
        if (e.actionType !== 'daily_expense' && monthIdx >= 0 && monthIdx < 12) {
          const amount = e.actionType === 'transfer' ? -e.amount : e.amount;
          monthlyAmounts[monthIdx] += amount;
        }
        if (e.actionType !== 'issuance' && executedNoIssuanceByCatId[e.categoryId] !== undefined) {
          if (e.actionType === 'transfer') {
            executedNoIssuanceByCatId[e.categoryId] -= e.amount;
          } else {
            executedNoIssuanceByCatId[e.categoryId] += e.amount;
          }
        }
      } else if (e.isPlanned) {
        if (monthIdx >= 0 && monthIdx <= 11) {
          plannedMonthlyAmounts[monthIdx] += e.amount;
        }
      }
    }

    // 11월(Index 10)까지 100% 소진 목표선형 가이드
    const monthlyTargetUnit = totalBudget / 11;

    // --- 1. Linear Regression (최소자승법 선형 회귀) ---
    const N = currentMonth;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    let tempCumulative = 0;
    for (let k = 1; k <= N; k++) {
      tempCumulative += monthlyAmounts[k - 1];
      sumX += k;
      sumY += tempCumulative;
      sumXY += k * tempCumulative;
      sumXX += k * k;
    }
    
    const slope = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / N;

    // --- 2. Target Burn-down Plan by Nov 30 ---
    const actualCumulative = tempCumulative;
    const remainTargetAmt = Math.max(0, totalBudget - actualCumulative);

    // 가상 조정액(Virtual Adjustment) 총합 계산 (개별 카테고리 단위로 실제 집행액을 하한선으로 보정)
    let totalVirtualAdjustment = 0;
    for (let cIdx = 0; cIdx < filteredCategories.length; cIdx++) {
      const cat = filteredCategories[cIdx];
      let catVirtualAdjustment = 0;
      if (cat.subItems) {
        for (let sIdx = 0; sIdx < cat.subItems.length; sIdx++) {
          const sub = cat.subItems[sIdx];
          const hasCalcs = sub.calculations && sub.calculations.length > 0;
          if (hasCalcs) {
            const calcs = sub.calculations!;
            for (let calcIdx = 0; calcIdx < calcs.length; calcIdx++) {
              const calc = calcs[calcIdx];
              if (typeof calc.virtualAdjustment === 'number') {
                catVirtualAdjustment += calc.virtualAdjustment;
              }
            }
          } else {
            if (typeof sub.virtualAdjustment === 'number') {
              catVirtualAdjustment += sub.virtualAdjustment;
            }
          }
        }
      }

      // 개별 카테고리(통계목) 단위의 실제 집행액 계산 (단순 한도 배정인 issuance 교부 건은 제외)
      const catExecuted = executedNoIssuanceByCatId[cat.id] || 0;

      totalVirtualAdjustment += Math.max(catExecuted, catVirtualAdjustment);
    }

    let totalPlannedInDraft = 0;
    for (let pIdx = 0; pIdx < plannedMonthlyAmounts.length; pIdx++) {
      totalPlannedInDraft += plannedMonthlyAmounts[pIdx];
    }
    // 가상 조정액 보정치 반영 (설계 완료로 인식하여 차감)
    const unplannedRemainingAmount = remainTargetAmt - totalPlannedInDraft - totalVirtualAdjustment;

    // 월 권장 지출액 (참고용 기준값)
    const recommendedMonthlySpendForTarget = Math.round(remainTargetAmt / 6);

    let cumulative = 0;
    let planCumulativeVal = 0;
    
    const trendData = months.map((m, i) => {
      const actualMonthAmount = monthlyAmounts[i];
      cumulative += actualMonthAmount;
      
      const targetVal = i < 11 
        ? Math.round(monthlyTargetUnit * (i + 1)) 
        : totalBudget;

      const regVal = Math.round(slope * (i + 1) + intercept);
      const plannedMonthSpend = Math.round(plannedMonthlyAmounts[i]);
      
      if (i <= currentMonth - 1) {
        // 1월~현재 월 (실제 데이터 반영)
        // 가계획 입력값이 있다면 계획값을 사용하고, 없으면 실제 누적 실적값을 계획선 베이스로 적용
        const effectivePlanSpend = plannedMonthSpend > 0 ? plannedMonthSpend : actualMonthAmount;
        planCumulativeVal += effectivePlanSpend;
        return {
          name: m,
          monthly: actualMonthAmount,
          cumulative: cumulative,
          planCumulative: planCumulativeVal,
          planMonthly: plannedMonthSpend > 0 ? plannedMonthSpend : actualMonthAmount,
          regressionCumulative: regVal >= 0 ? regVal : 0,
          targetCumulative: targetVal
        };
      } else {
        // 6월~12월 (계획/예측 데이터 반영)
        planCumulativeVal += plannedMonthSpend;
        
        return {
          name: m,
          monthly: undefined,
          cumulative: undefined,
          planCumulative: planCumulativeVal,
          planMonthly: plannedMonthSpend,
          regressionCumulative: regVal >= 0 ? regVal : 0,
          targetCumulative: targetVal
        };
      }
    });
    
    // 최대 지출월 찾기 (Direct for loop)
    let maxAmt = 0;
    let maxMonthName = 'None';
    for (let i = 0; i < monthlyAmounts.length; i++) {
      const amt = monthlyAmounts[i];
      if (amt > maxAmt) {
        maxAmt = amt;
        maxMonthName = months[i];
      }
    }
    
    const avgSpend = currentMonth > 0 ? executedBudget / currentMonth : 0;
    
    // 자연 소진 월(exhaustion month) 구하기
    let exhaustionMonth = 'N/A';
    if (slope > 0) {
      const monthFloat = (totalBudget - intercept) / slope;
      if (monthFloat > 0 && monthFloat <= 24) {
        const monthNum = Math.ceil(monthFloat);
        if (monthNum <= 12) {
          exhaustionMonth = `2026년 ${monthNum}월`;
        } else {
          exhaustionMonth = `2027년 ${monthNum - 12}월`;
        }
      } else if (monthFloat > 24) {
        exhaustionMonth = '2년 이상 소요';
      }
    } else {
      exhaustionMonth = '지출 증가세 없음';
    }

    // 2026년 말 최종 예상 소진율
    const regEoyVal = trendData[11].regressionCumulative;
    const projectedEoyRate = totalBudget > 0 ? (regEoyVal / totalBudget) * 100 : 0;
    
    return {
      monthlyExecutionData: trendData,
      maxSpendMonth: { month: maxMonthName, amount: maxAmt },
      avgMonthlySpend: avgSpend,
      remainingTargetAmount: remainTargetAmt,
      recommendedMonthlySpendForTarget,
      exhaustionMonthName: exhaustionMonth,
      projectedEoyExecutionRate: projectedEoyRate,
      totalPlannedInDraft,
      unplannedRemainingAmount,
      totalVirtualAdjustment
    };
  }, [filteredCategories, budgetEntries, executedBudget, totalBudget]);

  return {
    selectedProject, setSelectedProject,
    expandedCategory, setExpandedCategory,
    predictionModel, setPredictionModel,
    routineSpend, setRoutineSpend,
    detailedProjects,
    filteredCategories,
    totalBudget,
    executedBudget,
    remainingBudget,
    executionRate,
    pieData,
    breakdownData,
    monthlyExecutionData,
    maxSpendMonth,
    avgMonthlySpend,
    remainingTargetAmount,
    recommendedMonthlySpendForTarget,
    exhaustionMonthName,
    projectedEoyExecutionRate,
    totalPlannedInDraft,
    unplannedRemainingAmount,
    totalVirtualAdjustment
  };
}
