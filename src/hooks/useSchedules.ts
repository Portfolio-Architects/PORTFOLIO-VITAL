'use client';

import { useCallback, useMemo, useContext } from 'react';
import { useQuery, useMutation, QueryClientContext } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from '@/lib/query-client';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Schedule, generateId } from '@/types';

const STORAGE_KEY = 'hchps-schedules';
const TOMBSTONE_STORAGE_KEY = 'hchps-global-tombstones';
const EMPTY_SCHEDULES: Schedule[] = [];

function readLocalTombstones(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
          return (item as { id: string }).id;
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function recordLocalTombstone(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const array = Array.isArray(list) ? list : [];
    const exists = array.some((item: unknown) =>
      typeof item === 'string' ? item === id : Boolean(item && typeof item === 'object' && (item as { id?: string }).id === id)
    );
    if (!exists) {
      array.push(id);
      window.localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(array));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function useSchedules(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClientContext = useContext(QueryClientContext);
  const queryClient = queryClientContext || defaultQueryClient;

  const { data: schedules = [], isLoading: loading } = useQuery<Schedule[]>({
    queryKey: ['SCHEDULES'],
    queryFn: async () => {
      try {
        const rows = await readSheet<Schedule>('SCHEDULES');
        const deletedSet = new Set(readLocalTombstones());
        const filtered = (Array.isArray(rows) ? rows : []).filter(s => !deletedSet.has(s.id));
        if (filtered.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)); } catch {}
          return filtered;
        }
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed.filter((s: Schedule) => !deletedSet.has(s.id));
          }
        } catch {}
        return filtered;
      } catch {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            const deletedSet = new Set(readLocalTombstones());
            if (Array.isArray(parsed)) return parsed.filter((s: Schedule) => !deletedSet.has(s.id));
          }
        } catch {}
        return [];
      }
    },
    initialData: () => {
      if (typeof window === 'undefined') return [];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const deletedSet = new Set(readLocalTombstones());
          if (Array.isArray(parsed)) return parsed.filter((s: Schedule) => !deletedSet.has(s.id));
        }
      } catch {}
      return [];
    },
    initialDataUpdatedAt: 0,
    enabled,
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  }, queryClient);

  const addScheduleMut = useMutation({
    mutationFn: (newSchedule: Schedule) => addRow('SCHEDULES', newSchedule),
    onMutate: async (newSchedule: Schedule) => {
      await queryClient.cancelQueries({ queryKey: ['SCHEDULES'] });
      const previous = queryClient.getQueryData<Schedule[]>(['SCHEDULES']);
      const next = [newSchedule, ...(previous || [])];
      queryClient.setQueryData<Schedule[]>(['SCHEDULES'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, newSchedule, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['SCHEDULES'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['SCHEDULES'] });
      }
    }
  }, queryClient);

  const updateScheduleMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Schedule> }) =>
      updateRow('SCHEDULES', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['SCHEDULES'] });
      const previous = queryClient.getQueryData<Schedule[]>(['SCHEDULES']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      const next = (previous || []).map(s => s.id === id ? { ...s, ...updatedFields } : s);
      queryClient.setQueryData<Schedule[]>(['SCHEDULES'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['SCHEDULES'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['SCHEDULES'] });
      }
    }
  }, queryClient);

  const deleteScheduleMut = useMutation({
    mutationFn: (id: string) => deleteRow('SCHEDULES', id),
    onMutate: async (id: string) => {
      recordLocalTombstone(id);
      await queryClient.cancelQueries({ queryKey: ['SCHEDULES'] });
      const previous = queryClient.getQueryData<Schedule[]>(['SCHEDULES']);
      const next = (previous || []).filter(s => s.id !== id);
      queryClient.setQueryData<Schedule[]>(['SCHEDULES'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['SCHEDULES'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['SCHEDULES'] });
      }
    }
  }, queryClient);

  const schedulesByDateMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      let list = map.get(s.date);
      if (!list) {
        list = [];
        map.set(s.date, list);
      }
      list.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [schedules]);

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    addScheduleMut.mutate(newSchedule);
    return newSchedule;
  }, [addScheduleMut]);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    updateScheduleMut.mutate({ id, updates });
  }, [updateScheduleMut]);

  const deleteSchedule = useCallback((id: string) => {
    deleteScheduleMut.mutate(id);
  }, [deleteScheduleMut]);

  const getSchedulesForDate = useCallback((dateStr: string) => {
    return schedulesByDateMap.get(dateStr) || EMPTY_SCHEDULES;
  }, [schedulesByDateMap]);

  const importCalendar = useCallback(async (params: { icsUrl?: string; rawIcs?: string }) => {
    const res = await fetch('/api/calendar/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.success) {
      queryClient.invalidateQueries({ queryKey: ['SCHEDULES'] });
      return { success: true, count: data.importedCount || 0 };
    }
    return { success: false, error: data.error || '일정 가져오기에 실패했습니다.' };
  }, [queryClient]);

  return {
    schedules,
    loading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedulesForDate,
    importCalendar
  };
}


