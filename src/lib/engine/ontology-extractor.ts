import * as Y from 'yjs';
import { OntologyNode, OntologyEdge } from '@/lib/ontology.types';

export interface ExtractedGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

/**
 * 한국어 라벨에서 끝나는 조사(은/는/이/가/을/를/의/에/에서/등) 및 불필요한 따옴표를 정제합니다.
 */
export function cleanKoreanLabel(label: string): string {
  if (!label) return '';
  let cleaned = label.trim();

  // Remove trailing Korean postpositions (조사)
  const postpositions = ['에서', '에게', '으로', '까지', '부터', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로'];
  for (const post of postpositions) {
    if (cleaned.endsWith(post) && cleaned.length > post.length) {
      const base = cleaned.substring(0, cleaned.length - post.length);
      if (/[\uac00-\ud7a30-9a-zA-Z]$/.test(base)) {
        cleaned = base;
        break;
      }
    }
  }

  // Eliminate quotes and unnecessary outer spaces
  cleaned = cleaned.replace(/^['"“‘]+|['"”’]+$/g, '').trim();

  return cleaned;
}

/**
 * 추출된 온톨로지 노드/엣지를 후처리합니다:
 * 1. 노드 라벨 한국어 조사 정제
 * 2. baseValue 기준 상위 15개 노드로 제한
 * 3. 15개 범위 밖 dangling 엣지 및 self-reference 엣지 제거
 */
export function postProcessGraph(nodes: any[], edges: any[]): { nodes: any[]; edges: any[] } {
  if (!nodes) nodes = [];
  if (!edges) edges = [];

  // 1. cleanKoreanLabel on all node labels
  const cleanedNodes = nodes
    .map(n => ({
      ...n,
      label: cleanKoreanLabel(n.label || '')
    }))
    .filter(n => n.label.length > 0 && n.id);

  // 2. Limit nodes to 15 (sort by baseValue descending and slice)
  const sortedNodes = [...cleanedNodes].sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0));
  const limitedNodes = sortedNodes.slice(0, 15);
  const nodeIds = new Set(limitedNodes.map(n => n.id));

  // 3. Prune dangling edges (edges where source or target is not in the 15 nodes list)
  // Also prune self-references (source === target)
  const prunedEdges = edges.filter(e => {
    return e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target;
  });

  return { nodes: limitedNodes, edges: prunedEdges };
}

/**
 * 추출된 시맨틱 온톨로지 정보를 Yjs CRDT 협업 스토어에 안전하게 병합합니다.
 */
export function mergeExtractedGraph(ydoc: Y.Doc, extracted: ExtractedGraph) {
  if (!extracted || !extracted.nodes) return;

  ydoc.transact(() => {
    const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
    const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
    const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

    // 1. 추출 노드 병합
    for (let i = 0; i < extracted.nodes.length; i++) {
      const node = extracted.nodes[i];
      if (!node.id) continue;
      
      // 이미 존재하는 노드면 덮어쓰지 않고 스킵 (수동 오버라이드 보존)
      if (!customNodesMap.has(node.id)) {
        customNodesMap.set(node.id, {
          id: node.id,
          label: node.label || '이름 없음',
          group: node.group || 'OTHER',
          baseValue: node.baseValue ?? 80,
          layerId: node.layerId ?? 3, // 기본: 3 (위키/문서)
          centralityScore: 100,
        });
      }
    }

    // 2. 추출 엣지(관계) 병합
    if (extracted.edges) {
      for (let i = 0; i < extracted.edges.length; i++) {
        const edge = extracted.edges[i];
        if (!edge.source || !edge.target) continue;
        
        const edgeId = `${edge.source}|||${edge.target}`;
        const reverseId = `${edge.target}|||${edge.source}`;

        // 삭제 마킹 해제 (부활)
        if (deletedEdgesMap.has(edgeId)) deletedEdgesMap.delete(edgeId);
        if (deletedEdgesMap.has(reverseId)) deletedEdgesMap.delete(reverseId);

        // 중복 추가 방지
        if (!customEdgesMap.has(edgeId) && !customEdgesMap.has(reverseId)) {
          customEdgesMap.set(edgeId, {
            source: edge.source,
            target: edge.target,
            weight: edge.weight ?? 1.0,
            type: edge.type ?? 'DEPENDENCY',
          });
        }
      }
    }
  });
}
