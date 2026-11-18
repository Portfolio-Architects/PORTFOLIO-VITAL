'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArchiveItem, ArchiveSearchResponse } from '@/types/archive';

export interface UseArchiveExplorerOptions {
  initialYear?: string;
  initialProject?: string;
  initialCategory?: string;
}

export function useArchiveExplorer(options?: UseArchiveExplorerOptions) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [year, setYear] = useState(options?.initialYear || '2026년');
  const [project, setProject] = useState(options?.initialProject || 'ALL');
  const [category, setCategory] = useState(options?.initialCategory || 'ALL');
  const [imageCategory, setImageCategory] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');

  const [data, setData] = useState<ArchiveSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Debounce search query by 180ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchArchive = useCallback(
    async (clusterTargetId?: string) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          year,
          project,
          category: viewMode === 'gallery' ? 'image' : category,
          imageCategory,
          limit: viewMode === 'gallery' ? '180' : '120',
        });
        if (clusterTargetId) {
          params.set('clusterFor', clusterTargetId);
        }

        const res = await fetch(`/api/archive?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to fetch archive index');
        const json: ArchiveSearchResponse = await res.json();
        setData(json);
        if (!clusterTargetId && json.items.length > 0) {
          setSelectedId(json.items[0].id);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('[useArchiveExplorer] error:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, year, project, category, imageCategory, viewMode]
  );

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const selectItemForCluster = useCallback(
    (item: ArchiveItem) => {
      setSelectedId(item.id);
      fetchArchive(item.id);
    },
    [fetchArchive]
  );

  const openArchiveTarget = useCallback(async (relPath: string, mode: 'file' | 'folder') => {
    try {
      const safePath = relPath.replace(/%/g, '%25');
      const res = await fetch('/api/archive/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: safePath, mode }),
      });
      if (res.ok) {
        setActionToast(
          mode === 'folder'
            ? '윈도우 탐색기에서 해당 파일 위치를 열었습니다.'
            : '연결 프로그램으로 파일을 실행했습니다.'
        );
        setTimeout(() => setActionToast(null), 2600);
      } else {
        const errPayload = await res.json().catch(() => null);
        setActionToast(errPayload?.error || '파일 실행 요청에 실패했습니다.');
        setTimeout(() => setActionToast(null), 3200);
      }
    } catch (err) {
      console.error('[useArchiveExplorer] open error:', err);
      setActionToast('파일 실행 중 네트워크 오류가 발생했습니다.');
      setTimeout(() => setActionToast(null), 3200);
    }
  }, []);

  const triggerReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/archive/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reindex' }),
      });
      if (res.ok) {
        await fetchArchive(selectedId);
        setActionToast('마스터 아카이브 본문·사진 색인 최신화를 완료했습니다.');
        setTimeout(() => setActionToast(null), 3000);
      }
    } finally {
      setReindexing(false);
    }
  }, [fetchArchive, selectedId]);

  return {
    query,
    setQuery,
    year,
    setYear,
    project,
    setProject,
    category,
    setCategory,
    imageCategory,
    setImageCategory,
    viewMode,
    setViewMode,
    selectedId,
    selectItemForCluster,
    data,
    loading,
    reindexing,
    actionToast,
    openArchiveTarget,
    triggerReindex,
  };
}
