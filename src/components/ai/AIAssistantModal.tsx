import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Settings, Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAIChat } from '@/hooks/useAIChat';
import { BudgetCategory, BudgetEntry } from '@/types';
import { SignalEntry } from '@/hooks/useSignal';
import { buildSignalGraph } from '@/lib/signal-graph';
import { OntologyNetwork } from '@/lib/engine/OntologyNetwork';

const AgentStatusBoard = dynamic(
  () => import('./AgentStatusBoard').then((mod) => mod.AgentStatusBoard),
  { ssr: false }
);

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: {
    signals: SignalEntry[];
    budgetEntries?: BudgetEntry[];
    budgetCategories?: BudgetCategory[];
    budgets?: BudgetCategory[];
    customNodes?: any[];
    customEdges?: any[];
    deletedEdges?: string[];
    overrides?: Record<string, any>;
    keywordMap?: Record<string, number>;
  };
  appMode?: 'HCHPS' | 'VITAL';
}

// Helper function to extract plain text from editor block structure (BlockNote schema)
function extractTextFromBlocks(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return '';
  let text = '';
  for (const block of blocks) {
    if (block.content && Array.isArray(block.content)) {
      const line = block.content.map((c: any) => c.text || '').join('');
      if (line.trim()) {
        text += line + '\n';
      }
    }
    if (block.children && block.children.length > 0) {
      text += extractTextFromBlocks(block.children);
    }
  }
  return text;
}

function getCanonicalId(id: string): string {
  if (id.startsWith('leaf-')) {
    if (id.startsWith('leaf-tag-')) {
      const parts = id.split('-');
      if (parts.length >= 4) return `leaf-kw-${parts.slice(3).join('-')}`;
    }
    const parts = id.split('-');
    if (parts[1] === 'kw') return id;
    return `leaf-kw-${parts.slice(1).join('-')}`;
  }
  return id;
}

const LAYER_LABELS: Record<number, string> = {
  0: 'L0:인물/조직',
  1: 'L1:예산/비품',
  2: 'L2:업무/회의',
  3: 'L3:위키/문서'
};

function getLayerLabel(n: any): string {
  let layerId = 3;
  if (n.layerId !== undefined && n.layerId !== null) {
    layerId = Number(n.layerId);
  } else {
    const label = n.label || '';
    const id = n.id || '';
    if (/[가-힣]+ (이사|대리|부장|과장|사원|담당|대표|팀장|주임)/.test(label) || label.endsWith('님') || id.startsWith('user_') || id.includes('person')) {
      layerId = 0;
    } else if (label.includes('예산') || label.includes('비용') || label.includes('구매') || label.includes('임대') || label.includes('비품') || label.includes('원') || id.includes('budget') || id.includes('inventory')) {
      layerId = 1;
    } else if (label.includes('회의') || label.includes('개발') || label.includes('추진') || label.includes('기획') || label.includes('구축') || label.includes('작업') || id.startsWith('task-') || id.startsWith('project-') || id.startsWith('meeting-')) {
      layerId = 2;
    }
  }
  return LAYER_LABELS[layerId] || 'L3:위키/문서';
}

function AIAssistantModalComponent({ isOpen, onClose, contextData, appMode = 'VITAL' }: AIAssistantModalProps) {
  const { messages, addMessage, clearMessages: baseClearMessages, isTyping, setIsTyping, chatMutation } = useAIChat();
  const [input, setInput] = useState('');
  const [wikiContextMap, setWikiContextMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const clearMessages = () => {
    baseClearMessages();
    setWikiContextMap({});
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userQuery = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userQuery });
    setIsTyping(true);

    // ── 동적 마인드맵 노드 매핑 및 위키 RAG 컨텍스트 추출 ──
    let updatedWikiMap = { ...wikiContextMap };
    let hasNewMatch = false;
    try {
      const customNodes = contextData?.customNodes || [];
      const overrides = contextData?.overrides || {};
      
      for (const cn of customNodes) {
        const override = overrides[cn.id];
        const nodeLabel = override?.customLabel || cn.label || '';
        
        if (nodeLabel.length >= 2 && userQuery.includes(nodeLabel)) {
          const canonicalId = getCanonicalId(cn.id);
          const wikiStr = localStorage.getItem(`HCHPS-Wiki-${canonicalId}`) || localStorage.getItem(`HCHPS-Wiki-${cn.id}`);
          
          if (wikiStr) {
            const blocks = JSON.parse(wikiStr);
            const wikiContent = extractTextFromBlocks(blocks);
            if (wikiContent.trim()) {
              const formattedContent = `- [노드: ${nodeLabel}] 관련 위키 내용:\n${wikiContent.trim()}\n\n`;
              updatedWikiMap[nodeLabel] = formattedContent;
              hasNewMatch = true;
            }
          }
        }
      }
    } catch (e) {
      console.log('Failed to extract matching wiki context:', e);
    }

    if (hasNewMatch) {
      setWikiContextMap(updatedWikiMap);
    }

    // 누적된 모든 위키 컨텍스트 병합
    const matchedWikiText = Object.values(updatedWikiMap).join('');

    // ── 온톨로지 지식 그래프 RAG 코퍼스 생성 및 시맨틱 추론 ──
    let knowledgeGraphText = '';
    try {
      const signals = contextData?.signals || [];
      const keywordMap = contextData?.keywordMap || {};
      const customNodes = contextData?.customNodes || [];
      const customEdges = contextData?.customEdges || [];
      const deletedEdges = contextData?.deletedEdges || [];
      const overrides = contextData?.overrides || {};

      const graph = buildSignalGraph(keywordMap, signals, {
        overrides,
        customNodes,
        customEdges,
        deletedEdges
      });

      // 1. 질문에 포함된 노드 필터링
      const matchedNodes = graph.nodes.filter(node => {
        const label = node.label || node.id;
        return label.length >= 2 && userQuery.includes(label);
      });

      if (matchedNodes.length > 0) {
        const matchedNodeIds = new Set(matchedNodes.map(n => n.id));
        const subgraphNodeIds = new Set<string>();
        
        // 1-Hop 인접 노드 확장
        graph.edges.forEach(edge => {
          if (matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)) {
            subgraphNodeIds.add(edge.source);
            subgraphNodeIds.add(edge.target);
          }
        });
        
        // 매칭된 노드가 고립된 경우 대비
        matchedNodes.forEach(n => subgraphNodeIds.add(n.id));

        const subgraphNodes = graph.nodes.filter(n => subgraphNodeIds.has(n.id));
        const subgraphEdges = graph.edges.filter(edge => 
          subgraphNodeIds.has(edge.source) && subgraphNodeIds.has(edge.target)
        );

        // 노드 레이블 및 레이어 정보 맵 작성
        const nodeLabelMap = new Map<string, string>();
        const nodeLayerMap = new Map<string, string>();

        subgraphNodes.forEach(n => {
          nodeLabelMap.set(n.id, n.label || n.id);
          nodeLayerMap.set(n.id, getLayerLabel(n));
        });

        // 1. 노드 목록 및 레이어 구조 텍스트 생성
        const nodeLayerText = subgraphNodes.map(n => {
          const label = nodeLabelMap.get(n.id);
          const layerName = nodeLayerMap.get(n.id);
          return `- [노드] ${label} (${layerName})`;
        }).join('\n    ');

        // 2. SPO 트리플 생성
        const triples: string[] = [];
        subgraphEdges.forEach(edge => {
          const sLabel = nodeLabelMap.get(edge.source);
          const tLabel = nodeLabelMap.get(edge.target);
          const sLayer = nodeLayerMap.get(edge.source);
          const tLayer = nodeLayerMap.get(edge.target);
          
          if (sLabel && tLabel) {
            let relType: string = edge.type || '연결';
            if (edge.type === 'DEPENDENCY') relType = '의존성';
            else if (edge.type === 'CAUSAL_DRIVE') relType = '인과구동';
            else if (edge.type === 'FEEDBACK_LOOP') relType = '피드백루프';
            else if (edge.type === 'ASSIGNEE') relType = '담당자';
            else if (edge.type === 'BUDGET_SOURCE') relType = '예산원천';
            else if (edge.type === 'COMPONENTS') relType = '구성요소';
            
            triples.push(`- [관계] ${sLabel}(${sLayer}) --(${relType})--> ${tLabel}(${tLayer})`);
          }
        });

        // 규칙 기반 시맨틱 추론기 구동
        const inferences = OntologyNetwork.inferSemanticRelations(subgraphNodes, subgraphEdges);

        // XML 조각 빌드
        knowledgeGraphText = `<knowledge_graph>\n`;
        if (nodeLayerText) {
          knowledgeGraphText += `  <nodes>\n    ${nodeLayerText}\n  </nodes>\n`;
        }
        if (triples.length > 0) {
          knowledgeGraphText += `  <relations>\n    ${triples.join('\n    ')}\n  </relations>\n`;
        } else {
          knowledgeGraphText += `  <relations>없음</relations>\n`;
        }
        if (inferences.length > 0) {
          knowledgeGraphText += `  <inferences>\n    ${inferences.join('\n    ')}\n  </inferences>\n`;
        } else {
          knowledgeGraphText += `  <inferences>없음</inferences>\n`;
        }
        knowledgeGraphText += `</knowledge_graph>`;
      }
    } catch (err) {
      console.log('Failed to build knowledge graph:', err);
    }

    chatMutation.mutate({
      messages: [...messages, { role: 'user', content: userQuery }],
      contextData: {
        ...contextData,
        matchedWiki: matchedWikiText || undefined,
        knowledgeGraph: knowledgeGraphText || undefined
      },
      appMode
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
      className="flex gap-4 items-start w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-5 duration-300"
      style={{ maxWidth: '960px', height: '780px', maxHeight: '85vh' }}
    >
      {/* Chat Area */}
      <div 
        className="flex-1 flex flex-col glass-panel rounded-2xl shadow-2xl border border-white/30 overflow-hidden h-full"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200/50 bg-white/30 backdrop-blur-xs">
          <div className="flex items-center gap-2 group">
            <Sparkles size={18} className="text-blue-500 group-hover:rotate-12 transition-transform duration-300" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide font-sans">Portfolio Assistant</span>
              <span className="text-[10px] text-slate-450 font-semibold">GEMMA 4 31B IT</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={clearMessages}
              className="text-slate-400 hover:text-red-500 rounded-full p-1.5 hover:bg-red-50 transition-colors"
              title="대화 내역 지우기"
            >
              <Trash2 size={16} />
            </button>
            <button className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-colors">
              <Settings size={16} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        
        {/* Body: Chat History */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/10 flex flex-col gap-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/15 rounded-2xl flex items-center justify-center mb-4 text-blue-500 shadow-inner">
                <Sparkles size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-2">
                {appMode} 행정 인텔리전스 어시스턴트
                <br />
                <span className="text-xs font-semibold text-slate-450">공문서 표준 개조식 문체 및 행정 분석 제공</span>
              </h3>
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-450">
                <p>&quot;2026 양재천 건강페스티벌 부스 배치 계획 보고&quot;</p>
                <p>&quot;보건소 예산 비목별 실집행액 및 잔액 현황 분석&quot;</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] sm:max-w-[80%] gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role !== 'system' && (
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-xs border ${
                      msg.role === 'user' 
                        ? 'bg-slate-800 border-slate-700 text-white' 
                        : 'bg-blue-500 border-blue-450 text-white'
                    }`}>
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>
                  )}
                  
                  <div 
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'glass-panel-dark text-white rounded-tr-none shadow-2xs' 
                        : msg.role === 'assistant'
                          ? 'glass-panel text-slate-700 rounded-tl-none shadow-3xs'
                          : 'bg-red-500/10 text-red-600 border border-red-500/15 rounded-xl text-xs w-full text-center font-bold'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[80%] gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-full bg-blue-500 border border-blue-450 text-white flex items-center justify-center shadow-xs">
                  <Bot size={13} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-none glass-panel shadow-3xs flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
  
        {/* Bottom Input Area */}
        <div className="p-3 bg-white/30 backdrop-blur-xs border-t border-slate-200/50">
          <form onSubmit={handleSubmit} className="relative flex items-center bg-white/50 backdrop-blur-xs rounded-xl border border-slate-200 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/15 focus-within:bg-white transition-all shadow-3xs">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="무엇이든 물어보세요..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent text-sm resize-none outline-none py-3 px-4 custom-scrollbar placeholder:text-slate-350 placeholder:font-semibold"
              rows={1}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2.5 bottom-2 p-1.5 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors shadow-2xs hover:shadow-md cursor-pointer"
            >
              {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
            </button>
          </form>
        </div>
      </div>

      {/* Live Agent Monitoring Side Panel */}
      <div className="hidden md:block shrink-0 h-full w-[320px]">
        <AgentStatusBoard />
      </div>
    </div>
  );
}

AIAssistantModalComponent.displayName = 'AIAssistantModal';
export const AIAssistantModal = React.memo(AIAssistantModalComponent);
