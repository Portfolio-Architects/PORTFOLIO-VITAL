import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceView } from '@/components/WorkspaceView';
import { PortfolioDashboardViewSkeleton } from '@/components/skeletons/PortfolioDashboardViewSkeleton';
import { YangjaeFestivalSkeleton } from '@/components/skeletons/YangjaeFestivalSkeleton';
import { useYangjaeFestival } from '@/hooks/useYangjaeFestival';
import { useQuery } from '@tanstack/react-query';
import { SegmentedTabs, Badge, NumericText, KpiStatCard, Modal } from '@/components/ui';

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

      // Switch to Simulator tab
      const simulatorBtn = screen.getByRole('button', { name: /예산 시뮬레이터/ });
      await act(async () => {
        fireEvent.click(simulatorBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('budget-simulator')).toBeInTheDocument();
      });

      expect(simulatorMountSpy).toHaveBeenCalledTimes(1);
      // Budget component MUST remain mounted (no unmount call)
      expect(budgetUnmountSpy).not.toHaveBeenCalled();
      expect(budgetEl.parentElement).toHaveClass('hidden');

      const simulatorEl = screen.getByTestId('budget-simulator');
      expect(simulatorEl.parentElement).toHaveClass('block');

      // Switch back to Budget tab
      const budgetBtn = screen.getByRole('button', { name: /예산 대조보드/ });
      await act(async () => {
        fireEvent.click(budgetBtn);
      });

      // No new mount calls, no unmounts, display toggled to block
      expect(budgetMountSpy).toHaveBeenCalledTimes(1);
      expect(budgetUnmountSpy).not.toHaveBeenCalled();
      expect(simulatorUnmountSpy).not.toHaveBeenCalled();
      expect(budgetEl.parentElement).toHaveClass('block');
      expect(simulatorEl.parentElement).toHaveClass('hidden');
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

      const simulatorBtn = screen.getByRole('button', { name: /예산 시뮬레이터/ });
      await act(async () => {
        fireEvent.click(simulatorBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('budget-simulator')).toBeInTheDocument();
      });

      // Remediation verified: activeTab successfully switches to simulator
      const budgetEl = screen.getByTestId('budget-dashboard');
      expect(budgetEl.parentElement).toHaveClass('hidden');
      const simulatorEl = screen.getByTestId('budget-simulator');
      expect(simulatorEl.parentElement).toHaveClass('block');
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
    it('renders PortfolioDashboardViewSkeleton with zero-CLS KPI placeholders', () => {
      render(<PortfolioDashboardViewSkeleton />);
      const kpiCards = screen.getAllByTestId('dashboard-skeleton-kpi-card');
      expect(kpiCards).toHaveLength(4);
      expect(screen.queryByTestId('dashboard-skeleton-contacts')).not.toBeInTheDocument();
    });

    it('renders YangjaeFestivalSkeleton with high-contrast layout and data-testid', () => {
      render(<YangjaeFestivalSkeleton />);
      const skeleton = screen.getByTestId('yangjae-festival-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('4. VLDS Localhost Design System Primitives Integrity', () => {
    it('renders SegmentedTabs with active selection, preload hover callback, and tabular badge count', () => {
      const onChange = jest.fn();
      const onPreload = jest.fn();
      const items = [
        { id: 'budget', label: '예산 대조보드', badgeCount: 12 },
        { id: 'simulator', label: '예산 시뮬레이터', badgeCount: 3 },
      ] as const;

      render(
        <SegmentedTabs
          items={items}
          activeId="budget"
          onChange={onChange}
          onPreload={onPreload}
        />
      );

      const simTab = screen.getByRole('button', { name: /예산 시뮬레이터/ });
      fireEvent.mouseEnter(simTab);
      expect(onPreload).toHaveBeenCalledWith('simulator');

      fireEvent.click(simTab);
      expect(onChange).toHaveBeenCalledWith('simulator');
    });

    it('renders NumericText, KpiStatCard, and domain Badges with tabular-nums formatting', () => {
      render(
        <div>
          <NumericText value={17339000} unit="원" />
          <KpiStatCard label="본청 가용잔액" value="7,440,600원" subLabel="달성 108.5%" />
          <Badge variant="daily">일상경비</Badge>
          <Badge variant="general">일반지출</Badge>
        </div>
      );

      expect(screen.getByText('17,339,000')).toBeInTheDocument();
      expect(screen.getByText('본청 가용잔액')).toBeInTheDocument();
      expect(screen.getByText('일상경비')).toBeInTheDocument();
      expect(screen.getByText('일반지출')).toBeInTheDocument();
    });

    it('closes VLDS Modal immediately on Escape key and cleans up body overflow', () => {
      const onClose = jest.fn();
      const { unmount } = render(
        <Modal isOpen={true} onClose={onClose} title="예산 상세 검증">
          <div>검증 본문</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
