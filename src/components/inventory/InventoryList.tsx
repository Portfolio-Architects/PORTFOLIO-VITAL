'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { InventoryItem, StockChange } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Package, Search } from 'lucide-react';

// ============ Responsive Column Detector ============
function useColumnCount() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w < 640) setCols(1);
      else if (w < 1024) setCols(2);
      else setCols(3);
    };
    updateCols();
    window.addEventListener('resize', updateCols, { passive: true });
    return () => window.removeEventListener('resize', updateCols);
  }, []);
  return cols;
}

// ============ Zero-Dependency Window Virtualizer Hook ============
function useVirtualGrid({
  totalRows,
  estimatedRowHeight = 265,
  overscan = 2,
  containerRef
}: {
  totalRows: number;
  estimatedRowHeight?: number;
  overscan?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [containerOffsetTop, setContainerOffsetTop] = useState(0);

  useEffect(() => {
    const scrollParent = document.getElementById('main-scroll-container') || window;
    let rafId: number | null = null;

    const updateOffsetAndMetrics = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (scrollParent === window) {
        setScrollTop(window.scrollY);
        setViewportHeight(window.innerHeight);
        setContainerOffsetTop(containerRect.top + window.scrollY);
      } else {
        const el = scrollParent as HTMLElement;
        const elRect = el.getBoundingClientRect();
        setScrollTop(el.scrollTop);
        setViewportHeight(el.clientHeight);
        setContainerOffsetTop(containerRect.top - elRect.top + el.scrollTop);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (scrollParent === window) {
          setScrollTop(window.scrollY);
        } else {
          const el = scrollParent as HTMLElement;
          setScrollTop(el.scrollTop);
        }
      });
    };

    const handleResize = () => {
      updateOffsetAndMetrics();
    };

    updateOffsetAndMetrics();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);

  const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);

  const startRowIndex = Math.max(0, Math.floor(relativeScrollTop / estimatedRowHeight) - overscan);
  const endRowIndex = Math.min(
    totalRows,
    Math.ceil((relativeScrollTop + viewportHeight) / estimatedRowHeight) + overscan
  );

  const topPadding = startRowIndex * estimatedRowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRowIndex) * estimatedRowHeight);

  return { startRowIndex, endRowIndex, topPadding, bottomPadding };
}

// ============ Locally Isolated Inventory Item Card ============
function areInventoryItemCardPropsEqual(
  prevProps: {
    item: InventoryItem;
    history: StockChange[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    onAdjust: (item: InventoryItem, defaultChange: string) => void;
  },
  nextProps: {
    item: InventoryItem;
    history: StockChange[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    onAdjust: (item: InventoryItem, defaultChange: string) => void;
  }
) {
  if (prevProps.onEdit !== nextProps.onEdit) return false;
  if (prevProps.onDelete !== nextProps.onDelete) return false;
  if (prevProps.onAdjust !== nextProps.onAdjust) return false;

  const pItem = prevProps.item;
  const nItem = nextProps.item;
  if (
    pItem.id !== nItem.id ||
    pItem.name !== nItem.name ||
    pItem.category !== nItem.category ||
    pItem.currentStock !== nItem.currentStock ||
    pItem.unit !== nItem.unit
  ) {
    return false;
  }

  const pHist = prevProps.history;
  const nHist = nextProps.history;
  if (pHist.length !== nHist.length) return false;
  for (let i = 0; i < pHist.length; i++) {
    if (pHist[i].id !== nHist[i].id || pHist[i].change !== nHist[i].change) return false;
  }

  return true;
}

const InventoryItemCardComponent = ({
  item,
  history,
  onEdit,
  onDelete,
  onAdjust
}: {
  item: InventoryItem;
  history: StockChange[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdjust: (item: InventoryItem, defaultChange: string) => void;
}) => {
  const itemId = item.id || '';
  const currentStock = item.currentStock || 0;
  const itemUnit = item.unit || '개';
  const isOut = currentStock === 0;
  const isLow = currentStock > 0 && currentStock < 10;
  const stockColor = isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500';
  const stockBg = isOut ? 'bg-rose-500/10' : isLow ? 'bg-amber-500/10' : 'bg-emerald-500/10';
  const statusLabel = isOut ? '품절' : isLow ? '소진임박' : '충분';

  return (
    <Card className="glass-panel rounded-[2rem] border border-slate-200/60 shadow-2xs hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-1 transition-transform duration-300 group">
      <CardContent className="p-5 flex flex-col h-full justify-between">
        <div>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-base text-slate-800 line-clamp-1">{item.name || '이름 없음'}</div>
              {item.category && <span className="inline-block mt-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">{item.category}</span>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" title="수정"><Pencil size={12} /></button>
              <button onClick={() => onDelete(itemId)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer transition-colors" title="삭제"><Trash2 size={12} /></button>
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-slate-50/50 rounded-2xl p-4 mb-4 border border-slate-100/50">
            <div className="flex flex-col">
              <span className="text-[12px] text-slate-500 font-semibold mb-0.5">현재 재고</span>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {currentStock} <span className="text-xs font-normal text-slate-400">{itemUnit}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${stockColor} border-current/20 ${stockBg} text-[11px] font-bold shadow-3xs`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-sm"></span>
              {statusLabel}
            </div>
          </div>
        </div>

        <div>
          <div className="flex gap-2">
            <button onClick={() => onAdjust(item, '1')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-55 hover:bg-emerald-100/80 text-emerald-700 text-xs font-bold border border-emerald-100 transition-colors cursor-pointer shadow-3xs">
              <ArrowUp size={12} /> 입고
            </button>
            <button onClick={() => onAdjust(item, '-1')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-55 hover:bg-rose-100/80 text-rose-700 text-xs font-bold border border-rose-100 transition-colors cursor-pointer shadow-3xs">
              <ArrowDown size={12} /> 출고
            </button>
          </div>

          {history.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mb-1">최근 변동 이력</div>
              {history.map(h => (
                <div key={h.id} className="flex justify-between items-center text-[11px] text-slate-500 hover:bg-slate-50 px-1.5 py-0.5 rounded transition-colors font-medium">
                  <span className="flex items-center gap-1 truncate">
                    <span className="text-slate-300 font-mono text-[9px] shrink-0">•</span>
                    <span className="truncate">{h.reason}</span>
                  </span>
                  <span className={`font-semibold font-mono shrink-0 ${h.change > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {h.change > 0 ? '+' : ''}{h.change}{itemUnit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const InventoryItemCard = React.memo(InventoryItemCardComponent, areInventoryItemCardPropsEqual);
InventoryItemCard.displayName = 'InventoryItemCard';

// ============ Main Inventory List Component ============
function InventoryListComponent({ items, addItem, updateItem, deleteItem, adjustStock, getItemHistory }: {
  items: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('개');
  const [adjChange, setAdjChange] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cols = useColumnCount();

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-colors duration-150 font-medium";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedItem) {
      updateItem(selectedItem.id, { name, category, unit });
    } else {
      addItem({ name, category, currentStock: Number(stock) || 0, unit, budgetEntryIds: [] });
    }
    resetForm();
  };

  const closeAdjustModal = useCallback(() => {
    setShowAdjustModal(false);
    setSelectedItem(null);
    setAdjChange('');
    setAdjReason('');
  }, []);

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !adjChange) return;
    adjustStock(selectedItem.id, Number(adjChange), adjReason || (Number(adjChange) > 0 ? '입고' : '출고'));
    closeAdjustModal();
  };

  const resetForm = () => {
    setName(''); setCategory(''); setStock(''); setUnit('개'); setSelectedItem(null); setShowAddModal(false);
  };

  const openEdit = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setName(item?.name || '');
    setCategory(item?.category || '');
    setUnit(item?.unit || '개');
    setShowAddModal(true);
  }, []);

  const openAdjust = useCallback((item: InventoryItem, defaultChange: string) => {
    setSelectedItem(item);
    setAdjChange(defaultChange);
    setShowAdjustModal(true);
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    deleteItem(id);
  }, [deleteItem]);

  const { uniqueCategories, filteredItems } = useMemo(() => {
    const cats = new Set<string>();
    const query = (searchQuery || '').trim().toLowerCase();
    const result: InventoryItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      if (item.category) cats.add(item.category);

      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      if (!matchesCategory) continue;

      if (!query) {
        result.push(item);
      } else {
        const itemName = (item.name || '').toLowerCase();
        const itemCategory = (item.category || '').toLowerCase();
        if (itemName.includes(query) || itemCategory.includes(query)) {
          result.push(item);
        }
      }
    }

    return {
      uniqueCategories: Array.from(cats),
      filteredItems: result
    };
  }, [items, searchQuery, selectedCategory]);

  const itemRows = useMemo(() => {
    const rows: InventoryItem[][] = [];
    for (let i = 0; i < filteredItems.length; i += cols) {
      rows.push(filteredItems.slice(i, i + cols));
    }
    return rows;
  }, [filteredItems, cols]);

  const { startRowIndex, endRowIndex, topPadding, bottomPadding } = useVirtualGrid({
    totalRows: itemRows.length,
    estimatedRowHeight: 265,
    overscan: 2,
    containerRef
  });

  const visibleRows = useMemo(() => {
    return itemRows.slice(startRowIndex, endRowIndex);
  }, [itemRows, startRowIndex, endRowIndex]);

  const visibleItemHistoryMap = useMemo(() => {
    const map = new Map<string, StockChange[]>();
    for (const row of visibleRows) {
      for (const item of row) {
        const itemId = item.id || '';
        map.set(itemId, (getItemHistory(itemId) || []).slice(0, 3));
      }
    }
    return map;
  }, [visibleRows, getItemHistory]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">홍보물 관리</h2>
        <button 
          onClick={() => { setSelectedItem(null); resetForm(); setShowAddModal(true); }} 
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-500/10 cursor-pointer"
        >
          <Plus size={16} /> 품목 추가
        </button>
      </div>

      <div className="glass-panel rounded-[2rem] p-5 shadow-2xs border border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input 
            type="text" 
            placeholder="품목명 또는 분류 검색..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-colors duration-150 font-medium cursor-text"
          />
        </div>
        {uniqueCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <button 
              onClick={() => setSelectedCategory(null)} 
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors duration-150 cursor-pointer shadow-3xs ${
                !selectedCategory 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              전체
            </button>
            {uniqueCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)} 
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors duration-150 cursor-pointer shadow-3xs ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="glass-panel rounded-[2rem] border border-white/25">
          <CardContent className="px-5 py-16 text-center text-sm text-slate-400">
            <Package size={40} className="mx-auto mb-3 text-indigo-500/40 animate-bounce" />
            홍보물 품목을 추가해 보세요
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="glass-panel rounded-[2rem] border border-white/25">
          <CardContent className="px-5 py-12 text-center text-sm text-slate-400">
            검색 결과에 부합하는 품목이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div ref={containerRef} className="w-full">
          {topPadding > 0 && <div style={{ height: `${topPadding}px` }} aria-hidden="true" />}
          
          <div className="space-y-4">
            {visibleRows.map((row, idx) => {
              const rowIndex = startRowIndex + idx;
              const rowKey = row[0]?.id || rowIndex;
              return (
                <div key={rowKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {row.map(item => {
                    const itemId = item.id || '';
                    const history = visibleItemHistoryMap.get(itemId) || [];
                    return (
                      <InventoryItemCard 
                        key={itemId}
                        item={item}
                        history={history}
                        onEdit={openEdit}
                        onDelete={handleDeleteItem}
                        onAdjust={openAdjust}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {bottomPadding > 0 && <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showAddModal} onClose={resetForm} title={selectedItem ? '품목 수정' : '새 품목'} size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">품명 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">분류</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} className={inputClass} placeholder="예: 홍보물" />
          </div>
          {!selectedItem && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">초기 수량</label>
              <input type="number" value={stock} onChange={e => setStock(e.target.value)} className={inputClass} placeholder="0" />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">단위</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-indigo-500/10">
            {selectedItem ? '수정' : '추가'}
          </button>
        </form>
      </Modal>

      {/* Adjust Modal */}
      <Modal isOpen={showAdjustModal} onClose={closeAdjustModal} title={`재고 조정 — ${selectedItem?.name}`} size="sm">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="text-center text-sm text-slate-500">현재 재고: <span className="font-bold text-slate-800">{selectedItem?.currentStock} {selectedItem?.unit}</span></div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">변동 수량 (양수=입고, 음수=출고) *</label>
            <input type="number" value={adjChange} onChange={e => setAdjChange(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">사유</label>
            <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} className={inputClass} placeholder="입고/출고 사유" />
          </div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-indigo-500/10">
            적용
          </button>
        </form>
      </Modal>
    </div>
  );
}

InventoryListComponent.displayName = 'InventoryList';
export const InventoryList = React.memo(InventoryListComponent);
