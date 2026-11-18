'use client';

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useQuery, QueryClientContext } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from '@/lib/query-client';
import { WorkingMemoryCategory, WorkingMemoryMemo, WorkingMemorySource } from '@/types';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import {
  createWorkingMemoryMemosFromText,
  DEFAULT_WORKING_MEMORY_MEMOS,
  getContextRelevantMemos,
  nextMonotonicIso,
  parseWorkingMemoryInput,
  WorkingMemoryContextModule,
} from '@/lib/working-memory-parser';

const SHEET_NAME = 'WORKING_MEMORY';
const STORAGE_KEY = 'hchps-working-memory-v1';
const PIN_STORAGE_KEY = 'hchps-memo-pin';
const TOMBSTONE_STORAGE_KEY = 'hchps-global-tombstones';

let memoryStore: WorkingMemoryMemo[] | null = null;
const storeListeners = new Set<(memos: WorkingMemoryMemo[]) => void>();

function readLocalTombstoneIds(): string[] {
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
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const exists = list.some((item: unknown) =>
      typeof item === 'string' ? item === id : Boolean(item && typeof item === 'object' && (item as { id?: string }).id === id)
    );
    if (!exists) {
      list.push({ id, deletedAt: Date.now() });
      window.localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore storage errors
  }
}

function getSavedPin(): string {
  if (typeof window === 'undefined') return '7116';
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) || '7116';
  } catch {
    return '7116';
  }
}

function loadInitialStore(): WorkingMemoryMemo[] {
  if (memoryStore !== null) {
    return memoryStore;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore = parsed;
          return memoryStore;
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  memoryStore = [...DEFAULT_WORKING_MEMORY_MEMOS];
  return memoryStore;
}

function updateStoreAndNotify(nextMemos: WorkingMemoryMemo[]) {
  memoryStore = nextMemos;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMemos));
    } catch {
      // Ignore storage quota errors
    }
  }
  try {
    defaultQueryClient.setQueryData(['WORKING_MEMORY'], nextMemos);
  } catch {
    // Ignore if default query client is uninitialized
  }
  storeListeners.forEach((listener) => listener(nextMemos));
}

export function resetWorkingMemoryStoreForTest(seed: WorkingMemoryMemo[] = DEFAULT_WORKING_MEMORY_MEMOS) {
  updateStoreAndNotify([...seed]);
  try {
    defaultQueryClient.setQueryData(['WORKING_MEMORY'], [...seed]);
  } catch {}
}

export interface UseWorkingMemoryOptions {
  contextModule?: WorkingMemoryContextModule;
  autoFetch?: boolean;
}

export function useWorkingMemory(options: UseWorkingMemoryOptions = {}) {
  const { contextModule = 'dashboard', autoFetch = true } = options;
  const queryClientContext = useContext(QueryClientContext);
  const queryClient = queryClientContext || defaultQueryClient;

  const [memos, setMemos] = useState<WorkingMemoryMemo[]>(() => loadInitialStore());
  const [isSyncingInbox, setIsSyncingInbox] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isLoading = isSyncingInbox;

  useEffect(() => {
    const listener = (updated: WorkingMemoryMemo[]) => {
      setMemos(updated);
    };
    storeListeners.add(listener);
    return () => {
      storeListeners.delete(listener);
    };
  }, []);

  const refreshFromSSOT = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof fetch !== 'function') return;
    try {
      const remote = await readSheet<WorkingMemoryMemo>(SHEET_NAME);
      if (Array.isArray(remote) && remote.length > 0) {
        const deletedSet = new Set(readLocalTombstoneIds());
        const filtered = remote.filter((m) => !deletedSet.has(m.id));
        updateStoreAndNotify(filtered);
        queryClient.setQueryData(['WORKING_MEMORY'], filtered);
      }
    } catch {
      // Offline or test environment without fetch: keep current local/seed store
    }
  }, [queryClient]);

  // Route re-entry and stale revalidation query with 5-second staleTime
  useQuery({
    queryKey: ['WORKING_MEMORY'],
    queryFn: async () => {
      if (typeof document !== 'undefined' && document.hidden) return memoryStore || loadInitialStore();
      if (typeof fetch !== 'function') return memoryStore || loadInitialStore();
      try {
        const remote = await readSheet<WorkingMemoryMemo>(SHEET_NAME);
        if (Array.isArray(remote) && remote.length > 0) {
          const deletedSet = new Set(readLocalTombstoneIds());
          const filtered = remote.filter((m) => !deletedSet.has(m.id));
          updateStoreAndNotify(filtered);
          return filtered;
        }
      } catch {
        // Offline or test environment
      }
      return memoryStore || loadInitialStore();
    },
    enabled: autoFetch,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  }, queryClient);


  const addMemo = useCallback(
    async (
      content: string,
      explicitCategory?: WorkingMemoryCategory,
      source: WorkingMemorySource = 'pc'
    ): Promise<WorkingMemoryMemo | null> => {
      const createdList = createWorkingMemoryMemosFromText({
        content,
        explicitCategory,
        source,
      });
      if (createdList.length === 0) return null;

      const current = loadInitialStore();
      const next = [...createdList, ...current];
      updateStoreAndNotify(next);

      try {
        for (const item of createdList) {
          await addRow(SHEET_NAME, item as unknown as Record<string, unknown>);
        }
      } catch {
        // Optimistic state preserved locally
      }
      return createdList[0];
    },
    []
  );

  const markReflected = useCallback(
    async (id: string) => {
      const current = loadInitialStore();
      const target = current.find((m) => m.id === id);
      const now = nextMonotonicIso(target?.updatedAt, target?.reflectedAt);
      const next = current.map((m) =>
        m.id === id
          ? { ...m, status: 'reflected' as const, reflectedAt: now, updatedAt: now }
          : m
      );
      updateStoreAndNotify(next);

      const updates = {
        status: 'reflected' as const,
        reflectedAt: now,
        updatedAt: now,
      };

      if (!autoFetch && typeof fetch === 'function') {
        try {
          await fetch('/api/memo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Memo-Pin': getSavedPin(),
            },
            body: JSON.stringify({
              action: 'update',
              id,
              updates,
            }),
          });
        } catch {
          // Optimistic state preserved locally
        }
        return;
      }

      try {
        await updateRow(SHEET_NAME, id, updates);
      } catch {
        // Optimistic state preserved locally
      }
    },
    [autoFetch]
  );

  const reopenMemo = useCallback(
    async (id: string) => {
      const current = loadInitialStore();
      const target = current.find((m) => m.id === id);
      const now = nextMonotonicIso(target?.updatedAt, target?.reflectedAt);
      const next = current.map((m) =>
        m.id === id
          ? { ...m, status: 'pending' as const, reflectedAt: undefined, updatedAt: now }
          : m
      );
      updateStoreAndNotify(next);

      const updates = {
        status: 'pending' as const,
        reflectedAt: undefined,
        updatedAt: now,
      };

      if (!autoFetch && typeof fetch === 'function') {
        try {
          await fetch('/api/memo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Memo-Pin': getSavedPin(),
            },
            body: JSON.stringify({
              action: 'update',
              id,
              updates,
            }),
          });
        } catch {
          // Optimistic state preserved locally
        }
        return;
      }

      try {
        await updateRow(SHEET_NAME, id, updates);
      } catch {
        // Optimistic state preserved locally
      }
    },
    [autoFetch]
  );

  const togglePin = useCallback(
    async (id: string) => {
      const current = loadInitialStore();
      const target = current.find((m) => m.id === id);
      if (!target) return;
      const now = nextMonotonicIso(target.updatedAt, target.reflectedAt);
      const nextPinned = !target.pinned;

      const next = current.map((m) =>
        m.id === id ? { ...m, pinned: nextPinned, updatedAt: now } : m
      );
      updateStoreAndNotify(next);

      const updates = {
        pinned: nextPinned,
        updatedAt: now,
      };

      if (!autoFetch && typeof fetch === 'function') {
        try {
          await fetch('/api/memo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Memo-Pin': getSavedPin(),
            },
            body: JSON.stringify({
              action: 'update',
              id,
              updates,
            }),
          });
        } catch {
          // Optimistic state preserved locally
        }
        return;
      }

      try {
        await updateRow(SHEET_NAME, id, updates);
      } catch {
        // Optimistic state preserved locally
      }
    },
    [autoFetch]
  );

  const updateMemoContent = useCallback(
    async (id: string, nextContent: string, explicitCategory?: WorkingMemoryCategory) => {
      const trimmed = nextContent.trim();
      if (!trimmed) return;
      const current = loadInitialStore();
      const target = current.find((m) => m.id === id);
      const now = nextMonotonicIso(target?.updatedAt, target?.reflectedAt);
      const parsed = parseWorkingMemoryInput(trimmed, explicitCategory);
      const next = current.map((m) =>
        m.id === id
          ? {
              ...m,
              content: trimmed,
              category: parsed.category,
              tags: parsed.tags,
              numericHighlight: parsed.numericHighlight,
              dateHighlight: parsed.dateHighlight,
              updatedAt: now,
            }
          : m
      );
      updateStoreAndNotify(next);

      const updates = {
        content: trimmed,
        category: parsed.category,
        tags: parsed.tags,
        numericHighlight: parsed.numericHighlight,
        dateHighlight: parsed.dateHighlight,
        updatedAt: now,
      };

      if (!autoFetch && typeof fetch === 'function') {
        try {
          await fetch('/api/memo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Memo-Pin': getSavedPin(),
            },
            body: JSON.stringify({
              action: 'update',
              id,
              updates,
            }),
          });
        } catch {
          // Optimistic state preserved locally
        }
        return;
      }

      try {
        await updateRow(SHEET_NAME, id, updates);
      } catch {
        // Optimistic state preserved locally
      }
    },
    [autoFetch]
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      recordLocalTombstone(id);
      const current = loadInitialStore();
      const next = current.filter((m) => m.id !== id);
      updateStoreAndNotify(next);

      if (!autoFetch && typeof fetch === 'function') {
        try {
          await fetch('/api/memo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Memo-Pin': getSavedPin(),
            },
            body: JSON.stringify({
              action: 'delete',
              id,
            }),
          });
        } catch {
          // Optimistic state preserved locally
        }
        return;
      }

      try {
        await deleteRow(SHEET_NAME, id);
      } catch {
        // Optimistic state preserved locally
      }
    },
    [autoFetch]
  );

  /**
   * Synchronizes with `/api/memo` (Mobile KV Memo Inbox relay).
   * Merges any mobile-captured memos into local SSOT and pushes local memos + tombstones back.
   */
  const syncMemoInbox = useCallback(async (pin?: string): Promise<boolean> => {
    setIsSyncingInbox(true);
    setSyncError(null);
    try {
      const savedPin = pin || getSavedPin();
      const deletedIds = readLocalTombstoneIds();

      const res = await fetch('/api/memo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Memo-Pin': savedPin,
        },
        body: JSON.stringify({
          action: 'sync',
          memos: loadInitialStore(),
          deletedIds,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const deletedSet = new Set(deletedIds);
        updateStoreAndNotify(
          (json.data as WorkingMemoryMemo[]).filter((m) => !deletedSet.has(m.id))
        );
        setLastSyncedAt(new Date().toISOString());
        return true;
      }
      return false;
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : '동기화 오류');
      return false;
    } finally {
      setIsSyncingInbox(false);
    }
  }, []);

  /**
   * Verifies PIN and fetches memos from `/api/memo` for the mobile `/memo` route.
   */
  const verifyPinAndLoadInbox = useCallback(async (pin: string): Promise<boolean> => {
    setIsSyncingInbox(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/memo', {
        method: 'GET',
        headers: {
          'X-Memo-Pin': pin.trim(),
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setSyncError(errJson.error || 'PIN 번호가 일치하지 않습니다.');
        return false;
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(PIN_STORAGE_KEY, pin.trim());
        }
        const deletedSet = new Set(readLocalTombstoneIds());
        updateStoreAndNotify(
          (json.data as WorkingMemoryMemo[]).filter((m) => !deletedSet.has(m.id))
        );
        setLastSyncedAt(new Date().toISOString());
        return true;
      }
      return false;
    } catch {
      // Fallback for offline local mode if PIN matches standard local PINs
      if (['7116', '1031', '0000', '2026', 'gangnam'].includes(pin.trim())) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(PIN_STORAGE_KEY, pin.trim());
        }
        return true;
      }
      setSyncError('PIN 인증 요청에 실패했습니다.');
      return false;
    } finally {
      setIsSyncingInbox(false);
    }
  }, []);

  /**
   * Submits single-line or multi-line mobile memo(s) directly to `/api/memo` with PIN header and updates local store.
   */
  const submitMobileMemo = useCallback(
    async (
      content: string,
      pin: string,
      explicitCategory?: WorkingMemoryCategory
    ): Promise<WorkingMemoryMemo | null> => {
      const createdList = createWorkingMemoryMemosFromText({
        content,
        explicitCategory,
        source: 'mobile',
      });
      if (createdList.length === 0) return null;

      const current = loadInitialStore();
      updateStoreAndNotify([...createdList, ...current]);

      try {
        const res = await fetch('/api/memo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Memo-Pin': pin.trim(),
          },
          body: JSON.stringify(
            createdList.length === 1
              ? { action: 'add', memo: createdList[0] }
              : { action: 'add', memo: createdList[0], memos: createdList }
          ),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const deletedSet = new Set(readLocalTombstoneIds());
            updateStoreAndNotify(
              (json.data as WorkingMemoryMemo[]).filter((m) => !deletedSet.has(m.id))
            );
          }
          setLastSyncedAt(new Date().toISOString());
        }
      } catch {
        // Offline fallback keeps optimistic memo in local store
      }

      return createdList[0];
    },
    []
  );

  const pendingMemos = useMemo(
    () =>
      [...memos]
        .filter((m) => m.status === 'pending')
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) {
            return a.pinned ? -1 : 1;
          }
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }),
    [memos]
  );

  const reflectedMemos = useMemo(
    () =>
      [...memos]
        .filter((m) => m.status === 'reflected')
        .sort((a, b) => (b.reflectedAt || b.updatedAt || '').localeCompare(a.reflectedAt || a.updatedAt || '')),
    [memos]
  );

  const contextMemos = useMemo(
    () => getContextRelevantMemos(memos, contextModule),
    [memos, contextModule]
  );

  return {
    memos,
    pendingMemos,
    reflectedMemos,
    contextMemos,
    isLoading,
    isSyncingInbox,
    lastSyncedAt,
    syncError,
    addMemo,
    markReflected,
    reopenMemo,
    togglePin,
    updateMemoContent,
    deleteMemo,
    refreshFromSSOT,
    syncMemoInbox,
    verifyPinAndLoadInbox,
    submitMobileMemo,
  };
}
