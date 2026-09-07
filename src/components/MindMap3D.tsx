'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { MindMapHeader } from './mindmap/ui/MindMapHeader';
import { MindMapNoteEditor, ManualNodeItem, ManualEdgeItem } from './mindmap/ui/MindMapNoteEditor';
import { 
  Plus, CornerDownRight, Edit3, 
  CheckCircle2, FileText 
} from 'lucide-react';

export interface MindMap3DProps {
  signalKeywords?: Record<string, number>;
  signalEntries?: any[];
  onAddSignal?: (text: string) => void;
  onDeleteSignal?: (id: string) => void;
  onUpdateKeywords?: (id: string, keywords: string[]) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
  isActive?: boolean;
}

const CARD_WIDTH = 220;
const CARD_HEIGHT = 90;

export const MindMap3D: React.FC<MindMap3DProps> = ({
  isActive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);
  
  // Customization controller hooks
  const {
    overrides = {},
    customNodes = [],
    customEdges = [],
    deletedEdges = [],
    addCustomNode,
    deleteCustomNode,
    updateCustomNodeText,
    setNodeOverride,
    batchSetNodeOverrides,
    addCustomEdge,
    deleteCustomEdge,
    clearAll,
    undo,
    redo,
  } = useGraphCustomization(isActive);

  // Viewport transformation states
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add Node Modal States
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [selectedLayerId, setSelectedLayerId] = useState('2');
  const [selectedGroup, setSelectedGroup] = useState('OTHER');
  const [pendingNodeCoords, setPendingNodeCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging and interaction refs & states
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nodeDragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickTimeRef = useRef<number>(0);
  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMouseMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // 1. Process custom nodes and overrides into unified manual node items
  const manualNodes = useMemo<ManualNodeItem[]>(() => {
    return customNodes.map((n, idx) => {
      const ov = overrides[n.id] || {};
      const rawX = ov.fixedX !== undefined && ov.fixedX !== null ? ov.fixedX : (n.fixedX ?? (idx * 260 - 200));
      const rawY = ov.fixedY !== undefined && ov.fixedY !== null ? ov.fixedY : (n.fixedY ?? (idx * 60));
      
      return {
        id: n.id,
        label: ov.customLabel || n.label || '새 노트',
        memo: ov.customContextText || '',
        color: ov.customColor || '#3b82f6',
        parentId: ov.customParent || n.parentId || null,
        x: rawX,
        y: rawY,
        isCompleted: ov.isCompleted ?? false,
      };
    });
  }, [customNodes, overrides]);

  // 2. Process manual edges (O(1) Set-based lookups)
  const manualEdges = useMemo<ManualEdgeItem[]>(() => {
    const deletedSet = new Set(deletedEdges || []);
    const validNodeIdSet = new Set(manualNodes.map(n => n.id));
    const existingEdgeKeys = new Set<string>();
    const edges: ManualEdgeItem[] = [];

    // From customEdges
    customEdges.forEach(e => {
      const key = `${e.source}|||${e.target}`;
      const revKey = `${e.target}|||${e.source}`;
      if (!deletedSet.has(key) && !deletedSet.has(revKey)) {
        edges.push({ source: e.source, target: e.target, type: e.type });
        existingEdgeKeys.add(key);
        existingEdgeKeys.add(revKey);
      }
    });

    // From parent-child relationships if not already in customEdges (O(1) lookups)
    manualNodes.forEach(n => {
      if (n.parentId && validNodeIdSet.has(n.parentId)) {
        const key = `${n.parentId}|||${n.id}`;
        const revKey = `${n.id}|||${n.parentId}`;
        if (!existingEdgeKeys.has(key) && !existingEdgeKeys.has(revKey) && !deletedSet.has(key) && !deletedSet.has(revKey)) {
          edges.push({ source: n.parentId, target: n.id, type: 'PARENT_CHILD' });
          existingEdgeKeys.add(key);
          existingEdgeKeys.add(revKey);
        }
      }
    });

    return edges;
  }, [customEdges, deletedEdges, manualNodes]);

  // Node Map for O(1) lookups during curve calculations and card interactions
  const nodeMap = useMemo(() => {
    const map = new Map<string, ManualNodeItem>();
    manualNodes.forEach(n => map.set(n.id, n));
    return map;
  }, [manualNodes]);

  // Precomputed child counts for O(1) lookup, eliminating O(N^2) render filtering
  const childCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < manualNodes.length; i++) {
      const pId = manualNodes[i].parentId;
      if (pId) {
        counts.set(pId, (counts.get(pId) || 0) + 1);
      }
    }
    return counts;
  }, [manualNodes]);

  // Active node item with O(1) map lookup
  const activeNode = useMemo(() => {
    if (!activeNodeId) return null;
    return nodeMap.get(activeNodeId) || null;
  }, [activeNodeId, nodeMap]);

  // Canvas wheel event handler
  const handleCanvasWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.25), 2.5));
    } else {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  // 3. Wheel listener on canvas element with passive: false for non-blocking zoom/pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleCanvasWheel);
    };
  }, [handleCanvasWheel]);

  // 4. Wiki Event Listeners for global modal interop
  const handleOpenWiki = useCallback((e: CustomEvent<{ id: string; label: string }>) => {
    if (e.detail?.id) {
      setActiveNodeId(e.detail.id);
    }
  }, []);

  const handleCloseWiki = useCallback(() => {
    setActiveNodeId(null);
  }, []);

  useEffect(() => {
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    window.addEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    
    return () => {
      window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
      window.removeEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    };
  }, [handleOpenWiki, handleCloseWiki]);

  // 5. Visibility Change Handler (Zero-Stall standard)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        } else {
          cancelAnimationFrame(0);
        }
      } else if (isActive) {
        animationFrameRef.current = requestAnimationFrame(() => {
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (isActive && !document.hidden) {
      animationFrameRef.current = requestAnimationFrame(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  // 6. Engine Lifecycle & Cleanup
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      if (!engineRef.current) {
        engineRef.current = new OntologyCanvasEngine();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [isActive]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.25), 2.5));
    } else {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  const handleExecuteAddNode = useCallback(() => {
    if (!newNodeName.trim()) return;
    const coords = (pendingNodeCoords.x !== 0 || pendingNodeCoords.y !== 0)
      ? pendingNodeCoords
      : { x: Math.round(-pan.x / zoom), y: Math.round(-pan.y / zoom) };
    const newNode = addCustomNode(newNodeName.trim(), coords.x, coords.y, '#3b82f6');
    setActiveNodeId(newNode.id);
    setIsAddingNode(false);
    setNewNodeName('');
  }, [newNodeName, pendingNodeCoords, pan, zoom, addCustomNode]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const canvasX = (clickX - rect.width / 2 - pan.x) / zoom;
    const canvasY = (clickY - rect.height / 2 - pan.y) / zoom;
    setPendingNodeCoords({ x: Math.round(canvasX), y: Math.round(canvasY) });
    setNewNodeName('');
    setIsAddingNode(true);
  }, [pan, zoom]);

  const handleMouseDownBackground = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const now = Date.now();
    if (now - lastClickTimeRef.current < 300 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const canvasX = (clickX - rect.width / 2 - pan.x) / zoom;
      const canvasY = (clickY - rect.height / 2 - pan.y) / zoom;
      
      setPendingNodeCoords({ x: Math.round(canvasX), y: Math.round(canvasY) });
      setNewNodeName('');
      setIsAddingNode(true);
      lastClickTimeRef.current = 0;
      return;
    }
    lastClickTimeRef.current = now;

    setIsPanning(true);
    panStartRef.current = { ...pan };
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
  }, [pan, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning && !draggingNodeId) return;
    pendingMouseMoveRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (mouseMoveRafRef.current === null) {
      mouseMoveRafRef.current = requestAnimationFrame(() => {
        mouseMoveRafRef.current = null;
        const pending = pendingMouseMoveRef.current;
        if (!pending) return;

        if (isPanning) {
          const dx = pending.clientX - mouseStartRef.current.x;
          const dy = pending.clientY - mouseStartRef.current.y;
          setPan({
            x: panStartRef.current.x + dx,
            y: panStartRef.current.y + dy,
          });
        } else if (draggingNodeId) {
          const dx = (pending.clientX - mouseStartRef.current.x) / zoom;
          const dy = (pending.clientY - mouseStartRef.current.y) / zoom;
          setDragOffset({ x: dx, y: dy });
        }
      });
    }
  }, [isPanning, draggingNodeId, zoom]);

  const handleMouseUp = useCallback(() => {
    if (mouseMoveRafRef.current !== null) {
      cancelAnimationFrame(mouseMoveRafRef.current);
      mouseMoveRafRef.current = null;
    }
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggingNodeId) {
      const finalX = Math.round(nodeDragStartPosRef.current.x + dragOffset.x);
      const finalY = Math.round(nodeDragStartPosRef.current.y + dragOffset.y);
      setNodeOverride(draggingNodeId, { fixedX: finalX, fixedY: finalY });
      setDraggingNodeId(null);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isPanning, draggingNodeId, dragOffset, setNodeOverride]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: ManualNodeItem) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setActiveNodeId(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({ x: 0, y: 0 });
    nodeDragStartPosRef.current = { x: node.x, y: node.y };
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleAddNewRootNode = useCallback(() => {
    const offset = (manualNodes.length % 5) * 40;
    const x = -100 + offset;
    const y = -100 + offset;
    setPendingNodeCoords({ x, y });
    setNewNodeName('');
    setIsAddingNode(true);
  }, [manualNodes.length]);

  const handleAddChildNode = useCallback((parentId: string, title = '하위 생각') => {
    const parent = nodeMap.get(parentId);
    const parentX = parent ? parent.x : 0;
    const parentY = parent ? parent.y : 0;

    const siblingCount = childCountMap.get(parentId) || 0;
    const childX = parentX + CARD_WIDTH + 60;
    const childY = parentY + siblingCount * (CARD_HEIGHT + 30) - 20;

    const childColor = parent?.color || '#3b82f6';
    const newNode = addCustomNode(title, childX, childY, childColor);
    
    setNodeOverride(newNode.id, { 
      customParent: parentId, 
      fixedX: childX, 
      fixedY: childY, 
      customColor: childColor 
    });
    addCustomEdge(parentId, newNode.id);
    setActiveNodeId(newNode.id);
  }, [nodeMap, childCountMap, addCustomNode, setNodeOverride, addCustomEdge]);

  const handleDeleteNode = useCallback((id: string, cascade = false) => {
    if (cascade) {
      const childrenByParent = new Map<string, string[]>();
      manualNodes.forEach(n => {
        if (n.parentId) {
          const list = childrenByParent.get(n.parentId) || [];
          list.push(n.id);
          childrenByParent.set(n.parentId, list);
        }
      });

      const toDelete = new Set<string>([id]);
      const queue = [id];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const kids = childrenByParent.get(curr) || [];
        kids.forEach(k => {
          if (!toDelete.has(k)) {
            toDelete.add(k);
            queue.push(k);
          }
        });
      }

      toDelete.forEach(targetId => {
        deleteCustomNode(targetId);
      });
    } else {
      deleteCustomNode(id);
    }

    if (activeNodeId === id) {
      setActiveNodeId(null);
    }
  }, [manualNodes, deleteCustomNode, activeNodeId]);

  const handleAutoArrange = useCallback(() => {
    if (manualNodes.length === 0) return;

    const nodeIds = new Set(manualNodes.map(n => n.id));
    const roots = manualNodes.filter(n => !n.parentId || !nodeIds.has(n.parentId));

    const childrenMap = new Map<string, ManualNodeItem[]>();
    manualNodes.forEach(n => {
      if (n.parentId && nodeIds.has(n.parentId)) {
        const list = childrenMap.get(n.parentId) || [];
        list.push(n);
        childrenMap.set(n.parentId, list);
      }
    });

    const updates: Record<string, { fixedX: number; fixedY: number }> = {};
    let globalY = 0;

    const layoutSubtree = (node: ManualNodeItem, depth: number): { top: number; bottom: number } => {
      const x = depth * (CARD_WIDTH + 80);
      const children = childrenMap.get(node.id) || [];

      if (children.length === 0) {
        const y = globalY;
        globalY += CARD_HEIGHT + 40;
        updates[node.id] = { fixedX: x, fixedY: y };
        return { top: y, bottom: y };
      }

      let minChildY = Infinity;
      let maxChildY = -Infinity;

      children.forEach(child => {
        const childBounds = layoutSubtree(child, depth + 1);
        minChildY = Math.min(minChildY, childBounds.top);
        maxChildY = Math.max(maxChildY, childBounds.bottom);
      });

      const y = (minChildY + maxChildY) / 2;
      updates[node.id] = { fixedX: x, fixedY: y };
      return { top: minChildY, bottom: maxChildY };
    };

    roots.forEach(root => {
      layoutSubtree(root, 0);
      globalY += 60;
    });

    if (batchSetNodeOverrides) {
      batchSetNodeOverrides(updates);
    } else {
      Object.entries(updates).forEach(([id, coords]) => {
        setNodeOverride(id, coords);
      });
    }

    setPan({ x: 100, y: 150 });
    setZoom(1.0);
  }, [manualNodes, batchSetNodeOverrides, setNodeOverride]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeNodeId) {
          e.preventDefault();
          if (confirm('선택한 노드를 삭제하시겠습니까?')) {
            handleDeleteNode(activeNodeId, false);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setActiveNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNodeId, handleDeleteNode, undo, redo]);

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full min-h-[650px] bg-slate-100/90 dark:bg-slate-950 flex flex-col overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Toolbar */}
      <MindMapHeader
        stats={{ nodes: manualNodes.length, edges: manualEdges.length }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddNewNode={handleAddNewRootNode}
        onClearAll={clearAll}
        onAutoArrange={handleAutoArrange}
        onZoomIn={() => setZoom(z => Math.min(z * 1.15, 2.5))}
        onZoomOut={() => setZoom(z => Math.max(z * 0.85, 0.25))}
        onResetZoom={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
      />

      {/* Main Infinite Canvas Workspace */}
      <div 
        className="relative flex-1 w-full h-full min-h-[550px] cursor-grab active:cursor-grabbing overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDownBackground}
        onDoubleClick={handleCanvasDoubleClick}
        style={{
          backgroundImage: `radial-gradient(circle, var(--dot-color, rgba(148, 163, 184, 0.25)) 1.5px, transparent 1.5px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Background Canvas element for non-passive zoom and zero-leak tests */}
        <canvas
          ref={canvasRef}
          onDoubleClick={handleCanvasDoubleClick}
          className="absolute inset-0 w-full h-full pointer-events-auto block"
          style={{ width: '100%', height: '100%', minHeight: '550px' }}
        />
        {/* Transform Container */}
        <div
          className="absolute inset-0 origin-center pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
          }}
        >
          {/* SVG Connection Lines Layer */}
          <svg className="absolute overflow-visible w-full h-full pointer-events-none inset-0">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>
            {manualEdges.map((edge, idx) => {
              const srcNode = nodeMap.get(edge.source);
              const tgtNode = nodeMap.get(edge.target);
              if (!srcNode || !tgtNode) return null;

              const srcX = (srcNode.id === draggingNodeId ? srcNode.x + dragOffset.x : srcNode.x) + CARD_WIDTH;
              const srcY = (srcNode.id === draggingNodeId ? srcNode.y + dragOffset.y : srcNode.y) + CARD_HEIGHT / 2;

              const tgtX = (tgtNode.id === draggingNodeId ? tgtNode.x + dragOffset.x : tgtNode.x);
              const tgtY = (tgtNode.id === draggingNodeId ? tgtNode.y + dragOffset.y : tgtNode.y) + CARD_HEIGHT / 2;

              const dx = Math.abs(tgtX - srcX) * 0.5;
              const pathD = `M ${srcX} ${srcY} C ${srcX + Math.max(dx, 40)} ${srcY}, ${tgtX - Math.max(dx, 40)} ${tgtY}, ${tgtX} ${tgtY}`;

              const strokeColor = srcNode.color || '#94a3b8';
              const isHighlighted = activeNodeId === srcNode.id || activeNodeId === tgtNode.id;

              return (
                <g key={`${edge.source}-${edge.target}-${idx}`}>
                  {isHighlighted && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="6"
                      strokeOpacity="0.25"
                    />
                  )}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? "2.5" : "2"}
                    strokeOpacity={isHighlighted ? "0.9" : "0.55"}
                    strokeDasharray={edge.type === 'DEPENDENCY' ? '5,4' : undefined}
                  />
                  <circle cx={srcX} cy={srcY} r="3" fill={strokeColor} />
                  <circle cx={tgtX} cy={tgtY} r="3.5" fill={strokeColor} />
                </g>
              );
            })}
          </svg>

          {/* HTML Note Cards Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {manualNodes.map(node => {
              const isDragging = draggingNodeId === node.id;
              const currentX = isDragging ? node.x + dragOffset.x : node.x;
              const currentY = isDragging ? node.y + dragOffset.y : node.y;
              const isSelected = activeNodeId === node.id;
              const matchesSearch = isSearching ? (
                node.label.toLowerCase().includes(normalizedQuery) ||
                (node.memo && node.memo.toLowerCase().includes(normalizedQuery))
              ) : true;

              const nodeColor = node.color || '#3b82f6';
              const childCount = childCountMap.get(node.id) || 0;

              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleNodeMouseDown(e, node)}
                  style={{
                    transform: `translate(${currentX}px, ${currentY}px)`,
                    width: `${CARD_WIDTH}px`,
                    minHeight: `${CARD_HEIGHT}px`,
                  }}
                  className={`absolute rounded-2xl pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border transition-shadow cursor-grab active:cursor-grabbing select-none group ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-xl border-blue-500 z-20'
                      : 'hover:shadow-lg border-slate-200/80 dark:border-slate-800/80 z-10'
                  } ${
                    isSearching && !matchesSearch ? 'opacity-25 grayscale' : 'opacity-100'
                  }`}
                >
                  {/* Top Color Accent Stripe */}
                  <div 
                    className="h-1.5 w-full rounded-t-2xl"
                    style={{ backgroundColor: nodeColor }}
                  />

                  {/* Card Body */}
                  <div className="p-3.5 flex flex-col justify-between h-full">
                    {/* Header: Title & Quick Add Child */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: nodeColor }}
                        />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                          {node.label}
                        </h4>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleAddChildNode(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-opacity cursor-pointer"
                        title="하위 가지 추가"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Memo Preview */}
                    {node.memo ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-snug">
                        {node.memo}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400/60 dark:text-slate-600 italic mt-1.5">
                        메모 없음 (클릭하여 작성)
                      </p>
                    )}

                    {/* Footer: Badges & Child Counter */}
                    <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        {childCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            <CornerDownRight size={10} className="text-blue-500" />
                            {childCount}
                          </span>
                        )}
                        {node.isCompleted && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                            <CheckCircle2 size={10} /> 완료
                          </span>
                        )}
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setActiveNodeId(node.id);
                        }}
                        className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit3 size={11} /> 편집
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty State Prompt */}
        {manualNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-sm">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
              수기 마인드맵 & 노트가 준비되었습니다
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
              화면의 빈 공간을 <strong>더블클릭</strong>하거나 상단의 <strong>'+ 새 노트 추가'</strong> 버튼을 눌러 생각을 직접 자유롭게 작성해보세요.
            </p>
            <button
              onClick={handleAddNewRootNode}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>첫 노트 작성하기</span>
            </button>
          </div>
        )}
      </div>

      {/* Side Note Editor Drawer */}
      {activeNode && (
        <MindMapNoteEditor
          key={activeNode.id}
          node={activeNode}
          allNodes={manualNodes}
          allEdges={manualEdges}
          override={overrides[activeNode.id]}
          onUpdateTitle={(id, title) => updateCustomNodeText(id, title)}
          onUpdateMemo={(id, memo) => setNodeOverride(id, { customContextText: memo })}
          onUpdateColor={(id, color) => setNodeOverride(id, { customColor: color })}
          onToggleComplete={(id, isCompleted) => setNodeOverride(id, { isCompleted })}
          onAddChildNode={handleAddChildNode}
          onConnectNode={(src, tgt) => addCustomEdge(src, tgt)}
          onDisconnectNode={(src, tgt) => deleteCustomEdge(src, tgt)}
          onDeleteNode={handleDeleteNode}
          onSelectNode={node => setActiveNodeId(node.id)}
          onClose={() => setActiveNodeId(null)}
        />
      )}

      {/* Add Node Modal */}
      {isAddingNode && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => {
            setIsAddingNode(false);
            setNewNodeName('');
          }}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">새 노드 추가</h3>
            </div>

            <div className="py-2 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modalNewNodeName" className="text-xs font-semibold text-slate-500 dark:text-slate-400">노드 이름</label>
                <input
                  id="modalNewNodeName"
                  autoFocus
                  type="text"
                  placeholder="노드 이름을 입력하세요..."
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNodeName.trim()) {
                      e.preventDefault();
                      handleExecuteAddNode();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsAddingNode(false);
                      setNewNodeName('');
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800 dark:text-slate-200 placeholder-slate-400 font-medium transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modalSelectedLayer" className="text-xs font-semibold text-slate-500 dark:text-slate-400">온톨로지 레이어</label>
                <select
                  id="modalSelectedLayer"
                  value={selectedLayerId}
                  onChange={(e) => setSelectedLayerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800 dark:text-slate-200 font-medium transition-all cursor-pointer"
                >
                  <option value="1">비전/전략</option>
                  <option value="2">업무/회의</option>
                  <option value="3">실행/과제</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modalSelectedGroup" className="text-xs font-semibold text-slate-500 dark:text-slate-400">분류 (그룹)</label>
                <select
                  id="modalSelectedGroup"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800 dark:text-slate-200 font-medium transition-all cursor-pointer"
                >
                  <option value="OTHER">기타</option>
                  <option value="BUSINESS">사업</option>
                  <option value="MANAGEMENT">관리</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 mt-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNode(false);
                  setNewNodeName('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExecuteAddNode}
                disabled={!newNodeName.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer ${
                  newNodeName.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed opacity-50'
                }`}
              >
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMap3D;
