import React from 'react';
import { OrbitalNode, OntologyEdge, GROUP_COLORS, OntologyGroup, EdgeType, OntologyLayerId, OntologyNode, GROUP_LABELS, LAYER_LABELS, EDGE_TYPE_LABELS } from '@/lib/ontology.types';
import { NodeOverride } from '@/hooks/useGraphCustomization';
import { Edit2, Waypoints, Trash2, Link2, Radio, X, Crosshair, Activity, Bot, Unlink, Phone, DollarSign, CheckCircle2, PlusSquare } from 'lucide-react';
import { useLocalContacts } from '@/hooks/useLocalContacts';
import { getCanonicalWikiId } from '@/hooks/useWikiStorage';
import { readSheet } from '@/lib/sheets-api';
import { extractRawTextFromBlocks, parseContacts } from '@/lib/contacts-parser';
import { useAILinker } from '@/hooks/useAILinker';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';


interface ForceGraphEngine {
  nodes: OrbitalNode[];
  edges: OntologyEdge[];
  needsRedraw?: boolean;
  getConnectedEdges?: (nodeId: string) => Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>;
  getNodeById?: (nodeId: string) => OrbitalNode | null | undefined;
  activeNode?: OrbitalNode | null;
  pendingCameraTargetId?: string | null;
}

interface MindMapInspectorProps {
  activeNode: OrbitalNode | null;
  engineRef: React.MutableRefObject<ForceGraphEngine | null | undefined>;
  activeNodeOverride?: NodeOverride;
  setNodeOverride: (id: string, options: Partial<NodeOverride>) => void;
  setActiveNode: React.Dispatch<React.SetStateAction<OrbitalNode | null>>;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
  updateCustomNodeText: (id: string, text: string) => void;
  removeCustomTombstone: (childId: string, parentId: string) => void;
  renameNodeId?: (oldId: string, newId: string) => void;
  deleteCustomNode: (id: string) => void;
  addCustomNode: (label: string, x: number, y: number, color?: string, group?: OntologyGroup, baseValue?: number, layerId?: OntologyLayerId) => OntologyNode;
  addCustomEdge: (src: string, tgt: string, type?: EdgeType, weight?: number) => void;
  deleteCustomEdge: (src: string, tgt: string) => void;
  parentModeSource: string | null;
  setParentModeSource: (id: string | null) => void;
  initEngine: () => void;
  handleSwapNodeOrder: (dir: -1 | 1) => void;
  clearNodeOverride: (id: string) => void;
  isOverlay: boolean;
  wikiBlocks?: any[];
}

export const MindMapInspector = React.memo(function MindMapInspector(props: MindMapInspectorProps) {
  const {
    activeNode, engineRef, activeNodeOverride, setNodeOverride, setActiveNode,
    onRenameCategory, onDeleteCategory, updateCustomNodeText, removeCustomTombstone, renameNodeId,
    deleteCustomNode, addCustomNode, addCustomEdge, deleteCustomEdge,
    parentModeSource, setParentModeSource,
    initEngine, clearNodeOverride, isOverlay,
    wikiBlocks
  } = props;

  const { tasks = [] } = useTasks();
  const { categories = [], getCategoryStats } = useBudget();



  const matchedCat = React.useMemo(() => {
    if (!activeNode) return null;
    return categories.find(c => c.name.includes(activeNode.label) || activeNode.label.includes(c.name));
  }, [activeNode, categories]);

  const catStats = React.useMemo(() => {
    if (!matchedCat) return null;
    return getCategoryStats(matchedCat.id);
  }, [matchedCat, getCategoryStats]);

  const matchedTasks = React.useMemo(() => {
    if (!activeNode) return [];
    return tasks.filter(t => t.title?.includes(activeNode.label) || t.category?.includes(activeNode.label));
  }, [activeNode, tasks]);

  const { recordContactMutation, batchRecordContactsMutation } = useLocalContacts();

  const [connectedEdges, setConnectedEdges] = React.useState<Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>>([]);
  const [parentLabel, setParentLabel] = React.useState<string | null>(null);
  const [engineNodes, setEngineNodes] = React.useState<OrbitalNode[]>([]);
  const engineNodesMap = React.useMemo(() => new Map(engineNodes.map(n => [n.id, n])), [engineNodes]);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordSuccess, setRecordSuccess] = React.useState(false);
  const [aiTargetId, setAiTargetId] = React.useState<string>('');
  const aiLinkMut = useAILinker();

  // Node Creation form states
  const [createLabel, setCreateLabel] = React.useState('');
  const [createGroup, setCreateGroup] = React.useState<OntologyGroup>('OTHER');
  const [createBaseValue, setCreateBaseValue] = React.useState<number>(80);
  const [createLayer, setCreateLayer] = React.useState<string>('');

  // Edge Creation form states
  const [newEdgeTargetId, setNewEdgeTargetId] = React.useState('');
  const [newEdgeType, setNewEdgeType] = React.useState<EdgeType>('DEPENDENCY');
  const [newEdgeWeight, setNewEdgeWeight] = React.useState<number>(1.0);

  const [catSearch, setCatSearch] = React.useState('');
  const [isCatOpen, setIsCatOpen] = React.useState(false);
  const catDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setCatSearch(parentLabel || '');
  }, [parentLabel]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target as Node)) {
        setIsCatOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setIsCatOpen]);
 
  // Clear success feedback when activeNode changes
  React.useEffect(() => {
    setRecordSuccess(false);
    setIsRecording(false);
    setAiTargetId(''); // reset AI target selection
    setCatSearch(parentLabel || '');
    setIsCatOpen(false);

    // Reset manual edge creation states
    setNewEdgeTargetId('');
    setNewEdgeType('DEPENDENCY');
    setNewEdgeWeight(1.0);
  }, [activeNode, parentLabel]);



  // 자카드 유사도 및 부분 일치 기반 노드 간 유사도 연산 (Zero-Allocation)
  const calculateNodeSimilarity = React.useCallback((labelA: string, labelB: string) => {
    if (!labelA || !labelB) return 0;
    const cleanA = labelA.toLowerCase().replace(/\s+/g, '');
    const cleanB = labelB.toLowerCase().replace(/\s+/g, '');
    if (cleanA === cleanB) return 100;
    
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
      return (Math.min(cleanA.length, cleanB.length) / Math.max(cleanA.length, cleanB.length)) * 80;
    }
    
    const setA = new Set(cleanA);
    const setB = new Set(cleanB);
    let intersectionCount = 0;
    for (const char of setA) {
      if (setB.has(char)) {
        intersectionCount++;
      }
    }
    const unionSize = setA.size + setB.size - intersectionCount;
    if (unionSize === 0) return 0;
    
    return (intersectionCount / unionSize) * 50;
  }, []);

  // 스마트 카테고리 퀵 추천 칩 목록
  const smartRecommendations = React.useMemo(() => {
    if (!activeNode || engineNodes.length === 0) return [];
    
    const candidates = engineNodes.filter((n: OrbitalNode) => {
      if (n.id === activeNode.id) return false;
      if (n.id === activeNode.parentId) return false;
      if (activeNode.id.startsWith('root-') || activeNode.orbitIndex === 0) return false;
      // 순환 구조 방지: 본인보다 바깥 궤도인 노드나 본인의 직계 자식은 제외
      return n.orbitIndex < (activeNode.orbitIndex ?? 1) || n.orbitIndex <= 2;
    });

    return candidates
      .map(n => {
        let score = calculateNodeSimilarity(activeNode.label, n.label);
        // 에코 중심, 1차, 2차 궤도 상위 노드 보너스 점수
        if (n.orbitIndex === 0) score += 20;
        else if (n.orbitIndex === 1) score += 15;
        else if (n.orbitIndex === 2) score += 8;
        return { node: n, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter(item => item.score > 5)
      .map(item => item.node);
  }, [activeNode, engineNodes, calculateNodeSimilarity]);

  // 검색어에 따른 자동완성 후보들
  const filteredCategoryNodes = React.useMemo(() => {
    const baseNodes = engineNodes.filter((n: OrbitalNode) => {
      if (activeNode && n.id === activeNode.id) return false;
      if (activeNode && (activeNode.id.startsWith('root-') || activeNode.orbitIndex === 0)) return false;
      return true;
    });
    
    const query = catSearch.trim().toLowerCase();
    if (!query) {
      return baseNodes.sort((a, b) => {
        if (a.orbitIndex !== b.orbitIndex) return a.orbitIndex - b.orbitIndex;
        return a.label.localeCompare(b.label);
      });
    }
    
    return baseNodes
      .filter((n: OrbitalNode) => n.label.toLowerCase().includes(query))
      .sort((a, b) => {
        const indexA = a.label.toLowerCase().indexOf(query);
        const indexB = b.label.toLowerCase().indexOf(query);
        if (indexA !== indexB) return indexA - indexB;
        if (a.orbitIndex !== b.orbitIndex) return a.orbitIndex - b.orbitIndex;
        return a.label.localeCompare(b.label);
      });
  }, [engineNodes, activeNode, catSearch]);

  // 부모 지정을 처리하는 핸들러
  const handleSelectParent = React.useCallback((parentId: string) => {
    if (!activeNode) return;
    if (parentId === 'NONE') {
      setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
      setTimeout(() => {
        if (engineRef.current) {
          setActiveNode(prev => prev ? { ...prev, parentId: undefined, customOrbitIndex: undefined } : null);
          initEngine();
        }
      }, 50);
    } else {
      const parentNode = engineRef.current?.getNodeById ? engineRef.current.getNodeById(parentId) : engineRef.current?.nodes.find((n: OrbitalNode) => n.id === parentId);
      const newOrbit = parentNode ? parentNode.orbitIndex + 1 : undefined;
      removeCustomTombstone(activeNode.id, parentId);
      setNodeOverride(activeNode.id, { customParent: parentId, customOrbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
      setTimeout(() => {
        if (engineRef.current) {
          setActiveNode(prev => prev ? { ...prev, parentId: parentId, customOrbitIndex: newOrbit, orbitIndex: newOrbit ?? prev.orbitIndex } : null);
          initEngine();
        }
      }, 50);
    }
    setIsCatOpen(false);
  }, [activeNode, setNodeOverride, setActiveNode, initEngine, removeCustomTombstone, engineRef]);


  const handleRecordToNotebookLM = async (phones: string[], emails: string[]) => {
    if (!activeNode || isRecording) return;
    setIsRecording(true);
    setRecordSuccess(false);

    recordContactMutation.mutate({
      nodeId: activeNode.id,
      nodeLabel: activeNode.label || activeNode.id,
      phones,
      emails
    }, {
      onSuccess: () => {
        setRecordSuccess(true);
        setTimeout(() => {
          setRecordSuccess(false);
        }, 3000);
      },
      onError: (err: any) => {
        alert(`기록 실패: ${err.message || '알 수 없는 오류'}`);
      },
      onSettled: () => {
        setIsRecording(false);
      }
    });
  };

  const [isBatchExtracting, setIsBatchExtracting] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [batchSuccessCount, setBatchSuccessCount] = React.useState<number | null>(null);

  const handleBatchExtractToNotebookLM = async () => {
    if (isBatchExtracting || engineNodes.length === 0) return;
    setIsBatchExtracting(true);
    setBatchSuccessCount(null);
    setBatchProgress({ current: 0, total: engineNodes.length });

    const extractedContacts: Array<{ nodeId: string; nodeLabel: string; phones: string[]; emails: string[] }> = [];

    try {
      for (let i = 0; i < engineNodes.length; i++) {
        const node = engineNodes[i];
        setBatchProgress({ current: i + 1, total: engineNodes.length });

        const canonicalWikiId = getCanonicalWikiId(node.id);
        const rows = await readSheet<any>(`WIKI_DOC_${canonicalWikiId}`);
        if (rows && rows.length > 0 && rows[0].blocks) {
          const rawText = extractRawTextFromBlocks(rows[0].blocks);
          const { phones, emails } = parseContacts(rawText);
          if (phones.length > 0 || emails.length > 0) {
            extractedContacts.push({
              nodeId: node.id,
              nodeLabel: node.label,
              phones,
              emails,
            });
          }
        }
      }

      if (extractedContacts.length === 0) {
        alert('추출 완료: 연락처가 작성된 위키 문서가 없습니다.');
        setIsBatchExtracting(false);
        setBatchProgress(null);
        return;
      }

      // Send all extracted contacts to the backend route
      batchRecordContactsMutation.mutate({
        contacts: extractedContacts
      }, {
        onSuccess: () => {
          setBatchSuccessCount(extractedContacts.length);
          setTimeout(() => {
            setBatchSuccessCount(null);
          }, 4000);
        },
        onError: (err: any) => {
          alert(`기록 실패: ${err.message || '알 수 없는 오류'}`);
        },
        onSettled: () => {
          setIsBatchExtracting(false);
          setBatchProgress(null);
        }
      });
    } catch (err: any) {
      console.log('[MindMapInspector] batch extract error:', err);
      alert(`기록 중 에러 발생: ${err.message || err}`);
      setIsBatchExtracting(false);
      setBatchProgress(null);
    }
  };

  React.useEffect(() => {
    if (engineRef && engineRef.current) {
      const uniqueNodes: OrbitalNode[] = [];
      const seenIds = new Set<string>();
      engineRef.current.nodes.forEach((n: OrbitalNode) => {
        if (!seenIds.has(n.id)) {
          seenIds.add(n.id);
          uniqueNodes.push(n);
        }
      });
      setEngineNodes(uniqueNodes);
      if (activeNode) {
        const edges = engineRef.current.getConnectedEdges ? engineRef.current.getConnectedEdges(activeNode.id) : [];
        setConnectedEdges(edges || []);
        
        if (activeNode.parentId) {
          const parent = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.parentId) : engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.parentId);
          setParentLabel(parent ? parent.label : null);
        } else {
          setParentLabel(null);
        }
      } else {
        setConnectedEdges([]);
        setParentLabel(null);
      }
    } else {
      setEngineNodes([]);
      setConnectedEdges([]);
      setParentLabel(null);
    }
  }, [activeNode, engineRef]);


  const handleSelectNode = (node: OrbitalNode) => {
    if (engineRef.current) {
      let parentId = node.parentId;
      const engine = engineRef.current as any;
      if (engine && engine.collapsedNodeIds) {
        while (parentId) {
          engine.collapsedNodeIds.delete(parentId);
          const parentNode = engine.getNodeById ? engine.getNodeById(parentId) : engine.nodes.find((n: any) => n.id === parentId);
          parentId = parentNode?.parentId;
        }
        engine.collapsedNodeIds.delete(node.id);
      }
      
      engine.activeNode = node;
      engine.pendingCameraTargetId = node.id;
      engine.needsRedraw = true;
      setActiveNode(node);
    }
  };

  const priorityNodes = React.useMemo(() => {
    if (engineNodes.length === 0) return [];

    const scored = engineNodes
      .filter((n) => n.id !== 'root-HCHPS' && !n.isCompleted && !n.layoutHidden)
      .map((node) => {
        let score = (node.renderSize || 0.5) * 15;
        const reasons: string[] = [];



        // 2. Risk Factor (리스크 스코어)
        const risk = node.riskFactor ?? 0;
        const isRiskOrigin = node.group === 'SYSTEM_RISK';
        if (isRiskOrigin) {
          score += 45;
          reasons.push(`🚨 시스템 리스크 발원지`);
        } else if (risk > 0.3) {
          score += risk * 30;
          reasons.push(`⚠️ 리스크 영향 감지 (위험도: ${(risk * 100).toFixed(0)}%)`);
        }

        // 3. Centrality (핵심 허브)
        if ((node.renderSize || 0.5) > 0.75 && reasons.length === 0) {
          reasons.push(`🌟 네트워크 위상학적 핵심 허브`);
        }

        if (reasons.length === 0) {
          reasons.push(`🔍 위상 분석 및 잠재적 모니터링 대상`);
        }

        return {
          node,
          score,
          reasons,
        };
      });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [engineNodes]);

  const renderNodeDetails = (isOverlay: boolean) => {
    return (
      <div 
        className={
          isOverlay 
            ? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] w-[95%] md:w-[90%] max-w-[800px] glass-panel dark:glass-panel-dark rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all duration-300 transform translate-y-0 animate-slide-up-fade"
            : "w-full h-full flex-1 glass-panel dark:glass-panel-dark rounded-2xl shadow-md overflow-hidden relative flex flex-col pointer-events-auto transition-all duration-300"
        }
      >
        <div className="px-4.5 py-3.5 border-b border-white/20 bg-slate-500/5 flex justify-between items-center">
          <h3 className="text-[12.5px] font-bold text-slate-500 uppercase tracking-wider">노드 인스펙터</h3>
          {activeNode !== null && (
            <button onClick={() => setActiveNode(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: isOverlay ? '45vh' : 'auto' }}>
                {activeNode ? (
                  (() => {
                    return (
                      <div className="p-4.5 flex flex-col gap-4">
                        {/* Group color + label */}
                    <div className="flex items-center gap-3.5 bg-white/40 p-3.5 rounded-2xl border border-slate-200/30">
                      <div
                        className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-white text-base font-bold shadow-sm"
                        style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }}
                      >
                        {activeNode.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[15.5px] text-slate-800 leading-snug flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{activeNode.label}</span>
                            <span className="shrink-0 px-2 py-0.5 bg-slate-200/60 border border-slate-200/80 text-slate-600 rounded text-[9.5px] font-bold uppercase tracking-wide">
                              {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newName = prompt('새 이름을 입력하세요:', activeNode.label);
                              if (newName && newName.trim() !== activeNode.label) {
                                  let targetId = activeNode.id;
                                  const rawNew = newName.trim().startsWith('#') ? newName.trim().slice(1) : newName.trim();
                                const isUncategorized = activeNode.id === 'tag-💭 미분류';
                                
                                if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                  targetId = `tag-${rawNew}`;
                                  if (renameNodeId) {
                                    renameNodeId(activeNode.id, targetId);
                                    const existingOverride = activeNodeOverride || {};
                                    setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  } else {
                                    const existingOverride = activeNodeOverride || {};
                                    setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                    clearNodeOverride(activeNode.id);
                                  }
                                } else {
                                  const existingOverride = activeNodeOverride || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  if (targetId.startsWith('custom-')) {
                                    updateCustomNodeText(targetId, newName.trim());
                                  }
                                }
                                
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.label = newName.trim();
                                    if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                      engineNode.id = targetId; 
                                    }
                                  }
                                  setActiveNode({ ...activeNode, id: targetId, label: newName.trim() });
                                }
 
                                if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onRenameCategory) {
                                  onRenameCategory(activeNode.label, newName.trim());
                                }
                              }
                            }}
                            className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer shrink-0 ml-2"
                            title="이름 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-1">
                          {(activeNode.orbitIndex === 1 || (activeNode.parentId && activeNode.parentId !== 'root-HCHPS')) && (
                            <>
                              <span className="text-emerald-600 font-semibold truncate">
                                 📁 카테고리: {activeNode.orbitIndex === 1 ? '메인' : (parentLabel || (activeNode.parentId?.startsWith('tag-') ? activeNode.parentId.replace('tag-', '') : '지정됨'))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
 
                    {/* Tags */}
                    {activeNode.isHedge && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 border border-rose-500/15 text-rose-700 uppercase tracking-wider animate-pulse">
                          🚧 병목 노드
                        </span>
                      </div>
                    )}
 
                    {/* Node Attributes Toggles: Highlight & Verification Status */}
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="flex flex-col bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl shadow-2xs">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">노드 항상 강조</label>
                          <button
                            onClick={() => {
                              const newVal = !activeNode.isHighlighted;
                              setNodeOverride(activeNode.id, { isHighlighted: newVal });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) engineNode.isHighlighted = newVal;
                                setActiveNode({ ...activeNode, isHighlighted: newVal });
                              }
                            }}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeNode.isHighlighted ? 'bg-amber-400' : 'bg-slate-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${activeNode.isHighlighted ? 'translate-x-3' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <span className="text-[9px] text-amber-600 font-bold leading-tight">선택 여부와 관계없이 3D 캔버스 내 글로우 후광 상시 유지</span>
                      </div>

                      {/* 📋 노드 검증 상태 (Verification Status) */}
                      <div className="flex flex-col bg-slate-900/5 border border-slate-700/15 p-3 rounded-xl shadow-2xs gap-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            📋 노드 검증 상태
                          </label>
                          <span className="text-[9.5px] font-bold text-slate-600">
                            {activeNode.verificationStatus === 'verified' ? '✅ 검증완료' :
                             activeNode.verificationStatus === 'in-progress' ? '🔍 검토 진행중' :
                             activeNode.verificationStatus === 'risk-warning' ? '⚠️ 위험경고' : '❓ 미완료'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => {
                              const newStatus = 'uncompleted';
                              setNodeOverride(activeNode.id, { verificationStatus: newStatus });
                              if (engineRef.current) {
                                const n = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((x: OrbitalNode) => x.id === activeNode.id);
                                if (n) n.verificationStatus = newStatus;
                                setActiveNode({ ...activeNode, verificationStatus: newStatus });
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border text-center ${
                              (!activeNode.verificationStatus || activeNode.verificationStatus === 'uncompleted')
                                ? 'bg-slate-700 text-white border-slate-800 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            ❓ 미완료
                          </button>
                          <button
                            onClick={() => {
                              const newStatus = 'in-progress';
                              setNodeOverride(activeNode.id, { verificationStatus: newStatus });
                              if (engineRef.current) {
                                const n = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((x: OrbitalNode) => x.id === activeNode.id);
                                if (n) n.verificationStatus = newStatus;
                                setActiveNode({ ...activeNode, verificationStatus: newStatus });
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border text-center ${
                              activeNode.verificationStatus === 'in-progress'
                                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            🔍 검토중
                          </button>
                          <button
                            onClick={() => {
                              const newStatus = 'verified';
                              setNodeOverride(activeNode.id, { verificationStatus: newStatus });
                              if (engineRef.current) {
                                const n = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((x: OrbitalNode) => x.id === activeNode.id);
                                if (n) n.verificationStatus = newStatus;
                                setActiveNode({ ...activeNode, verificationStatus: newStatus });
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border text-center ${
                              activeNode.verificationStatus === 'verified'
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            ✅ 검증완료
                          </button>
                          <button
                            onClick={() => {
                              const newStatus = 'risk-warning';
                              setNodeOverride(activeNode.id, { verificationStatus: newStatus });
                              if (engineRef.current) {
                                const n = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((x: OrbitalNode) => x.id === activeNode.id);
                                if (n) n.verificationStatus = newStatus;
                                setActiveNode({ ...activeNode, verificationStatus: newStatus });
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border text-center ${
                              activeNode.verificationStatus === 'risk-warning'
                                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                                : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
                            }`}
                          >
                            ⚠️ 위험경고
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 🔗 통합 업무 워크플로우 연동 현황 */}
                    <div className="flex flex-col gap-3 p-3.5 bg-gradient-to-br from-slate-500/5 to-indigo-500/5 border border-indigo-500/10 rounded-2xl shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 size={13} className="text-indigo-500" /> 🔗 통합 업무 워크플로우 연동 현황
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {/* 1. 예산 연동 */}
                        <div className="p-3 bg-white/50 border border-slate-200/40 rounded-xl flex items-center justify-between text-[11px] font-semibold text-slate-700 shadow-3xs">
                          <div className="flex items-center gap-2">
                            <DollarSign size={14} className="text-emerald-500" />
                            <span>예산 대조</span>
                          </div>
                          {matchedCat && catStats ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] text-slate-800 font-bold">{catStats.totalBudget?.toLocaleString()}원</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/15 text-emerald-700">
                                집행률 {Math.round(catStats.usageRate)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">연동 예산 없음</span>
                          )}
                        </div>

                        {/* 2. 태스크 연동 */}
                        <div className="p-3 bg-white/50 border border-slate-200/40 rounded-xl flex flex-col gap-1.5 shadow-3xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-indigo-500" />
                              <span>태스크 추진 일정</span>
                            </div>
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">
                              총 {matchedTasks.length}건
                            </span>
                          </div>
                          {matchedTasks.length > 0 && (
                            <div className="flex flex-col gap-1 border-t border-slate-200/20 pt-1.5">
                              {matchedTasks.slice(0, 2).map((t, idx) => (
                                <div key={t.id || `task-${t.title || (t as any).text || ''}-${idx}`} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                  <span className={`w-1.5 h-1.5 rounded-full ${(t as any).isCompleted || (t as any).status === '완료' || (t.status as any) === 'DONE' || (t.status as any) === 'done' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                  <span className="truncate flex-1">{t.title || (t as any).text || ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>                      {/* Report generation and semantic extraction removed */}
                    </div>

                    {/* 모바일 다이렉트 연락처 카드 */}
                    {(() => {
                      const rawText = extractRawTextFromBlocks(wikiBlocks || []);
                      const { phones, emails } = parseContacts(rawText);
                      
                      if (phones.length === 0 && emails.length === 0) return null;
                      
                      return (
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 border border-indigo-500/15 rounded-2xl shadow-2xs">
                          <div className="text-[10px] font-bold text-indigo-700 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                            <Phone size={12} className="animate-pulse text-indigo-500" />
                            📞 담당자 연락처 &amp; 아카이브
                          </div>
                          <div className="flex flex-col gap-2">
                            {phones.map((phone) => (
                              <div key={phone} className="flex items-center justify-between bg-white/70 dark:bg-slate-850/70 p-2.5 rounded-xl border border-slate-200/30 dark:border-slate-750 text-[11.5px] font-semibold text-slate-700 dark:text-slate-350 shadow-2xs">
                                <span>{phone}</span>
                                <div className="flex gap-1.5">
                                  <a
                                    href={`tel:${phone}`}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px]"
                                  >
                                    전화
                                  </a>
                                  <a
                                    href={`sms:${phone}`}
                                    className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px]"
                                  >
                                    문자
                                  </a>
                                </div>
                              </div>
                            ))}
                            {emails.map((email) => (
                              <div key={email} className="flex items-center justify-between bg-white/70 dark:bg-slate-850/70 p-2.5 rounded-xl border border-slate-200/30 dark:border-slate-750 text-[11.5px] font-semibold text-slate-700 dark:text-slate-350 shadow-2xs min-w-0">
                                <span 
                                  className="truncate mr-2 text-slate-600 dark:text-slate-400 select-text cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
                                  title="클릭하여 이메일 텍스트 복사"
                                  onClick={() => navigator.clipboard.writeText(email)}
                                >
                                  {email}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => navigator.clipboard.writeText(email)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px] cursor-pointer"
                                    title="이메일 텍스트 복사"
                                  >
                                    복사
                                  </button>
                                  <a
                                    href={`mailto:${email}`}
                                    className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px]"
                                  >
                                    메일
                                  </a>
                                </div>
                              </div>
                            ))}

                            <button
                              onClick={() => handleRecordToNotebookLM(phones, emails)}
                              disabled={isRecording}
                              className={`mt-1.5 w-full py-2 px-3.5 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                recordSuccess
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400'
                              }`}
                            >
                              <Bot size={13} className={isRecording ? "animate-spin" : ""} />
                              {isRecording ? '기록 중...' : recordSuccess ? '✓ 노트북 LM 기록 완료!' : '💾 노트북 LM에 기록'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {activeNode.id !== 'root-HCHPS' && (
                      <div className="flex flex-col gap-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                          <Waypoints size={13} className="text-slate-400" /> 관계 및 위계 설정
                        </div>

                        {/* 🤖 AI 관계 추론 및 자동 연결 */}
                        <div className="flex flex-col gap-1.5 bg-gradient-to-br from-slate-500/5 to-indigo-500/5 dark:from-slate-900/10 dark:to-indigo-900/10 border border-indigo-500/10 dark:border-indigo-950/20 p-3.5 rounded-2xl shadow-2xs">
                          <label className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                            <Bot size={13} className="animate-pulse text-indigo-500" /> 🤖 AI 관계 추론 및 자동 연결
                          </label>
                          <p className="text-[9px] text-slate-500 font-bold leading-tight mb-1.5">
                            현재 노드와 관계를 지을 타겟 노드를 선택하면, AI가 데이터 구조를 분석해 관계 유형을 판별하고 연결합니다.
                          </p>
                          <div className="flex flex-col gap-2 w-full">
                            <select
                              value={aiTargetId}
                              onChange={(e) => setAiTargetId(e.target.value)}
                              className="w-full min-w-0 text-[10.5px] px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium cursor-pointer"
                            >
                              <option value="">-- 연결할 대상 노드 선택 --</option>
                              {engineNodes
                                .filter(n => n.id !== activeNode.id && n.id !== 'root-HCHPS' && !n.layoutHidden)
                                .sort((a, b) => a.label.localeCompare(b.label))
                                .map(n => (
                                  <option key={n.id} value={n.id}>
                                    {n.label}
                                  </option>
                                ))
                              }
                            </select>
                            <button
                              disabled={!aiTargetId || aiLinkMut.isPending}
                              onClick={() => {
                                if (!aiTargetId) return;
                                const targetNode = engineNodesMap.get(aiTargetId);
                                if (!targetNode) return;

                                aiLinkMut.mutate({
                                  sourceId: activeNode.id,
                                  sourceLabel: activeNode.label,
                                  targetId: targetNode.id,
                                  targetLabel: targetNode.label
                                }, {
                                  onSuccess: (res) => {
                                    if (res.connected) {
                                      props.addCustomEdge(activeNode.id, targetNode.id, res.type as EdgeType);
                                      alert(`🤖 AI 관계 분석 성공!\n\n관계 유형: ${res.type}\n설명: ${res.summary}\n\n[결과] 간선이 자동 연결되어 Yjs/CRDT 캔버스 세션에 즉시 병합되었습니다.`);
                                      setAiTargetId('');
                                      setTimeout(() => initEngine(), 50);
                                    } else {
                                      alert(`🤖 AI 분석 결과, 두 노드 간의 뚜렷한 의미론적 관계성을 찾을 수 없어 연결을 생성하지 않았습니다.\n\n설명: ${res.summary}`);
                                    }
                                  },
                                  onError: (err) => {
                                    alert(`AI 관계 추론 실패: ${err.message}`);
                                  }
                                });
                              }}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-[10.5px] cursor-pointer transition-all shadow-3xs flex items-center justify-center gap-1"
                            >
                              {aiLinkMut.isPending ? '추론 중..' : '추론 및 연결'}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* 1. 카테고리 위계 선택 */}
                          <div className="flex flex-col gap-1.5 bg-slate-500/5 dark:bg-slate-900/10 border border-slate-200/40 dark:border-slate-800 rounded-2xl p-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">상위 카테고리 (그룹) 소속 지정</label>
                            
                            {/* 스마트 카테고리 추천 영역 */}
                            {smartRecommendations.length > 0 && (
                              <div className="flex flex-col gap-1 mb-1 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-2 animate-fade-in">
                                <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-1">
                                  <Bot size={10} className="animate-pulse" /> 🤖 퀵 추천 카테고리
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {smartRecommendations.map(rec => (
                                    <button
                                      key={rec.id}
                                      onClick={() => handleSelectParent(rec.id)}
                                      className="px-2 py-0.5 text-[9.5px] font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 active:bg-indigo-100 rounded-lg cursor-pointer transition-all shadow-3xs text-left"
                                    >
                                      {rec.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2 relative" ref={catDropdownRef}>
                              <div className="flex-1 relative flex items-center">
                                <input
                                  type="text"
                                  disabled={activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')}
                                  placeholder={activeNode.parentId ? "부모 카테고리 변경..." : "상위 카테고리 검색 및 지정..."}
                                  value={catSearch}
                                  onChange={(e) => {
                                    setCatSearch(e.target.value);
                                    setIsCatOpen(true);
                                  }}
                                  onFocus={() => setIsCatOpen(true)}
                                  className={`w-full text-xs pl-2.5 pr-8 py-2 rounded-xl border font-medium focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/40 ${(activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')) ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-550 cursor-not-allowed' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-200 cursor-text'}`}
                                />
                                {catSearch && (
                                  <button
                                    onClick={() => {
                                      setCatSearch('');
                                      setIsCatOpen(true);
                                    }}
                                    className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-full hover:bg-slate-100"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              
                              <button
                                onClick={() => setParentModeSource(parentModeSource === activeNode.id ? null : activeNode.id)}
                                className={`px-3 py-2 rounded-xl border text-xs shadow-2xs cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                                  parentModeSource === activeNode.id
                                    ? 'bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-900 text-purple-700 dark:text-purple-300 shadow-inner'
                                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title={parentModeSource === activeNode.id ? "맵에서 지정할 부모 노드를 클릭하세요..." : "맵에서 대상 노드 직접 클릭하기"}
                              >
                                <Crosshair size={14} />
                              </button>

                              {/* Autocomplete Dropdown List */}
                              {isCatOpen && !((activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE'))) && (
                                <div className="absolute top-[100%] left-0 right-0 mt-1 max-h-[220px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg z-50 py-1.5 custom-scrollbar">
                                  {/* 연결 해제 상시 노출 */}
                                  <div
                                    onClick={() => handleSelectParent('NONE')}
                                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer transition-all border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5"
                                  >
                                    <Unlink size={12} /> ❌ 연결 해제 (독립된 맵으로 고립)
                                  </div>
                                  
                                  {filteredCategoryNodes.length === 0 ? (
                                    <div className="px-3 py-2.5 text-xs text-slate-400 dark:text-slate-500 text-center font-medium">
                                      검색된 카테고리가 없습니다
                                    </div>
                                  ) : (
                                    filteredCategoryNodes.map((c: OrbitalNode) => {
                                      const prefix = c.orbitIndex === 0 ? '🌟' : c.orbitIndex === 1 ? '📁 1차:' : c.orbitIndex === 2 ? '📄 2차:' : `📄 ${c.orbitIndex}차:`;
                                      const isSelected = activeNode.parentId === c.id;
                                      return (
                                        <div
                                          key={c.id}
                                          onClick={() => handleSelectParent(c.id)}
                                          className={`px-3 py-2 text-xs cursor-pointer transition-all flex items-center justify-between font-medium ${
                                            isSelected 
                                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' 
                                              : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
                                          }`}
                                        >
                                          <span>{prefix} {c.label}</span>
                                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* 2. 궤도 차수 강제 지정 */}
                          <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">궤도(차수) 수동 강제 지정</label>
                            <select
                              disabled={activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)}
                              className={`border text-xs px-2.5 py-2 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40 cursor-pointer ${(activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                              value={activeNode.customOrbitIndex ?? activeNode.orbitIndex ?? 1}
                              onChange={(e) => {
                                const newOrbit = Number(e.target.value);
                                const resolvedOrbit = newOrbit === 0 ? undefined : newOrbit;

                                setNodeOverride(activeNode.id, { customOrbitIndex: resolvedOrbit, fixedX: undefined, fixedY: undefined });
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.customOrbitIndex = resolvedOrbit;
                                    engineNode.fixedX = undefined;
                                    engineNode.fixedY = undefined;
                                  }
                                  setActiveNode({ ...activeNode, customOrbitIndex: resolvedOrbit, orbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
                                }
                                setTimeout(() => initEngine(), 50);
                              }}
                            >
                              {activeNode.id.startsWith('root-') && <option value="0">초기화 (0차 복귀)</option>}
                              <option value="1">1차 카테고리 (메인)</option>
                              <option value="2">2차 궤도 파생</option>
                              <option value="3">3차 궤도 파생</option>
                              <option value="4">4차 궤도 파생</option>
                              <option value="5">5차 궤도 파생</option>
                              <option value="6">6차 궤도 파생</option>
                            </select>
                          </div>

                          {/* 3. 위치 고정 해제 */}
                          {activeNodeOverride && (
                            (activeNodeOverride.fixedX !== undefined && activeNodeOverride.fixedX !== null) || 
                            (activeNodeOverride.fixedY !== undefined && activeNodeOverride.fixedY !== null)
                          ) && (
                            <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">수동 드래그 위치 고정 상태</label>
                              <button
                                onClick={() => {
                                  setNodeOverride(activeNode.id, { fixedX: undefined, fixedY: undefined });
                                  if (engineRef.current) {
                                    const engineNode = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                    if (engineNode) {
                                      engineNode.fixedX = undefined;
                                      engineNode.fixedY = undefined;
                                    }
                                    setActiveNode({ ...activeNode, fixedX: undefined, fixedY: undefined });
                                  }
                                  setTimeout(() => initEngine(), 50);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-rose-600 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer font-bold shadow-2xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                고정 좌표 초기화 (물리 거동 복원)
                              </button>
                            </div>
                          )}

                          {/* 4. 수동 관계 연결 (Edge 생성) */}
                          <div className="flex flex-col gap-2.5 bg-gradient-to-br from-slate-500/5 to-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-2xl shadow-2xs">
                            <label className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                              <Link2 size={13} className="text-indigo-500" /> 수동 관계 연결 (Edge 생성)
                            </label>
                            <div className="flex flex-col gap-2.5">
                              {/* Target Selection */}
                              <select
                                value={newEdgeTargetId}
                                onChange={(e) => setNewEdgeTargetId(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 rounded-xl focus:border-indigo-500 font-medium cursor-pointer dark:text-slate-200"
                              >
                                <option value="">-- 연결할 대상 노드 선택 --</option>
                                {engineNodes
                                  .filter(n => n.id !== activeNode.id && n.id !== 'root-HCHPS' && !n.layoutHidden)
                                  .sort((a, b) => a.label.localeCompare(b.label))
                                  .map(n => (
                                    <option key={n.id} value={n.id}>{n.label}</option>
                                  ))
                                }
                              </select>

                              {/* Edge Type */}
                              <select
                                value={newEdgeType}
                                onChange={(e) => setNewEdgeType(e.target.value as EdgeType)}
                                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 rounded-xl focus:border-indigo-500 font-medium cursor-pointer dark:text-slate-200"
                              >
                                {Object.entries(EDGE_TYPE_LABELS).map(([key, val]) => (
                                  <option key={key} value={key}>{val}</option>
                                ))}
                              </select>

                              {/* Edge Weight Slider */}
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">가중치 (-1.0 ~ 1.0)</label>
                                  <span className="text-[9.5px] font-bold text-indigo-650">{newEdgeWeight}</span>
                                </div>
                                <input
                                  type="range"
                                  min="-1"
                                  max="1"
                                  step="0.1"
                                  value={newEdgeWeight}
                                  onChange={(e) => setNewEdgeWeight(Number(e.target.value))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                />
                              </div>

                              <button
                                disabled={!newEdgeTargetId}
                                onClick={() => {
                                  addCustomEdge(activeNode.id, newEdgeTargetId, newEdgeType, newEdgeWeight);
                                  setNewEdgeTargetId('');
                                  setNewEdgeType('DEPENDENCY');
                                  setNewEdgeWeight(1.0);

                                  setTimeout(() => {
                                    initEngine();
                                    if (engineRef.current) {
                                      const updated = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : null;
                                      if (updated) setActiveNode(updated);
                                    }
                                  }, 50);
                                }}
                                className="w-full py-1.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl text-[10.5px] transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1"
                              >
                                연결 추가
                              </button>
                            </div>
                          </div>

                          {/* 5. 연결 관계 상세 목록 (Categorized Connections List) */}
                          <div className="flex flex-col gap-3.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3.5 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Waypoints size={13} className="text-slate-400" /> 연결 관계 상세 목록
                            </label>

                            <div className="flex flex-col gap-3">
                              {/* Outgoing Connections */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-extrabold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">나가는 연결 (Outgoing)</span>
                                {connectedEdges.filter(item => item.edge.source === activeNode.id).length === 0 ? (
                                  <span className="text-[9.5px] text-slate-450 italic pl-1">나가는 방향의 연결이 없습니다.</span>
                                ) : (
                                  <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                    {connectedEdges
                                      .filter(item => item.edge.source === activeNode.id)
                                      .map(({ edge, otherNode }, idx) => (
                                        <div key={`${otherNode.id}-${edge.type}-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-white/40 dark:bg-slate-900/40 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border border-slate-150/40 transition-all">
                                          <span className="text-[10.5px] font-semibold truncate text-slate-700 dark:text-slate-350 flex-1">
                                            → {otherNode.label} <span className="text-[8px] text-indigo-500 font-bold bg-indigo-500/5 px-1 rounded ml-1">{EDGE_TYPE_LABELS[edge.type]} ({edge.weight})</span>
                                          </span>
                                          <button
                                            onClick={() => {
                                              if (confirm(`'${activeNode.label}'에서 '${otherNode.label}'로 가는 관계를 끊으시겠습니까?`)) {
                                                if (otherNode.parentId === activeNode.id) {
                                                  setNodeOverride(otherNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                                }
                                                deleteCustomEdge(activeNode.id, otherNode.id);
                                                setTimeout(() => {
                                                  initEngine();
                                                  if (engineRef.current) {
                                                    const updated = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : null;
                                                    if (updated) setActiveNode(updated);
                                                  }
                                                }, 50);
                                              }
                                            }}
                                            className="p-1 hover:bg-rose-500/10 text-slate-450 hover:text-rose-600 rounded-lg cursor-pointer transition-all shrink-0"
                                            title="연결 해제"
                                          >
                                            <Unlink size={12} />
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>

                              {/* Incoming Connections */}
                              <div className="flex flex-col gap-1.5 border-t border-slate-200/20 pt-2.5">
                                <span className="text-[9px] font-extrabold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">들어오는 연결 (Incoming)</span>
                                {connectedEdges.filter(item => item.edge.target === activeNode.id).length === 0 ? (
                                  <span className="text-[9.5px] text-slate-450 italic pl-1">들어오는 방향의 연결이 없습니다.</span>
                                ) : (
                                  <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                    {connectedEdges
                                      .filter(item => item.edge.target === activeNode.id)
                                      .map(({ edge, otherNode }, idx) => (
                                        <div key={`${otherNode.id}-${edge.type}-${idx}`} className="flex items-center justify-between gap-2 p-1.5 bg-white/40 dark:bg-slate-900/40 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border border-slate-150/40 transition-all">
                                          <span className="text-[10.5px] font-semibold truncate text-slate-700 dark:text-slate-350 flex-1">
                                            ← {otherNode.label} <span className="text-[8px] text-cyan-650 font-bold bg-cyan-500/5 px-1 rounded ml-1">{EDGE_TYPE_LABELS[edge.type]} ({edge.weight})</span>
                                          </span>
                                          <button
                                            onClick={() => {
                                              if (confirm(`'${otherNode.label}'에서 '${activeNode.label}'로 들어오는 관계를 끊으시겠습니까?`)) {
                                                if (activeNode.parentId === otherNode.id) {
                                                  setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                                }
                                                deleteCustomEdge(otherNode.id, activeNode.id);
                                                setTimeout(() => {
                                                  initEngine();
                                                  if (engineRef.current) {
                                                    const updated = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : null;
                                                    if (updated) setActiveNode(updated);
                                                  }
                                                }, 50);
                                              }
                                            }}
                                            className="p-1 hover:bg-rose-500/10 text-slate-450 hover:text-rose-600 rounded-lg cursor-pointer transition-all shrink-0"
                                            title="연결 해제"
                                          >
                                            <Unlink size={12} />
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeNode.id !== 'root-HCHPS' && (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                          <Trash2 size={13} /> 관리 속성
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5 mt-0.5">
                            <button
                              onClick={() => {
                                if (!activeNode) return;
                                
                                const allNodes = engineRef.current ? engineRef.current.nodes : [];
                                const children = allNodes.filter((n: OrbitalNode) => n.parentId === activeNode.id);
                                const hasChildren = children.length > 0;
                                
                                let deleteList: OrbitalNode[] = [activeNode];
                                let cascadeDelete = false;

                                if (hasChildren) {
                                  cascadeDelete = confirm(
                                    `"${activeNode.label}" 노드에 하위 노드가 ${children.length}개 존재합니다.\n\n하위 노드도 전체 함께 삭제하시겠습니까?\n\n[확인]: 하위 노드도 모두 일괄 삭제\n[취소]: 선택한 부모 노드만 단독 삭제`
                                  );
                                  
                                  if (cascadeDelete) {
                                    // Pre-index children by parentId for O(1) traversal
                                    const childrenByParent = new Map<string, OrbitalNode[]>();
                                    for (const n of allNodes as OrbitalNode[]) {
                                      if (n.parentId) {
                                        let list = childrenByParent.get(n.parentId);
                                        if (!list) {
                                          list = [];
                                          childrenByParent.set(n.parentId, list);
                                        }
                                        list.push(n);
                                      }
                                    }

                                    const queue = [activeNode.id];
                                    const visited = new Set<string>([activeNode.id]);
                                    let head = 0;
                                    
                                    while (head < queue.length) {
                                      const currentId = queue[head++];
                                      const childNodes = childrenByParent.get(currentId) || [];
                                      for (const child of childNodes) {
                                        if (!visited.has(child.id)) {
                                          visited.add(child.id);
                                          deleteList.push(child);
                                          queue.push(child.id);
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const isDeepDelete = activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1;
                                  const msg = isDeepDelete 
                                    ? '이 카테고리(또는 노드)를 완전히 삭제할까요?\n\n※ 연관된 태그나 데이터 연동이 해제될 수 있습니다.'
                                    : '이 노드를 맵에서 삭제할까요?\n\n※ 원본 데이터(업무/지식 등)는 보존되며 맵 화면에서만 지워집니다.';
                                  if (!confirm(msg)) return;
                                }

                                const deleteIds = deleteList.map(n => n.id);
                                const deleteLabels = deleteList.map(n => n.label).filter(Boolean) as string[];

                                try {
                                  const oldTombstonesRaw = localStorage.getItem('hchps-global-tombstones');
                                  const tombstones: string[] = oldTombstonesRaw ? JSON.parse(oldTombstonesRaw) : [];
                                    localStorage.setItem('hchps-global-tombstones', JSON.stringify(Array.from(new Set([...tombstones, ...deleteIds]))));

                                  const oldLabelsRaw = localStorage.getItem('hchps-deleted-labels');
                                  const deletedLabels: string[] = oldLabelsRaw ? JSON.parse(oldLabelsRaw) : [];
                                  localStorage.setItem('hchps-deleted-labels', JSON.stringify(Array.from(new Set([...deletedLabels, ...deleteLabels]))));
                                } catch (e) {
                                  console.log('Tombstone saving error:', e);
                                }

                                const parentId = activeNode.parentId;
                                let parentNode: OrbitalNode | null = null;

                                for (const targetNode of deleteList) {
                                  const isDeepDelete = targetNode.id.startsWith('custom-') || targetNode.orbitIndex === 1;
                                  
                                  if (isDeepDelete) {
                                    if ((targetNode.orbitIndex === 1 || targetNode.group === 'MACRO_RESEARCH') && onDeleteCategory) {
                                      onDeleteCategory(targetNode.label);
                                    }
                                    if (targetNode.id.startsWith('custom-')) {
                                      deleteCustomNode(targetNode.id);
                                    }
                                  }
                                }

                                if (engineRef.current) {
                                  const deleteIdSet = new Set(deleteIds);
                                  engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => !deleteIdSet.has(n.id));
                                  engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => !deleteIdSet.has(e.source) && !deleteIdSet.has(e.target));
                                  
                                  if (parentId && !deleteIdSet.has(parentId)) {
                                    parentNode = (engineRef.current.getNodeById ? engineRef.current.getNodeById(parentId) : (engineRef.current.nodes as OrbitalNode[]).find((n: OrbitalNode) => n.id === parentId)) || null;
                                  }
                                  
                                  if (parentNode) {
                                    engineRef.current.activeNode = parentNode;
                                    engineRef.current.pendingCameraTargetId = parentNode.id;
                                  } else {
                                    engineRef.current.activeNode = null;
                                  }
                                  engineRef.current.needsRedraw = true;
                                }
                                
                                setActiveNode(parentNode);
                              }}
                              className="flex-1 flex justify-center items-center gap-1.5 py-2.5 bg-rose-500/10 border border-rose-500/15 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-500 hover:text-white transition-all shadow-2xs cursor-pointer"
                            >
                              <Trash2 size={14} /> 노드 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4.5 flex flex-col h-full gap-4">
                    {/* New Node Creation Form */}
                    <div className="flex flex-col gap-3.5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 p-4 rounded-2xl shadow-2xs mb-2">
                      <div className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-indigo-500/10">
                        <PlusSquare size={14} className="text-indigo-500" />
                        <span>➕ 새 노드 생성</span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {/* 1. Label Input */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">노드 이름</label>
                          <input
                            type="text"
                            placeholder="노드 이름을 입력하세요..."
                            value={createLabel}
                            onChange={(e) => setCreateLabel(e.target.value)}
                            className="w-full text-xs px-2.5 py-2 border rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-medium"
                          />
                        </div>

                        {/* 2. Group Select */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">그룹 지정</label>
                          <select
                            value={createGroup}
                            onChange={(e) => setCreateGroup(e.target.value as OntologyGroup)}
                            className="w-full text-xs px-2.5 py-2 border rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-medium cursor-pointer"
                          >
                            {Object.entries(GROUP_LABELS).map(([key, val]) => (
                              <option key={key} value={key}>{val}</option>
                            ))}
                          </select>
                        </div>

                        {/* 3. baseValue (Importance) Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">중요도 (0 - 100)</label>
                            <span className="text-[10px] font-bold text-indigo-650">{createBaseValue}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={createBaseValue}
                            onChange={(e) => setCreateBaseValue(Number(e.target.value))}
                            className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                          />
                        </div>

                        {/* 4. Layer Select */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">레이어 지정 (선택)</label>
                          <select
                            value={createLayer}
                            onChange={(e) => setCreateLayer(e.target.value)}
                            className="w-full text-xs px-2.5 py-2 border rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-medium cursor-pointer"
                          >
                            <option value="">-- 레이어 선택 안 함 --</option>
                            {Object.entries(LAYER_LABELS).map(([key, val]) => (
                              <option key={key} value={key}>{val}</option>
                            ))}
                          </select>
                        </div>

                        {/* Create Button */}
                        <button
                          onClick={() => {
                            const name = createLabel.trim();
                            if (!name) return alert('이름을 입력하세요.');
                            const x = (Math.random() - 0.5) * 50;
                            const y = (Math.random() - 0.5) * 50;
                            const color = GROUP_COLORS[createGroup];
                            const layerId = createLayer !== '' ? Number(createLayer) as OntologyLayerId : undefined;

                            const newNode = addCustomNode(name, x, y, color, createGroup, createBaseValue, layerId);
                            
                            // Reset form
                            setCreateLabel('');
                            setCreateGroup('OTHER');
                            setCreateBaseValue(80);
                            setCreateLayer('');

                            // Re-focus camera and activate new node
                            setTimeout(() => {
                              initEngine();
                              if (engineRef.current) {
                                const addedNode = (engineRef.current.getNodeById ? engineRef.current.getNodeById(newNode.id) : undefined) || engineRef.current.nodes.find(n => n.id === newNode.id || n.label === name);
                                if (addedNode) {
                                  engineRef.current.activeNode = addedNode;
                                  engineRef.current.pendingCameraTargetId = addedNode.id;
                                  engineRef.current.needsRedraw = true;
                                  setActiveNode(addedNode);
                                }
                              }
                            }, 80);
                          }}
                          className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PlusSquare size={13} />
                          <span>노드 생성</span>
                        </button>
                      </div>
                    </div>

                    {priorityNodes.length > 0 ? (
                      <div className="flex-1 flex flex-col">
                        <div className="mb-4 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center gap-2 mb-2 text-indigo-700">
                            <Bot size={18} className="animate-pulse" />
                            <h4 className="text-xs font-bold uppercase tracking-wider">스마트 포커스 레이더</h4>
                          </div>
                          <p className="text-[11.5px] text-slate-600 leading-normal font-semibold">
                            전체 {engineNodes.length}개 노드 중 위상 중요도, 마감 기한, 리스크 영향도를 실시간 종합 분석하여 지금 가장 집중해야 할 노드를 추천합니다.
                          </p>
                        </div>

                        {/* 노트북 LM 전역 연락처 추출 및 기록 카드 */}
                        <div className="mb-4 p-4 bg-slate-500/5 border border-slate-200/40 rounded-2xl shadow-2xs">
                          <div className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <Link2 size={12} className="text-indigo-500" />
                            📂 노트북 LM 전역 연락처 추출
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold mb-3">
                            캔버스의 전체 {engineNodes.length}개 노드 위키 문서를 스캔하여 감지된 모든 연락처 정보를 `data/local_contacts.txt` 파일에 추출·기록합니다.
                          </p>
                          <button
                            onClick={handleBatchExtractToNotebookLM}
                            disabled={isBatchExtracting}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                              batchSuccessCount !== null
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400'
                            }`}
                          >
                            {isBatchExtracting ? (
                              <>
                                <Bot size={13} className="animate-spin" />
                                <span>스캔 중... ({batchProgress?.current}/{batchProgress?.total})</span>
                              </>
                            ) : batchSuccessCount !== null ? (
                              <span>✓ {batchSuccessCount}개 노드 추출 완료! (txt 파일 저장됨)</span>
                            ) : (
                              <>
                                <span>💾 전체 노드 연락처 일괄 추출</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="text-[11px] font-bold text-slate-400 mb-2.5 px-1 flex items-center gap-1.5 uppercase tracking-wider">
                          <Activity size={13} className="text-indigo-500 animate-pulse" /> 핵심 요주의 노드 Top 5
                        </div>

                        <div className="flex flex-col gap-2">
                          {priorityNodes.map(({ node, score, reasons }) => {
                            const groupColor = GROUP_COLORS[node.group as OntologyGroup] || '#94A3B8';
                            return (
                              <button
                                key={node.id}
                                onClick={() => handleSelectNode(node)}
                                className="w-full text-left bg-white/60 dark:bg-slate-850/60 hover:bg-white dark:hover:bg-slate-850 border border-slate-200/40 dark:border-slate-800 hover:border-indigo-500/30 dark:hover:border-indigo-900/40 rounded-xl p-3.5 shadow-2xs hover:shadow-md hover:scale-[1.005] transition-all duration-150 flex items-start gap-3 group cursor-pointer"
                              >
                                <div 
                                  className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs"
                                  style={{ backgroundColor: groupColor }}
                                >
                                  {node.label.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-bold text-xs text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400 truncate transition-colors">
                                      {node.label}
                                    </span>
                                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold text-indigo-700 bg-indigo-500/10 border border-indigo-500/15 rounded-md">
                                      중요도: {score.toFixed(0)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    {reasons.map((r, idx) => (
                                      <span key={`${node.id}-reason-${r}-${idx}`} className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 my-auto">
                        <Radio size={28} className="mx-auto mb-3.5 text-slate-300 animate-pulse" />
                        <div className="text-xs font-bold text-slate-400 leading-relaxed">
                          노드를 선택해보세요<br />
                          그래프의 점을 클릭하면<br />
                          연결된 관계를 확인할 수 있어요
                        </div>
                      </div>
                    )}
                  </div>
                )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderNodeDetails(isOverlay)}
    </>
  );
});
