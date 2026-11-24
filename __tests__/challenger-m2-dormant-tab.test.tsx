import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceView } from '@/components/WorkspaceView';
import { YangjaeFestivalDashboard } from '@/components/festival/YangjaeFestivalDashboard';
import { useYangjaeFestival, YANGJAE_FALLBACK_DATA } from '@/hooks/useYangjaeFestival';
import { BudgetCategory, BudgetEntry, InventoryItem } from '@/types';

// Mock Lucide icons with a Proxy to handle any icon component
jest.mock('lucide-react', () => {
  const DummyIcon = ({ className, ...props }: any) => (
    <span data-testid="lucide-icon" className={className} {...props} />
  );
  return new Proxy({}, {
    get: () => DummyIcon,
  });
});

// Mock next/dynamic to return stateful components for WorkspaceView
jest.mock('next/dynamic', () => {
  return (importFn: any) => {
    const fnStr = importFn.toString();
    if (fnStr.includes('BudgetDashboard')) {
      return function MockBudgetDashboard(props: any) {
        const [text, setText] = useState('');
        return (
          <div
            data-testid="mock-budget-dashboard"
            data-sub-view={props.initialSubView || 'categories'}
            data-show-burn-up={String(Boolean(props.initialShowBurnUp))}
          >
            <h3>예산 대시보드 컴포넌트</h3>
            <input
              data-testid="budget-stateful-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예산 메모 입력"
            />
          </div>
        );
      };
    }
    if (fnStr.includes('InventoryList')) {
      return function MockInventoryList() {
        const [text, setText] = useState('');
        return (
          <div data-testid="mock-inventory-list">
            <h3>재고 목록 컴포넌트</h3>
            <input
              data-testid="inventory-stateful-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="재고 메모 입력"
            />
          </div>
        );
      };
    }
    if (fnStr.includes('BudgetSimulator')) {
      return function MockBudgetSimulator() {
        const [text, setText] = useState('');
        return (
          <div data-testid="mock-budget-simulator">
            <h3>예산 시뮬레이터 컴포넌트</h3>
            <input
              data-testid="simulator-stateful-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="시뮬레이터 메모 입력"
            />
          </div>
        );
      };
    }
    return function MockGeneric() {
      return <div data-testid="mock-generic" />;
    };
  };
});

// Mock fetch globally for festival data
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('Milestone M2 Empirical Challenger: Dormant Tab & Zombie Polling Defense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => YANGJAE_FALLBACK_DATA,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
  });

  describe('1. WorkspaceView Dormant Sub-Tab Architecture & State Preservation', () => {
    const mockCategories: BudgetCategory[] = [
      { id: 'cat-1', name: '보건소 운영비', allocatedAmount: 50000000, description: '운영비' } as any,
    ];
    const mockEntries: BudgetEntry[] = [];
    const mockInventoryItems: InventoryItem[] = [
      { id: 'item-1', name: '마스크', category: '방역물품', currentStock: 100, unit: '개', budgetEntryIds: [], createdAt: '', updatedAt: '' },
    ];

    const defaultProps = {
      budgetCategories: mockCategories,
      budgetEntries: mockEntries,
      addCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      replaceCategories: jest.fn(),
      addEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      getCategoryStats: jest.fn().mockReturnValue(null),
      overallStats: {
        totalBudget: 50000000,
        totalSpent: 0,
        totalPlanned: 0,
        remaining: 50000000,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      },
      inventoryItems: mockInventoryItems,
      addItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      adjustStock: jest.fn(),
      getItemHistory: jest.fn().mockReturnValue([]),
    };

    it('mounts only single unified BudgetDashboard without duplicate BudgetSimulator or InventoryList instances', () => {
      render(<WorkspaceView {...defaultProps} />);

      const budget = screen.getByTestId('mock-budget-dashboard');
      expect(budget).toBeInTheDocument();
      expect(budget).toHaveAttribute('data-sub-view', 'categories');
      expect(budget).toHaveAttribute('data-show-burn-up', 'false');

      // Duplicate legacy tab components are not mounted
      expect(screen.queryByTestId('mock-inventory-list')).toBeNull();
      expect(screen.queryByTestId('mock-budget-simulator')).toBeNull();
    });

    it('preserves mounted BudgetDashboard instance and draft state when initialTab switches between budget and simulator', () => {
      const { rerender } = render(<WorkspaceView {...defaultProps} initialTab="budget" />);

      // Step A: Enter draft text in unified BudgetDashboard
      const budgetInput = screen.getByTestId('budget-stateful-input');
      fireEvent.change(budgetInput, { target: { value: '2026년 방역 예산 신규 배정안' } });
      expect(budgetInput).toHaveValue('2026년 방역 예산 신규 배정안');

      // Step B: Switch initialTab to simulator -> forwards initialSubView="plan" without remounting
      rerender(<WorkspaceView {...defaultProps} initialTab="simulator" />);

      const budgetEl = screen.getByTestId('mock-budget-dashboard');
      expect(budgetEl).toHaveAttribute('data-sub-view', 'plan');
      expect(budgetEl).toHaveAttribute('data-show-burn-up', 'true');
      expect(screen.queryByTestId('mock-budget-simulator')).toBeNull();

      // Crucial: Draft input inside BudgetDashboard retains its state across mode switch!
      expect(screen.getByTestId('budget-stateful-input')).toHaveValue('2026년 방역 예산 신규 배정안');

      // Step C: Switch back to budget
      rerender(<WorkspaceView {...defaultProps} initialTab="budget" />);
      expect(budgetEl).toHaveAttribute('data-sub-view', 'categories');
      expect(screen.getByTestId('budget-stateful-input')).toHaveValue('2026년 방역 예산 신규 배정안');
    });

    it('stress test: withstands 15 rapid consecutive initialTab transitions without DOM node duplication or state loss', () => {
      const { rerender } = render(<WorkspaceView {...defaultProps} initialTab="budget" />);

      fireEvent.change(screen.getByTestId('budget-stateful-input'), { target: { value: '안전성 스트레스 테스트' } });

      // Rapidly toggle initialTab 15 times
      for (let i = 0; i < 15; i++) {
        rerender(<WorkspaceView {...defaultProps} initialTab={i % 2 === 0 ? 'simulator' : 'budget'} />);
      }

      // Check DOM integrity: exactly 1 unified BudgetDashboard and 0 duplicate BudgetSimulator instances
      expect(screen.getAllByTestId('mock-budget-dashboard')).toHaveLength(1);
      expect(screen.queryByTestId('mock-budget-simulator')).toBeNull();

      // Verify state was never reset
      expect(screen.getByTestId('budget-stateful-input')).toHaveValue('안전성 스트레스 테스트');
    });
  });

  describe('2. YangjaeFestivalDashboard Sub-Tab Dormant Strategy & Accordion/Draft Retention', () => {
    it('preserves expanded accordion state and draft inputs when switching between milestones and booths tabs', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <YangjaeFestivalDashboard isActive={true} />
        </QueryClientProvider>
      );

      // Step A: Switch from default Tab 1 ("1. 히스토리·체크리스트") to Tab 2 ("2. 추진과제")
      const milestonesTabBtn = screen.getByRole('button', { name: /2\.\s*추진과제/i });
      const boothsTabBtn = screen.getByRole('button', { name: /3\.\s*부스현황/i });
      expect(milestonesTabBtn).toBeInTheDocument();
      expect(boothsTabBtn).toBeInTheDocument();
      fireEvent.click(milestonesTabBtn);

      // Expand all task accordions
      const toggleAllBtn = screen.getByRole('button', { name: /전체 펼치기/i });
      fireEvent.click(toggleAllBtn);

      // Verify accordions expanded ("전체 접기" now visible)
      expect(screen.getByRole('button', { name: /전체 접기/i })).toBeInTheDocument();

      // Find the milestone card edit button to activate draft editing state
      const editButtons = screen.getAllByTitle('과제 수정');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      // Verify edit mode is active for milestone 1 (title input with placeholder="추진과제 제목")
      const titleInput = screen.getByPlaceholderText('추진과제 제목');
      expect(titleInput).toBeInTheDocument();

      // Modify the milestone task title in draft edit mode
      fireEvent.change(titleInput, { target: { value: '긴급 현장 점검 및 안전 통제 계획' } });
      expect(titleInput).toHaveValue('긴급 현장 점검 및 안전 통제 계획');

      // Step B: Switch to Booths tab
      fireEvent.click(boothsTabBtn);

      // Booth status header should now be visible in DOM
      expect(screen.getByText(/부스 배치 계획/i)).toBeInTheDocument();

      // Step C: Crucial verification - Milestones container is hidden, NOT unmounted!
      // The draft input is STILL in the document with the modified value!
      expect(screen.getByPlaceholderText('추진과제 제목')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue('긴급 현장 점검 및 안전 통제 계획');

      // Step D: Switch back to Milestones tab
      fireEvent.click(milestonesTabBtn);

      // Accordion is STILL expanded ("전체 접기" still active)
      expect(screen.getByRole('button', { name: /전체 접기/i })).toBeInTheDocument();

      // Draft input retains the uncommitted text!
      expect(screen.getByPlaceholderText('추진과제 제목')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('추진과제 제목')).toHaveValue('긴급 현장 점검 및 안전 통제 계획');
    });
  });

  describe('3. Zombie Polling Suppression (isActive Flag & Network Pausing)', () => {
    it('sets refetchInterval to 2500 when isActive is true, and completely disables it (false) when isActive is false', () => {
      const activeQueryClient = createTestQueryClient();
      const activeWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={activeQueryClient}>{children}</QueryClientProvider>
      );

      const { result: activeResult } = renderHook(() => useYangjaeFestival(true), { wrapper: activeWrapper });
      const activeQuery = activeQueryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect(activeQuery).toBeDefined();
      const activeOpts = activeQuery?.options as Record<string, any>;
      expect(activeOpts.refetchInterval).toBe(2500);
      expect(activeOpts.refetchOnWindowFocus).toBe(true);
      expect(activeOpts.refetchIntervalInBackground).toBe(false);

      // Now test with isActive = false
      const dormantQueryClient = createTestQueryClient();
      const dormantWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={dormantQueryClient}>{children}</QueryClientProvider>
      );

      const { result: dormantResult } = renderHook(() => useYangjaeFestival(false), { wrapper: dormantWrapper });
      const dormantQuery = dormantQueryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect(dormantQuery).toBeDefined();
      const dormantOpts = dormantQuery?.options as Record<string, any>;
      expect(dormantOpts.refetchInterval).toBe(false);
      expect(dormantOpts.refetchOnWindowFocus).toBe(false);
      expect(dormantOpts.refetchIntervalInBackground).toBe(false);
    });

    it('dynamically halts and resumes polling interval when isActive transitions true -> false -> true', () => {
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { rerender } = renderHook(
        ({ active }: { active: boolean }) => useYangjaeFestival(active),
        { initialProps: { active: true }, wrapper }
      );

      let query = queryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect((query?.options as Record<string, any>).refetchInterval).toBe(2500);
      expect((query?.options as Record<string, any>).refetchOnWindowFocus).toBe(true);

      // Transition to inactive (e.g. user navigated to another top-level tab)
      rerender({ active: false });

      query = queryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect((query?.options as Record<string, any>).refetchInterval).toBe(false);
      expect((query?.options as Record<string, any>).refetchOnWindowFocus).toBe(false);

      // Transition back to active (e.g. user returned to Festival tab)
      rerender({ active: true });

      query = queryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect((query?.options as Record<string, any>).refetchInterval).toBe(2500);
      expect((query?.options as Record<string, any>).refetchOnWindowFocus).toBe(true);
    });

    it('passes isActive={false} down to useYangjaeFestival when YangjaeFestivalDashboard is rendered with isActive={false}', () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <YangjaeFestivalDashboard isActive={false} />
        </QueryClientProvider>
      );

      const query = queryClient.getQueryCache().find({ queryKey: ['festival', 'yangjae'] });
      expect(query).toBeDefined();
      const options = query?.options as Record<string, any>;
      expect(options.refetchInterval).toBe(false);
      expect(options.refetchOnWindowFocus).toBe(false);
    });
  });
});
