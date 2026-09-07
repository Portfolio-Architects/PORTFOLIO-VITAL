'use client';

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { SimulationEntry, ProjectSimulationSummary, StatItemSimulationSummary, generateId } from '@/types';
import { FESTIVAL_PRESET_SIMULATION_ENTRIES } from '@/lib/presets/festival5DomainPreset';

const SIMULATION_STORAGE_KEY = 'hchps-budget-simulations';

export const FESTIVAL_PRESET_ENTRIES = FESTIVAL_PRESET_SIMULATION_ENTRIES;

// Realistic Test Preset Data (8 Health Center / AI Medihealth Project Expenditures)
export const TEST_PRESET_ENTRIES: Omit<SimulationEntry, 'id' | 'createdAt'>[] = [
  {
    name: 'AI 헬스체크업 결과 분석 키오스크 구매',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 3500000,
    quantity: 2,
    amount: 7000000,
    memo: '건강증진지원실 AI 메디헬스 결과지 자동 출력 및 분석 키오스크 2대',
  },
  {
    name: '스마트 짐 근골격계 측정 장비 교정 소모품',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 250000,
    quantity: 4,
    amount: 1000000,
    memo: 'AI 신체측정 센서 정밀 교정용 센서 패키지',
  },
  {
    name: 'AI 메디헬스 센터 안내 리플릿 2차 인쇄',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 1200,
    quantity: 2500,
    amount: 3000000,
    memo: '주민 배포용 AI 운동처방 가이드북 2,500부',
  },
  {
    name: '체력측정 전담요원 하반기 피복비',
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 150000,
    quantity: 6,
    amount: 900000,
    memo: '체력측정 전담요원 하반기 지자체 유니폼 지원',
  },
  {
    name: '야외 건강체험관 공공전기료 및 수수료',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-02 공공운영비',
    unitPrice: 120000,
    quantity: 3,
    amount: 360000,
    memo: '체험관 시설 운영을 위한 공공요금 분납액',
  },
  {
    name: '주민 참여 AI 헬스케어 강좌 강사수당',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-03 행사운영비',
    unitPrice: 250000,
    quantity: 8,
    amount: 2000000,
    memo: '외부 운동처방 전문의 특강 수당 (총 8회)',
  },
  {
    name: '바른자세 개선사업 관내 학교 현장 출장 여비',
    detailedProject: '건강증진지원실 운영',
    statItem: '202-01 국내여비',
    unitPrice: 20000,
    quantity: 15,
    amount: 300000,
    memo: '초중고 출장 검진 관리자 현장 출장여비',
  },
  {
    name: '건강생활실천 프로그램 홍보 물품 구매',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 4500,
    quantity: 1000,
    amount: 4500000,
    memo: '캠페인용 하반기 건강 밴드 및 텀블러',
  },
];

export interface UseBudgetSimulatorReturn {
  // Data State
  entries: SimulationEntry[];
  isLoading: boolean;

  // Filter States
  selectedDetailedProject: string;
  selectedStatItem: string;

  // Dynamic Options & Helpers
  availableDetailedProjects: string[];
  availableStatItems: string[];
  getDetailedProjects: () => string[];
  getStatItemsForProject: (detailedProject: string) => string[];
  setSelectedDetailedProject: (dp: string) => void;
  setSelectedStatItem: (st: string) => void;

  // CRUD Actions
  addEntry: (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => SimulationEntry;
  updateEntry: (id: string, partial: Partial<SimulationEntry>) => void;
  deleteEntry: (id: string) => void;
  resetEntries: () => void;
  loadTestPreset: () => void;
  loadFestivalPreset: () => void;

  // Real Expenditure Lifecycle Action (정산 전환)
  settleEntry: (simId: string, actualAmount?: number, actualDate?: string) => Promise<void>;

  // Aggregated Summaries
  projectSummaries: ProjectSimulationSummary[];
  statItemSummaries: StatItemSimulationSummary[];

  // Utilities
  resolveCategoryId: (detailedProject: string, statItem: string) => string | undefined;
}

const emptySimEntries: SimulationEntry[] = [];
let cachedSimJson = '';
let cachedSimList: SimulationEntry[] = emptySimEntries;

const subscribeSimStorage = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === SIMULATION_STORAGE_KEY || !e.key) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

const getSimSnapshot = (): SimulationEntry[] => {
  if (typeof window === 'undefined') return emptySimEntries;
  const saved = localStorage.getItem(SIMULATION_STORAGE_KEY) || '';
  if (saved === cachedSimJson) return cachedSimList;
  cachedSimJson = saved;
  if (!saved) {
    cachedSimList = emptySimEntries;
    return emptySimEntries;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      cachedSimList = parsed as SimulationEntry[];
      return cachedSimList;
    }
  } catch {}
  cachedSimList = emptySimEntries;
  return emptySimEntries;
};

const getSimServerSnapshot = () => emptySimEntries;

export function useBudgetSimulator(): UseBudgetSimulatorReturn {
  const {
    categories,
    entries: budgetEntries,
    addEntry: addBudgetEntry,
    updateEntry: updateBudgetEntry,
    deleteEntry: deleteBudgetEntry,
    getCategoryStats,
    isLoading: budgetLoading
  } = useBudget();

  // Filter States
  const [selectedDetailedProject, setSelectedDetailedProject] = useState<string>('');
  const [selectedStatItem, setSelectedStatItem] = useState<string>('');

  // Simulation Entries State with SSR-safe useSyncExternalStore
  const storedEntries = useSyncExternalStore(subscribeSimStorage, getSimSnapshot, getSimServerSnapshot);
  const [entriesOverride, setEntriesOverride] = useState<SimulationEntry[] | null>(null);
  const entries = entriesOverride ?? storedEntries;

  const setEntries = useCallback((updater: SimulationEntry[] | ((prev: SimulationEntry[]) => SimulationEntry[])) => {
    setEntriesOverride(prev => {
      const current = prev ?? getSimSnapshot();
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.warn('[useBudgetSimulator] Failed to save simulation entries:', err);
        }
      }
      return next;
    });
  }, []);

  // Combine storedEntries with any SSOT budgetEntries that are planned (isPlanned: true)
  const mergedEntries = useMemo<SimulationEntry[]>(() => {
    const list = [...entries];
    const existingBudgetEntryIds = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (list[i].budgetEntryId) existingBudgetEntryIds.add(list[i].budgetEntryId!);
    }

    if (budgetEntries) {
      for (let i = 0; i < budgetEntries.length; i++) {
        const be = budgetEntries[i];
        if (be.isPlanned && !existingBudgetEntryIds.has(be.id)) {
          const cat = categories?.find(c => c.id === be.categoryId);
          list.push({
            id: be.simulationEntryId || `sim-be-${be.id}`,
            name: be.purpose,
            detailedProject: cat?.detailedProject || '기타사업',
            statItem: cat?.statItem || cat?.name || '일반운영비',
            categoryId: be.categoryId,
            unitPrice: be.amount,
            quantity: 1,
            amount: be.amount,
            memo: be.memo,
            createdAt: be.date || new Date().toISOString(),
            status: be.isSettled ? 'SETTLED' : 'PLANNED',
            budgetEntryId: be.id,
          });
        }
      }
    }
    return list;
  }, [entries, budgetEntries, categories]);

  // Pre-indexed O(1) lookup Map for category resolution by detailedProject + statItem
  const projectStatItemToCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    if (categories) {
      for (const c of categories) {
        if (c.detailedProject && c.statItem) {
          map.set(`${c.detailedProject}|||${c.statItem}`, c.id);
        }
      }
    }
    return map;
  }, [categories]);

  // 1. Resolve categoryId from detailedProject + statItem in O(1)
  const resolveCategoryId = useCallback((detailedProject: string, statItem: string): string | undefined => {
    if (!detailedProject || !statItem || !categories) return undefined;
    return projectStatItemToCategoryMap.get(`${detailedProject}|||${statItem}`);
  }, [categories, projectStatItemToCategoryMap]);

  // 2. Extract Available Detailed Projects (Unique Set)
  const availableDetailedProjects = useMemo(() => {
    if (!categories) return [];
    const set = new Set<string>();
    categories.forEach(c => {
      if (c.detailedProject && c.detailedProject.trim()) {
        set.add(c.detailedProject.trim());
      }
    });
    return Array.from(set).sort();
  }, [categories]);

  // Helper: getDetailedProjects
  const getDetailedProjects = useCallback(() => {
    return availableDetailedProjects;
  }, [availableDetailedProjects]);

  // Helper: getStatItemsForProject
  const getStatItemsForProject = useCallback((dp: string) => {
    if (!categories) return [];
    const set = new Set<string>();
    categories.forEach(c => {
      if ((!dp || c.detailedProject === dp) && c.statItem && c.statItem.trim()) {
        set.add(c.statItem.trim());
      }
    });
    return Array.from(set).sort();
  }, [categories]);

  // 3. Extract Available Stat Items (Filtered by selectedDetailedProject)
  const availableStatItems = useMemo(() => {
    return getStatItemsForProject(selectedDetailedProject);
  }, [getStatItemsForProject, selectedDetailedProject]);

  // 4. CRUD Operations
  const addEntry = useCallback((
    rawInput: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }
  ): SimulationEntry => {
    const unitPrice = rawInput.unitPrice || 0;
    const quantity = rawInput.quantity || 1;
    const computedAmount = rawInput.amount !== undefined 
      ? rawInput.amount 
      : unitPrice * quantity;
    
    const categoryId = rawInput.categoryId || resolveCategoryId(rawInput.detailedProject, rawInput.statItem);
    const newSimId = generateId();

    const newEntry: SimulationEntry = {
      ...rawInput,
      id: newSimId,
      unitPrice,
      quantity,
      amount: computedAmount,
      categoryId,
      createdAt: new Date().toISOString(),
      status: 'PLANNED',
    };

    // Auto-sync as BudgetEntry (isPlanned: true) to data/BUDGET_ENTRIES.json SSOT
    if (categoryId) {
      try {
        const created = addBudgetEntry({
          categoryId,
          amount: computedAmount,
          date: new Date().toISOString().split('T')[0],
          purpose: rawInput.name,
          memo: rawInput.memo ? `[시뮬레이션] ${rawInput.memo}` : `[시뮬레이션] 단가 ₩${unitPrice.toLocaleString('ko-KR')} × ${quantity}개`,
          isPlanned: true,
          isSettled: false,
          actionType: 'general',
          simulationEntryId: newSimId,
        });
        if (created && created.id) {
          newEntry.budgetEntryId = created.id;
        }
      } catch (err) {
        console.warn('[useBudgetSimulator] Failed to sync to BudgetEntry:', err);
      }
    }

    setEntries(prev => [newEntry, ...prev]);
    return newEntry;
  }, [resolveCategoryId, addBudgetEntry, setEntries]);

  const updateEntry = useCallback((id: string, partial: Partial<SimulationEntry>) => {
    setEntries(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...partial };
      if (partial.unitPrice !== undefined || partial.quantity !== undefined) {
        const u = updated.unitPrice || 0;
        const q = updated.quantity || 1;
        updated.amount = u * q;
      }
      if (partial.detailedProject !== undefined || partial.statItem !== undefined) {
        updated.categoryId = resolveCategoryId(updated.detailedProject, updated.statItem);
      }
      return updated;
    }));
  }, [resolveCategoryId, setEntries]);

  const deleteEntry = useCallback((id: string) => {
    const target = mergedEntries.find(item => item.id === id);
    if (target?.budgetEntryId) {
      deleteBudgetEntry(target.budgetEntryId);
    }
    setEntries(prev => prev.filter(item => item.id !== id));
  }, [mergedEntries, deleteBudgetEntry, setEntries]);

  // Real Expenditure Lifecycle Action (정산 전환)
  const settleEntry = useCallback(async (simId: string, actualAmount?: number, actualDate?: string) => {
    const sim = mergedEntries.find(e => e.id === simId);
    if (!sim) return;
    const finalAmount = actualAmount !== undefined ? actualAmount : sim.amount;
    const finalDate = actualDate || new Date().toISOString().split('T')[0];

    // 1. Mark planned budget entry as settled if linked
    if (sim.budgetEntryId) {
      await updateBudgetEntry(sim.budgetEntryId, { isSettled: true });
    }

    // 2. Add real expenditure entry to SSOT (isPlanned: false)
    const actualEntry = await addBudgetEntry({
      categoryId: sim.categoryId || resolveCategoryId(sim.detailedProject, sim.statItem) || '',
      amount: finalAmount,
      date: finalDate,
      purpose: `${sim.name} (실지출 집행)`,
      memo: sim.memo ? `${sim.memo} [시뮬레이션 정산 완료]` : `[시뮬레이션 정산 완료: ${sim.name}]`,
      isPlanned: false,
      isSettled: false,
      relatedPlanId: sim.budgetEntryId,
      actionType: 'general',
    });

    // 3. Mark sim entry as SETTLED in local state
    updateEntry(simId, {
      status: 'SETTLED',
      settledEntryId: actualEntry && 'id' in actualEntry ? (actualEntry.id as string) : undefined,
      settledDate: finalDate,
    });
  }, [mergedEntries, updateBudgetEntry, addBudgetEntry, resolveCategoryId, updateEntry]);

  const resetEntries = useCallback(() => {
    setEntries([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SIMULATION_STORAGE_KEY);
    }
  }, [setEntries]);

  const loadTestPreset = useCallback(() => {
    const now = new Date().toISOString();
    const presetEntriesWithIds: SimulationEntry[] = new Array(TEST_PRESET_ENTRIES.length);
    for (let i = 0; i < TEST_PRESET_ENTRIES.length; i++) {
      const item = TEST_PRESET_ENTRIES[i];
      presetEntriesWithIds[i] = {
        ...item,
        id: generateId(),
        categoryId: resolveCategoryId(item.detailedProject, item.statItem),
        createdAt: now,
      };
    }
    setEntries(presetEntriesWithIds);
  }, [resolveCategoryId, setEntries]);

  const loadFestivalPreset = useCallback(() => {
    const now = new Date().toISOString();
    const presetEntriesWithIds: SimulationEntry[] = new Array(FESTIVAL_PRESET_SIMULATION_ENTRIES.length);
    for (let i = 0; i < FESTIVAL_PRESET_SIMULATION_ENTRIES.length; i++) {
      const item = FESTIVAL_PRESET_SIMULATION_ENTRIES[i];
      presetEntriesWithIds[i] = {
        ...item,
        id: generateId(),
        categoryId: resolveCategoryId(item.detailedProject, item.statItem),
        createdAt: now,
      };
    }
    setEntries(presetEntriesWithIds);
  }, [resolveCategoryId, setEntries]);

  // 5. Calculate Real-Time Memoized Summaries (projectSummaries & statItemSummaries)
  const projectSummaries = useMemo<ProjectSimulationSummary[]>(() => {
    if (!categories) return [];

    const map = new Map<string, {
      totalBudget: number;
      currentSpent: number;
      simulatedExpenditure: number;
    }>();

    // Initialize with existing categories
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const dp = cat.detailedProject || '기타';
      let target = map.get(dp);
      if (!target) {
        target = { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 };
        map.set(dp, target);
      }
      const stats = getCategoryStats(cat.id);
      target.totalBudget += cat.totalBudget || 0;
      target.currentSpent += stats?.spent || 0;
    }

    // Add simulation entries (excluding settled ones)
    for (let i = 0; i < mergedEntries.length; i++) {
      const entry = mergedEntries[i];
      if (entry.status === 'SETTLED') continue;
      const dp = entry.detailedProject || '기타';
      let target = map.get(dp);
      if (!target) {
        target = { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 };
        map.set(dp, target);
      }
      target.simulatedExpenditure += entry.amount || 0;
    }

    // Convert map to summary objects
    const results: ProjectSimulationSummary[] = [];
    for (const [dp, val] of map) {
      const currentRemaining = val.totalBudget - val.currentSpent;
      const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;
      const executionRate = val.totalBudget > 0 
        ? ((val.currentSpent + val.simulatedExpenditure) / val.totalBudget) * 100 
        : 0;
      
      results.push({
        detailedProject: dp,
        totalBudget: val.totalBudget,
        currentSpent: val.currentSpent,
        currentRemaining,
        simulatedExpenditure: val.simulatedExpenditure,
        finalExpectedBalance,
        executionRate,
        isDeficit: finalExpectedBalance < 0,
      });
    }

    return results.sort((a, b) => a.detailedProject.localeCompare(b.detailedProject));
  }, [categories, getCategoryStats, mergedEntries]);

  const statItemSummaries = useMemo<StatItemSimulationSummary[]>(() => {
    if (!categories) return [];

    const map = new Map<string, {
      statItem: string;
      detailedProject: string;
      totalBudget: number;
      currentSpent: number;
      simulatedExpenditure: number;
    }>();

    // Key format: `${dp}::${st}`
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const dp = cat.detailedProject || '기타';
      const st = cat.statItem || '일반';
      const key = `${dp}::${st}`;

      let target = map.get(key);
      if (!target) {
        target = {
          statItem: st,
          detailedProject: dp,
          totalBudget: 0,
          currentSpent: 0,
          simulatedExpenditure: 0,
        };
        map.set(key, target);
      }
      const stats = getCategoryStats(cat.id);
      target.totalBudget += cat.totalBudget || 0;
      target.currentSpent += stats?.spent || 0;
    }

    // Add simulation entries (excluding settled ones)
    for (let i = 0; i < mergedEntries.length; i++) {
      const entry = mergedEntries[i];
      if (entry.status === 'SETTLED') continue;
      const dp = entry.detailedProject || '기타';
      const st = entry.statItem || '일반';
      const key = `${dp}::${st}`;

      let target = map.get(key);
      if (!target) {
        target = {
          statItem: st,
          detailedProject: dp,
          totalBudget: 0,
          currentSpent: 0,
          simulatedExpenditure: 0,
        };
        map.set(key, target);
      }
      target.simulatedExpenditure += entry.amount || 0;
    }

    // Convert map to summary objects
    const results: StatItemSimulationSummary[] = [];
    for (const val of map.values()) {
      const currentRemaining = val.totalBudget - val.currentSpent;
      const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;

      results.push({
        statItem: val.statItem,
        detailedProject: val.detailedProject,
        totalBudget: val.totalBudget,
        currentSpent: val.currentSpent,
        currentRemaining,
        simulatedExpenditure: val.simulatedExpenditure,
        finalExpectedBalance,
        isDeficit: finalExpectedBalance < 0,
      });
    }

    return results.sort((a, b) => {
      const dpComp = a.detailedProject.localeCompare(b.detailedProject);
      if (dpComp !== 0) return dpComp;
      return a.statItem.localeCompare(b.statItem);
    });
  }, [categories, getCategoryStats, mergedEntries]);

  return {
    entries: mergedEntries,
    isLoading: budgetLoading,
    selectedDetailedProject,
    selectedStatItem,
    availableDetailedProjects,
    availableStatItems,
    getDetailedProjects,
    getStatItemsForProject,
    setSelectedDetailedProject,
    setSelectedStatItem,
    addEntry,
    updateEntry,
    deleteEntry,
    resetEntries,
    loadTestPreset,
    loadFestivalPreset,
    settleEntry,
    projectSummaries,
    statItemSummaries,
    resolveCategoryId,
  };
}
