'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle, Check, Info } from 'lucide-react';
import { OntologyNode, OntologyEdge, OntologyGroup, OntologyLayerId, EdgeType, GROUP_LABELS, LAYER_LABELS, EDGE_TYPE_LABELS } from '@/lib/ontology.types';

interface SemanticReviewModalProps {
 isOpen: boolean;
 onClose: () => void;
 pendingNodes: OntologyNode[];
 pendingEdges: OntologyEdge[];
 existingNodeIds: Set<string>;
 approveAndMerge: (
 approvedNodes: OntologyNode[],
 approvedEdges: OntologyEdge[],
 skippedIds: string[]
  ) => void;
}

interface ReviewNodeRowItemProps {
 node: OntologyNode;
 onUpdate: (id: string, field: keyof OntologyNode, value: any) => void;
 onDelete: (id: string) => void;
}

const ReviewNodeRowItem = React.memo(({ node, onUpdate, onDelete }: ReviewNodeRowItemProps) => {
 const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 onUpdate(node.id, 'label', e.target.value);
  }, [node.id, onUpdate]);

 const handleLayerChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
 onUpdate(node.id, 'layerId', parseInt(e.target.value) as OntologyLayerId);
  }, [node.id, onUpdate]);

 const handleGroupChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
 onUpdate(node.id, 'group', e.target.value as OntologyGroup);
  }, [node.id, onUpdate]);

 const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 onUpdate(node.id, 'baseValue', parseInt(e.target.value));
  }, [node.id, onUpdate]);

 const handleDelete = useCallback(() => {
 onDelete(node.id);
  }, [node.id, onDelete]);

 return (
    <div 
 className="p-4 bg-white border border-slate-200/60 rounded-2xl shadow-3xs flex flex-col gap-3 transition-colors duration-150 hover:border-slate-350"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <input
 type="text"
 value={node.label}
 onChange={handleLabelChange}
 className="w-full text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none pb-0.5"
          />
          <div className="text-[10px] text-slate-400 font-mono mt-1 select-none">ID: {node.id}</div>
        </div>
        <button
 type="button"
 onClick={handleDelete}
 className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
 title="노드 삭제"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-1">
        {/* Layer select */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">레이어</label>
          <select
 value={node.layerId ?? 3}
 onChange={handleLayerChange}
 className="w-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2 py-1 focus:outline-none"
          >
            <option value={0}>{LAYER_LABELS[0]}</option>
            <option value={1}>{LAYER_LABELS[1]}</option>
            <option value={2}>{LAYER_LABELS[2]}</option>
            <option value={3}>{LAYER_LABELS[3]}</option>
          </select>
        </div>

        {/* Group select */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">분류 그룹</label>
          <select
 value={node.group}
 onChange={handleGroupChange}
 className="w-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2 py-1 focus:outline-none"
          >
            {(Object.keys(GROUP_LABELS) as OntologyGroup[]).map(g => (
              <option key={g} value={g}>{GROUP_LABELS[g]}</option>
            ))}
          </select>
        </div>

        {/* Value slider */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex justify-between">
            <span>가중치</span>
            <span className="font-mono text-indigo-500 font-bold">{node.baseValue}</span>
          </label>
          <input
 type="range"
 min="10"
 max="100"
 step="5"
 value={node.baseValue}
 onChange={handleValueChange}
 className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>
    </div>
  );
});
ReviewNodeRowItem.displayName = 'ReviewNodeRowItem';

interface ReviewEdgeRowItemProps {
 edge: OntologyEdge;
 index: number;
 sourceLabel: string;
 targetLabel: string;
 onUpdate: (index: number, field: keyof OntologyEdge, value: any) => void;
 onDelete: (index: number) => void;
}

const ReviewEdgeRowItem = React.memo(({
 edge,
 index,
 sourceLabel,
 targetLabel,
 onUpdate,
 onDelete
}: ReviewEdgeRowItemProps) => {
 const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
 onUpdate(index, 'type', e.target.value as EdgeType);
  }, [index, onUpdate]);

 const handleWeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 onUpdate(index, 'weight', parseFloat(e.target.value));
  }, [index, onUpdate]);

 const handleDelete = useCallback(() => {
 onDelete(index);
  }, [index, onDelete]);

 return (
    <div 
 className="p-4 bg-white border border-slate-200/60 rounded-2xl shadow-3xs flex flex-col gap-3 transition-colors duration-150 hover:border-slate-350"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 text-xs font-semibold text-slate-600 flex flex-wrap items-center gap-1.5">
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold max-w-[150px] truncate">
            {sourceLabel}
          </span>
          <span className="text-indigo-500 font-bold mx-0.5">➔</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold max-w-[150px] truncate">
            {targetLabel}
          </span>
        </div>
        <button
 type="button"
 onClick={handleDelete}
 className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
 title="관계 삭제"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {/* Edge Type */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">관계 성격</label>
          <select
 value={edge.type}
 onChange={handleTypeChange}
 className="w-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2 py-1 focus:outline-none"
          >
            {(Object.keys(EDGE_TYPE_LABELS) as EdgeType[]).map(t => (
              <option key={t} value={t}>{EDGE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Weight Slider */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex justify-between">
            <span>가중 강도</span>
            <span className="font-mono text-indigo-500 font-bold">{edge.weight.toFixed(1)}</span>
          </label>
          <input
 type="range"
 min="-1.0"
 max="1.0"
 step="0.1"
 value={edge.weight}
 onChange={handleWeightChange}
 className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>
    </div>
  );
});
ReviewEdgeRowItem.displayName = 'ReviewEdgeRowItem';

function SemanticReviewModalComponent({
 isOpen,
 onClose,
 pendingNodes,
 pendingEdges,
 existingNodeIds,
 approveAndMerge
}: SemanticReviewModalProps) {
 const [nodes, setNodes] = useState<OntologyNode[]>(() => JSON.parse(JSON.stringify(pendingNodes || [])));
 const [edges, setEdges] = useState<OntologyEdge[]>(() => JSON.parse(JSON.stringify(pendingEdges || [])));
  // Track skipped/rejected IDs
 const [skippedIds, setSkippedIds] = useState<string[]>([]);
 const [initialNodes, setInitialNodes] = useState<OntologyNode[]>(() => JSON.parse(JSON.stringify(pendingNodes || [])));
 const [initialEdges, setInitialEdges] = useState<OntologyEdge[]>(() => JSON.parse(JSON.stringify(pendingEdges || [])));
 const lastIsOpenRef = React.useRef(false);

 React.useEffect(() => {
 if (isOpen && !lastIsOpenRef.current) {
 const initialN = JSON.parse(JSON.stringify(pendingNodes || []));
 const initialE = JSON.parse(JSON.stringify(pendingEdges || []));
 setNodes(initialN);
 setEdges(initialE);
 setInitialNodes(initialN);
 setInitialEdges(initialE);
 setSkippedIds([]);
    }
 lastIsOpenRef.current = isOpen;
  }, [isOpen, pendingNodes, pendingEdges]);
  
  // Tab control: 'nodes' or 'edges'
 const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');

  // Input states for adding new node/edge in modal
 const [newNodeLabel, setNewNodeLabel] = useState('');
 const [newNodeGroup, setNewNodeGroup] = useState<OntologyGroup>('OTHER');
 const [newNodeLayer, setNewNodeLayer] = useState<OntologyLayerId>(3);
 const [newNodeValue, setNewNodeValue] = useState(80);

 const [newEdgeSource, setNewEdgeSource] = useState('');
 const [newEdgeTarget, setNewEdgeTarget] = useState('');
 const [newEdgeType, setNewEdgeType] = useState<EdgeType>('DEPENDENCY');
 const [newEdgeWeight, setNewEdgeWeight] = useState(1.0);

  // Node editing handlers
 const handleUpdateNode = useCallback((id: string, field: keyof OntologyNode, value: any) => {
 setNodes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  }, []);

 const handleDeleteNode = useCallback((id: string) => {
 setNodes(prev => prev.filter(n => n.id !== id));
    
    // Also remove any edges referencing this node and batch update skippedIds
 setEdges(prev => {
 const remainingEdges: OntologyEdge[] = [];
 const edgeSkippedKeys: string[] = [id];
 for (let i = 0; i < prev.length; i++) {
 const e = prev[i];
 if (e.source === id || e.target === id) {
 edgeSkippedKeys.push(`${e.source}|||${e.target}`);
        } else {
 remainingEdges.push(e);
        }
      }
 setSkippedIds(s => [...s, ...edgeSkippedKeys]);
 return remainingEdges;
    });
  }, []);

 const handleAddNode = useCallback(() => {
 if (!newNodeLabel.trim()) return;
 const generatedId = `custom-ai-${Date.now()}`;
 const newNode: OntologyNode = {
 id: generatedId,
 label: newNodeLabel.trim(),
 group: newNodeGroup,
 layerId: newNodeLayer,
 baseValue: newNodeValue,
 centralityScore: 100
    };
 setNodes(prev => [...prev, newNode]);
 setNewNodeLabel('');
  }, [newNodeLabel, newNodeGroup, newNodeLayer, newNodeValue]);

  // Edge editing handlers
 const handleUpdateEdge = useCallback((index: number, field: keyof OntologyEdge, value: any) => {
 setEdges(prev => prev.map((e, idx) => idx === index ? { ...e, [field]: value } : e));
  }, []);

 const handleDeleteEdge = useCallback((index: number) => {
 setEdges(prev => {
 const edgeToDelete = prev[index];
 if (edgeToDelete) {
 const edgeKey = `${edgeToDelete.source}|||${edgeToDelete.target}`;
 setSkippedIds(s => [...s, edgeKey]);
      }
 return prev.filter((_, idx) => idx !== index);
    });
  }, []);

 const handleAddEdge = useCallback(() => {
 if (!newEdgeSource || !newEdgeTarget) return;
 if (newEdgeSource === newEdgeTarget) {
 alert('출발 노드와 도착 노드는 서로 달라야 합니다.');
 return;
    }
 const newEdge: OntologyEdge = {
 source: newEdgeSource,
 target: newEdgeTarget,
 type: newEdgeType,
 weight: newEdgeWeight
    };
 setEdges(prev => [...prev, newEdge]);
 setNewEdgeSource('');
 setNewEdgeTarget('');
  }, [newEdgeSource, newEdgeTarget, newEdgeType, newEdgeWeight]);

  // Compute all available node IDs for edge connection selection
 const allAvailableNodeIds = useMemo(() => {
 const nodeIds = new Set<string>();
 existingNodeIds.forEach(id => nodeIds.add(id));
 nodes.forEach(n => nodeIds.add(n.id));
 return nodeIds;
  }, [existingNodeIds, nodes]);

  // Pre-index node labels into Map for O(1) lookups
 const nodeLabelMap = useMemo(() => {
 const map = new Map<string, string>();
 for (const n of nodes) {
 map.set(n.id, n.label);
    }
 return map;
  }, [nodes]);

  // Helper to get labels for IDs in O(1)
 const getNodeLabelById = useCallback((id: string) => {
 return nodeLabelMap.get(id) || id;
  }, [nodeLabelMap]);

  // Data Integrity Warnings Engine
 const integrityWarnings = useMemo(() => {
 const warnings: string[] = [];
 const nodeLabels = new Set<string>();
    
    // 1. Check duplicate Names or IDs in pending
 nodes.forEach(n => {
 if (existingNodeIds.has(n.id)) {
 warnings.push(`노드 ID 중복: '${n.id}'(표시명: ${n.label})는 이미 마인드맵에 존재합니다. 병합 시 덮어써집니다.`);
      }
 if (nodeLabels.has(n.label)) {
 warnings.push(`노드 이름 중복: '${n.label}'이라는 이름의 노드가 검토 목록에 여러 개 포함되어 있습니다.`);
      }
 nodeLabels.add(n.label);
    });

    // 2. Check edges for self-references or dangling connections
 edges.forEach((e) => {
 const edgeName = `'${getNodeLabelById(e.source)} ➔ ${getNodeLabelById(e.target)}'`;
 if (e.source === e.target) {
 warnings.push(`자기 참조 관계: ${edgeName}는 스스로를 가리키는 관계입니다.`);
      }
 const sourceExists = allAvailableNodeIds.has(e.source);
 const targetExists = allAvailableNodeIds.has(e.target);

 if (!sourceExists || !targetExists) {
 const missing = !sourceExists && !targetExists 
          ? '출발 및 도착 노드' 
          : !sourceExists 
            ? `출발 노드('${e.source}')` 
            : `도착 노드('${e.target}')`;
 warnings.push(`미연결 관계(Dangling Edge): ${edgeName}의 ${missing}가 맵에 존재하지 않고 검토 목록에도 누락되어 있습니다.`);
      }
    });

 return warnings;
  }, [nodes, edges, existingNodeIds, allAvailableNodeIds, getNodeLabelById]);

  // Submit Handler
 const handleApprove = useCallback(() => {
 const finalApprovedNodeIds = new Set(nodes.map(n => n.id));
 const finalApprovedEdgeKeys = new Set(edges.map(e => `${e.source}|||${e.target}`));

 const newlySkippedNodes = initialNodes
      .filter(n => !finalApprovedNodeIds.has(n.id))
      .map(n => n.id);

 const newlySkippedEdges = initialEdges
      .filter(e => !finalApprovedEdgeKeys.has(`${e.source}|||${e.target}`))
      .map(e => `${e.source}|||${e.target}`);

 const allSkipped = Array.from(new Set([...skippedIds, ...newlySkippedNodes, ...newlySkippedEdges]));

 approveAndMerge(nodes, edges, allSkipped);
 onClose();
  }, [nodes, edges, initialNodes, initialEdges, skippedIds, approveAndMerge, onClose]);

 const handleSetTabNodes = useCallback(() => setActiveTab('nodes'), []);
 const handleSetTabEdges = useCallback(() => setActiveTab('edges'), []);

 if (!isOpen) return null;

 return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60">
      <div className="w-full max-w-4xl h-[85vh] bg-white/95 border border-slate-200 rounded-[2rem] shadow-md flex flex-col overflow-hidden font-sans">
        
        {/* Header */}
        <div className="shrink-0 p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/10">
              ✨
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">관계 검토</h2>
              <p className="text-xs text-slate-400 font-medium">추출 노드 · 관계 병합 전 편집</p>
            </div>
          </div>
          <button 
 type="button"
 onClick={onClose}
 className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Warnings Banner */}
        {integrityWarnings.length > 0 && (
          <div className="shrink-0 px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 flex items-start gap-2.5 max-h-24 overflow-y-auto custom-scrollbar">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="text-xs font-semibold leading-relaxed flex-1">
              <span className="font-bold">[데이터 무결성 검증 경고] </span>
              {integrityWarnings.length}개의 정합성 요소 발견. 병합 전에 확인해 주십시오:
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {integrityWarnings.map((warning, idx) => (
                  <li key={idx} className="opacity-90">{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab switchers */}
        <div className="shrink-0 border-b border-slate-200 px-6 flex justify-between items-center bg-slate-50/20">
          <div className="flex gap-1 pt-2">
            <button
 type="button"
 onClick={handleSetTabNodes}
 className={`px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-colors duration-150 cursor-pointer ${
 activeTab === 'nodes'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              추출된 노드 검토 ({nodes.length})
            </button>
            <button
 type="button"
 onClick={handleSetTabEdges}
 className={`px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-colors duration-150 cursor-pointer ${
 activeTab === 'edges'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              추출된 관계 검토 ({edges.length})
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          
          {/* List panel (left 60%) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 border-b md:border-b-0 md:border-r border-slate-200">
            {activeTab === 'nodes' ? (
              <div className="flex flex-col gap-3">
                {nodes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-semibold text-xs flex flex-col items-center gap-2">
                    <Info size={24} className="text-slate-300" />
                    추출 노드 없음 · 우측 폼 수동 추가 가능
                  </div>
                ) : (
 nodes.map((node) => (
                    <ReviewNodeRowItem
 key={node.id}
 node={node}
 onUpdate={handleUpdateNode}
 onDelete={handleDeleteNode}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {edges.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-semibold text-xs flex flex-col items-center gap-2">
                    <Info size={24} className="text-slate-300" />
                    추출 관계 없음 · 우측 폼 수동 정의 가능
                  </div>
                ) : (
 edges.map((edge, index) => (
                    <ReviewEdgeRowItem
 key={`${edge.source}-${edge.target}-${edge.type}-${index}`}
 edge={edge}
 index={index}
 sourceLabel={getNodeLabelById(edge.source)}
 targetLabel={getNodeLabelById(edge.target)}
 onUpdate={handleUpdateEdge}
 onDelete={handleDeleteEdge}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Creation panel (right 40%) */}
          <div className="w-full md:w-[320px] shrink-0 p-6 bg-slate-50/40 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            
            {activeTab === 'nodes' ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2 uppercase tracking-wide">
                  <Plus size={15} /> 수동 노드 추가
                </h3>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">표시 라벨</label>
                    <input
 type="text"
 placeholder="예: 김주무관, 예산 증액안"
 value={newNodeLabel}
 onChange={(e) => setNewNodeLabel(e.target.value)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">레이어</label>
                    <select
 value={newNodeLayer}
 onChange={(e) => setNewNodeLayer(parseInt(e.target.value) as OntologyLayerId)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value={0}>{LAYER_LABELS[0]}</option>
                      <option value={1}>{LAYER_LABELS[1]}</option>
                      <option value={2}>{LAYER_LABELS[2]}</option>
                      <option value={3}>{LAYER_LABELS[3]}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">분류 그룹</label>
                    <select
 value={newNodeGroup}
 onChange={(e) => setNewNodeGroup(e.target.value as OntologyGroup)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {(Object.keys(GROUP_LABELS) as OntologyGroup[]).map(g => (
                        <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex justify-between">
                      <span>중요도 가중치</span>
                      <span className="font-mono text-indigo-500 font-bold">{newNodeValue}</span>
                    </label>
                    <input
 type="range"
 min="10"
 max="100"
 step="5"
 value={newNodeValue}
 onChange={(e) => setNewNodeValue(parseInt(e.target.value))}
 className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <button
 onClick={handleAddNode}
 disabled={!newNodeLabel.trim()}
 className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-sm transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> 노드 목록에 추가
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2 uppercase tracking-wide">
                  <Plus size={15} /> 수동 관계 추가
                </h3>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">출발 노드</label>
                    <select
 value={newEdgeSource}
 onChange={(e) => setNewEdgeSource(e.target.value)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value="">-- 노드 선택 --</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>[추출] {n.label}</option>
                      ))}
                      {Array.from(existingNodeIds).map(id => (
                        <option key={id} value={id}>[기존] {id}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">도착 노드</label>
                    <select
 value={newEdgeTarget}
 onChange={(e) => setNewEdgeTarget(e.target.value)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value="">-- 노드 선택 --</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>[추출] {n.label}</option>
                      ))}
                      {Array.from(existingNodeIds).map(id => (
                        <option key={id} value={id}>[기존] {id}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">관계 성격</label>
                    <select
 value={newEdgeType}
 onChange={(e) => setNewEdgeType(e.target.value as EdgeType)}
 className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {(Object.keys(EDGE_TYPE_LABELS) as EdgeType[]).map(t => (
                        <option key={t} value={t}>{EDGE_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex justify-between">
                      <span>가중치</span>
                      <span className="font-mono text-indigo-500 font-bold">{newEdgeWeight.toFixed(1)}</span>
                    </label>
                    <input
 type="range"
 min="-1.0"
 max="1.0"
 step="0.1"
 value={newEdgeWeight}
 onChange={(e) => setNewEdgeWeight(parseFloat(e.target.value))}
 className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <button
 onClick={handleAddEdge}
 disabled={!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget}
 className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-sm transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> 관계 목록에 추가
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 p-6 border-t border-slate-200/80 flex justify-between items-center bg-slate-50/50">
          <div className="text-xs font-semibold text-slate-500">
            총 <span className="text-indigo-600 font-bold">{nodes.length}</span>개 노드 및 <span className="text-indigo-600 font-bold">{edges.length}</span>개 관계 대기 중
          </div>
          <div className="flex gap-3">
            <button
 onClick={onClose}
 className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer"
            >
              취소
            </button>
            <button
 onClick={handleApprove}
 className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-colors duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} /> 승인 후 마인드맵에 최종 병합
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

SemanticReviewModalComponent.displayName = 'SemanticReviewModal';
export const SemanticReviewModal = React.memo(SemanticReviewModalComponent);
