import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWikiStorage, getCanonicalWikiId } from '@/hooks/useWikiStorage';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import * as sheetsApi from '@/lib/sheets-api';

// Mock sheets-api for fine-grained assertion of write operations
jest.mock('@/lib/sheets-api', () => {
  const original = jest.requireActual('@/lib/sheets-api');
  return {
    ...original,
    readSheet: jest.fn(),
    addRow: jest.fn(),
    updateRow: jest.fn(),
    deleteRow: jest.fn(),
    replaceAll: jest.fn(),
  };
});

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('Challenger M1: Frontend State Synchronization Stress Suite', () => {
  const mockReadSheet = sheetsApi.readSheet as jest.Mock;
  const mockAddRow = sheetsApi.addRow as jest.Mock;
  const mockUpdateRow = sheetsApi.updateRow as jest.Mock;
  const mockDeleteRow = sheetsApi.deleteRow as jest.Mock;
  const mockReplaceAll = sheetsApi.replaceAll as jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.useRealTimers();

    // Default mock implementations
    mockReadSheet.mockImplementation((sheetName: string) => {
      if (sheetName.startsWith('WIKI_DOC_')) {
        return Promise.resolve([
          { id: 'singleton', blocks: [{ type: 'paragraph', content: 'Initial Text' }] }
        ]);
      }
      if (sheetName === 'BUDGET_CATEGORIES') {
        return Promise.resolve([
          { id: 'cat-1', name: '사업비', totalBudget: 50000000, policyProject: 'P1', unitProject: 'U1', detailedProject: '건강증진지원실 운영', statItem: '201-01 사무관리비' },
          { id: 'cat-2', name: '여비', totalBudget: 10000000, policyProject: 'P1', unitProject: 'U1', detailedProject: '건강증진지원실 운영', statItem: '202-01 국내여비' }
        ]);
      }
      if (sheetName === 'BUDGET_ENTRIES') {
        return Promise.resolve([
          {
            id: 'be-linked-101',
            categoryId: 'cat-1',
            amount: 2500000,
            purpose: '기존 품의서 항목',
            date: '2026-09-01',
            isPlanned: true,
            isSettled: false,
            simulationEntryId: 'sim-linked-101',
            actionType: 'general'
          }
        ]);
      }
      if (sheetName === 'BUDGET_SIMULATIONS') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    mockAddRow.mockResolvedValue(true);
    mockUpdateRow.mockResolvedValue(true);
    mockDeleteRow.mockResolvedValue(true);
    mockReplaceAll.mockResolvedValue(true);
  });

  // =========================================================================
  // 1. WIKI UNMOUNT AUTO-FLUSH VERIFICATION (useWikiStorage)
  // =========================================================================
  describe('1. Wiki Storage Unmount Auto-Flush (useWikiStorage)', () => {
    it('canonical Wiki ID handles leaf keywords correctly', () => {
      expect(getCanonicalWikiId('node-123')).toBe('node-123');
      expect(getCanonicalWikiId('leaf-tag-예산-비만예방')).toBe('leaf-kw-비만예방');
      expect(getCanonicalWikiId('leaf-kw-금연클리닉')).toBe('leaf-kw-금연클리닉');
      expect(getCanonicalWikiId('leaf-건강증진')).toBe('leaf-kw-건강증진');
    });

    it('flushes pending debounced block changes immediately on unmount before the 2000ms timer fires', async () => {
      const { Wrapper } = createTestWrapper();
      const { result, unmount } = renderHook(() => useWikiStorage('node-stress-1', '테스트 노드'), { wrapper: Wrapper });

      // Wait for initial cloud fetch to settle and set isLoaded = true (so isFetchedRef.current = true)
      await waitFor(() => expect(result.current.isLoaded).toBe(true));
      expect(result.current.blocks).toBeDefined();

      const updatedBlocks = [
        { type: 'paragraph', content: 'Debounced Draft In Flight' } as any
      ];

      // User types and triggers saveBlocks
      act(() => {
        result.current.saveBlocks('node-stress-1', updatedBlocks);
      });

      // Verify that replaceAll has NOT been called yet because of the 2000ms debounce
      expect(mockReplaceAll).not.toHaveBeenCalled();

      // Verify localStorage was updated immediately (instant client fallback)
      expect(localStorage.getItem('HCHPS-Wiki-node-stress-1')).toBe(JSON.stringify(updatedBlocks));

      // Simulate rapid navigation / unmount 50ms after typing (before 2000ms timer expires)
      act(() => {
        unmount();
      });

      // The unmount cleanup must auto-flush the pending changes to disk SSOT immediately!
      expect(mockReplaceAll).toHaveBeenCalledTimes(1);
      expect(mockReplaceAll).toHaveBeenCalledWith('WIKI_DOC_node-stress-1', [
        { id: 'singleton', blocks: updatedBlocks }
      ]);
    });

    it('multiple rapid keystrokes before unmount flush only the latest block state', async () => {
      const { Wrapper } = createTestWrapper();
      const { result, unmount } = renderHook(() => useWikiStorage('node-rapid-edit', '신속 편집 노드'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      // Keystroke 1
      act(() => {
        result.current.saveBlocks('node-rapid-edit', [{ type: 'paragraph', content: 'Draft 1' } as any]);
      });
      // Keystroke 2
      act(() => {
        result.current.saveBlocks('node-rapid-edit', [{ type: 'paragraph', content: 'Draft 2' } as any]);
      });
      // Keystroke 3 (Final)
      const finalBlocks = [{ type: 'paragraph', content: 'Draft 3 - Final Keystroke' } as any];
      act(() => {
        result.current.saveBlocks('node-rapid-edit', finalBlocks);
      });

      expect(mockReplaceAll).not.toHaveBeenCalled();

      // Immediate unmount
      act(() => {
        unmount();
      });

      // Only 1 flush should be called, with the latest blocks
      expect(mockReplaceAll).toHaveBeenCalledTimes(1);
      expect(mockReplaceAll).toHaveBeenCalledWith('WIKI_DOC_node-rapid-edit', [
        { id: 'singleton', blocks: finalBlocks }
      ]);
    });

    it('does NOT trigger redundant flush on unmount if timer already fired and completed', async () => {
      jest.useFakeTimers();
      const { Wrapper } = createTestWrapper();
      const { result, unmount } = renderHook(() => useWikiStorage('node-timer-done', '완료 노드'), { wrapper: Wrapper });

      // Run microtasks so fetchCloud resolves
      await act(async () => {
        jest.runAllTicks();
      });

      const blocks = [{ type: 'paragraph', content: 'Timer should fire' } as any];

      act(() => {
        result.current.saveBlocks('node-timer-done', blocks);
      });

      expect(mockReplaceAll).not.toHaveBeenCalled();

      // Advance timer beyond 2000ms
      await act(async () => {
        jest.advanceTimersByTime(2050);
      });

      // Timer fired replaceAll once
      expect(mockReplaceAll).toHaveBeenCalledTimes(1);
      expect(mockReplaceAll).toHaveBeenCalledWith('WIKI_DOC_node-timer-done', [
        { id: 'singleton', blocks }
      ]);

      mockReplaceAll.mockClear();

      // Now unmount afterwards
      act(() => {
        unmount();
      });

      // No pending blocks remain; unmount should NOT make a duplicate call!
      expect(mockReplaceAll).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('gracefully handles replaceAll rejection during unmount without crashing unmount cleanup', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockReplaceAll.mockRejectedValueOnce(new Error('Disk write error during unmount'));

      const { Wrapper } = createTestWrapper();
      const { result, unmount } = renderHook(() => useWikiStorage('node-err-safe', '오류 방어 노드'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.saveBlocks('node-err-safe', [{ type: 'paragraph', content: 'Failing content' } as any]);
      });

      // Unmounting should not throw unhandled exception
      expect(() => {
        act(() => {
          unmount();
        });
      }).not.toThrow();

      expect(mockReplaceAll).toHaveBeenCalledWith('WIKI_DOC_node-err-safe', [
        { id: 'singleton', blocks: [{ type: 'paragraph', content: 'Failing content' }] }
      ]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Auto-Flush on Unmount] Failed to flush wiki node-err-safe:'),
          expect.any(Error)
        );
      });
      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 2. BUDGET SIMULATOR BIDIRECTIONAL SYNC VERIFICATION (useBudgetSimulator)
  // =========================================================================
  describe('2. Budget Simulator Bidirectional Sync (useBudgetSimulator)', () => {
    it('mergedEntries ingests SSOT planned budget entry and sets budgetEntryId', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify the planned budget entry from BUDGET_ENTRIES.json is present in merged entries
      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      expect(plannedEntry).toBeDefined();
      expect(plannedEntry?.name).toBe('기존 품의서 항목');
      expect(plannedEntry?.amount).toBe(2500000);
      expect(plannedEntry?.categoryId).toBe('cat-1');
      expect(plannedEntry?.status).toBe('PLANNED');
    });

    it('updateEntry for a linked entry immediately updates the corresponding BudgetEntry in BUDGET_ENTRIES SSOT', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      expect(plannedEntry).toBeDefined();
      const simId = plannedEntry!.id;

      // Update name and amount
      act(() => {
        result.current.updateEntry(simId, {
          name: 'AI 헬스케어 키오스크 수정 품의',
          amount: 3200000,
          memo: '단가 상향 조정 반영'
        });
      });

      // Verify that updateRow was called on BUDGET_ENTRIES with the updated fields!
      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'BUDGET_ENTRIES',
          'be-linked-101',
          expect.objectContaining({
            id: 'be-linked-101',
            purpose: 'AI 헬스케어 키오스크 수정 품의',
            amount: 3200000,
            memo: '[시뮬레이션] 단가 상향 조정 반영'
          })
        );
      });

      // Verify local simulation entry is also updated in state
      const updatedLocal = result.current.entries.find(e => e.id === simId);
      expect(updatedLocal?.name).toBe('AI 헬스케어 키오스크 수정 품의');
      expect(updatedLocal?.amount).toBe(3200000);
    });

    it('updateEntry automatically computes amount from unitPrice and quantity when amount is omitted', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      const simId = plannedEntry!.id;

      // Update unitPrice to 450,000 and quantity to 4 (expected amount = 1,800,000)
      act(() => {
        result.current.updateEntry(simId, {
          unitPrice: 450000,
          quantity: 4
        });
      });

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'BUDGET_ENTRIES',
          'be-linked-101',
          expect.objectContaining({
            amount: 1800000,
            memo: '[시뮬레이션] 단가 ₩450,000 × 4개'
          })
        );
      });

      const updatedLocal = result.current.entries.find(e => e.id === simId);
      expect(updatedLocal?.amount).toBe(1800000);
    });

    it('updateEntry automatically resolves new categoryId when detailedProject and statItem change', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      const simId = plannedEntry!.id;

      // Switch to cat-2 (건강증진지원실 운영 / 202-01 국내여비)
      act(() => {
        result.current.updateEntry(simId, {
          detailedProject: '건강증진지원실 운영',
          statItem: '202-01 국내여비'
        });
      });

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'BUDGET_ENTRIES',
          'be-linked-101',
          expect.objectContaining({
            categoryId: 'cat-2'
          })
        );
      });

      const updatedLocal = result.current.entries.find(e => e.id === simId);
      expect(updatedLocal?.categoryId).toBe('cat-2');
    });

    it('updateEntry on an unlinked entry updates simulation state safely without throwing or calling updateRow', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Add a simulation entry that has no categoryId (so no budgetEntryId is created)
      let customSim: any;
      act(() => {
        customSim = result.current.addEntry({
          name: '가상 아이템 (비연결)',
          detailedProject: '미등록 프로젝트',
          statItem: '미등록 통계목',
          unitPrice: 100000,
          quantity: 2
        });
      });

      expect(customSim.budgetEntryId).toBeUndefined();
      mockUpdateRow.mockClear();

      // Now update the unlinked entry
      act(() => {
        result.current.updateEntry(customSim.id, {
          name: '가상 아이템 명칭 수정',
          unitPrice: 150000
        });
      });

      // No budgetEntryId, so updateRow('BUDGET_ENTRIES') should NOT be called
      expect(mockUpdateRow).not.toHaveBeenCalled();

      // But local state should reflect the change
      const updated = result.current.entries.find(e => e.id === customSim.id);
      expect(updated?.name).toBe('가상 아이템 명칭 수정');
      expect(updated?.amount).toBe(300000); // 150000 * 2
    });

    it('deleteEntry on a linked entry triggers deleteRow on BUDGET_ENTRIES', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      const simId = plannedEntry!.id;

      act(() => {
        result.current.deleteEntry(simId);
      });

      await waitFor(() => {
        expect(mockDeleteRow).toHaveBeenCalledWith('BUDGET_ENTRIES', 'be-linked-101');
      });
      const remaining = result.current.entries.find(e => e.id === simId);
      expect(remaining).toBeUndefined();
    });

    it('settleEntry marks the planned entry as settled and adds an actual expenditure entry', async () => {
      const { Wrapper } = createTestWrapper();
      const { result } = renderHook(() => useBudgetSimulator(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const plannedEntry = result.current.entries.find(e => e.budgetEntryId === 'be-linked-101');
      const simId = plannedEntry!.id;

      await act(async () => {
        await result.current.settleEntry(simId, 2400000, '2026-09-10');
      });

      // 1. Mark planned entry settled
      expect(mockUpdateRow).toHaveBeenCalledWith(
        'BUDGET_ENTRIES',
        'be-linked-101',
        expect.objectContaining({ isSettled: true })
      );

      // 2. Add actual entry (isPlanned: false)
      expect(mockAddRow).toHaveBeenCalledWith(
        'BUDGET_ENTRIES',
        expect.objectContaining({
          categoryId: 'cat-1',
          amount: 2400000,
          date: '2026-09-10',
          isPlanned: false,
          isSettled: false,
          relatedPlanId: 'be-linked-101'
        })
      );
    });
  });
});
