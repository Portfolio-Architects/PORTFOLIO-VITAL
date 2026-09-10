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
          <div data-testid="mock-budget-dashboard">
            <h3>예산 대시보드 컴포넌트</h3>
            <input
              data-testid="budget-stateful-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예산 메모 입력"
            />
            <button data-testid="goto-simulator-btn" onClick={props.onNavigateToSimulator}>
              시뮬레이터로 이동
            </button>
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

    it('mounts only initial active tab initially, keeping unvisited tabs unmounted', () => {
      render(<WorkspaceView {...defaultProps} />);

      const budget = screen.getByTestId('mock-budget-dashboard');
      expect(budget).toBeInTheDocument();
      expect(budget.parentElement).toHaveClass('block');

      // Unvisited tabs are not in the DOM yet
      expect(screen.queryByTestId('mock-inventory-list')).toBeNull();
      expect(screen.queryByTestId('mock-budget-simulator')).toBeNull();
    });

    it('preserves mounted DOM instances and state when switching between budget, inventory, and simulator', () => {
      render(<WorkspaceView {...defaultProps} />);

      // Step A: Enter draft text in Budget tab
      const budgetInput = screen.getByTestId('budget-stateful-input');
      fireEvent.change(budgetInput, { target: { value: '2026년 방역 예산 신규 배정안' } });
      expect(budgetInput).toHaveValue('2026년 방역 예산 신규 배정안');

      // Step B: Switch to Inventory tab ("홍보물 관리")
      const inventoryTabBtn = screen.getByRole('button', { name: /홍보물 관리/i });
      fireEvent.click(inventoryTabBtn);

      // Verify DOM: Budget container is hidden, Inventory container is block
      const budgetEl = screen.getByTestId('mock-budget-dashboard');
      const inventoryEl = screen.getByTestId('mock-inventory-list');
      expect(budgetEl.parentElement).toHaveClass('hidden');
      expect(inventoryEl.parentElement).toHaveClass('block');

      // Crucial: Budget input is STILL in the document and retains its state!
      expect(screen.getByTestId('budget-stateful-input')).toHaveValue('2026년 방역 예산 신규 배정안');

      // Step C: Enter draft text in Inventory tab
      const inventoryInput = screen.getByTestId('inventory-stateful-input');
      fireEvent.change(inventoryInput, { target: { value: '비축 마스크 10,000개 검수 완료' } });
      expect(inventoryInput).toHaveValue('비축 마스크 10,000개 검수 완료');

      // Step D: Switch to Simulator tab ("예산 시뮬레이터")
      const simulatorTabBtn = screen.getByRole('button', { name: /예산 시뮬레이터/i });
      fireEvent.click(simulatorTabBtn);

      const simulatorEl = screen.getByTestId('mock-budget-simulator');
      expect(budgetEl.parentElement).toHaveClass('hidden');
      expect(inventoryEl.parentElement).toHaveClass('hidden');
      expect(simulatorEl.parentElement).toHaveClass('block');

      // All 3 components are mounted in the DOM simultaneously
      expect(screen.getByTestId('mock-budget-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('mock-inventory-list')).toBeInTheDocument();
      expect(screen.getByTestId('mock-budget-simulator')).toBeInTheDocument();

      // Enter state in Simulator tab
      const simulatorInput = screen.getByTestId('simulator-stateful-input');
      fireEvent.change(simulatorInput, { target: { value: '시뮬레이션 시나리오 A 검토' } });

      // Step E: Switch back to Budget tab ("예산 대조보드")
      const budgetTabBtn = screen.getByRole('button', { name: /예산 대조보드/i });
      fireEvent.click(budgetTabBtn);

      expect(budgetEl.parentElement).toHaveClass('block');
      expect(inventoryEl.parentElement).toHaveClass('hidden');
      expect(simulatorEl.parentElement).toHaveClass('hidden');

      // Verify all 3 stateful values are fully intact
      expect(screen.getByTestId('budget-stateful-input')).toHaveValue('2026년 방역 예산 신규 배정안');
      expect(screen.getByTestId('inventory-stateful-input')).toHaveValue('비축 마스크 10,000개 검수 완료');
      expect(screen.getByTestId('simulator-stateful-input')).toHaveValue('시뮬레이션 시나리오 A 검토');
    });

    it('stress test: withstands 15 rapid consecutive tab switches without DOM node duplication or state loss', () => {
      render(<WorkspaceView {...defaultProps} />);

      fireEvent.change(screen.getByTestId('budget-stateful-input'), { target: { value: '안전성 스트레스 테스트' } });

      const tabs = [
        screen.getByRole('button', { name: /홍보물 관리/i }),
        screen.getByRole('button', { name: /예산 시뮬레이터/i }),
        screen.getByRole('button', { name: /예산 대조보드/i }),
      ];

      // Rapidly toggle tabs 15 times
      for (let i = 0; i < 15; i++) {
        fireEvent.click(tabs[i % 3]);
      }

      // Check DOM integrity: exactly 1 instance of each mounted component
      expect(screen.getAllByTestId('mock-budget-dashboard')).toHaveLength(1);
      expect(screen.getAllByTestId('mock-inventory-list')).toHaveLength(1);
      expect(screen.getAllByTestId('mock-budget-simulator')).toHaveLength(1);

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

      // Step A: Initially on milestones tab (Tab labels: "1. 추진과제", "2. 부스현황")
      const milestonesTabBtn = screen.getByRole('button', { name: /1\.\s*추진과제/i });
      const boothsTabBtn = screen.getByRole('button', { name: /2\.\s*부스현황/i });
      expect(milestonesTabBtn).toBeInTheDocument();
      expect(boothsTabBtn).toBeInTheDocument();

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
