'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow, replaceAll, getTombstones } from '@/lib/sheets-api';
import { BudgetCategory, BudgetEntry, generateId } from '@/types';

export interface CategoryStats {
  totalBudget: number;
  spent: number;
  planned: number;
  locked: number;
  remaining: number;
  usageRate: number;
  generalSpent: number;
  dailyExpenseIssued: number;
  dailyExpenseSpent: number;
  dailyExpenseRemaining: number;
}

export function useBudget() {
  const queryClient = useQueryClient();

  const { data: rawCategories = [], isLoading: catLoading } = useQuery({
    queryKey: ['BUDGET_CATEGORIES'],
    queryFn: () => readSheet<BudgetCategory>('BUDGET_CATEGORIES'),
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const { data: entries = [], isLoading: entryLoading } = useQuery({
    queryKey: ['BUDGET_ENTRIES'],
    queryFn: () => readSheet<BudgetEntry>('BUDGET_ENTRIES'),
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  // Deduplicate categories based on a composite key to prevent double-counting
  // FIX: Include 'name' in the key to prevent merging distinct categories
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    const result: BudgetCategory[] = [];
    for (let i = 0; i < rawCategories.length; i++) {
      const c = rawCategories[i];
      const key = `${c.name}-${c.policyProject}-${c.unitProject}-${c.detailedProject}-${c.statItem}-${c.budgetType || '본예산'}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }
    return result;
  }, [rawCategories]);

  // Pre-indexed O(1) lookup Map for categories by ID
  const categoriesByIdMap = useMemo(() => {
    const map = new Map<string, BudgetCategory>();
    for (const c of rawCategories) {
      map.set(c.id, c);
    }
    return map;
  }, [rawCategories]);

  // Pre-indexed O(1) lookup Map for entries by ID
  const entriesByIdMap = useMemo(() => {
    const map = new Map<string, BudgetEntry>();
    for (const e of entries) {
      map.set(e.id, e);
    }
    return map;
  }, [entries]);

  // ================= Category Mutations =================
  const addCategoryMut = useMutation({
    mutationFn: (newCat: BudgetCategory) => addRow('BUDGET_CATEGORIES', newCat),
    onMutate: async (newCat) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => [...(old || []), newCat]);
      return { previous };
    },
    onError: (err, newCat, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      }
    }
  });

  const updateCategoryMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<BudgetCategory> }) => {
      // E2EE requires full payload replacement. Merge frontend state first with O(1) Map lookup.
      const cached = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      let existing: BudgetCategory | undefined;
      if (cached) {
        const catMap = new Map<string, BudgetCategory>();
        for (let i = 0; i < cached.length; i++) {
          catMap.set(cached[i].id, cached[i]);
        }
        existing = catMap.get(id);
      } else {
        existing = categoriesByIdMap.get(id);
      }
      if (!existing) throw new Error("Item not found in cache");
      const fullItem = { ...existing, ...updates };
      return updateRow('BUDGET_CATEGORIES', id, fullItem);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => (old || []).map(c => c.id === id ? { ...c, ...updates } : c));
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      }
    }
  });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => deleteRow('BUDGET_CATEGORIES', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => (old || []).filter(c => c.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      }
    }
  });

  const replaceCategoriesMut = useMutation({
    mutationFn: (newCategories: BudgetCategory[]) => replaceAll('BUDGET_CATEGORIES', newCategories),
    onMutate: async (newCategories) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], newCategories);
      return { previous };
    },
    onError: (err, newCategories, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      }
    }
  });

  // ================= Entry Mutations =================
  const addEntryMut = useMutation({
    mutationFn: (newEntry: BudgetEntry) => addRow('BUDGET_ENTRIES', newEntry),
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => [newEntry, ...(old || [])]);
      return { previous };
    },
    onError: (err, newEntry, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      }
    }
  });

  const updateEntryMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<BudgetEntry> }) => {
      // E2EE requires full payload replacement. Merge frontend state first with O(1) Map lookup.
      const cached = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      let existing: BudgetEntry | undefined;
      if (cached) {
        const entryMap = new Map<string, BudgetEntry>();
        for (let i = 0; i < cached.length; i++) {
          entryMap.set(cached[i].id, cached[i]);
        }
        existing = entryMap.get(id);
      } else {
        existing = entriesByIdMap.get(id);
      }
      if (!existing) throw new Error("Item not found in cache");
      const fullItem = { ...existing, ...updates };
      return updateRow('BUDGET_ENTRIES', id, fullItem);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => (old || []).map(e => e.id === id ? { ...e, ...updates } : e));
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      }
    }
  });

  const deleteEntryMut = useMutation({
    mutationFn: (id: string) => deleteRow('BUDGET_ENTRIES', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => (old || []).filter(e => e.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      }
    }
  });

  const replaceEntriesMut = useMutation({
    mutationFn: (newEntries: BudgetEntry[]) => replaceAll('BUDGET_ENTRIES', newEntries),
    onMutate: async (newEntries) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], newEntries);
      return { previous };
    },
    onError: (err, newEntries, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      }
    }
  });


  // Action Wrappers
  const addCategory = useCallback((cat: Omit<BudgetCategory, 'id'>) => {
    const newCat: BudgetCategory = { ...cat, id: generateId() };
    addCategoryMut.mutate(newCat);
    return newCat;
  }, [addCategoryMut]);

  const updateCategory = useCallback((id: string, updates: Partial<BudgetCategory>) => {
    updateCategoryMut.mutate({ id, updates });
  }, [updateCategoryMut]);

  const deleteCategory = useCallback((id: string) => {
    deleteCategoryMut.mutate(id);
    // Filter out associated entries and update with a single replace call to prevent cascading mutations and file-lock race conditions
    const remainingEntries = entries.filter(e => e.categoryId !== id);
    replaceEntriesMut.mutate(remainingEntries);
  }, [entries, deleteCategoryMut, replaceEntriesMut]);

  const replaceCategories = useCallback((newCategories: BudgetCategory[]) => {
    replaceCategoriesMut.mutate(newCategories);
  }, [replaceCategoriesMut]);

  // checkLimit and Entry mutations moved below getCategoryStats

  // Pre-calculate statistics Map for all unique categories to avoid O(N * M) overhead
  const categoryStatsMap = useMemo(() => {
    // Group entries by categoryId first for O(M) grouping
    const entriesMap = new Map<string, BudgetEntry[]>();
    for (const e of entries) {
      if (!entriesMap.has(e.categoryId)) {
        entriesMap.set(e.categoryId, []);
      }
      entriesMap.get(e.categoryId)!.push(e);
    }

    const statsMap = new Map<string, { standard: CategoryStats; excludePlanned: CategoryStats }>();

    for (const cat of uniqueCategories) {
      const catEntries = entriesMap.get(cat.id) || [];
      
      let generalSpent = 0;
      let dailyExpenseIssued = 0;
      let dailyExpenseSpent = 0;
      let planned = 0;

      for (const e of catEntries) {
        if (e.isPlanned) {
          if (!e.isSettled) planned += e.amount;
        } else {
          if (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer') {
            if (e.actionType === 'transfer') {
              if (e.transferDirection === 'out') generalSpent += e.amount;
              else generalSpent -= e.amount;
            } else {
              generalSpent += e.amount;
            }
          } else if (e.actionType === 'issuance') {
            dailyExpenseIssued += e.amount;
          } else if (e.actionType === 'daily_expense') {
            dailyExpenseSpent += e.amount;
          }
        }
      }

      const spent = generalSpent + dailyExpenseIssued;
      
      let lockedAmount = 0;
      if (cat.subItems) {
        for (const sub of cat.subItems) {
          if (sub.isLocked) {
            lockedAmount += sub.amount;
          } else if (sub.calculations) {
            for (const calc of sub.calculations) {
              if (calc.isLocked) lockedAmount += calc.amount;
            }
          }
        }
      }

      const remaining = cat.totalBudget - spent - planned - lockedAmount;
      const dailyExpenseRemaining = dailyExpenseIssued - dailyExpenseSpent;
      const usageRate = cat.totalBudget > 0 ? ((spent + planned) / cat.totalBudget) * 100 : 0;

      const standard: CategoryStats = {
        totalBudget: cat.totalBudget,
        spent,
        planned,
        locked: lockedAmount,
        remaining,
        usageRate,
        generalSpent,
        dailyExpenseIssued,
        dailyExpenseSpent,
        dailyExpenseRemaining
      };

      const remainingExclude = cat.totalBudget - spent - lockedAmount;
      const usageRateExclude = cat.totalBudget > 0 ? (spent / cat.totalBudget) * 100 : 0;

      const excludePlanned: CategoryStats = {
        totalBudget: cat.totalBudget,
        spent,
        planned: 0,
        locked: lockedAmount,
        remaining: remainingExclude,
        usageRate: usageRateExclude,
        generalSpent,
        dailyExpenseIssued,
        dailyExpenseSpent,
        dailyExpenseRemaining
      };

      statsMap.set(cat.id, { standard, excludePlanned });
    }

    return statsMap;
  }, [uniqueCategories, entries]);


  // Pre-indexed O(1) lookup Map for entries with relatedPlanId
  const childEntriesByPlanIdMap = useMemo(() => {
    const map = new Map<string, BudgetEntry[]>();
    for (const e of entries) {
      if (e.relatedPlanId) {
        let list = map.get(e.relatedPlanId);
        if (!list) {
          list = [];
          map.set(e.relatedPlanId, list);
        }
        list.push(e);
      }
    }
    return map;
  }, [entries]);

  // Derived Stats - O(1) zero-allocation lookup from pre-cached stats Map
  const getCategoryStats = useCallback((categoryId: string, excludePlanned = false): CategoryStats | null => {
    const cached = categoryStatsMap.get(categoryId);
    if (!cached) return null;
    return excludePlanned ? cached.excludePlanned : cached.standard;
  }, [categoryStatsMap]);

  const checkLimit = useCallback((categoryId: string, amount: number, actionType?: string, entryId?: string, transferDirection?: string, isPlanned?: boolean) => {
    if (actionType === 'correction') return true;
    if (actionType === 'transfer' && transferDirection !== 'out') return true;
    
    const stats = getCategoryStats(categoryId);
    if (!stats) return true;
    
    let oldAmount = 0;
    if (entryId) {
      const oldEntry = entriesByIdMap.get(entryId);
      if (oldEntry && oldEntry.categoryId === categoryId) {
        oldAmount = oldEntry.amount;
      }
    }
    const delta = amount - oldAmount;
    if (delta <= 0) return true;

    if (actionType === 'daily_expense') {
      if (delta > stats.dailyExpenseRemaining) {
        alert(`[일상경비 한도 초과] 등록하려는 금액이 일상경비 잔액(${stats.dailyExpenseRemaining.toLocaleString()}원)을 초과하여 등록을 차단합니다.`);
        return false;
      }
    } else {
      const limit = isPlanned
        ? stats.remaining
        : (stats.totalBudget - stats.spent - stats.locked);

      if (delta > limit) {
        alert(`[예산 한도 초과] 등록하려는 금액이 가용 예산 잔액(${limit.toLocaleString()}원)을 초과하여 등록을 차단합니다.`);
        return false;
      }
    }
    return true;
  }, [entriesByIdMap, getCategoryStats]);

  const addEntry = useCallback((entry: Omit<BudgetEntry, 'id'>) => {
    if (!checkLimit(entry.categoryId, entry.amount, entry.actionType, undefined, entry.transferDirection, entry.isPlanned)) {
      return null;
    }
    const newEntry: BudgetEntry = { ...entry, id: generateId() };
    addEntryMut.mutate(newEntry);
    return newEntry;
  }, [addEntryMut, checkLimit]);

  const updateEntry = useCallback((id: string, updates: Partial<BudgetEntry>) => {
    const existing = entriesByIdMap.get(id);
    if (existing) {
      const targetCatId = updates.categoryId || existing.categoryId;
      const targetAmount = updates.amount !== undefined ? updates.amount : existing.amount;
      const targetActionType = updates.actionType || existing.actionType;
      const targetTransferDir = updates.transferDirection !== undefined ? updates.transferDirection : existing.transferDirection;
      const targetIsPlanned = updates.isPlanned !== undefined ? updates.isPlanned : existing.isPlanned;
      
      if (!checkLimit(targetCatId, targetAmount, targetActionType, id, targetTransferDir, targetIsPlanned)) {
        return;
      }
    }
    updateEntryMut.mutate({ id, updates });
  }, [updateEntryMut, entriesByIdMap, checkLimit]);

  const deleteEntry = useCallback((id: string) => {
    const entryToDelete = entriesByIdMap.get(id);
    if (entryToDelete && entryToDelete.isPlanned) {
      const childList = childEntriesByPlanIdMap.get(id);
      if (childList && childList.length > 0) {
        alert('이 품의서(원인행위)에 연결된 실제 지출 내역이 존재하여 삭제할 수 없습니다. 연결된 지출 내역을 먼저 삭제하거나 수정해주세요.');
        return;
      }
    }
    deleteEntryMut.mutate(id);
  }, [deleteEntryMut, entriesByIdMap, childEntriesByPlanIdMap]);

  // ================= Batch Entry Mutations =================
  const batchUpdateEntriesMut = useMutation({
    mutationFn: async ({ ids, updates, items }: { ids?: string[]; updates?: Partial<BudgetEntry>; items?: Array<{ id: string; [key: string]: any }> }) => {
      const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
      let newEntries = [...current];
      if (items && items.length > 0) {
        const itemMap = new Map(items.map(item => [item.id, item]));
        newEntries = current.map(e => itemMap.has(e.id) ? { ...e, ...itemMap.get(e.id) } : e);
      } else if (ids && updates) {
        const idSet = new Set(ids);
        newEntries = current.map(e => idSet.has(e.id) ? { ...e, ...updates } : e);
      }
      await replaceAll('BUDGET_ENTRIES', newEntries);
      return newEntries;
    },
    onMutate: async ({ ids, updates, items }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      let newEntries = [...(previous || [])];
      if (items && items.length > 0) {
        const itemMap = new Map(items.map(item => [item.id, item]));
        newEntries = (previous || []).map(e => itemMap.has(e.id) ? { ...e, ...itemMap.get(e.id) } : e);
      } else if (ids && updates) {
        const idSet = new Set(ids);
        newEntries = (previous || []).map(e => idSet.has(e.id) ? { ...e, ...updates } : e);
      }
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], newEntries);
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    }
  });

  const batchDeleteEntriesMut = useMutation({
    mutationFn: async (ids: string[]) => {
      if (typeof window !== 'undefined') {
        try {
          const tombstones = getTombstones();
          const tombstoneIdSet = new Set(tombstones.map(t => t.id));
          let changed = false;
          ids.forEach(id => {
            if (!tombstoneIdSet.has(id)) {
              tombstones.push({ id, deletedAt: Date.now() });
              tombstoneIdSet.add(id);
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem('hchps-global-tombstones', JSON.stringify(tombstones));
          }
        } catch {}
      }
      const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
      const idSet = new Set(ids);
      const remaining = current.filter(e => !idSet.has(e.id));
      await replaceAll('BUDGET_ENTRIES', remaining);
      return remaining;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      const idSet = new Set(ids);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) =>
        (old || []).filter(e => !idSet.has(e.id))
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    }
  });

  const batchSettleEntriesMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'SETTLED' | 'PENDING' | 'REJECTED' }) => {
      const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
      const idSet = new Set(ids);
      const newEntries = current.map(e => {
        if (!idSet.has(e.id)) return e;
        if (status === 'SETTLED') {
          return { ...e, isSettled: true, isPlanned: false };
        } else if (status === 'PENDING') {
          return { ...e, isSettled: false, isPlanned: true };
        } else {
          const memoText = e.memo?.includes('[지출반려]') ? e.memo : (e.memo ? `${e.memo} [지출반려]` : '[지출반려]');
          return { ...e, isSettled: false, isPlanned: false, memo: memoText };
        }
      });
      await replaceAll('BUDGET_ENTRIES', newEntries);
      return newEntries;
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      const idSet = new Set(ids);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) =>
        (old || []).map(e => {
          if (!idSet.has(e.id)) return e;
          if (status === 'SETTLED') {
            return { ...e, isSettled: true, isPlanned: false };
          } else if (status === 'PENDING') {
            return { ...e, isSettled: false, isPlanned: true };
          } else {
            const memoText = e.memo?.includes('[지출반려]') ? e.memo : (e.memo ? `${e.memo} [지출반려]` : '[지출반려]');
            return { ...e, isSettled: false, isPlanned: false, memo: memoText };
          }
        })
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
      queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    }
  });

  const batchUpdateEntries = useCallback((
    idsOrUpdates: string[] | Array<{ id: string; [key: string]: any }>,
    updates?: Partial<BudgetEntry>
  ) => {
    if (!idsOrUpdates || (Array.isArray(idsOrUpdates) && idsOrUpdates.length === 0)) return;
    const catExtraDelta = new Map<string, number>();

    if (typeof idsOrUpdates[0] === 'string') {
      const ids = idsOrUpdates as string[];
      if (updates) {
        for (const id of ids) {
          const existing = entriesByIdMap.get(id);
          if (existing) {
            const targetCatId = updates.categoryId || existing.categoryId;
            const targetAmount = updates.amount !== undefined ? updates.amount : existing.amount;
            const targetActionType = updates.actionType || existing.actionType;
            const targetTransferDir = updates.transferDirection !== undefined ? updates.transferDirection : existing.transferDirection;
            const targetIsPlanned = updates.isPlanned !== undefined ? updates.isPlanned : existing.isPlanned;

            const extra = catExtraDelta.get(targetCatId) || 0;
            if (!checkLimit(targetCatId, targetAmount + extra, targetActionType, id, targetTransferDir, targetIsPlanned)) {
              return;
            }

            let oldAmount = 0;
            if (existing.categoryId === targetCatId) {
              oldAmount = existing.amount;
            }
            const delta = targetAmount - oldAmount;
            catExtraDelta.set(targetCatId, extra + delta);
          }
        }
        batchUpdateEntriesMut.mutate({ ids, updates });
      }
    } else {
      const items = idsOrUpdates as Array<{ id: string; [key: string]: any }>;
      for (const item of items) {
        const existing = entriesByIdMap.get(item.id);
        if (existing) {
          const targetCatId = item.categoryId || existing.categoryId;
          const targetAmount = item.amount !== undefined ? item.amount : existing.amount;
          const targetActionType = item.actionType || existing.actionType;
          const targetTransferDir = item.transferDirection !== undefined ? item.transferDirection : existing.transferDirection;
          const targetIsPlanned = item.isPlanned !== undefined ? item.isPlanned : existing.isPlanned;

          const extra = catExtraDelta.get(targetCatId) || 0;
          if (!checkLimit(targetCatId, targetAmount + extra, targetActionType, item.id, targetTransferDir, targetIsPlanned)) {
            return;
          }

          let oldAmount = 0;
          if (existing.categoryId === targetCatId) {
            oldAmount = existing.amount;
          }
          const delta = targetAmount - oldAmount;
          catExtraDelta.set(targetCatId, extra + delta);
        }
      }
      batchUpdateEntriesMut.mutate({ items });
    }
  }, [batchUpdateEntriesMut, entriesByIdMap, checkLimit]);

  const batchDeleteEntries = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    for (const id of ids) {
      const entryToDelete = entriesByIdMap.get(id);
      if (entryToDelete && entryToDelete.isPlanned) {
        const childList = childEntriesByPlanIdMap.get(id);
        const hasSettledChildren = childList && childList.some(e => !idSet.has(e.id));
        if (hasSettledChildren) {
          alert('이 품의서(원인행위)에 연결된 실제 지출 내역이 존재하여 삭제할 수 없습니다. 연결된 지출 내역을 먼저 삭제하거나 수정해주세요.');
          return;
        }
      }
    }
    batchDeleteEntriesMut.mutate(ids);
  }, [batchDeleteEntriesMut, entriesByIdMap, childEntriesByPlanIdMap]);

  const batchSettleEntries = useCallback((ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => {
    if (!ids || ids.length === 0) return;
    batchSettleEntriesMut.mutate({ ids, status });
  }, [batchSettleEntriesMut]);

  const overallStats = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let totalPlanned = 0;
    let totalLocked = 0;
    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;

    for (const { standard: st } of categoryStatsMap.values()) {
      totalBudget += st.totalBudget;
      totalSpent += st.spent;
      totalPlanned += st.planned;
      totalLocked += st.locked;
      dailyExpenseIssued += st.dailyExpenseIssued;
      dailyExpenseSpent += st.dailyExpenseSpent;
    }
    
    return { 
      totalBudget, 
      totalSpent, 
      totalPlanned, 
      totalLocked,
      remaining: totalBudget - totalSpent - totalPlanned - totalLocked,
      dailyExpenseIssued,
      dailyExpenseSpent,
      dailyExpenseRemaining: dailyExpenseIssued - dailyExpenseSpent
    };
  }, [categoryStatsMap]);

  const overallStatsActual = useMemo(() => {
    return { 
      totalBudget: overallStats.totalBudget, 
      totalSpent: overallStats.totalSpent, 
      totalPlanned: 0, 
      totalLocked: overallStats.totalLocked,
      remaining: overallStats.totalBudget - overallStats.totalSpent - overallStats.totalLocked,
      dailyExpenseIssued: overallStats.dailyExpenseIssued,
      dailyExpenseSpent: overallStats.dailyExpenseSpent,
      dailyExpenseRemaining: overallStats.dailyExpenseRemaining
    };
  }, [overallStats]);

  return { 
    categories: uniqueCategories, 
    entries, 
    isLoading: catLoading || entryLoading,
    addCategory, 
    updateCategory, 
    deleteCategory, 
    replaceCategories,
    addEntry, 
    updateEntry, 
    deleteEntry, 
    batchUpdateEntries,
    batchDeleteEntries,
    batchSettleEntries,
    getCategoryStats, 
    checkLimit,
    overallStats,
    overallStatsActual
  };
}
