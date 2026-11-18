'use client';

import { useEffect, useCallback, useMemo, useSyncExternalStore, useRef, useState } from 'react';
import { OntologyNode, OntologyEdge, EdgeType, OntologyGroup, OntologyLayerId, VerificationStatus, NodeOverride } from '@/lib/ontology.types';
export type { NodeOverride };
import { useYjsStore, globalYDoc } from '@/hooks/useYjsStore';
import * as Y from 'yjs';
import { readSheet, replaceAll } from '@/lib/sheets-api';
import { getFestivalPresetGraphData, FESTIVAL_PRESET_SIMULATION_ENTRIES } from '@/lib/presets/festival5DomainPreset';

// Global variables for pending items and listeners
let globalPendingNodes: OntologyNode[] = [];
let globalPendingEdges: OntologyEdge[] = [];
const pendingListeners = new Set<() => void>();
const recentlyDeletedNodes = new Set<string>();

const addPendingListener = (listener: () => void) => {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
};

const setGlobalPending = (nodes: OntologyNode[], edges: OntologyEdge[]) => {
  globalPendingNodes = nodes;
  globalPendingEdges = edges;
  pendingListeners.forEach(l => l());
};

function getReviewedNodeIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const val = localStorage.getItem('hchps-reviewed-ai-nodes');
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function getReviewedEdgeKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const val = localStorage.getItem('hchps-reviewed-ai-edges');
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function addReviewedItems(nodeIds: string[], edgeKeys: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const currentNodes = getReviewedNodeIds();
    const nextNodes = Array.from(new Set([...currentNodes, ...nodeIds]));
    localStorage.setItem('hchps-reviewed-ai-nodes', JSON.stringify(nextNodes));

    const currentEdges = getReviewedEdgeKeys();
    const nextEdges = Array.from(new Set([...currentEdges, ...edgeKeys]));
    localStorage.setItem('hchps-reviewed-ai-edges', JSON.stringify(nextEdges));
  } catch (e) {
    console.error('Failed to update reviewed items in localStorage:', e);
  }
}

export interface MapCustomizationData {
  overrides: Record<string, NodeOverride>;
  customNodes: OntologyNode[];
  customEdges: OntologyEdge[];
  deletedEdges?: string[];
}

export function useGraphCustomization(enabled = true) {
  const { ydoc } = useYjsStore();
  const isSyncing = useRef(false);

  const [pendingNodes, setPendingNodes] = useState<OntologyNode[]>(globalPendingNodes);
  const [pendingEdges, setPendingEdges] = useState<OntologyEdge[]>(globalPendingEdges);

  useEffect(() => {
    return addPendingListener(() => {
      setPendingNodes(globalPendingNodes);
      setPendingEdges(globalPendingEdges);
    });
  }, []);

  const approveAndMerge = useCallback((
    approvedNodes: OntologyNode[],
    approvedEdges: OntologyEdge[],
    skippedIds: string[]
  ) => {
    ydoc.transact(() => {
      const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;

      approvedNodes.forEach(node => {
        customNodesMap.set(node.id, node);
      });

      approvedEdges.forEach(edge => {
        const k = `${edge.source}|||${edge.target}`;
        customEdgesMap.set(k, edge);
      });
    });

    const reviewedNodeIds = [
      ...approvedNodes.map(n => n.id),
      ...skippedIds.filter(id => !id.includes('|||'))
    ];
    const reviewedEdgeKeys = [
      ...approvedEdges.map(e => `${e.source}|||${e.target}`),
      ...skippedIds.filter(id => id.includes('|||'))
    ];

    addReviewedItems(reviewedNodeIds, reviewedEdgeKeys);

    const reviewedNodeIdSet = new Set(reviewedNodeIds);
    const approvedNodeIdSet = new Set(approvedNodes.map(an => an.id));
    const remainingNodes = globalPendingNodes.filter(
      n => !reviewedNodeIdSet.has(n.id) && !approvedNodeIdSet.has(n.id)
    );

    const reviewedEdgeKeySet = new Set(reviewedEdgeKeys);
    const approvedEdgeKeySet = new Set(approvedEdges.map(ae => `${ae.source}|||${ae.target}`));
    const remainingEdges = globalPendingEdges.filter(
      e => {
        const k = `${e.source}|||${e.target}`;
        return !reviewedEdgeKeySet.has(k) && !approvedEdgeKeySet.has(k);
      }
    );

    setGlobalPending(remainingNodes, remainingEdges);
  }, [ydoc]);

  const addPendingSuggestions = useCallback(async (newNodes: OntologyNode[], newEdges: OntologyEdge[]) => {
    try {
      const rows = await readSheet<MapCustomizationData & { id: string }>('MAP_CUSTOMIZATION');
      let currentData: MapCustomizationData = { overrides: {}, customNodes: [], customEdges: [], deletedEdges: [] };
      if (rows && rows.length > 0 && rows[0].id === 'singleton') {
        currentData = rows[0];
      }

      const existingNodeIds = new Set((currentData.customNodes || []).map(n => n.id));
      const existingEdgeKeys = new Set((currentData.customEdges || []).map(e => `${e.source}|||${e.target}`));

      const filteredNewNodes = newNodes.filter(n => !existingNodeIds.has(n.id));
      const filteredNewEdges = newEdges.filter(e => !existingEdgeKeys.has(`${e.source}|||${e.target}`));

      if (filteredNewNodes.length === 0 && filteredNewEdges.length === 0) {
        const reviewedNodes = new Set(getReviewedNodeIds());
        const reviewedEdges = new Set(getReviewedEdgeKeys());
        const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
        const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;

        const freshNodes = newNodes.filter(n => !customNodesMap.has(n.id) && !reviewedNodes.has(n.id));
        const freshEdges = newEdges.filter(e => {
          const k = `${e.source}|||${e.target}`;
          const r = `${e.target}|||${e.source}`;
          return !customEdgesMap.has(k) && !customEdgesMap.has(r) && !reviewedEdges.has(k) && !reviewedEdges.has(r);
        });

        if (freshNodes.length > 0 || freshEdges.length > 0) {
          const mergedNodes = Array.from(new Map([...globalPendingNodes, ...freshNodes].map(n => [n.id, n])).values());
          const mergedEdges = Array.from(new Map([...globalPendingEdges, ...freshEdges].map(e => [`${e.source}|||${e.target}`, e])).values());
          setGlobalPending(mergedNodes, mergedEdges);
        }
        return;
      }

      const updatedNodes = [...(currentData.customNodes || []), ...filteredNewNodes];
      const updatedEdges = [...(currentData.customEdges || []), ...filteredNewEdges];

      await replaceAll('MAP_CUSTOMIZATION', [{
        id: 'singleton',
        overrides: currentData.overrides || {},
        customNodes: updatedNodes,
        customEdges: updatedEdges,
        deletedEdges: currentData.deletedEdges || []
      }]);

      const reviewedNodes = new Set(getReviewedNodeIds());
      const reviewedEdges = new Set(getReviewedEdgeKeys());
      const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;

      const freshNodes = filteredNewNodes.filter(n => !customNodesMap.has(n.id) && !reviewedNodes.has(n.id));
      const freshEdges = filteredNewEdges.filter(e => {
        const k = `${e.source}|||${e.target}`;
        const r = `${e.target}|||${e.source}`;
        return !customEdgesMap.has(k) && !customEdgesMap.has(r) && !reviewedEdges.has(k) && !reviewedEdges.has(r);
      });

      const mergedNodes = Array.from(new Map([...globalPendingNodes, ...freshNodes].map(n => [n.id, n])).values());
      const mergedEdges = Array.from(new Map([...globalPendingEdges, ...freshEdges].map(e => [`${e.source}|||${e.target}`, e])).values());
      setGlobalPending(mergedNodes, mergedEdges);

      console.info(`[useGraphCustomization] Successfully added ${filteredNewNodes.length} nodes and ${filteredNewEdges.length} edges to MAP_CUSTOMIZATION sheet.`);
    } catch (err) {
      console.error('Failed to add pending suggestions to cloud:', err);
    }
  }, [ydoc]);

  const undoManager = useMemo(() => {
    return new Y.UndoManager([
      ydoc.getMap('overrides'),
      ydoc.getMap('customNodesMap'),
      ydoc.getMap('customEdgesMap'),
      ydoc.getMap('deletedEdgesMap')
    ]);
  }, [ydoc]);

  // 이관(Migration) 로직
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const localRaw = localStorage.getItem('hchps-map-customization');
        const hasMigrated = localStorage.getItem('hchps-yjs-migrated');
        
        if (localRaw && !hasMigrated) {
          const localData = JSON.parse(localRaw) as MapCustomizationData;
          console.info('[Yjs Migration] 기존 로컬 스토리지 데이터 발견. Yjs로 복구합니다...');
          
          ydoc.transact(() => {
            const overridesMap = ydoc.getMap('overrides');
            const customNodesMap = ydoc.getMap('customNodesMap');
            const customEdgesMap = ydoc.getMap('customEdgesMap');
            const deletedEdgesMap = ydoc.getMap('deletedEdgesMap');

            if (localData.overrides) {
              Object.entries(localData.overrides).forEach(([k, v]) => {
                if (!overridesMap.has(k)) overridesMap.set(k, v);
              });
            }
            if (localData.customNodes) {
              localData.customNodes.forEach(n => {
                if (!customNodesMap.has(n.id)) customNodesMap.set(n.id, n);
              });
            }
            if (localData.customEdges) {
              localData.customEdges.forEach(e => {
                const k = `${e.source}|||${e.target}`;
                if (!customEdgesMap.has(k)) customEdgesMap.set(k, e);
              });
            }
            if (localData.deletedEdges) {
              localData.deletedEdges.forEach(e => {
                if (!deletedEdgesMap.has(e)) deletedEdgesMap.set(e, true);
              });
            }
          });
          
          localStorage.setItem('hchps-yjs-migrated', 'true');
        }
      } catch (e) {
        console.error('Yjs migration failed:', e);
      }
    }
  }, [ydoc]);

  // Phase 3: useSyncExternalStore & Debounce 패턴 접목
  // Yjs 상태 변경 시 곧바로 React 렌더링을 큐에 넣지 않고, 프레임 최적화(Debounce)하여 CPU 점유율을 대폭 낮춥니다.
  const store = useMemo(() => {
    const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
    const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
    const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
    const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

    let snapshot: MapCustomizationData = {
      overrides: overridesMap.toJSON() as Record<string, NodeOverride>,
      customNodes: Array.from(customNodesMap.values()),
      customEdges: Array.from(customEdgesMap.values()),
      deletedEdges: Array.from(deletedEdgesMap.keys()),
    };

    const listeners = new Set<() => void>();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 16ms (약 60FPS) 이하의 초고속 이벤트를 병합(Batch) 처리 
      timeoutId = setTimeout(() => {
        snapshot = {
          overrides: overridesMap.toJSON() as Record<string, NodeOverride>,
          customNodes: Array.from(customNodesMap.values()),
          customEdges: Array.from(customEdgesMap.values()),
          deletedEdges: Array.from(deletedEdgesMap.keys()),
        };
        listeners.forEach(l => l());
      }, 16);
    };

    return {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        if (listeners.size === 1) {
          overridesMap.observe(onUpdate);
          customNodesMap.observe(onUpdate);
          customEdgesMap.observe(onUpdate);
          deletedEdgesMap.observe(onUpdate);
        }
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) {
            overridesMap.unobserve(onUpdate);
            customNodesMap.unobserve(onUpdate);
            customEdgesMap.unobserve(onUpdate);
            deletedEdgesMap.unobserve(onUpdate);
            if (timeoutId) clearTimeout(timeoutId);
          }
        };
      },
      getSnapshot: () => snapshot
    };
  }, [ydoc]);

  // data 정의 전에 store가 존재하지 않는 특수한 상황(HMR 초기화 꼬임 등) 방어 코드
  const safeSubscribe = store?.subscribe || (() => () => {});
  const safeGetSnapshot = store?.getSnapshot || (() => ({ overrides: {}, customNodes: [], customEdges: [], deletedEdges: [] }));

  const data = useSyncExternalStore(safeSubscribe, safeGetSnapshot, safeGetSnapshot);

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  const setNodeOverride = useCallback((id: string, override: Partial<NodeOverride>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      const current = map.get(id) || {};
      const next: NodeOverride = { ...current };
      
      // Allow clearing specific fields explicitly by setting them to `null` to retain intent
      (Object.keys(override) as Array<keyof NodeOverride>).forEach(k => {
        if (override[k] === undefined) {
          next[k] = null as any; // Type-safe omission is handled by map, null acts as explicit tombstone
        } else {
          // Temporarily bypass strict index typing with a cast, safe due to key extraction
          (next as Record<string, unknown>)[k] = override[k];
        }
      });
      map.set(id, next);
    });
  }, [ydoc]);

  const batchSetNodeOverrides = useCallback((updates: Record<string, Partial<NodeOverride>>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      for (const [id, override] of Object.entries(updates)) {
        const current = map.get(id) || {};
        const next: NodeOverride = { ...current };
        (Object.keys(override) as Array<keyof NodeOverride>).forEach(k => {
          if (override[k] === undefined) {
            next[k] = null as any;
          } else {
            (next as Record<string, unknown>)[k] = override[k];
          }
        });
        map.set(id, next);
      }
    });
  }, [ydoc]);

  const clearNodeOverride = useCallback((id: string) => {
    ydoc.getMap('overrides').delete(id);
  }, [ydoc]);

  const addCustomNode = useCallback((
    label: string,
    x: number,
    y: number,
    color?: string,
    group?: OntologyGroup,
    baseValue?: number,
    layerId?: OntologyLayerId
  ) => {
    const labelLower = label.toLowerCase();
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: group || 'OTHER',
      baseValue: baseValue !== undefined ? baseValue : 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      layerId: layerId,
      centralityScore: 100,
    };

    ydoc.transact(() => {
      const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      for (const key of Array.from(overridesMap.keys())) {
        const override = overridesMap.get(key);
        if (override) {
          if (key === `tag-${labelLower}` || key === `leaf-${labelLower}` || override.customLabel === label) {
            if (override.hidden) {
              overridesMap.set(key, { ...override, hidden: null });
            }
          }
        }
      }
      (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    });

    return newNode;
  }, [ydoc]);



  const deleteCustomNode = useCallback((id: string) => {
    recentlyDeletedNodes.add(id);
    setTimeout(() => {
      recentlyDeletedNodes.delete(id);
    }, 5000);

    ydoc.transact(() => {
      (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).delete(id);
      
      const edgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const keysToDelete: string[] = [];
      edgesMap.forEach((edge, key) => {
        if (edge.source === id || edge.target === id) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(k => edgesMap.delete(k));
      
      // Clean up related overrides
      const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      if (overridesMap.has(id)) overridesMap.delete(id);
      
      // Clean up tombstones to prevent memory leaks
      const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
      const tombstonesToDelete: string[] = [];
      for (const key of Array.from(deletedEdgesMap.keys())) {
        if (key.startsWith(`${id}|||`) || key.endsWith(`|||${id}`)) {
          tombstonesToDelete.push(key);
        }
      }
      tombstonesToDelete.forEach(k => deletedEdgesMap.delete(k));
    });
  }, [ydoc]);

  const updateCustomNodeText = useCallback((id: string, newLabel: string) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const node = map.get(id);
      if (node) {
        map.set(id, { ...node, label: newLabel });
      }
    });
  }, [ydoc]);

  const addCustomEdge = useCallback((source: string, target: string, type: EdgeType = 'DEPENDENCY', weight: number = 1.0) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const deletedMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
      
      // Remove any tombstone if it exists so the edge can be resurrected
      if (deletedMap.has(edgeId)) deletedMap.delete(edgeId);
      if (deletedMap.has(reverseId)) deletedMap.delete(reverseId);

      if (map.has(edgeId)) {
        const existing = map.get(edgeId);
        if (existing) {
          map.set(edgeId, { ...existing, weight, type });
        }
      } else if (map.has(reverseId)) {
        const existing = map.get(reverseId);
        if (existing) {
          map.set(reverseId, { ...existing, weight, type });
        }
      } else {
        map.set(edgeId, { source, target, weight, type });
      }
    });
  }, [ydoc]);

  const deleteCustomEdge = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      if (map.has(edgeId)) map.delete(edgeId);
      if (map.has(reverseId)) map.delete(reverseId);
      
      (ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>).set(edgeId, true);
    });
  }, [ydoc]);

  const removeCustomTombstone = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const deletedMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
      if (deletedMap.has(edgeId)) deletedMap.delete(edgeId);
      if (deletedMap.has(reverseId)) deletedMap.delete(reverseId);
    });
  }, [ydoc]);

  const renameNodeId = useCallback((oldId: string, newId: string) => {
    ydoc.transact(() => {
      const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

      // 1. Move Override
      if (overridesMap.has(oldId)) {
        overridesMap.set(newId, overridesMap.get(oldId)!);
        overridesMap.delete(oldId);
      }

      // 2. Cascade customParent updates to all other nodes
      for (const [key, override] of Array.from(overridesMap.entries())) {
        if (override.customParent === oldId) {
          overridesMap.set(key, { ...override, customParent: newId });
        }
      }

      // 3. Move Custom Node itself if applicable
      if (customNodesMap.has(oldId)) {
        const node = customNodesMap.get(oldId)!;
        customNodesMap.set(newId, { ...node, id: newId });
        customNodesMap.delete(oldId);
      }

      // 4. Cascade Custom Edges
      const edgesToMove: [string, OntologyEdge][] = [];
      for (const [key, edge] of Array.from(customEdgesMap.entries())) {
        if (edge.source === oldId || edge.target === oldId) {
          const updatedEdge = {
            ...edge,
            source: edge.source === oldId ? newId : edge.source,
            target: edge.target === oldId ? newId : edge.target
          };
          edgesToMove.push([key, updatedEdge]);
        }
      }
      edgesToMove.forEach(([oldKey, edge]) => {
        customEdgesMap.delete(oldKey);
        customEdgesMap.set(`${edge.source}|||${edge.target}`, edge);
      });

      // 5. Cascade Deleted Edges (Tombstones)
      const tombstonesToMove: string[] = [];
      for (const key of Array.from(deletedEdgesMap.keys())) {
        const [s, t] = key.split('|||');
        if (s === oldId || t === oldId) {
          tombstonesToMove.push(key);
        }
      }
      tombstonesToMove.forEach(oldKey => {
        const [s, t] = oldKey.split('|||');
        const newS = s === oldId ? newId : s;
        const newT = t === oldId ? newId : t;
        deletedEdgesMap.delete(oldKey);
        deletedEdgesMap.set(`${newS}|||${newT}`, true);
      });
    });
  }, [ydoc]);

  const clearOverrides = useCallback(() => {
    if (confirm('모든 노드의 색상과 핀 고정 위치를 처음 상태로 되돌리겠습니까?')) {
      ydoc.transact(() => {
        const map = ydoc.getMap('overrides');
        Array.from(map.keys()).forEach(k => map.delete(k));
      });
    }
  }, [ydoc]);

  const resetLayoutOverrides = useCallback(() => {
    if (confirm('모든 노드의 "배치 위치(좌표)"와 "소속 관계"를 초기화하시겠습니까? (색상 및 이름 변경 내역은 유지됩니다)')) {
      ydoc.transact(() => {
        const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
        for (const key of Array.from(map.keys())) {
          const current = map.get(key);
          if (current) {
            map.set(key, { ...current, fixedX: null, fixedY: null, customParent: null, customOrbitIndex: null, customSortOrder: null });
          }
        }
      });
    }
  }, [ydoc]);

  const clearAll = useCallback(() => {
    if (confirm('화이트보드의 모든 편집 내용을 지우겠습니까?')) {
      ydoc.transact(() => {
        ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
          const m = ydoc.getMap(name);
          Array.from(m.keys()).forEach(k => m.delete(k));
        });
        // Set hideDefaultGraph: true on root-HCHPS override
        ydoc.getMap('overrides').set('root-HCHPS', { hideDefaultGraph: true });
      });
    }
  }, [ydoc]);

  const syncToCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('현재 화면의 모든 노드 구조를 클라우드에 저장하시겠습니까? (프로덕션 환경과 동기화)')) return;
    try {
      const latestData = store.getSnapshot();
      const res = await replaceAll('MAP_CUSTOMIZATION', [{ id: 'singleton', ...latestData }]);
      if (res && !silent) alert('☁️ 성공적으로 클라우드에 동기화되었습니다!');
      else if (!res && !silent) alert('저장에 실패했습니다.');
    } catch (e: unknown) {
      console.error(e);
      if (!silent) alert('동기화 중 오류가 발생했습니다.');
    }
  }, [store]);

  const applyFestivalPreset = useCallback(() => {
    const { nodes, edges, overrides } = getFestivalPresetGraphData();

    ydoc.transact(() => {
      const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

      Array.from(overridesMap.keys()).forEach(k => overridesMap.delete(k));
      Array.from(customNodesMap.keys()).forEach(k => customNodesMap.delete(k));
      Array.from(customEdgesMap.keys()).forEach(k => customEdgesMap.delete(k));
      Array.from(deletedEdgesMap.keys()).forEach(k => deletedEdgesMap.delete(k));

      // Set hideDefaultGraph: true on root-HCHPS override
      overridesMap.set('root-HCHPS', { hideDefaultGraph: true });

      // Injects 5 domain hubs + sub-nodes into customNodesMap
      nodes.forEach((n: OntologyNode) => {
        customNodesMap.set(n.id, n);
      });

      // Injects cross-domain edges into customEdgesMap
      edges.forEach((e: OntologyEdge) => {
        const key = `${e.source}|||${e.target}`;
        customEdgesMap.set(key, e);
      });

      // Injects overrides
      Object.entries(overrides).forEach(([id, ov]) => {
        if (id !== 'root-HCHPS') {
          overridesMap.set(id, ov as NodeOverride);
        }
      });
    });

    if (typeof window !== 'undefined') {
      try {
        const presetEntriesWithIds = FESTIVAL_PRESET_SIMULATION_ENTRIES.map((item) => ({
          ...item,
          id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          createdAt: new Date().toISOString()
        }));
        localStorage.setItem('hchps-budget-simulations', JSON.stringify(presetEntriesWithIds));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.warn('[applyFestivalPreset] Failed to sync simulation entries:', err);
      }
    }

    syncToCloud(true);
  }, [ydoc, syncToCloud]);

  const fetchFromCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('클라우드에서 최신 데이터를 불러오시겠습니까? (현재 로컬의 캔버스 내용은 모두 덮어씌워집니다)')) return;
    try {
      isSyncing.current = true;
      const rows = await readSheet<MapCustomizationData & { id: string }>('MAP_CUSTOMIZATION');
      console.log('[DEBUG] fetchFromCloud rows:', rows);
      if (rows && rows.length > 0 && rows[0].id === 'singleton') {
        const cloudData = rows[0];
        console.log('[DEBUG] cloudData.customNodes:', cloudData.customNodes?.length);
        ydoc.transact(() => {
          ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
            const m = ydoc.getMap(name);
            Array.from(m.keys()).forEach(k => m.delete(k));
          });
          
          if (cloudData.overrides) Object.entries(cloudData.overrides).forEach(([k, v]) => ydoc.getMap('overrides').set(k, v));
          if (cloudData.customNodes) cloudData.customNodes.forEach((n: OntologyNode) => ydoc.getMap('customNodesMap').set(n.id, n));
          if (cloudData.customEdges) cloudData.customEdges.forEach((e: OntologyEdge) => ydoc.getMap('customEdgesMap').set(`${e.source}|||${e.target}`, e));
          if (cloudData.deletedEdges) cloudData.deletedEdges.forEach((e: string) => ydoc.getMap('deletedEdgesMap').set(e, true));
        });
        if (!silent) alert('☁️ 성공적으로 클라우드에서 데이터를 불러왔습니다!');
      } else {
        if (!silent) alert('클라우드에 저장된 백업 데이터가 없습니다.');
      }
    } catch (e: unknown) {
      console.error(e);
      if (!silent) alert('불러오기 중 오류가 발생했습니다.');
    } finally {
      isSyncing.current = false;
    }
  }, [ydoc]);

  // 자동 클라우드 로드 (최초 마운트)
  const isInitialMount = useRef(true);
  const cloudFetched = useRef(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  useEffect(() => {
    if (enabled && isInitialMount.current) {
      isInitialMount.current = false;
      // 동기적 로딩 모델: 딜레이 없이 즉각 클라우드 호출
      fetchFromCloud(true).then(() => {
         cloudFetched.current = true;
         setIsCloudLoaded(true);
         console.log('[Auto-Load] MindMap configuration fetched from cloud.');
      });
    }
  }, [enabled, fetchFromCloud]);

  // 자동 클라우드 백업 (디바운스 2500ms)
  useEffect(() => {
    if (!enabled || !cloudFetched.current || isSyncing.current) return;
    const timer = setTimeout(() => {
      syncToCloud(true).then(() => {
        console.log('[Auto-Save] MindMap configuration uploaded to cloud.');
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [enabled, data, syncToCloud]);

  // AI 추출 후보를 1회 감지하여 pendingNodes / pendingEdges 버퍼 상태로 필터링 수집 (10s 폴링 제거)
  useEffect(() => {
    if (!enabled || !isCloudLoaded) return;

    const runPoll = async () => {
      if (!enabled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
        return;
      }
      try {
        const { readSheet } = await import('@/lib/sheets-api');
        const rows = await readSheet<MapCustomizationData & { id: string }>('MAP_CUSTOMIZATION');
        
        if (rows && rows.length > 0 && rows[0].id === 'singleton') {
          const dbData = rows[0];
          
          const customNodesMap = globalYDoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
          const customEdgesMap = globalYDoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
          const deletedEdgesMap = globalYDoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

          const reviewedNodeIds = new Set(getReviewedNodeIds());
          const reviewedEdgeKeys = new Set(getReviewedEdgeKeys());

          const newPendingNodes: OntologyNode[] = [];
          if (dbData.customNodes) {
            dbData.customNodes.forEach((n: OntologyNode) => {
              if (!customNodesMap.has(n.id) && !reviewedNodeIds.has(n.id) && !recentlyDeletedNodes.has(n.id)) {
                newPendingNodes.push(n);
              }
            });
          }

          const newPendingEdges: OntologyEdge[] = [];
          if (dbData.customEdges) {
            dbData.customEdges.forEach((e: OntologyEdge) => {
              const k = `${e.source}|||${e.target}`;
              const r = `${e.target}|||${e.source}`;
              
              if (recentlyDeletedNodes.has(e.source) || recentlyDeletedNodes.has(e.target)) {
                return;
              }

              if (
                !customEdgesMap.has(k) && !customEdgesMap.has(r) && 
                !reviewedEdgeKeys.has(k) && !reviewedEdgeKeys.has(r) &&
                !deletedEdgesMap.has(k) && !deletedEdgesMap.has(r)
              ) {
                newPendingEdges.push(e);
              }
            });
          }

          const isNodesSame = globalPendingNodes.length === newPendingNodes.length &&
                              globalPendingNodes.every((n, i) => n.id === newPendingNodes[i].id);
          const isEdgesSame = globalPendingEdges.length === newPendingEdges.length &&
                              globalPendingEdges.every((e, i) => `${e.source}|||${e.target}` === `${newPendingEdges[i].source}|||${newPendingEdges[i].target}`);
          if (!isNodesSame || !isEdgesSame) {
            setGlobalPending(newPendingNodes, newPendingEdges);
          }
        }
      } catch (err) {
        console.error('[Watcher Poll Error] Failed to auto-sync watcher DB:', err);
      }
    };

    runPoll();
  }, [enabled, isCloudLoaded]);

  return {
    ...data,
    isCloudLoaded,
    saveStatus: 'saved', // Mock saveStatus since Yjs persists automatically
    undo,
    redo,
    setNodeOverride,
    batchSetNodeOverrides,
    clearNodeOverride,
    addCustomNode,
    deleteCustomNode,
    updateCustomNodeText,
    addCustomEdge,
    deleteCustomEdge,
    removeCustomTombstone,
    renameNodeId,
    clearOverrides,
    resetLayoutOverrides,
    clearAll,
    applyFestivalPreset,
    syncToCloud,
    fetchFromCloud,
    pendingNodes,
    pendingEdges,
    approveAndMerge,
    addPendingSuggestions,
  };
}
