'use client';

import { useCallback, useMemo, useContext } from 'react';
import { useQuery, useMutation, QueryClientContext } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from '@/lib/query-client';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Meeting, generateId } from '@/types';

const STORAGE_KEY = 'hchps-meetings';
const TOMBSTONE_STORAGE_KEY = 'hchps-global-tombstones';

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

export function useMeetings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClientContext = useContext(QueryClientContext);
  const queryClient = queryClientContext || defaultQueryClient;

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['MEETINGS'],
    queryFn: async () => {
      try {
        const rows = await readSheet<Meeting>('MEETINGS');
        const deletedSet = new Set(readLocalTombstones());
        const filtered = (Array.isArray(rows) ? rows : []).filter(m => !deletedSet.has(m.id));
        if (filtered.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)); } catch {}
          return filtered;
        }
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed.filter((m: Meeting) => !deletedSet.has(m.id));
          }
        } catch {}
        return filtered;
      } catch {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            const deletedSet = new Set(readLocalTombstones());
            if (Array.isArray(parsed)) return parsed.filter((m: Meeting) => !deletedSet.has(m.id));
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
          if (Array.isArray(parsed)) return parsed.filter((m: Meeting) => !deletedSet.has(m.id));
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

  const addMeetingMut = useMutation({
    mutationFn: (newMeeting: Meeting) => addRow('MEETINGS', newMeeting),
    onMutate: async (newMeeting: Meeting) => {
      await queryClient.cancelQueries({ queryKey: ['MEETINGS'] });
      const previous = queryClient.getQueryData<Meeting[]>(['MEETINGS']);
      const next = [newMeeting, ...(previous || [])];
      queryClient.setQueryData<Meeting[]>(['MEETINGS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, newMeeting, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['MEETINGS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['MEETINGS'] });
      }
    }
  }, queryClient);

  const updateMeetingMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Meeting> }) =>
      updateRow('MEETINGS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['MEETINGS'] });
      const previous = queryClient.getQueryData<Meeting[]>(['MEETINGS']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      const next = (previous || []).map(m => m.id === id ? { ...m, ...updatedFields } : m);
      queryClient.setQueryData<Meeting[]>(['MEETINGS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['MEETINGS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['MEETINGS'] });
      }
    }
  }, queryClient);

  const deleteMeetingMut = useMutation({
    mutationFn: (id: string) => deleteRow('MEETINGS', id),
    onMutate: async (id: string) => {
      recordLocalTombstone(id);
      await queryClient.cancelQueries({ queryKey: ['MEETINGS'] });
      const previous = queryClient.getQueryData<Meeting[]>(['MEETINGS']);
      const next = (previous || []).filter(m => m.id !== id);
      queryClient.setQueryData<Meeting[]>(['MEETINGS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['MEETINGS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['MEETINGS'] });
      }
    }
  }, queryClient);

  // Pre-indexed O(1) lookup Map for meetings by ID
  const meetingsByIdMap = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const m of meetings) {
      map.set(m.id, m);
    }
    return map;
  }, [meetings]);

  const addMeeting = useCallback((meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newMeeting: Meeting = { ...meeting, id: generateId(), createdAt: now, updatedAt: now };
    addMeetingMut.mutate(newMeeting);
    return newMeeting;
  }, [addMeetingMut]);

  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    updateMeetingMut.mutate({ id, updates });
  }, [updateMeetingMut]);

  const deleteMeeting = useCallback((id: string) => {
    deleteMeetingMut.mutate(id);
  }, [deleteMeetingMut]);

  const getUpcomingMeetings = useCallback((limit: number = 5) => {
    const nowTime = Date.now();
    const upcoming: { meeting: Meeting; time: number }[] = [];
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      const time = Date.parse(m.datetime) || 0;
      if (time >= nowTime) {
        upcoming.push({ meeting: m, time });
      }
    }
    upcoming.sort((a, b) => a.time - b.time);
    const resultCount = Math.min(limit, upcoming.length);
    const result: Meeting[] = new Array(resultCount);
    for (let i = 0; i < resultCount; i++) {
      result[i] = upcoming[i].meeting;
    }
    return result;
  }, [meetings]);

  const getTodayMeetings = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const result: Meeting[] = [];
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      if (m.datetime && m.datetime.startsWith(today)) {
        result.push(m);
      }
    }
    return result;
  }, [meetings]);

  const getMeetingById = useCallback((id: string) => {
    return meetingsByIdMap.get(id);
  }, [meetingsByIdMap]);

  return { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings, getMeetingById };
}


