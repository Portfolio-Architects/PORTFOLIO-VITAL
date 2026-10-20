'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';

/**
 * useCloudStorage — Cloudflare KV 기반 상태 관리 훅
 * (Legacy 이름: useGoogleSheet — 하위 호환을 위해 유지)
 * 
 * - 초기 로드: Cloudflare KV에서 데이터 읽기 (실패 시 localStorage 폴백)
 * - 쓰기: 로컬 state 즉시 반영 (낙관적 업데이트) + 백그라운드 KV 저장
 * - localStorage는 캐시/폴백으로 유지
 */
export function useGoogleSheet<T extends { id: string }>(
  sheetName: string,
  localStorageKey: string,
  initialValue: T[] = [],
  enabled: boolean = true
): [T[], React.Dispatch<React.SetStateAction<T[]>>, boolean] {
  const [data, setData] = useState<T[]>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch { /* ignore */ }
    return initialValue;
  });
  const [loading, setLoading] = useState(enabled);
  const initialLoadDone = useRef(false);

  // Initial load from Google Sheets
  useEffect(() => {
    if (!enabled) return;

    // Only load if it's the first time OR we received a crypto-ready event
    const attemptLoadKV = async () => {
      const { isCryptoReady } = await import('@/lib/crypto');
      if (!isCryptoReady()) return; // Abort silently if locked. Will retry via event.
      
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;
      setLoading(true);

      try {
        const rows = await readSheet<T>(sheetName);
        if (rows.length > 0) {
          let finalRows = rows;
          try {
            const deletedList = JSON.parse(localStorage.getItem('hchps-global-tombstones') || '[]');
            if (Array.isArray(deletedList) && deletedList.length > 0) {
              const tombstoneSet = new Set<string>(deletedList);
              const filtered: T[] = [];
              for (let i = 0; i < rows.length; i++) {
                if (!tombstoneSet.has(rows[i].id)) {
                  filtered.push(rows[i]);
                }
              }
              finalRows = filtered;
            }
          } catch {}
          
          setData(finalRows);
          // Cache in localStorage
          try { localStorage.setItem(localStorageKey, JSON.stringify(finalRows)); } catch { /* ignore */ }
        } else {
          // KV is empty — push localStorage data to KV if available (one-time migration)
          const stored = localStorage.getItem(localStorageKey);
          if (stored) {
            try {
              const localData = JSON.parse(stored) as T[];
              if (localData.length > 0) {
                const { replaceAll } = await import('@/lib/sheets-api');
                const ok = await replaceAll(sheetName, localData);
                if (ok) console.info(`[KV Sync] 로컬 데이터 마이그레이션 완료: ${sheetName} (${localData.length}건)`);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch {
        // Silently fall back to localStorage data
      } finally {
        setLoading(false);
      }
    };

    attemptLoadKV();

    const onCryptoReady = () => {
      if (!initialLoadDone.current) {
        attemptLoadKV();
      }
    };

    window.addEventListener('crypto-ready', onCryptoReady);
    return () => window.removeEventListener('crypto-ready', onCryptoReady);
    
  }, [sheetName, localStorageKey, enabled]);

  // Sync to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(localStorageKey, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data, localStorageKey]);

  return [data, setData, loading];
}

/**
 * Sheet CRUD helpers — 낙관적 업데이트 + 백그라운드 동기화
 */
export function useSheetCrud<T extends { id: string }>(sheetName: string) {
  const syncAdd = useCallback(async (item: T) => {
    const plain = JSON.parse(JSON.stringify(item));
    await addRow(sheetName, plain);
  }, [sheetName]);

  const syncUpdate = useCallback(async (id: string, updates: Partial<T>) => {
    const plain = JSON.parse(JSON.stringify(updates));
    await updateRow(sheetName, id, plain);
  }, [sheetName]);

  const syncDelete = useCallback(async (id: string) => {
    try {
      const deletedIds = JSON.parse(localStorage.getItem('hchps-global-tombstones') || '[]');
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('hchps-global-tombstones', JSON.stringify(deletedIds));
      }
    } catch {}
    await deleteRow(sheetName, id);
  }, [sheetName]);

  return useMemo(() => ({ syncAdd, syncUpdate, syncDelete }), [syncAdd, syncUpdate, syncDelete]);
}
