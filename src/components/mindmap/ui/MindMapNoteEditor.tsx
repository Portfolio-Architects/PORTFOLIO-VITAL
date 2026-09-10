'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { 
  X, Plus, Trash2, Link2, Unlink, Palette, 
  FileText, CornerDownRight, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { NodeOverride } from '@/hooks/useGraphCustomization';

export interface ManualNodeItem {
  id: string;
  label: string;
  memo?: string;
  color?: string;
  parentId?: string | null;
  x: number;
  y: number;
  isCompleted?: boolean;
}

export interface ManualEdgeItem {
  source: string;
  target: string;
  type?: string;
}

interface MindMapNoteEditorProps {
  node: ManualNodeItem | null;
  allNodes: ManualNodeItem[];
  allEdges: ManualEdgeItem[];
  override?: NodeOverride;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onUpdateMemo: (id: string, newMemo: string) => void;
  onUpdateColor: (id: string, newColor: string) => void;
  onToggleComplete?: (id: string, isCompleted: boolean) => void;
  onAddChildNode: (parentId: string, childTitle?: string) => void;
  onConnectNode: (sourceId: string, targetId: string) => void;
  onDisconnectNode: (sourceId: string, targetId: string) => void;
  onDeleteNode: (id: string, cascade?: boolean) => void;
  onSelectNode: (node: ManualNodeItem) => void;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { name: '블루', value: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-500' },
  { name: '에메랄드', value: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-500' },
  { name: '퍼플', value: '#8b5cf6', bg: 'bg-purple-500', text: 'text-purple-500' },
  { name: '앰버', value: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-500' },
  { name: '로즈', value: '#f43f5e', bg: 'bg-rose-500', text: 'text-rose-500' },
  { name: '시안', value: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-500' },
  { name: '슬레이트', value: '#64748b', bg: 'bg-slate-500', text: 'text-slate-500' },
  { name: '인디고', value: '#6366f1', bg: 'bg-indigo-500', text: 'text-indigo-500' },
];

const MindMapNoteEditorComponent: React.FC<MindMapNoteEditorProps> = ({
  node,
  allNodes,
  allEdges,
  override,
  onUpdateTitle,
  onUpdateMemo,
  onUpdateColor,
  onToggleComplete,
  onAddChildNode,
  onConnectNode,
  onDisconnectNode,
  onDeleteNode,
  onSelectNode,
  onClose,
}) => {
  const [title, setTitle] = useState(override?.customLabel || node?.label || '');
  const [memo, setMemo] = useState(override?.customContextText || node?.memo || '');
  const [newChildTitle, setNewChildTitle] = useState('');
  const [selectedTargetToConnect, setSelectedTargetToConnect] = useState('');
  const [isAddingConnect, setIsAddingConnect] = useState(false);

  const prevNodeIdRef = useRef(node?.id);
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const memoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTitleRef = useRef(title);
  const latestMemoRef = useRef(memo);
  const latestNodeIdRef = useRef(node?.id);
  useEffect(() => {
    latestTitleRef.current = title;
    latestMemoRef.current = memo;
    latestNodeIdRef.current = node?.id;
  }, [title, memo, node?.id]);

  // Flush helpers for zero-loss guarantee
  const flushTitle = useCallback(() => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
      if (latestNodeIdRef.current) {
        onUpdateTitle(latestNodeIdRef.current, latestTitleRef.current);
      }
    }
  }, [onUpdateTitle]);

  const flushMemo = useCallback(() => {
    if (memoTimerRef.current) {
      clearTimeout(memoTimerRef.current);
      memoTimerRef.current = null;
      if (latestNodeIdRef.current) {
        onUpdateMemo(latestNodeIdRef.current, latestMemoRef.current);
      }
    }
  }, [onUpdateMemo]);

  const [, startTransition] = React.useTransition();

  // Sync state and flush uncommitted edits when selected node changes
  useEffect(() => {
    if (node?.id !== prevNodeIdRef.current) {
      if (prevNodeIdRef.current) {
        if (titleTimerRef.current) {
          clearTimeout(titleTimerRef.current);
          titleTimerRef.current = null;
          onUpdateTitle(prevNodeIdRef.current, latestTitleRef.current);
        }
        if (memoTimerRef.current) {
          clearTimeout(memoTimerRef.current);
          memoTimerRef.current = null;
          onUpdateMemo(prevNodeIdRef.current, latestMemoRef.current);
        }
      }
      prevNodeIdRef.current = node?.id;
      const nextTitle = override?.customLabel || node?.label || '';
      const nextMemo = override?.customContextText || node?.memo || '';
      startTransition(() => {
        setTitle(nextTitle);
        setMemo(nextMemo);
      });
      latestTitleRef.current = nextTitle;
      latestMemoRef.current = nextMemo;
    }
  }, [node?.id, override?.customLabel, override?.customContextText, node?.label, node?.memo, onUpdateTitle, onUpdateMemo]);

  // Flush pending updates on unmount
  useEffect(() => {
    return () => {
      flushTitle();
      flushMemo();
    };
  }, [flushTitle, flushMemo]);

  // Single-pass extraction of childNodes, connectedNodes, and connectableNodes
  const { childNodes, connectedNodes, connectableNodes } = useMemo(() => {
    if (!node) {
      return { childNodes: [], connectedNodes: [], connectableNodes: [] };
    }

    const connectedNodeIds = new Set<string>();
    for (let i = 0; i < allEdges.length; i++) {
      const e = allEdges[i];
      if (e.source === node.id) connectedNodeIds.add(e.target);
      if (e.target === node.id) connectedNodeIds.add(e.source);
    }

    const children: ManualNodeItem[] = [];
    const connected: ManualNodeItem[] = [];
    const connectable: ManualNodeItem[] = [];

    for (let i = 0; i < allNodes.length; i++) {
      const n = allNodes[i];
      if (n.parentId === node.id) {
        children.push(n);
      }
      if (n.id !== node.id) {
        if (connectedNodeIds.has(n.id) || n.parentId === node.id) {
          connected.push(n);
        } else if (node.parentId !== n.id) {
          connectable.push(n);
        }
      }
    }

    return { childNodes: children, connectedNodes: connected, connectableNodes: connectable };
  }, [allNodes, allEdges, node]);

  if (!node) return null;

  const currentColor = override?.customColor || node.color || '#3b82f6';
  const isCompleted = override?.isCompleted ?? node.isCompleted ?? false;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    latestTitleRef.current = val;
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
    }
    if (node) {
      titleTimerRef.current = setTimeout(() => {
        titleTimerRef.current = null;
        onUpdateTitle(node.id, val);
      }, 250);
    }
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMemo(val);
    latestMemoRef.current = val;
    if (memoTimerRef.current) {
      clearTimeout(memoTimerRef.current);
    }
    if (node) {
      memoTimerRef.current = setTimeout(() => {
        memoTimerRef.current = null;
        onUpdateMemo(node.id, val);
      }, 250);
    }
  };

  const handleAddChild = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onAddChildNode(node.id, newChildTitle.trim() || undefined);
    setNewChildTitle('');
  };

  const handleConnect = () => {
    if (!selectedTargetToConnect) return;
    onConnectNode(node.id, selectedTargetToConnect);
    setSelectedTargetToConnect('');
    setIsAddingConnect(false);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-[420px] lg:w-[460px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xl z-30 flex flex-col transition-all duration-200 animate-in slide-in-from-right-5">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-3.5 h-3.5 rounded-full shadow-sm"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            노트 편집기
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleComplete && (
            <button
              onClick={() => onToggleComplete(node.id, !isCompleted)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isCompleted 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
              }`}
              title={isCompleted ? '완료됨' : '미완료'}
            >
              <CheckCircle2 size={14} className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
              {isCompleted ? '완료' : '진행중'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            노트 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={flushTitle}
            placeholder="노트 제목을 입력하세요..."
            className="w-full px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-400 font-sans"
          />
        </div>

        {/* Color Palette */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Palette size={13} />
            노트 테마 색상
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => onUpdateColor(node.id, preset.value)}
                className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center cursor-pointer ${
                  currentColor === preset.value ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 shadow-sm' : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        {/* Memo / Notes Textarea */}
        <div className="flex flex-col flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <FileText size={13} />
            노트 상세 메모 (자유 작성)
          </label>
          <textarea
            value={memo}
            onChange={handleMemoChange}
            onBlur={flushMemo}
            rows={7}
            placeholder="이 생각에 대한 상세 내용, 메모, 체크포인트 등을 자유롭게 적어보세요..."
            className="w-full px-3.5 py-3 text-sm text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-y placeholder:text-slate-400/80 leading-relaxed font-sans"
          />
        </div>

        {/* Child Sub-notes Section */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <CornerDownRight size={13} className="text-blue-500" />
              하위 노트 ({childNodes.length})
            </label>
          </div>

          {/* Add Child Form */}
          <form onSubmit={handleAddChild} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newChildTitle}
              onChange={e => setNewChildTitle(e.target.value)}
              placeholder="새 하위 노트 이름..."
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={14} /> 추가
            </button>
          </form>

          {/* Child Nodes List */}
          {childNodes.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {childNodes.map(child => (
                <div
                  key={child.id}
                  onClick={() => onSelectNode(child)}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg border border-slate-200/70 dark:border-slate-700/60 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: child.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {child.label}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
              하위 가지 노트가 없습니다.
            </p>
          )}
        </div>

        {/* Connected Nodes Section */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Link2 size={13} className="text-emerald-500" />
              연결된 다른 노드 ({connectedNodes.length})
            </label>
            {!isAddingConnect && connectableNodes.length > 0 && (
              <button
                onClick={() => setIsAddingConnect(true)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={12} /> 새 연결
              </button>
            )}
          </div>

          {/* Add Connection Selector */}
          {isAddingConnect && (
            <div className="p-2.5 mb-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <select
                value={selectedTargetToConnect}
                onChange={e => setSelectedTargetToConnect(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">연결할 노드를 선택하세요...</option>
                {connectableNodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingConnect(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={!selectedTargetToConnect}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  연결하기
                </button>
              </div>
            </div>
          )}

          {/* Connected Nodes List */}
          {connectedNodes.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {connectedNodes.map(target => (
                <div
                  key={target.id}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/70 dark:border-slate-700/60"
                >
                  <div 
                    onClick={() => onSelectNode(target)}
                    className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                  >
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: target.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-500 truncate transition-colors">
                      {target.label}
                    </span>
                  </div>
                  <button
                    onClick={() => onDisconnectNode(node.id, target.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                    title="연결 해제"
                  >
                    <Unlink size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
              연결된 다른 노드가 없습니다.
            </p>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
        <button
          onClick={() => {
            if (childNodes.length > 0) {
              const confirmAll = confirm(`"${node.label}" 노드와 하위 노드(${childNodes.length}개)를 모두 삭제하시겠습니까?\n\n[확인]: 하위 노드 포함 전체 삭제\n[취소]: 이 노드만 삭제`);
              onDeleteNode(node.id, confirmAll);
            } else {
              if (confirm(`"${node.label}" 노드를 삭제하시겠습니까?`)) {
                onDeleteNode(node.id, false);
              }
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          노트 삭제
        </button>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all cursor-pointer"
        >
          완료
        </button>
      </div>
    </div>
  );
};

MindMapNoteEditorComponent.displayName = 'MindMapNoteEditor';
export const MindMapNoteEditor = React.memo(MindMapNoteEditorComponent);
export default MindMapNoteEditor;
