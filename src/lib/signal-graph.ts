/**
 * Signal Graph Builder — 시그널 키워드에서 온톨로지 그래프 생성
 * 사용자의 시그널 입력에서 추출된 키워드를 노드로,
 * 같은 문장에 함께 등장한 키워드 간에 엣지를 생성
 */

import { OntologyGraph, OntologyNode, OntologyEdge, OntologyGroup, NodeOverride } from './ontology.types';
import { SignalEntry } from '@/hooks/useSignal';
import { computeCentrality } from './ontology.service';

export type PartialOntologyEdge = OntologyEdge & { isCustom?: boolean };
export type PartialOntologyNode = OntologyNode & { isExplicitColor?: boolean };

const warnedNodes = new Set<string>();

const CATEGORY_GROUPS: readonly OntologyGroup[] = [
  'MACRO_RESEARCH',
  'DCF_MODELING',
  'DATA_PIPELINE',
  'INFRASTRUCTURE',
  'SYSTEM_RISK'
];

const HEX_PALETTE: readonly string[] = [
  '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', 
  '#ef4444', '#14b8a6', '#f97316', '#84cc16', '#6366f1',
  '#0ea5e9', '#d946ef', '#eab308', '#f43f5e', '#8b5cf6'
];

let cachedGraphInputHash: string | null = null;
let cachedGraphOutput: OntologyGraph | null = null;

export function buildSignalGraph(
  keywordMap: Record<string, number> = {},
  entries: SignalEntry[] = [],
  customData?: {
    overrides: Record<string, NodeOverride>;
    customNodes: OntologyNode[];
    customEdges: OntologyEdge[];
    deletedEdges?: string[];
  }
): OntologyGraph {
  // Support flexible positional argument ordering defensively
  let safeKeywordMap: Record<string, number> = keywordMap || {};
  let safeEntries: SignalEntry[] = Array.isArray(entries) ? entries : [];

  if (Array.isArray(keywordMap) && typeof entries === 'object' && !Array.isArray(entries)) {
    safeEntries = keywordMap as unknown as SignalEntry[];
    safeKeywordMap = entries || {};
  }

  // 🚀 O(1) Fast-Path Graph Cache Guard: 입력 데이터 변경이 없는 경우 0ms 반환
  const inputHash = `${safeEntries.length}_${Object.keys(safeKeywordMap).length}_${customData?.customNodes.length || 0}_${customData?.customEdges.length || 0}_${customData?.deletedEdges?.length || 0}_${Object.keys(customData?.overrides || {}).length}`;
  if (cachedGraphInputHash === inputHash && cachedGraphOutput) {
    return cachedGraphOutput;
  }

  const hideDefaultGraph = !!(customData && customData.overrides && customData.overrides['root-HCHPS']?.hideDefaultGraph);
  console.log('[DEBUG] buildSignalGraph START. hideDefaultGraph=', hideDefaultGraph, 'entries.length=', safeEntries.length, 'customNodes.length=', customData?.customNodes.length);

  const normalizeNodeId = (id: string): string => {
    if (id) {
      if (id.startsWith('leaf-tag-')) {
        const parts = id.split('-');
        if (parts.length >= 4) {
          return `leaf-${parts.slice(3).join('-')}`;
        }
      } else if (id.startsWith('leaf-kw-')) {
        const parts = id.split('-');
        if (parts.length >= 3) {
          return `leaf-${parts.slice(2).join('-')}`;
        }
      }
    }
    return id;
  };

  const customParentSet = new Set<string>();

  if (customData) {
    const dataRef = customData;
    const normalizedCustomData = {
      overrides: {} as Record<string, NodeOverride>,
      customNodes: [...dataRef.customNodes],
      customEdges: dataRef.customEdges ? [...dataRef.customEdges] : [],
      deletedEdges: dataRef.deletedEdges ? [...dataRef.deletedEdges] : [],
    };
    
    if (dataRef.overrides) {
      Object.keys(dataRef.overrides).forEach(key => {
        const val = dataRef.overrides[key];
        const newKey = normalizeNodeId(key);
        const newVal = { ...val };
        if (newVal.customParent) {
          newVal.customParent = normalizeNodeId(newVal.customParent);
          customParentSet.add(newVal.customParent);
        }
        normalizedCustomData.overrides[newKey] = {
          ...(normalizedCustomData.overrides[newKey] || {}),
          ...newVal
        };
      });
    }
    
    normalizedCustomData.customEdges = normalizedCustomData.customEdges.map(ce => ({
      ...ce,
      source: normalizeNodeId(ce.source),
      target: normalizeNodeId(ce.target)
    }));
    
    if (normalizedCustomData.deletedEdges) {
      normalizedCustomData.deletedEdges = normalizedCustomData.deletedEdges.map(edgeStr => {
        const parts = edgeStr.split('|||');
        if (parts.length === 2) {
          return `${normalizeNodeId(parts[0])}|||${normalizeNodeId(parts[1])}`;
        }
        return edgeStr;
      });
    }
    
    normalizedCustomData.customNodes = normalizedCustomData.customNodes.map(cn => {
      const ncn = { ...cn };
      if (ncn.parentId) {
        ncn.parentId = normalizeNodeId(ncn.parentId);
        customParentSet.add(ncn.parentId);
      }
      return ncn;
    });

    customData = normalizedCustomData;
  }

  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];
  let forcedCenterNode: OntologyNode | undefined = undefined;

  if (safeEntries.length === 0) {
    if (customData && customData.customNodes.length > 0) {
      // IF entries are empty but we have custom nodes, DON'T abort!
      // This might be the bug! If the user deleted all signals but kept custom nodes!
      console.log('[DEBUG] entries empty but custom nodes exist!');
      // We should still add a root node maybe?
    } else {
      console.log('[DEBUG] Returning empty nodes!');
      return {
        nodes: [{ id: 'empty', label: '엔트리가 없습니다', group: 'OTHER', baseValue: 50 }],
        edges: [],
      };
    }
  }

  // 1. Root Node (HCHPS) - Center of the tree
  nodes.push({
    id: 'root-HCHPS',
    label: 'Vital Tasks',
    group: 'CORE_PROJECT', // Vivid Blue
    baseValue: 100,
    centralityScore: 10000,
    customColor: '#94a3b8', // 흐릿한 회색 (slate-400)
  });

  if (!hideDefaultGraph) {
    // 2. Extract Orbit 1 Tags (Category constraints from Tasks/Modules)
    const tagCounts = new Map<string, number>();
    let hasRawSignals = false;

    for (let i = 0; i < safeEntries.length; i++) {
      const e = safeEntries[i];
      if (!e.tags || e.tags.length === 0) {
        hasRawSignals = true;
      } else {
        for (let j = 0; j < e.tags.length; j++) {
          const t = e.tags[j];
          tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
        }
      }
    }

    // Force '미분류' / '내 생각' branch if there are raw signals
    if (hasRawSignals) {
      tagCounts.set('💭 미분류', 9999); 
    }

    // Take top N tags to avoid clutter, but ALWAYS include tags that have overrides or are custom parents
    const allSortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const sortedTags: [string, number][] = [];
    const overrideKeys = customData ? new Set(Object.keys(customData.overrides)) : new Set<string>();

    for (let i = 0; i < allSortedTags.length; i++) {
      const [tag, count] = allSortedTags[i];
      const id = `tag-${tag}`;
      const hasOverride = overrideKeys.has(id);
      const isParentOfAny = customParentSet.has(id);

      if (i < 15 || hasOverride || isParentOfAny) {
        sortedTags.push([tag, count]);
      }
    }

    const tagNodesMap = new Map<string, string>();
    const tagGroupMap = new Map<string, OntologyGroup>();

    // Add Orbit 1 Nodes
    for (let i = 0; i < sortedTags.length; i++) {
      const [tag] = sortedTags[i];
      const id = `tag-${tag}`;
      const groupAssign = CATEGORY_GROUPS[i % CATEGORY_GROUPS.length];
      
      // 1차 카테고리 초기 색상 랜덤 (태그 문자열 해싱 기반으로 안정적인 랜덤 생성)
      let hash = 0;
      for (let j = 0; j < tag.length; j++) {
        hash = tag.charCodeAt(j) + ((hash << 5) - hash);
      }
      
      const stableColor = HEX_PALETTE[Math.abs(hash) % HEX_PALETTE.length];

      tagNodesMap.set(tag, id);
      tagGroupMap.set(tag, groupAssign);

      nodes.push({
        id,
        label: tag,
        group: groupAssign,
        customColor: stableColor,
        baseValue: 80,
        centralityScore: 1000 - i, // Orbit 1
      });
      // Create structural branch from Sun to Category
      edges.push({
        source: 'root-HCHPS',
        target: id,
        weight: 1.0,
        type: 'CAUSAL_DRIVE',
      });
    }

    // 3. Process Leaves (Keywords) & Map to Categories
    const keywordFreqByTag = new Map<string, Map<string, number>>();

    safeEntries.forEach(e => {
      let applicableTags: string[] = [];
      if (e.tags) {
        for (let i = 0; i < e.tags.length; i++) {
          const t = e.tags[i];
          if (tagNodesMap.has(t)) {
            applicableTags.push(t);
          }
        }
      }
      
      const entryKeywords = e.keywords || [];

      // Pure signal routing: Does it match a category keyword?
      if (applicableTags.length === 0) {
        const matched: string[] = [];
        for (let i = 0; i < entryKeywords.length; i++) {
          const kw = entryKeywords[i];
          if (tagNodesMap.has(kw)) {
            matched.push(kw);
          }
        }
        if (matched.length > 0) applicableTags = matched;
        else if (tagNodesMap.has('💭 미분류')) applicableTags = ['💭 미분류'];
      }

      applicableTags.forEach(tag => {
        const tagMap = keywordFreqByTag.get(tag) || new Map<string, number>();
        entryKeywords.forEach(kw => {
          // Exclude the category name itself from the leaves
          if (kw !== tag) { 
            tagMap.set(kw, (tagMap.get(kw) || 0) + 1);
          }
        });
        keywordFreqByTag.set(tag, tagMap);
      });
    });

    // Create Leaf Nodes & Branched Edges
    const nodesMap = new Map<string, OntologyNode>();
    nodes.forEach(n => nodesMap.set(n.id, n));

    keywordFreqByTag.forEach((kwMap, tag) => {
      const tagNodeId = tagNodesMap.get(tag)!;
      const branchGroup = tagGroupMap.get(tag) || 'OTHER';
      
      // Top 8 keywords per branch to prevent chaos, but ALWAYS include overridden ones or those referenced as customParent
      const allSortedKw = Array.from(kwMap.entries())
        .sort((a, b) => b[1] - a[1]);

      const sortedKw: [string, number][] = [];
      const overrideKeys = customData ? new Set(Object.keys(customData.overrides)) : new Set<string>();

      allSortedKw.forEach(([kw, freq], i) => {
        const leafId = `leaf-${kw}`;
        const hasOverride = overrideKeys.has(leafId);
        const isParentOfAny = customParentSet.has(leafId);

        if (i < 8 || hasOverride || isParentOfAny) {
          sortedKw.push([kw, freq]);
        }
      });

      sortedKw.forEach(([kw, freq]) => {
        const leafId = `leaf-${kw}`;
        
        let existingNode = nodesMap.get(leafId);
        if (!existingNode) {
          const newNode: OntologyNode = {
            id: leafId,
            label: kw,
            group: branchGroup, // Inherit category's color
            baseValue: Math.min(60, 30 + freq * 10),
            centralityScore: 100 + freq, // Orbit 2+
            parentId: tagNodeId,
          };
          nodes.push(newNode);
          nodesMap.set(leafId, newNode);
        } else {
          existingNode.baseValue = Math.max(existingNode.baseValue || 0, Math.min(60, 30 + freq * 10));
          existingNode.centralityScore = Math.max(existingNode.centralityScore || 0, 100 + freq);
        }
        
        // Branch off the Orbit 1 node
        edges.push({
          source: tagNodeId,
          target: leafId,
          weight: 0.7, 
          type: 'DEPENDENCY',
        });
      });
    });

    // 3.5. Inject AI Curation Graph Connectivity (Phase 3)
    const nodesByLabelMap = new Map<string, OntologyNode>();
    nodes.forEach(n => nodesByLabelMap.set(n.label, n));

    safeEntries.forEach(e => {
      if (e.aiCurated && e.curationData?.relatedKeywords) {
        let firstSourceTag: string | undefined = undefined;
        if (e.tags) {
          for (let i = 0; i < e.tags.length; i++) {
            const t = e.tags[i];
            if (tagNodesMap.has(t)) {
              firstSourceTag = t;
              break;
            }
          }
        }
        if (firstSourceTag) {
          const sourceTagId = tagNodesMap.get(firstSourceTag);
          if (sourceTagId) {
            e.curationData.relatedKeywords.forEach(rk => {
              const targetTagId = tagNodesMap.get(rk);
              if (targetTagId && targetTagId !== sourceTagId) {
                edges.push({
                  source: sourceTagId,
                  target: targetTagId,
                  weight: 0.4,
                  type: 'FEEDBACK_LOOP',
                });
              } else {
                const existingNode = nodesByLabelMap.get(rk);
                if (existingNode && existingNode.id !== sourceTagId) {
                  edges.push({
                    source: sourceTagId,
                    target: existingNode.id,
                    weight: 0.3,
                    type: 'DEPENDENCY',
                  });
                }
              }
            });
          }
        }
      }
    });
  }

  // 4. Merge Custom Nodes and Edges from Whiteboard
  if (customData) {
    const dataLabels = new Map<string, string>(); // label -> id
    nodes.forEach(n => dataLabels.set(n.label, n.id));
    
    // 유령 노드(Ghost Node) 방지: 삭제된 커스텀 노드의 ID와, 이를 대체한 실제 데이터 노드의 ID 매핑
    const mergedIdMap = new Map<string, string>();

    customData.customNodes.forEach(cn => {
      const override = customData.overrides[cn.id];
      const actualLabel = override?.customLabel || cn.label;

      if (dataLabels.has(actualLabel)) {
        // A node with this label already exists (either data node or custom node).
        // Transfer overrides and skip rendering the duplicate.
        const targetNodeId = dataLabels.get(actualLabel)!;
        mergedIdMap.set(cn.id, targetNodeId);
        
        if (override) {
          const targetOverride = customData.overrides[targetNodeId] || {};
          
          const resolveProp = <K extends keyof NodeOverride>(key: K) => {
            if (targetOverride[key] !== undefined) {
              return targetOverride[key] === null ? undefined : targetOverride[key];
            }
            return override[key] === null ? undefined : override[key];
          };

          customData.overrides[targetNodeId] = {
            ...targetOverride,
            fixedX: resolveProp('fixedX'),
            fixedY: resolveProp('fixedY'),
            customColor: resolveProp('customColor'),
            customGroup: resolveProp('customGroup'),
            customParent: resolveProp('customParent'),
            customOrbitIndex: resolveProp('customOrbitIndex'),
            customLabel: resolveProp('customLabel'),
            customSortOrder: resolveProp('customSortOrder'),
            hidden: resolveProp('hidden'),
            isHighlighted: resolveProp('isHighlighted'),
          };
        }
        return; // Skip adding `cn`
      }
      dataLabels.set(actualLabel, cn.id);
      nodes.push(cn);
    });

    // Remap parentId of all nodes to their merged canonical IDs
    nodes.forEach(n => {
      if (n.parentId && mergedIdMap.has(n.parentId)) {
        n.parentId = mergedIdMap.get(n.parentId)!;
      }
      if (n.parentId === n.id) {
        if (!warnedNodes.has(n.id)) {
          console.warn(`[Self-Healing] Detected self-parent reference during merge for node: ${n.id}. Breaking loop.`);
          warnedNodes.add(n.id);
        }
        n.parentId = undefined;
      }
    });

    // 4.8. Self-heal inverted parent-child relationships (e.g. parent is longer and contains child label)
    const currentNodesMap = new Map<string, OntologyNode>();
    nodes.forEach(n => currentNodesMap.set(n.id, n));

    nodes.forEach(node => {
      if (node.parentId) {
        const parentNode = currentNodesMap.get(node.parentId);
        if (parentNode) {
          const labelX = node.label || '';
          const labelY = parentNode.label || '';
          const cleanX = labelX.replace(/\s+/g, '').replace(/비$/, '비용').replace(/료$/, '비용').replace(/금$/, '비용');
          const cleanY = labelY.replace(/\s+/g, '').replace(/비$/, '비용').replace(/료$/, '비용').replace(/금$/, '비용');
          
          // If the parent (Y) contains the child (X) and Y is longer than X, it's inverted!
          if (cleanY.length > cleanX.length && (labelY.includes(labelX) || cleanY.includes(cleanX))) {
            console.log(`[Self-Healing] Detected inverted parent-child relationship: child="${labelX}", parent="${labelY}". Breaking connection to let reparenting algorithm fix it.`);
            node.parentId = undefined;
            
            // Remove the corresponding structural edge
            for (let i = edges.length - 1; i >= 0; i--) {
              const e = edges[i];
              if (e.target === node.id && e.source === parentNode.id && !(e as PartialOntologyEdge).isCustom) {
                edges.splice(i, 1);
              }
            }
          }
        }
      }
    });

    // Remap any ghost customParent references to their merged ALIVE IDs or self-heal dynamically generated data node IDs
    Object.keys(customData.overrides).forEach(key => {
      const override = customData.overrides[key];
      if (override && override.customParent) {
        if (mergedIdMap.has(override.customParent)) {
          // 재귀적 고스트가 발생하지 않도록 대체된 ID를 주입
          override.customParent = mergedIdMap.get(override.customParent)!;
        } else {
          // Self-heal: If customParent refers to a generated node ID that no longer exists,
          // extract the label and try to find a newly generated node with the same label.
          const isNodeExists = nodes.some(n => n.id === override.customParent) || customData.customNodes.some(cn => cn.id === override.customParent);
          if (!isNodeExists) {
            let originalLabel = '';
            if (override.customParent.startsWith('tag-')) {
              originalLabel = override.customParent.slice(4);
            } else if (override.customParent.startsWith('leaf-')) {
              const parts = override.customParent.split('-');
              if (parts[1] === 'tag' && parts.length >= 4) {
                originalLabel = parts.slice(3).join('-');
              } else if (parts[1] === 'kw' && parts.length >= 3) {
                originalLabel = parts.slice(2).join('-');
              } else {
                originalLabel = parts.slice(1).join('-');
              }
            }
            
            if (originalLabel && dataLabels.has(originalLabel)) {
              override.customParent = dataLabels.get(originalLabel)!;
            }
          }
        }
      }
    });

    customData.customEdges.forEach(ce => {
      const finalSource = mergedIdMap.get(ce.source) || ce.source;
      const finalTarget = mergedIdMap.get(ce.target) || ce.target;
      edges.push({ ...ce, source: finalSource, target: finalTarget, isCustom: true } as PartialOntologyEdge);
    });

    // 4.5. Create default parent-child edges for custom nodes that have a parentId but no customEdges representation
    const nodeMap = new Map<string, OntologyNode>(nodes.map(n => [n.id, n]));
    const connectedEdgesSet = new Set<string>();
    edges.forEach(e => {
      connectedEdgesSet.add(`${e.source}|||${e.target}`);
      connectedEdgesSet.add(`${e.target}|||${e.source}`);
    });

    customData.customNodes.forEach(cn => {
      const finalId = mergedIdMap.get(cn.id) || cn.id;
      const finalNode = nodeMap.get(finalId);
      if (!finalNode) return;

      const override = customData.overrides[finalId];

      let parentId = (override && override.customParent !== undefined)
        ? (override.customParent === 'NONE' ? undefined : override.customParent)
        : finalNode.parentId;

      if (parentId === finalId) {
        parentId = undefined;
      }

      if (parentId && parentId !== 'NONE' && nodeMap.has(parentId)) {
        const hasEdge = connectedEdgesSet.has(`${parentId}|||${finalId}`) ||
                        connectedEdgesSet.has(`${finalId}|||${parentId}`);
        if (!hasEdge) {
          const newEdge = {
            source: parentId,
            target: finalId,
            weight: 0.7,
            type: 'DEPENDENCY',
            isCustom: true
          } as PartialOntologyEdge;
          edges.push(newEdge);
          connectedEdgesSet.add(`${parentId}|||${finalId}`);
          connectedEdgesSet.add(`${finalId}|||${parentId}`);
        }
      }
    });

    // (DeletedEdges processing moved to the end of custom mapping to catch customParent generated edges)

    // 4.9. Topology-driven Hierarchical Reparenting (자동 계층형 부모 승격 알고리즘)
    console.log('[DEBUG] Start forcedCenterNode check. customData overrides keys:', customData ? Object.keys(customData.overrides) : 'none');
    forcedCenterNode = (customData ? nodes.find(n => {
      const o = customData.overrides[n.id];
      const match = o?.customOrbitIndex === 0;
      if (match) console.log('[DEBUG] Found forcedCenterNode via customOrbitIndex===0:', n.id, n.label);
      return match;
    }) : undefined) || nodes.find(n => n.id === 'root-HCHPS');
    console.log('[DEBUG] Resolved forcedCenterNode ID:', forcedCenterNode?.id, 'Label:', forcedCenterNode?.label);

    // 대상: parentId가 없거나 대분류 태그 ID('tag-')/중앙 노드인 모든 노드 (태그/루트 본인 제외)
    const leafNodesForReparent = nodes.filter(n => {
      if (n.id.startsWith('tag-') || n.id === 'root-HCHPS' || (forcedCenterNode && n.id === forcedCenterNode.id)) {
        return false;
      }
      const currentParent = n.parentId;
      return !currentParent || currentParent.startsWith('tag-') || currentParent === 'root-HCHPS' || (forcedCenterNode && currentParent === forcedCenterNode.id);
    });
    
    // 리프 노드들 간에 연결된 엣지 관계 파악 (양방향 지원을 위한 세트 구성)
    const connectedPairs = new Set<string>();
    edges.forEach(e => {
      if (
        e.type === 'DEPENDENCY' ||
        e.type === 'CAUSAL_DRIVE' ||
        e.type === 'COMPONENTS' ||
        e.type === 'BUDGET_SOURCE'
      ) {
        connectedPairs.add(`${e.source}|||${e.target}`);
        connectedPairs.add(`${e.target}|||${e.source}`);
      }
    });

    // nodes의 id 룩업 맵 빌드
    const liveNodesMap = new Map<string, OntologyNode>();
    nodes.forEach(n => liveNodesMap.set(n.id, n));

    // 순환 참조(Cycle)를 검사하는 DFS 헬퍼 (Map 기반 O(1) 초고속/정밀 감지)
    const hasCycle = (startId: string, parentIdToSet: string): boolean => {
      const visited = new Set<string>();
      let curr = parentIdToSet;
      while (curr) {
        if (curr === startId) return true;
        if (visited.has(curr)) break;
        visited.add(curr);
        const parentNode = liveNodesMap.get(curr);
        curr = parentNode?.parentId || '';
      }
      return false;
    };

    // Precompute semantic properties for all nodes in O(N) to optimize inner loop comparisons
    const nodeSemanticsMap = new Map<string, {
      label: string;
      clean: string;
      isCheckupCategory: boolean;
      isMedicalTerm: boolean;
    }>();

    nodes.forEach(n => {
      const label = n.label || '';
      const clean = label.replace(/\s+/g, '').replace(/비$/, '비용').replace(/료$/, '비용').replace(/금$/, '비용');
      const isCheckupCategory = label.includes('체크업') || label.includes('검진') || label.includes('보건') || label.includes('건강');
      const isMedicalTerm = /초음파|심장|혈압|당뇨|내시경|엑스레이|검사|의료|접종|백신|병원|진료|보건소|치매/.test(label);
      
      nodeSemanticsMap.set(n.id, {
        label,
        clean,
        isCheckupCategory,
        isMedicalTerm
      });
    });

    // 계층 재배치 수행
    leafNodesForReparent.forEach(nodeX => {
      // 이미 customData.overrides에서 customParent를 수동 정의하고 있다면 스킵
      const hasUserOverride = customData?.overrides[nodeX.id]?.customParent !== undefined;
      if (hasUserOverride) return;

      const semX = nodeSemanticsMap.get(nodeX.id);
      if (!semX) return;

      // nodeX를 가리키는 횡적 DEPENDENCY 등의 엣지를 보낸 source 노드(Y)들을 찾음
      const parentCandidates: Array<{ nodeY: OntologyNode; score: number }> = [];

      nodes.forEach(nodeY => {
        if (nodeY.id === nodeX.id) return;
        if (nodeY.id === 'root-HCHPS' || nodeY.id.startsWith('root-')) return;

        const semY = nodeSemanticsMap.get(nodeY.id);
        if (!semY) return;

        let score = 0;

        // 1. 엣지 연결성 점수 (양방향 엣지가 존재하는가?)
        const hasEdge = connectedPairs.has(`${nodeY.id}|||${nodeX.id}`);
        if (hasEdge) {
          score += 15; // 엣지 연결 시 우선순위 가중치 15점 부여
        }

        // 2. 텍스트 포함 시맨틱 점수 (Y의 레이블이 X의 레이블에 부분 포함되는가?)
        if (semY.label.length > 1 && semY.clean.length < semX.clean.length && (semX.label.includes(semY.label) || semX.clean.includes(semY.clean))) {
          score += 35; // direct containment is much more specific, give it 35 points
        }
        
        // 특수한 시맨틱 텍스트 결합 문맥 가중치 추가
        if (hasEdge && (
          (semX.label.includes('검진') && semY.label.includes('체크업')) ||
          (semX.label.includes('비용') && semY.label.includes('구매')) ||
          (semX.label.includes('회의록') && semY.label.includes('회의'))
        )) {
          score += 5;
        }

        // 보건/의료 시맨틱 가중치 추가
        if (semY.isCheckupCategory && semX.isMedicalTerm) {
          score += 20; // 2차 카테고리 매핑용 최우선 점수 부여
        }

        if (score > 0) {
          parentCandidates.push({ nodeY, score });
        }
      });

      if (parentCandidates.length > 0) {
        parentCandidates.sort((a, b) => b.score - a.score);
        const bestCandidate = parentCandidates[0].nodeY;

        if (!hasCycle(nodeX.id, bestCandidate.id)) {
          // 기존 부모, 태그 노드, 또는 중앙 노드와 nodeX 사이에 걸려있던 구조적 엣지 제거
          const oldParentId = nodeX.parentId;
          const centerId = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
          
          for (let i = edges.length - 1; i >= 0; i--) {
            const e = edges[i];
            if (e.target === nodeX.id && !((e as PartialOntologyEdge).isCustom)) {
              if (e.source === oldParentId || e.source === centerId || e.source.startsWith('tag-')) {
                edges.splice(i, 1);
              }
            }
          }

          nodeX.parentId = bestCandidate.id;
          liveNodesMap.set(nodeX.id, nodeX);

          // 새로운 부모-자식 연결 엣지 추가
          const hasEdge = edges.some(e => e.source === bestCandidate.id && e.target === nodeX.id);
          if (!hasEdge) {
            edges.push({
              source: bestCandidate.id,
              target: nodeX.id,
              weight: 0.7,
              type: 'DEPENDENCY',
            });
          }
        }
      }
    });

    // Pre-index nodes and structural edges for O(1) override applications
    const overrideNodeMap = new Map<string, OntologyNode>(nodes.map(n => [n.id, n]));
    const edgeTargetMap = new Map<string, OntologyEdge>();
    edges.forEach(e => {
      if (!(e as PartialOntologyEdge).isCustom) {
        edgeTargetMap.set(e.target, e as OntologyEdge);
      }
    });

    // Apply Overrides (Pins, Colors, Labels, Groups)
    nodes.forEach(n => {
      const override = customData.overrides[n.id];
      if (override) {
        // --- 지정 좌표(fixed X,Y) 강제 반영 ---
        if ('fixedX' in override) n.fixedX = override.fixedX === null ? undefined : override.fixedX;
        if ('fixedY' in override) n.fixedY = override.fixedY === null ? undefined : override.fixedY;

        if (override.customColor !== undefined) {
          n.customColor = override.customColor === null ? undefined : override.customColor;
          if (n.customColor) (n as PartialOntologyNode).isExplicitColor = true;
        }
        if (override.customLabel !== undefined) n.label = override.customLabel === null ? n.label : (override.customLabel as string);
        if (override.customGroup !== undefined) n.group = override.customGroup === null ? n.group : (override.customGroup as OntologyGroup);
        if (override.customOrbitIndex !== undefined) n.customOrbitIndex = override.customOrbitIndex === null ? undefined : override.customOrbitIndex;
        if (override.customSortOrder !== undefined) n.customSortOrder = override.customSortOrder === null ? undefined : override.customSortOrder;
        if (override.isHighlighted !== undefined) n.isHighlighted = override.isHighlighted === null ? undefined : override.isHighlighted;
        
        const safeParent = override.customParent === null ? undefined : override.customParent;
        if (override.customParent !== undefined) {
          if (safeParent === 'NONE') {
            n.parentId = undefined;
            const targetEdge = edgeTargetMap.get(n.id);
            if (targetEdge) {
              const edgeIndex = edges.indexOf(targetEdge);
              if (edgeIndex !== -1) edges.splice(edgeIndex, 1);
              edgeTargetMap.delete(n.id);
            }
          } else if (safeParent) {
            n.parentId = safeParent;
            
            // Re-route the structural edge (target === n.id)
            const edge = edgeTargetMap.get(n.id);
            if (edge) {
              edge.source = safeParent;
            } else {
              const newEdge = {
                source: safeParent,
                target: n.id,
                weight: 0.7,
                type: 'DEPENDENCY'
              } as OntologyEdge;
              edges.push(newEdge);
              edgeTargetMap.set(n.id, newEdge);
            }
            
            // Sync colour with new parent if custom group/color are not explicitly overridden
            const newParent = overrideNodeMap.get(safeParent);
            if (newParent && (override.customGroup === undefined || override.customGroup === null) && (override.customColor === undefined || override.customColor === null)) {
              n.group = newParent.group;
              n.customColor = newParent.customColor || undefined;
            }
          }
        }
        
        // If the custom node has been successfully pulled into the structural Orbit system, 
        // we must clear its hardcoded fallback creation coordinates so it obeys the physics system!
        if ((override.customOrbitIndex !== undefined || override.customParent !== undefined) && override.fixedX === undefined) {
           n.fixedX = undefined;
           n.fixedY = undefined;
        }
      }
    });
    
    // Remove deleted edges (tombstones for structural, custom, and customParent rerouted edges)
    // Placed *after* all edge creation phases so tombstones unilaterally override anything.
    if (customData.deletedEdges && customData.deletedEdges.length > 0) {
      const deletedSet = new Set(customData.deletedEdges);
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i];
        if (deletedSet.has(`${e.source}|||${e.target}`) || deletedSet.has(`${e.target}|||${e.source}`)) {
          edges.splice(i, 1);
        }
      }
    }
  }

  let finalNodes = nodes;
  let finalEdges = edges;

  // 5. Center Node Override Processing (Hijack Root Mode)
  if (forcedCenterNode) {
    forcedCenterNode.centralityScore = 9999999;
    forcedCenterNode.parentId = undefined;
    forcedCenterNode.group = 'CORE_PROJECT'; // Shift to core group identity
    forcedCenterNode.customColor = '#94a3b8'; // 중앙 노드는 흐릿한 회색 고정
    forcedCenterNode.fixedX = undefined;     // <--- Must clear baked custom node coords to center perfectly!
    forcedCenterNode.fixedY = undefined;
    
    // Find root-HCHPS which is ALWAYS the original source of Category edges in the stateless generator
    finalEdges.forEach(e => {
      // Transfer foundational driving branches from the default root to the new forced center,
      // EXCEPT for explicitly custom-attached nodes or edges (they should stay on the old root)
      if (e.source === 'root-HCHPS') {
        const isCustomParent = customData?.overrides[e.target]?.customParent === 'root-HCHPS';
        const isCustomEdge = (e as PartialOntologyEdge).isCustom;
        if (!isCustomParent && !isCustomEdge) {
          e.source = forcedCenterNode.id;
        }
      }
      // Remove incoming structural edges targeting the New Center to prevent loops
      if (e.target === forcedCenterNode.id) {
        if (!(e as PartialOntologyEdge).isCustom) {
          e.source = forcedCenterNode.id; // Mark as self-loop to be filtered out
        }
      }
    });
    
    // Formally push the old default root (아이뛰움) into Orbit 1 as a category of the new forced center
    finalEdges.push({
      source: forcedCenterNode.id,
      target: 'root-HCHPS',
      weight: 1.0,
      type: 'CAUSAL_DRIVE'
    });
    
    // Clean self-referencing edges
    finalEdges = finalEdges.filter(e => e.source !== e.target);
  }

  // Node hiding (hidden) filtering logic completely removed per user directive

  // --- 6. Top-Down Color Inheritance ---
  // 1차 카테고리의 색상을 하위 노드 전체로 전파합니다.
  const childMap = new Map<string, string[]>();
  finalEdges.forEach(e => {
    const current = childMap.get(e.source) || [];
    current.push(e.target);
    childMap.set(e.source, current);
  });

  const rootId = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
  const queue = childMap.get(rootId) ? [...childMap.get(rootId)!] : []; 
  const visited = new Set<string>([rootId]);
  
  // Create O(1) maps for nodes and parent edges to eliminate nested find() calls inside queue
  const nodeMap = new Map<string, OntologyNode>(finalNodes.map(n => [n.id, n]));
  const parentIdMap = new Map<string, string>();
  finalEdges.forEach(e => {
    parentIdMap.set(e.target, e.source);
  });

  let queueHead = 0;
  while (queueHead < queue.length) {
    const currentId = queue[queueHead++];
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    const parentSourceId = parentIdMap.get(currentId);
    if (parentSourceId) {
      const parentNode = nodeMap.get(parentSourceId);
      // 부모 노드가 시각적 색상을 갖고 있고, 중앙 노드(rootId)가 아니라면 색상을 다단계로 전파
      if (parentNode && parentNode.customColor && parentNode.id !== rootId) {
        // 단, 사용자가 명시적으로 색상을 지정한 노드는 덮어쓰지 않음
        const explicitOverride = customData?.overrides[currentId]?.customColor;
        if (!explicitOverride) {
          currentNode.customColor = parentNode.customColor;
        }
      }
    }

    const children = childMap.get(currentId) || [];
    children.forEach(child => {
      if (!visited.has(child)) {
        queue.push(child);
      }
    });
  }

  // Pre-create custom edges set for fast membership test
  const customEdgesSet = new Set<string>();
  if (customData && customData.customEdges) {
    customData.customEdges.forEach(ce => {
      customEdgesSet.add(`${ce.source}|||${ce.target}`);
      customEdgesSet.add(`${ce.target}|||${ce.source}`);
    });
  }

  // Pre-build finalNodeMap in O(N) for instant lookups
  const finalNodeMap = new Map<string, OntologyNode>();
  finalNodes.forEach(n => finalNodeMap.set(n.id, n));

  // 7. Cleanup invalid topology: Nodes with a specific parent should not connect directly to the center
  finalEdges = finalEdges.filter(e => {
    // 사용자가 수동으로 연결한 선분(Custom Edge)은 허용
    const isCustomEdge = customEdgesSet.has(`${e.source}|||${e.target}`) || customEdgesSet.has(`${e.target}|||${e.source}`);
    if (isCustomEdge) return true;

    const centerId = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
    if (e.source === centerId || e.target === centerId) {
      const otherId = e.source === centerId ? e.target : e.source;
      const otherNode = finalNodeMap.get(otherId);
      if (otherNode && otherNode.parentId && otherNode.parentId !== centerId) {
        return false;
      }
    }
    return true;
  });

  // 8. Orphan Node Prevention: 모든 노드는 중앙 노드(root-HCHPS)에 물리적으로 연결되어야 함
  // 사용자가 임의 추가한 커스텀 노드나, 간선 삭제로 인해 떨어져 나간 노드들을 중앙으로 강제 결속
  const actualCenter = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
  const adj = new Map<string, string[]>();
  
  finalNodes.forEach(n => adj.set(n.id, []));
  finalEdges.forEach(e => {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
  });

  const reachable = new Set<string>();
  const q = [actualCenter];
  let qHead = 0;
  reachable.add(actualCenter);

  while (qHead < q.length) {
    const curr = q[qHead++];
    const neighbors = adj.get(curr) || [];
    for (const nxt of neighbors) {
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        q.push(nxt);
      }
    }
  }

  // Reachable하지 않은 고립 컴포넌트의 노드들을 모아 중앙 루트에 엣지를 생성
  finalNodes.forEach(n => {
    if (!reachable.has(n.id)) {
      // n의 최상위 unreachable 조상(root)을 탐색
      let root = n;
      const visitedAncestors = new Set<string>([n.id]);
      while (root.parentId) {
        const parentNode = finalNodeMap.get(root.parentId);
        if (parentNode && !reachable.has(parentNode.id) && !visitedAncestors.has(parentNode.id)) {
          root = parentNode;
          visitedAncestors.add(parentNode.id);
        } else {
          break;
        }
      }

      // 최상위 조상 노드와 중앙 루트 연결
      finalEdges.push({
        source: actualCenter,
        target: root.id,
        weight: 0.5,
        type: 'DEPENDENCY',
        isCustom: true // Treat as custom so it isn't easily pruned
      } as PartialOntologyEdge);
      
      // BFS를 통해 해당 고립 컴포넌트 내의 모든 노드를 reachable로 등록
      const subQ = [root.id];
      let subQHead = 0;
      reachable.add(root.id);
      
      while (subQHead < subQ.length) {
        const curr = subQ[subQHead++];
        const neighbors = adj.get(curr) || [];
        for (const nxt of neighbors) {
          if (!reachable.has(nxt)) {
            reachable.add(nxt);
            subQ.push(nxt);
          }
        }
      }
    }
  });

  // ── 최종 빌드 결과물에 대한 순환 참조 사후 자가 치유 (Self-Healing Final Cycle Breaker) ──
  // finalNodes 내의 parentId 상속 고리가 순환을 이루지 않도록 DFS 탐색을 통해 순환 고리를 즉시 제거합니다.
  const edgesToRemove = new Set<string>();

  finalNodes.forEach(node => {
    const visited = new Set<string>();
    let curr: OntologyNode | undefined = node;
    while (curr && curr.parentId) {
      if (visited.has(curr.id)) {
        console.warn(`[Self-Healing] Breaking circular parentId reference for node: ${curr.id} (parent: ${curr.parentId})`);
        const targetParentId = curr.parentId;
        curr.parentId = undefined;
        edgesToRemove.add(`${targetParentId}::${curr.id}`);
        break;
      }
      visited.add(curr.id);
      curr = finalNodeMap.get(curr.parentId);
    }
  });

  if (edgesToRemove.size > 0) {
    finalEdges = finalEdges.filter(e => !edgesToRemove.has(`${e.source}::${e.target}`));
  }

  // ── 중앙 루트 노드 이름 강제 복원 ──
  const rootNode = finalNodeMap.get('root-HCHPS');
  if (rootNode) {
    rootNode.label = 'Vital Tasks';
  }

  console.log('[DEBUG] buildSignalGraph END. finalNodes.length=', finalNodes.length, 'finalEdges.length=', finalEdges.length);
  const scoredNodes = computeCentrality(finalNodes, finalEdges);
  const resultGraph = { nodes: scoredNodes, edges: finalEdges };
  cachedGraphInputHash = inputHash;
  cachedGraphOutput = resultGraph;
  return resultGraph;
}
