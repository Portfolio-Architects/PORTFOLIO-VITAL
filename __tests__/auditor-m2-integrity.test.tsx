import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3DSkeleton } from '@/components/skeletons/MindMap3DSkeleton';
import { YangjaeFestivalSkeleton } from '@/components/skeletons/YangjaeFestivalSkeleton';
import { useYangjaeFestival } from '@/hooks/useYangjaeFestival';
import { useQuery } from '@tanstack/react-query';
import DefaultMindMapNoteEditor, { MindMapNoteEditor } from '@/components/mindmap/ui/MindMapNoteEditor';

// Mock tanstack useQuery to inspect arguments
jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: jest.fn(),
    useQueryClient: jest.fn(() => ({
      invalidateQueries: jest.fn(),
    })),
    useMutation: jest.fn(() => ({
      mutate: jest.fn(),
      isPending: false,
    })),
  };
});

// Mock next/dynamic to synchronously render components for test determinism
jest.mock('next/dynamic', () => {
  return (loader: any) => {
    let Component: any = null;
    const promise = loader();
    if (promise && promise.then) {
      promise.then((mod: any) => {
        Component = mod.default || mod.BudgetDashboard || mod.InventoryList || mod.BudgetSimulator || mod;
      });
    }
    return (props: any) => {
      if (!Component) {
        return <div data-testid="dynamic-loading">Loading...</div>;
      }
      return <Component {...props} />;
    };
  };
});

// Spies for sub-components of WorkspaceView
const budgetMountSpy = jest.fn();
const budgetUnmountSpy = jest.fn();
jest.mock('@/components/budget/BudgetDashboard', () => {
  const MockBudgetDashboard = () => {
    React.useEffect(() => {
      budgetMountSpy();
      return () => {
        budgetUnmountSpy();
      };
    }, []);
    return <div data-testid="budget-dashboard">Budget Dashboard Content</div>;
  };
  return {
    __esModule: true,
    BudgetDashboard: MockBudgetDashboard,
    default: MockBudgetDashboard,
  };
});

const inventoryMountSpy = jest.fn();
const inventoryUnmountSpy = jest.fn();
jest.mock('@/components/inventory/InventoryList', () => {
  const MockInventoryList = () => {
    React.useEffect(() => {
      inventoryMountSpy();
      return () => {
        inventoryUnmountSpy();
      };
    }, []);
    return <div data-testid="inventory-list">Inventory List Content</div>;
  };
  return {
    __esModule: true,
    InventoryList: MockInventoryList,
    default: MockInventoryList,
  };
});

const simulatorMountSpy = jest.fn();
const simulatorUnmountSpy = jest.fn();
jest.mock('@/components/budget/BudgetSimulator', () => {
  const MockBudgetSimulator = () => {
    React.useEffect(() => {
      simulatorMountSpy();
      return () => {
        simulatorUnmountSpy();
      };
    }, []);
    return <div data-testid="budget-simulator">Budget Simulator Content</div>;
  };
  return {
    __esModule: true,
    BudgetSimulator: MockBudgetSimulator,
    default: MockBudgetSimulator,
  };
});

describe('Auditor M2 Forensic Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('1. WorkspaceView Dormant Sub-Tab Strategy', () => {
    it('preserves mounted sub-tabs across tab switches without unmounting when rendered without fixed initialTab', async () => {
      const mockProps: any = {
        budgetCategories: [],
        budgetEntries: [],
        addCategory: jest.fn(),
        updateCategory: jest.fn(),
        deleteCategory: jest.fn(),
        replaceCategories: jest.fn(),
        addEntry: jest.fn(),
        updateEntry: jest.fn(),
        deleteEntry: jest.fn(),
        batchUpdateEntries: jest.fn(),
        batchDeleteEntries: jest.fn(),
        batchSettleEntries: jest.fn(),
        getCategoryStats: jest.fn(),
        overallStats: { totalIncome: 0, totalExpense: 0, balance: 0, totalBudget: 0, remainingBudget: 0, executionRate: 0 },
        inventoryItems: [],
        addItem: jest.fn(),
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        adjustStock: jest.fn(),
        getItemHistory: jest.fn(),
        addSignal: jest.fn(),
      };

      render(<WorkspaceView {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('budget-dashboard')).toBeInTheDocument();
      });

      expect(budgetMountSpy).toHaveBeenCalledTimes(1);
      expect(inventoryMountSpy).not.toHaveBeenCalled();
      expect(simulatorMountSpy).not.toHaveBeenCalled();

      const budgetEl = screen.getByTestId('budget-dashboard');
      expect(budgetEl.parentElement).toHaveClass('block');

      // Switch to Inventory tab
      const inventoryBtn = screen.getByRole('button', { name: /홍보물 관리/ });
      await act(async () => {
        fireEvent.click(inventoryBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
      });

      expect(inventoryMountSpy).toHaveBeenCalledTimes(1);
      // Budget component MUST remain mounted (no unmount call)
      expect(budgetUnmountSpy).not.toHaveBeenCalled();
      expect(budgetEl.parentElement).toHaveClass('hidden');

      const inventoryEl = screen.getByTestId('inventory-list');
      expect(inventoryEl.parentElement).toHaveClass('block');

      // Switch to Simulator tab
      const simulatorBtn = screen.getByRole('button', { name: /예산 시뮬레이터/ });
      await act(async () => {
        fireEvent.click(simulatorBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('budget-simulator')).toBeInTheDocument();
      });

      expect(simulatorMountSpy).toHaveBeenCalledTimes(1);
      expect(budgetUnmountSpy).not.toHaveBeenCalled();
      expect(inventoryUnmountSpy).not.toHaveBeenCalled();

      // Switch back to Budget tab
      const budgetBtn = screen.getByRole('button', { name: /예산 대조보드/ });
      await act(async () => {
        fireEvent.click(budgetBtn);
      });

      // No new mount calls, no unmounts, display toggled to block
      expect(budgetMountSpy).toHaveBeenCalledTimes(1);
      expect(budgetUnmountSpy).not.toHaveBeenCalled();
      expect(budgetEl.parentElement).toHaveClass('block');
      expect(inventoryEl.parentElement).toHaveClass('hidden');
    });

    it('remediation verified: static initialTab does not lock tab switching; user can switch tabs smoothly', async () => {
      const mockProps: any = {
        initialTab: 'budget',
        budgetCategories: [],
        budgetEntries: [],
        addCategory: jest.fn(),
        updateCategory: jest.fn(),
        deleteCategory: jest.fn(),
        replaceCategories: jest.fn(),
        addEntry: jest.fn(),
        updateEntry: jest.fn(),
        deleteEntry: jest.fn(),
        batchUpdateEntries: jest.fn(),
        batchDeleteEntries: jest.fn(),
        batchSettleEntries: jest.fn(),
        getCategoryStats: jest.fn(),
        overallStats: { totalIncome: 0, totalExpense: 0, balance: 0, totalBudget: 0, remainingBudget: 0, executionRate: 0 },
        inventoryItems: [],
        addItem: jest.fn(),
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        adjustStock: jest.fn(),
        getItemHistory: jest.fn(),
        addSignal: jest.fn(),
      };

      render(<WorkspaceView {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('budget-dashboard')).toBeInTheDocument();
      });

      const inventoryBtn = screen.getByRole('button', { name: /홍보물 관리/ });
      await act(async () => {
        fireEvent.click(inventoryBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
      });

      // Remediation verified: activeTab successfully switches to inventory
      const budgetEl = screen.getByTestId('budget-dashboard');
      expect(budgetEl.parentElement).toHaveClass('hidden');
      const inventoryEl = screen.getByTestId('inventory-list');
      expect(inventoryEl.parentElement).toHaveClass('block');
    });
  });

  describe('2. Zombie Polling Suppression in useYangjaeFestival', () => {
    it('sets refetchInterval: 2500 and refetchOnWindowFocus: true when isActive is true or default', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: undefined });

      useYangjaeFestival();
      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['festival', 'yangjae'],
          refetchInterval: 2500,
          refetchOnWindowFocus: true,
          refetchIntervalInBackground: false,
        })
      );
    });

    it('disables refetchInterval and refetchOnWindowFocus when isActive is false', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: undefined });

      useYangjaeFestival(false);
      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['festival', 'yangjae'],
          refetchInterval: false,
          refetchOnWindowFocus: false,
          refetchIntervalInBackground: false,
        })
      );
    });
  });

  describe('3. Skeleton UI Guards (Rule H)', () => {
    it('renders MindMap3DSkeleton with high-contrast layout and data-testid', () => {
      render(<MindMap3DSkeleton />);
      const skeleton = screen.getByTestId('mindmap-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('renders YangjaeFestivalSkeleton with high-contrast layout and data-testid', () => {
      render(<YangjaeFestivalSkeleton />);
      const skeleton = screen.getByTestId('yangjae-festival-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('4. MindMapNoteEditor Keystroke Debounce & Auto-Flush', () => {
    it('debounces title updates by 250ms and flushes immediately on blur', () => {
      jest.useFakeTimers();
      const onUpdateTitle = jest.fn();
      const onUpdateMemo = jest.fn();

      const mockNode: any = {
        id: 'node-1',
        label: 'Initial Title',
        memo: 'Initial Memo',
      };

      render(
        <MindMapNoteEditor
          node={mockNode}
          allNodes={[mockNode]}
          allEdges={[]}
          onClose={jest.fn()}
          onSelectNode={jest.fn()}
          onUpdateTitle={onUpdateTitle}
          onUpdateMemo={onUpdateMemo}
          onUpdateColor={jest.fn()}
          onAddChildNode={jest.fn()}
          onDeleteNode={jest.fn()}
          onConnectNode={jest.fn()}
          onDisconnectNode={jest.fn()}
        />
      );

      const titleInput = screen.getByDisplayValue('Initial Title');

      // Type new title
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      // Before 250ms expires, onUpdateTitle should NOT be called yet
      expect(onUpdateTitle).not.toHaveBeenCalled();

      // Advance by 100ms
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(onUpdateTitle).not.toHaveBeenCalled();

      // Trigger onBlur -> MUST flush immediately
      act(() => {
        fireEvent.blur(titleInput);
      });
      expect(onUpdateTitle).toHaveBeenCalledWith('node-1', 'Updated Title');

      jest.useRealTimers();
    });

    it('flushes pending memo updates on unmount', () => {
      jest.useFakeTimers();
      const onUpdateTitle = jest.fn();
      const onUpdateMemo = jest.fn();

      const mockNode: any = {
        id: 'node-2',
        label: 'Node 2',
        memo: 'Original Memo',
      };

      const { unmount } = render(
        <MindMapNoteEditor
          node={mockNode}
          allNodes={[mockNode]}
          allEdges={[]}
          onClose={jest.fn()}
          onSelectNode={jest.fn()}
          onUpdateTitle={onUpdateTitle}
          onUpdateMemo={onUpdateMemo}
          onUpdateColor={jest.fn()}
          onAddChildNode={jest.fn()}
          onDeleteNode={jest.fn()}
          onConnectNode={jest.fn()}
          onDisconnectNode={jest.fn()}
        />
      );

      const memoTextarea = screen.getByDisplayValue('Original Memo');
      fireEvent.change(memoTextarea, { target: { value: 'Unsaved typing in progress...' } });

      expect(onUpdateMemo).not.toHaveBeenCalled();

      // Unmount while timer is still running
      act(() => {
        unmount();
      });

      // MUST flush pending update to onUpdateMemo on unmount!
      expect(onUpdateMemo).toHaveBeenCalledWith('node-2', 'Unsaved typing in progress...');

      jest.useRealTimers();
    });

    it('exports MindMapNoteEditor as default export', () => {
      expect(DefaultMindMapNoteEditor).toBeDefined();
      expect(DefaultMindMapNoteEditor).toBe(MindMapNoteEditor);
    });

    it('flushes pending edits to previous node on node switch without cross-node pollution', () => {
      jest.useFakeTimers();
      const onUpdateTitle = jest.fn();
      const onUpdateMemo = jest.fn();

      const nodeA: any = { id: 'node-a', label: 'Node A Label', memo: 'Node A Memo' };
      const nodeB: any = { id: 'node-b', label: 'Node B Label', memo: 'Node B Memo' };

      const { rerender } = render(
        <MindMapNoteEditor
          node={nodeA}
          allNodes={[nodeA, nodeB]}
          allEdges={[]}
          onClose={jest.fn()}
          onSelectNode={jest.fn()}
          onUpdateTitle={onUpdateTitle}
          onUpdateMemo={onUpdateMemo}
          onUpdateColor={jest.fn()}
          onAddChildNode={jest.fn()}
          onDeleteNode={jest.fn()}
          onConnectNode={jest.fn()}
          onDisconnectNode={jest.fn()}
        />
      );

      const titleInput = screen.getByDisplayValue('Node A Label');
      fireEvent.change(titleInput, { target: { value: 'Node A Modified Draft' } });

      // Before timer expires, switch node prop to nodeB
      rerender(
        <MindMapNoteEditor
          node={nodeB}
          allNodes={[nodeA, nodeB]}
          allEdges={[]}
          onClose={jest.fn()}
          onSelectNode={jest.fn()}
          onUpdateTitle={onUpdateTitle}
          onUpdateMemo={onUpdateMemo}
          onUpdateColor={jest.fn()}
          onAddChildNode={jest.fn()}
          onDeleteNode={jest.fn()}
          onConnectNode={jest.fn()}
          onDisconnectNode={jest.fn()}
        />
      );

      // Pending title edit must be flushed to node-a, NOT node-b!
      expect(onUpdateTitle).toHaveBeenCalledWith('node-a', 'Node A Modified Draft');
      expect(onUpdateTitle).not.toHaveBeenCalledWith('node-b', expect.anything());

      // Editor should now display nodeB's label
      expect(screen.getByDisplayValue('Node B Label')).toBeInTheDocument();

      jest.useRealTimers();
    });
  });
});
