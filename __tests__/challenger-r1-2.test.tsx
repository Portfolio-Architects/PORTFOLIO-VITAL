import { renderHook, act } from '@testing-library/react';
import { useGraphCustomization } from '@/__tests__/fixtures/useGraphCustomization';
import { globalYDoc } from '@/hooks/useYjsStore';
import * as sheetsApi from '@/lib/sheets-api';
import { useState } from 'react';

jest.mock('y-partykit/provider', () => {
  return jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  }));
});

jest.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
    })),
    storeState: jest.fn(),
  };
});

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([{ id: 'singleton', overrides: {}, customNodes: [], customEdges: [] }]),
  replaceAll: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/crypto', () => ({
  getAuthToken: jest.fn().mockReturnValue('mock-token'),
}));

describe('Empirical Challenger R1-2 Test Suite', () => {
  beforeEach(() => {
    globalYDoc.transact(() => {
      ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
        const m = globalYDoc.getMap(name);
        Array.from(m.keys()).forEach(k => m.delete(k));
      });
    });
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. Auto-save & Auto-load Effect under enabled = false vs enabled = true', () => {
    it('should NOT trigger fetchFromCloud or syncToCloud when enabled is false', async () => {
      const { result } = renderHook(() => useGraphCustomization(false));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // fetchFromCloud should not have been called
      expect(sheetsApi.readSheet).not.toHaveBeenCalled();
      // isCloudLoaded should be false
      expect(result.current.isCloudLoaded).toBe(false);

      // Trigger state change in Yjs
      act(() => {
        result.current.setNodeOverride('node-1', { customColor: '#ff0000' });
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // syncToCloud (replaceAll) should not have been called
      expect(sheetsApi.replaceAll).not.toHaveBeenCalled();
    });

    it('should trigger fetchFromCloud on mount and auto-save after data change when enabled is true', async () => {
      const { result } = renderHook(() => useGraphCustomization(true));

      // Advance timers for fetchFromCloud to complete
      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(sheetsApi.readSheet).toHaveBeenCalledWith('MAP_CUSTOMIZATION');
      expect(result.current.isCloudLoaded).toBe(true);

      // Make a data update
      act(() => {
        result.current.setNodeOverride('node-2', { customLabel: 'Custom Node' });
      });

      // Wait 16ms for useSyncExternalStore debounce
      act(() => {
        jest.advanceTimersByTime(20);
      });

      // Before 2500ms, replaceAll should not be called yet
      expect(sheetsApi.replaceAll).not.toHaveBeenCalled();

      // Advance 2500ms for debounced auto-save
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      expect(sheetsApi.replaceAll).toHaveBeenCalledWith(
        'MAP_CUSTOMIZATION',
        expect.arrayContaining([
          expect.objectContaining({ id: 'singleton' })
        ])
      );
    });

    it('should properly handle toggling enabled from false to true', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useGraphCustomization(enabled),
        { initialProps: { enabled: false } }
      );

      expect(sheetsApi.readSheet).not.toHaveBeenCalled();
      expect(result.current.isCloudLoaded).toBe(false);

      // Toggle enabled to true
      rerender({ enabled: true });

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(sheetsApi.readSheet).toHaveBeenCalledWith('MAP_CUSTOMIZATION');
      expect(result.current.isCloudLoaded).toBe(true);
    });

    it('should cancel pending auto-save timer when enabled transitions from true to false', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useGraphCustomization(enabled),
        { initialProps: { enabled: true } }
      );

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Trigger a change
      act(() => {
        result.current.setNodeOverride('node-3', { fixedX: 100 });
      });

      act(() => {
        jest.advanceTimersByTime(20);
      });

      // Toggle enabled to false BEFORE the 2500ms timer fires
      rerender({ enabled: false });

      // Advance 3000ms
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // replaceAll should NOT have been called for auto-save
      expect(sheetsApi.replaceAll).not.toHaveBeenCalled();
    });
  });

  describe('2. Hook Execution & Memoization Stability', () => {
    it('should maintain stable function references across re-renders', () => {
      const { result } = renderHook(() => {
        const [, setCnt] = useState(0);
        const graph = useGraphCustomization(true);
        return { graph, setCnt };
      });

      const initialGraph = result.current.graph;

      // Force parent component re-render
      act(() => {
        result.current.setCnt(1);
      });

      const nextGraph = result.current.graph;

      // Callbacks must maintain identical references
      expect(nextGraph.undo).toBe(initialGraph.undo);
      expect(nextGraph.redo).toBe(initialGraph.redo);
      expect(nextGraph.setNodeOverride).toBe(initialGraph.setNodeOverride);
      expect(nextGraph.batchSetNodeOverrides).toBe(initialGraph.batchSetNodeOverrides);
      expect(nextGraph.clearNodeOverride).toBe(initialGraph.clearNodeOverride);
      expect(nextGraph.addCustomNode).toBe(initialGraph.addCustomNode);
      expect(nextGraph.deleteCustomNode).toBe(initialGraph.deleteCustomNode);
      expect(nextGraph.updateCustomNodeText).toBe(initialGraph.updateCustomNodeText);
      expect(nextGraph.addCustomEdge).toBe(initialGraph.addCustomEdge);
      expect(nextGraph.deleteCustomEdge).toBe(initialGraph.deleteCustomEdge);
      expect(nextGraph.removeCustomTombstone).toBe(initialGraph.removeCustomTombstone);
      expect(nextGraph.renameNodeId).toBe(initialGraph.renameNodeId);
      expect(nextGraph.clearOverrides).toBe(initialGraph.clearOverrides);
      expect(nextGraph.resetLayoutOverrides).toBe(initialGraph.resetLayoutOverrides);
      expect(nextGraph.syncToCloud).toBe(initialGraph.syncToCloud);
      expect(nextGraph.fetchFromCloud).toBe(initialGraph.fetchFromCloud);
      expect(nextGraph.approveAndMerge).toBe(initialGraph.approveAndMerge);
      expect(nextGraph.addPendingSuggestions).toBe(initialGraph.addPendingSuggestions);
    });

    it('should handle stress batch updates without dropping state or crashing', async () => {
      const { result } = renderHook(() => useGraphCustomization(true));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Perform 200 rapid sequential node override updates
      act(() => {
        for (let i = 0; i < 200; i++) {
          result.current.setNodeOverride(`stress-node-${i}`, {
            fixedX: i * 10,
            fixedY: i * 20,
            customLabel: `Stress Node ${i}`
          });
        }
      });

      // Let debounce run
      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(Object.keys(result.current.overrides)).toHaveLength(200);
      expect(result.current.overrides['stress-node-199']).toEqual({
        fixedX: 1990,
        fixedY: 3980,
        customLabel: 'Stress Node 199'
      });
    });
  });
});
