'use client';

/**
 * VITAL Work & Wealth Architecture — Admin Ontology & Cross-Domain Hook
 * Module: src/hooks/useAdminOntology.ts
 * Standards: Rule 1 (M-V-C Controller Isolation), Rule B (Loud Failures), Rule R (Zero-Error Budget Math)
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  AdminOntologyGraph,
  AdminEntity,
  AdminAuditGap,
  AdminOntologySummaryStats,
} from '@/lib/ontology/admin-types';
import type {
  CrossDomainRegistry,
  CrossDomainProjectBundle,
} from '@/lib/ontology/cross-domain-types';

export interface UseAdminOntologyOptions {
  /** If provided, avoids initial fetch of the graph */
  initialGraph?: AdminOntologyGraph | null;
  /** General auto-fetch toggle (default: true) */
  autoFetch?: boolean;
  /** Automatically fetch graph on mount (default: true if !initialGraph) */
  autoFetchGraph?: boolean;
  /** Automatically fetch cross-join registry on mount (default: true) */
  autoFetchCrossJoin?: boolean;
  /** Filter/target a specific project key for bundle fetching */
  projectKey?: string | null;
}

export interface UseAdminOntologyReturn {
  // State
  graph: AdminOntologyGraph | null;
  stats: AdminOntologySummaryStats | null;
  crossDomainRegistry: CrossDomainRegistry | null;
  projectBundle: CrossDomainProjectBundle | null;
  loading: boolean;
  crossDomainLoading: boolean;
  isReindexing: boolean;
  error: string | null;
  crossDomainError: string | null;
  lastSyncedAt: Date | null;

  // Actions
  fetchGraph: () => Promise<AdminOntologyGraph | null>;
  fetchCrossJoin: (targetProjectKey?: string) => Promise<CrossDomainRegistry | CrossDomainProjectBundle | null>;
  fetchProjectBundle: (projectKey: string) => Promise<CrossDomainProjectBundle | null>;
  reindex: () => Promise<{ graph: AdminOntologyGraph; crossJoin: CrossDomainRegistry } | null>;
  openArchiveTarget: (targetPath: string, mode: 'file' | 'folder') => Promise<{ ok: boolean; error?: string }>;
  openArchiveFile: (filePath: string, mode?: 'file' | 'folder' | 'system') => Promise<boolean>;
  traceNode: (nodeId: string, direction?: 'upstream' | 'downstream' | 'both') => Promise<any>;
  searchNodes: (query: string) => Promise<AdminEntity[]>;
  fetchAuditGaps: () => Promise<AdminAuditGap[]>;

  // Setters
  setGraph: React.Dispatch<React.SetStateAction<AdminOntologyGraph | null>>;
  setCrossDomainRegistry: React.Dispatch<React.SetStateAction<CrossDomainRegistry | null>>;
  setProjectBundle: React.Dispatch<React.SetStateAction<CrossDomainProjectBundle | null>>;
}

// Module-level in-memory hot cache for zero-redundancy visits across tabs
let inMemoryGraph: AdminOntologyGraph | null = null;
let inMemoryCrossJoin: CrossDomainRegistry | null = null;
let lastCacheTime = 0;

export function clearAdminOntologyHookCache(): void {
  inMemoryGraph = null;
  inMemoryCrossJoin = null;
  lastCacheTime = 0;
}

export function useAdminOntology(options?: UseAdminOntologyOptions): UseAdminOntologyReturn {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const [graph, setGraph] = useState<AdminOntologyGraph | null>(() => {
    if (options?.initialGraph !== undefined) return options.initialGraph;
    return isTest ? null : inMemoryGraph;
  });

  const [crossDomainRegistry, setCrossDomainRegistry] = useState<CrossDomainRegistry | null>(() => {
    return isTest ? null : inMemoryCrossJoin;
  });

  const [projectBundle, setProjectBundle] = useState<CrossDomainProjectBundle | null>(null);

  const [loading, setLoading] = useState(false);
  const [crossDomainLoading, setCrossDomainLoading] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crossDomainError, setCrossDomainError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => (lastCacheTime && !isTest ? new Date(lastCacheTime) : null));

  const generalAutoFetch = options?.autoFetch ?? true;
  const autoFetchGraph = generalAutoFetch && (options?.autoFetchGraph ?? !options?.initialGraph);
  const autoFetchCrossJoin = generalAutoFetch && (options?.autoFetchCrossJoin ?? true);

  // Sync initialGraph prop if provided and updated
  useEffect(() => {
    if (options?.initialGraph) {
      setGraph(options.initialGraph);
    }
  }, [options?.initialGraph]);

  // Fetch Graph
  const fetchGraph = useCallback(async (): Promise<AdminOntologyGraph | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin-ontology?action=graph');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.success && data.graph) {
        setGraph(data.graph);
        inMemoryGraph = data.graph;
        lastCacheTime = Date.now();
        setLastSyncedAt(new Date(lastCacheTime));
        return data.graph;
      }
      return null;
    } catch (err: any) {
      const msg = err?.message || '그래프를 불러오는 중 오류가 발생했습니다.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Cross-Join
  const fetchCrossJoin = useCallback(async (targetProjectKey?: string) => {
    try {
      setCrossDomainLoading(true);
      setCrossDomainError(null);
      const query = targetProjectKey ? `&projectKey=${encodeURIComponent(targetProjectKey)}` : '';
      const res = await fetch(`/api/admin-ontology?action=cross-join${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.success && json.data) {
        if (targetProjectKey) {
          if ('ontology' in json.data && 'budget' in json.data) {
            setProjectBundle(json.data as CrossDomainProjectBundle);
          } else {
            const reg = json.data as Record<string, CrossDomainProjectBundle>;
            const matched = reg[targetProjectKey] || Object.values(reg)[0] || null;
            setProjectBundle(matched);
          }
          return json.data;
        } else {
          setCrossDomainRegistry(json.data as CrossDomainRegistry);
          inMemoryCrossJoin = json.data as CrossDomainRegistry;
          lastCacheTime = Date.now();
          setLastSyncedAt(new Date(lastCacheTime));
          return json.data;
        }
      }
      return null;
    } catch (err: any) {
      const msg = err?.message || '크로스 조인 데이터 연동 실패';
      setCrossDomainError(msg);
      return null;
    } finally {
      setCrossDomainLoading(false);
    }
  }, []);

  // Fetch Project Bundle directly
  const fetchProjectBundle = useCallback(async (key: string): Promise<CrossDomainProjectBundle | null> => {
    const result = await fetchCrossJoin(key);
    if (!result) return null;
    if ('ontology' in result && 'budget' in result) {
      return result as CrossDomainProjectBundle;
    }
    const reg = result as Record<string, CrossDomainProjectBundle>;
    return reg[key] || Object.values(reg)[0] || null;
  }, [fetchCrossJoin]);

  // Non-destructive Reindex
  const reindex = useCallback(async () => {
    try {
      setIsReindexing(true);
      const res = await fetch('/api/admin-ontology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reindex' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.success) {
        if (json.graph) {
          setGraph(json.graph);
          inMemoryGraph = json.graph;
        }
        if (json.crossJoin) {
          setCrossDomainRegistry(json.crossJoin);
          inMemoryCrossJoin = json.crossJoin;
        }
        lastCacheTime = Date.now();
        setLastSyncedAt(new Date(lastCacheTime));
        return { graph: json.graph, crossJoin: json.crossJoin };
      }
      return null;
    } catch (err: any) {
      setError(`온톨로지 재색인 중 오류가 발생했습니다: ${err.message}`);
      return null;
    } finally {
      setIsReindexing(false);
    }
  }, []);

  // Open Archive Target (File or Folder)
  const openArchiveTarget = useCallback(async (targetPath: string, mode: 'file' | 'folder'): Promise<{ ok: boolean; error?: string }> => {
    try {
      const safePath = targetPath.replace(/%/g, '%25');
      const res = await fetch('/api/archive/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: safePath, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error || '실행 요청 실패' };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || '네트워크 요청 실패' };
    }
  }, []);

  // Convenience wrapper conforming to openArchiveFile contract
  const openArchiveFile = useCallback(async (filePath: string, mode?: 'file' | 'folder' | 'system'): Promise<boolean> => {
    const actualMode = mode === 'folder' ? 'folder' : 'file';
    const result = await openArchiveTarget(filePath, actualMode);
    return result.ok;
  }, [openArchiveTarget]);

  // Trace Node
  const traceNode = useCallback(async (nodeId: string, direction: 'upstream' | 'downstream' | 'both' = 'upstream') => {
    const res = await fetch(`/api/admin-ontology?action=trace&nodeId=${encodeURIComponent(nodeId)}&direction=${direction}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }, []);

  // Search Nodes
  const searchNodes = useCallback(async (query: string): Promise<AdminEntity[]> => {
    const res = await fetch(`/api/admin-ontology?action=search&q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
  }, []);

  // Fetch Audit Gaps
  const fetchAuditGaps = useCallback(async (): Promise<AdminAuditGap[]> => {
    const res = await fetch('/api/admin-ontology?action=gaps');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.gaps || [];
  }, []);

  // Automatic Lifecycle Fetching on Mount
  useEffect(() => {
    if (autoFetchGraph) {
      fetchGraph();
    }
    if (autoFetchCrossJoin) {
      fetchCrossJoin();
    }
  }, [autoFetchGraph, autoFetchCrossJoin, fetchGraph, fetchCrossJoin]);

  return {
    graph,
    stats: null,
    crossDomainRegistry,
    projectBundle,
    loading,
    crossDomainLoading,
    isReindexing,
    error,
    crossDomainError,
    lastSyncedAt,
    fetchGraph,
    fetchCrossJoin,
    fetchProjectBundle,
    reindex,
    openArchiveTarget,
    openArchiveFile,
    traceNode,
    searchNodes,
    fetchAuditGaps,
    setGraph,
    setCrossDomainRegistry,
    setProjectBundle,
  };
}
