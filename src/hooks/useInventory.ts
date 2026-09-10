'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { InventoryItem, StockChange, generateId } from '@/types';

const EMPTY_STOCK_CHANGES: StockChange[] = [];

export function useInventory() {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['INVENTORY'],
    queryFn: () => readSheet<InventoryItem>('INVENTORY'),
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const { data: stockChanges = [] } = useQuery({
    queryKey: ['STOCK_CHANGES'],
    queryFn: () => readSheet<StockChange>('STOCK_CHANGES'),
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const addItemMut = useMutation({
    mutationFn: (newItem: InventoryItem) => addRow('INVENTORY', newItem),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) => [newItem, ...(old || [])]);
      return { previous };
    },
    onError: (err, newItem, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['INVENTORY'] });
      }
    },
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) => updateRow('INVENTORY', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) =>
        (old || []).map(i => i.id === id ? { ...i, ...updatedFields } : i)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['INVENTORY'] });
      }
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteRow('INVENTORY', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['INVENTORY'] });
      const previous = queryClient.getQueryData<InventoryItem[]>(['INVENTORY']);
      queryClient.setQueryData<InventoryItem[]>(['INVENTORY'], (old) => (old || []).filter(i => i.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['INVENTORY'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['INVENTORY'] });
      }
    },
  });

  const addStockChangeMut = useMutation({
    mutationFn: (sc: StockChange) => addRow('STOCK_CHANGES', sc),
    onMutate: async (sc) => {
      await queryClient.cancelQueries({ queryKey: ['STOCK_CHANGES'] });
      const previous = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']);
      queryClient.setQueryData<StockChange[]>(['STOCK_CHANGES'], (old) => [sc, ...(old || [])]);
      return { previous };
    },
    onError: (err, sc, context) => {
      if (context?.previous) queryClient.setQueryData(['STOCK_CHANGES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['STOCK_CHANGES'] });
      }
    },
  });

  const deleteStockChangesByItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      const changes = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']) || [];
      for (let i = 0; i < changes.length; i++) {
        if (changes[i].itemId === itemId) {
          await deleteRow('STOCK_CHANGES', changes[i].id);
        }
      }
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['STOCK_CHANGES'] });
      const previous = queryClient.getQueryData<StockChange[]>(['STOCK_CHANGES']);
      queryClient.setQueryData<StockChange[]>(['STOCK_CHANGES'], (old) => (old || []).filter(sc => sc.itemId !== itemId));
      return { previous };
    },
    onError: (err, itemId, context) => {
      if (context?.previous) queryClient.setQueryData(['STOCK_CHANGES'], context.previous);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['STOCK_CHANGES'] });
      }
    },
  });

  // Pre-indexed O(1) lookup Map for items by ID
  const itemsByIdMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  // Pre-grouped O(1) lookup Map for stock changes by itemId (pre-sorted by date desc)
  const stockChangesByItemMap = useMemo(() => {
    const map = new Map<string, StockChange[]>();
    for (const sc of stockChanges) {
      let list = map.get(sc.itemId);
      if (!list) {
        list = [];
        map.set(sc.itemId, list);
      }
      list.push(sc);
    }
    // Pre-sort each item's changes once with Date.parse (zero Date instance allocation)
    for (const list of map.values()) {
      list.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    }
    return map;
  }, [stockChanges]);

  const addItem = useCallback((item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    addItemMut.mutate(newItem);
    return newItem;
  }, [addItemMut]);

  const updateItem = useCallback((id: string, updates: Partial<InventoryItem>) => {
    updateItemMut.mutate({ id, updates });
  }, [updateItemMut]);

  const deleteItem = useCallback((id: string) => {
    deleteItemMut.mutate(id);
    deleteStockChangesByItemMut.mutate(id);
  }, [deleteItemMut, deleteStockChangesByItemMut]);

  const adjustStock = useCallback((itemId: string, change: number, reason: string) => {
    const sc: StockChange = { id: generateId(), itemId, change, reason, date: new Date().toISOString() };
    const currentItem = itemsByIdMap.get(itemId);
    if (currentItem) {
      const newStock = currentItem.currentStock + change;
      updateItemMut.mutate({ id: itemId, updates: { currentStock: newStock } });
    }
    addStockChangeMut.mutate(sc);
    return sc;
  }, [itemsByIdMap, updateItemMut, addStockChangeMut]);

  const getItemHistory = useCallback((itemId: string) => {
    return stockChangesByItemMap.get(itemId) || EMPTY_STOCK_CHANGES;
  }, [stockChangesByItemMap]);

  const getItemById = useCallback((id: string) => {
    return itemsByIdMap.get(id);
  }, [itemsByIdMap]);

  return { items, stockChanges, addItem, updateItem, deleteItem, adjustStock, getItemHistory, getItemById };
}
