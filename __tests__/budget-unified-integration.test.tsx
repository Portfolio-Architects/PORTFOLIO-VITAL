import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { SimulationSettleModal } from '@/components/budget/ui/SimulationSettleModal';
import { SimulationInputModal } from '@/components/budget/ui/SimulationInputModal';
import {
  BudgetCategory,
  BudgetEntry,
  SimulationEntry,
  ProjectSimulationSummary,
  StatItemSimulationSummary,
} from '@/types';
import { CategoryStats } from '@/hooks/useBudget';
import { UseBudgetSimulatorReturn } from '@/hooks/useBudgetSimulator';

// Synchronously resolve next/dynamic for deterministic modal & chart testing
jest.mock('next/dynamic', () => {
  return (loader: any) => {
    const fnStr = loader.toString();
    if (fnStr.includes('SimulationBurnUpChart')) {
      return function MockBurnUpChart() {
        return <div data-testid="unified-burnup-chart">Mock BurnUp Chart</div>;
      };
    }
    if (fnStr.includes('SimulationResultTable')) {
      return function MockResultTable(props: any) {
        return (
          <div data-testid="unified-result-table">
            <span>예정 항목 {props.entries?.length ?? 0}건</span>
            <button type="button" onClick={() => props.onSettleEntry?.(props.entries?.[0]?.id)}>
              표에서 정산 전환
            </button>
            <button type="button" onClick={() => props.onDeleteEntry?.(props.entries?.[0]?.id)}>
              표에서 예정 삭제
            </button>
          </div>
        );
      };
    }
    if (fnStr.includes('SimulationInputModal')) {
      const { SimulationInputModal: RealInputModal } = jest.requireActual(
        '@/components/budget/ui/SimulationInputModal'
      );
      return RealInputModal;
    }
    if (fnStr.includes('SimulationSettleModal')) {
      const { SimulationSettleModal: RealSettleModal } = jest.requireActual(
        '@/components/budget/ui/SimulationSettleModal'
      );
      return RealSettleModal;
    }
    return function MockDynamicModal() {
      return <div data-testid="mock-dynamic-modal" />;
    };
  };
});

describe('Unified Budget Control Board Integration & Data-Loss Safeguards', () => {
  const categories: BudgetCategory[] = [
    {
      id: 'cat-1',
      name: '사무관리비',
      policyProject: '지역사회 통합건강증진',
      unitProject: '건강생활실천',
      detailedProject: '건강증진지원실 운영',
      statItem: '201-01 사무관리비',
      formationItem: '사무관리비',
      totalBudget: 20000000,
      color: '#4f46e5',
      sortOrder: 0,
    },
  ];

  const entries: BudgetEntry[] = [
    {
      id: 'be-1',
      categoryId: 'cat-1',
      amount: 4000000,
      date: '2026-04-10',
      purpose: '사무용품 1차 구매',
      actionType: 'general',
      isPlanned: false,
      isSettled: true,
    },
    {
      id: 'be-2',
      categoryId: 'cat-1',
      amount: 4000000,
      date: '2026-04-15',
      purpose: '일상경비 교부',
      actionType: 'issuance',
      isPlanned: false,
      isSettled: true,
    },
    {
      id: 'be-3',
      categoryId: 'cat-1',
      amount: 1500000,
      date: '2026-04-20',
      purpose: '현장 소모품 집행',
      actionType: 'daily_expense',
      isPlanned: false,
      isSettled: true,
    },
  ];

  // Pure actuals: spent=8,000,000 (4M general + 4M issuance), generalRem=12,000,000, dailyRem=2,500,000
  // Planned: sim-1 general 2,000,000 + sim-2 daily_expense 500,000 = 2,500,000
  // Expected after planned: finalExpectedBalance=10,000,000, finalDailyRemaining=2,000,000, totalAvailable=12,000,000
  const simEntries: SimulationEntry[] = [
    {
      id: 'sim-1',
      categoryId: 'cat-1',
      detailedProject: '건강증진지원실 운영',
      statItem: '201-01 사무관리비',
      name: '리플릿 2차 인쇄 예정',
      unitPrice: 1000000,
      quantity: 2,
      amount: 2000000,
      memo: '하반기 캠페인 배포용',
      actionType: 'general',
      status: 'PLANNED',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'sim-2',
      categoryId: 'cat-1',
      detailedProject: '건강증진지원실 운영',
      statItem: '201-01 사무관리비',
      name: '행사 다과 구입 예정',
      unitPrice: 5000,
      quantity: 100,
      amount: 500000,
      actionType: 'daily_expense',
      status: 'PLANNED',
      createdAt: '2026-10-02T00:00:00.000Z',
    },
  ];

  const statItemSummaries: StatItemSimulationSummary[] = [
    {
      detailedProject: '건강증진지원실 운영',
      statItem: '201-01 사무관리비',
      totalBudget: 20000000,
      currentSpent: 8000000,
      currentRemaining: 12000000,
      simulatedExpenditure: 2500000,
      simulatedGeneralExpenditure: 2000000,
      simulatedDailyExpenditure: 500000,
      finalExpectedBalance: 10000000,
      finalDailyExpenseRemaining: 2000000,
      dailyExpenseShortfall: 0,
      needsAdditionalIssuance: false,
      isDeficit: false,
      dailyExpenseIssued: 4000000,
      dailyExpenseSpent: 1500000,
      dailyExpenseRemaining: 2500000,
    },
  ];

  const projectSummaries: ProjectSimulationSummary[] = [
    {
      detailedProject: '건강증진지원실 운영',
      totalBudget: 20000000,
      currentSpent: 8000000,
      currentRemaining: 12000000,
      simulatedExpenditure: 2500000,
      simulatedGeneralExpenditure: 2000000,
      simulatedDailyExpenditure: 500000,
      finalExpectedBalance: 10000000,
      finalDailyExpenseRemaining: 2000000,
      dailyExpenseShortfall: 0,
      needsAdditionalIssuance: false,
      isDeficit: false,
      executionRate: 52.5,
      dailyExpenseIssued: 4000000,
      dailyExpenseSpent: 1500000,
      dailyExpenseRemaining: 2500000,
    },
  ];

  const getCategoryStats = jest.fn((_id: string, excludePlanned?: boolean): CategoryStats => {
    if (excludePlanned) {
      return {
        totalBudget: 20000000,
        spent: 8000000,
        planned: 0,
        locked: 0,
        remaining: 12000000,
        usageRate: 40,
        generalSpent: 4000000,
        dailyExpenseIssued: 4000000,
        dailyExpenseSpent: 1500000,
        dailyExpenseRemaining: 2500000,
      };
    }
    return {
      totalBudget: 20000000,
      spent: 8000000,
      planned: 2000000,
      locked: 0,
      remaining: 10000000,
      usageRate: 50,
      generalSpent: 4000000,
      dailyExpenseIssued: 4000000,
      dailyExpenseSpent: 1500000,
      dailyExpensePlanned: 500000,
      dailyExpenseRemaining: 2000000,
    };
  });

  function createMockSimHook(overrides: Partial<UseBudgetSimulatorReturn> = {}): UseBudgetSimulatorReturn {
    return {
      categories,
      budgetEntries: entries,
      entries: simEntries,
      isLoading: false,
      selectedDetailedProject: '',
      selectedStatItem: '',
      availableDetailedProjects: ['건강증진지원실 운영'],
      availableStatItems: ['201-01 사무관리비'],
      getDetailedProjects: () => ['건강증진지원실 운영'],
      getStatItemsForProject: () => ['201-01 사무관리비'],
      setSelectedDetailedProject: jest.fn(),
      setSelectedStatItem: jest.fn(),
      addEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      resetEntries: jest.fn(),
      loadTestPreset: jest.fn(),
      loadFestivalPreset: jest.fn(),
      settleEntry: jest.fn().mockResolvedValue(undefined),
      projectSummaries,
      statItemSummaries,
      resolveCategoryId: () => 'cat-1',
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('displays unified dual-pipeline KPI figures without double-deducting general or daily planned amounts', () => {
    const simHook = createMockSimHook();

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    expect(screen.getByText('예산 현황')).toBeInTheDocument();
    expect(screen.getByText('전 사업 잔액 안전')).toBeInTheDocument();

    // Card 1: actual execution 40.0%, projected general execution (20M - 10M)/20M = 50.0%
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    expect(screen.getByText(/예정 50\.0%/)).toBeInTheDocument();

    // Card 2: General final expected balance 10,000,000 + actual remaining 12,000,000 + planned -2,000,000
    expect(screen.getAllByText('10,000,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('실잔여 12,000,000원')).toBeInTheDocument();
    expect(screen.getByText('예정 -2,000,000원')).toBeInTheDocument();

    // Card 3: Daily expense planned deduction (-500,000원 -> 2,000,000원)
    expect(screen.getByText('-500,000원')).toBeInTheDocument();
    expect(screen.getByText('2,000,000원')).toBeInTheDocument();

    // Card 4: Final total available = 10,000,000 + 2,000,000 = 12,000,000원 (60.0%)
    // Actual available before planned = 12,000,000 + 2,500,000 = 14,500,000원; planned 2건 (-2,500,000원)
    expect(screen.getByText('12,000,000')).toBeInTheDocument();
    expect(screen.getByText('현재 실가용 14,500,000원')).toBeInTheDocument();
    expect(screen.getByText('예정 2건 (-2,500,000원)')).toBeInTheDocument();
    expect(screen.getByText('본청 e-호조: 10,000,000원')).toBeInTheDocument();
    expect(screen.getByText('일상 통장: 2,000,000원')).toBeInTheDocument();
  });

  it('surfaces inline planned entries inside PolicyGroupCard & BudgetCategoryCardItem and triggers settle/edit/delete', async () => {
    const settleEntry = jest.fn().mockResolvedValue(undefined);
    const deleteEntry = jest.fn();
    const simHook = createMockSimHook({ settleEntry, deleteEntry });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    // Policy badge displays planned count & sum
    expect(screen.getByText('지출 예정 2건 · 2,500,000원')).toBeInTheDocument();

    // Expand policy card & category card
    fireEvent.click(screen.getByText('지역사회 통합건강증진'));
    expect(screen.getByText('예정 2건 · 2,500,000원')).toBeInTheDocument();

    fireEvent.click(screen.getByText('[사무관리비]'));
    expect(screen.getByText('지출 예정 (시뮬레이션)')).toBeInTheDocument();
    expect(screen.getByText('리플릿 2차 인쇄 예정')).toBeInTheDocument();
    expect(screen.getByText('행사 다과 구입 예정')).toBeInTheDocument();

    // Click '실지출 전환' on first planned entry -> opens SimulationSettleModal
    const settleButtons = screen.getAllByRole('button', { name: /실지출 전환/ });
    fireEvent.click(settleButtons[0]);

    expect(screen.getByText('실제 지출 정산')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /실지출 집행 완료/ }));

    await waitFor(() => {
      expect(settleEntry).toHaveBeenCalledWith('sim-1', 2000000, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    });

    // Delete second planned item with confirm guard
    const deleteButtons = screen.getAllByTitle('예정 항목 삭제');
    fireEvent.click(deleteButtons[1]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteEntry).toHaveBeenCalledWith('sim-2');

    confirmSpy.mockRestore();
  });

  it('toggles Burn-Up chart, switches between Categories and Plan sub-views, and opens Risk Chip prefill modal', () => {
    const addEntry = jest.fn();
    const simHook = createMockSimHook({ addEntry });

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    // Burn-up chart starts collapsed
    expect(screen.queryByTestId('unified-burnup-chart')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /소진 차트/ }));
    expect(screen.getByTestId('unified-burnup-chart')).toBeInTheDocument();

    // Risk chip (executionRate 52.5% < 70%) opens SimulationInputModal in creation mode
    const riskChip = screen.getByRole('button', { name: /건강증진지원실 운영.*52\.5%/ });
    fireEvent.click(riskChip);
    expect(screen.getByText('지출 예정 내역 등록')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /항목 추가/ }));
    expect(addEntry).toHaveBeenCalledTimes(1);

    // Switch to '예정 · 소진 표' sub-view
    fireEvent.click(screen.getByRole('button', { name: /예정 · 소진 표/ }));
    expect(screen.getByTestId('unified-result-table')).toBeInTheDocument();
    expect(screen.getByText('예정 항목 2건')).toBeInTheDocument();
  });

  it('protects destructive preset/reset actions in SimulationInputModal with confirm dialog and guards SimulationSettleModal against double-submit', async () => {
    const onResetAll = jest.fn();
    const onLoadTestPreset = jest.fn();
    const onClose = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <SimulationInputModal
        isOpen={true}
        onClose={onClose}
        detailedProjects={['건강증진지원실 운영']}
        getStatItemsForProject={() => ['201-01 사무관리비']}
        statItemSummaries={statItemSummaries}
        editingEntry={null}
        onAddEntry={jest.fn()}
        onUpdateEntry={jest.fn()}
        onResetAll={onResetAll}
        onLoadTestPreset={onLoadTestPreset}
      />
    );

    // Destructive actions hidden until '보조 도구' expanded
    expect(screen.queryByRole('button', { name: /예정 전체 초기화/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /보조 도구/ }));

    // Clicking reset/preset while confirm returns false must NOT wipe data
    fireEvent.click(screen.getByRole('button', { name: /예정 전체 초기화/ }));
    fireEvent.click(screen.getByRole('button', { name: /프리셋 로드/ }));
    expect(onResetAll).not.toHaveBeenCalled();
    expect(onLoadTestPreset).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /예정 전체 초기화/ }));
    expect(onResetAll).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();

    // Test SimulationSettleModal double-submit protection
    let resolveConfirm!: () => void;
    const slowConfirm = jest.fn(
      () => new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      })
    );

    render(
      <SimulationSettleModal
        item={simEntries[0]}
        onClose={jest.fn()}
        onConfirm={slowConfirm}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /실지출 집행 완료/ });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(slowConfirm).toHaveBeenCalledTimes(1);

    resolveConfirm();
    await waitFor(() => {
      expect(slowConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('displays deficit warning and daily expense additional issuance shortfall badge when planned amounts exceed limits', () => {
    const deficitStatSummaries: StatItemSimulationSummary[] = [
      {
        ...statItemSummaries[0],
        simulatedExpenditure: 16000000,
        simulatedGeneralExpenditure: 13000000,
        simulatedDailyExpenditure: 3000000,
        dailyExpenseShortfall: 500000,
        needsAdditionalIssuance: true,
        finalDailyExpenseRemaining: 0,
        finalExpectedBalance: -1500000,
        isDeficit: true,
      },
    ];
    const deficitProjectSummaries: ProjectSimulationSummary[] = [
      {
        ...projectSummaries[0],
        simulatedExpenditure: 16000000,
        finalExpectedBalance: -1500000,
        dailyExpenseShortfall: 500000,
        needsAdditionalIssuance: true,
        finalDailyExpenseRemaining: 0,
        isDeficit: true,
        executionRate: 120,
      },
    ];

    const simHook = createMockSimHook({
      statItemSummaries: deficitStatSummaries,
      projectSummaries: deficitProjectSummaries,
    });

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    expect(screen.getByText('1개 사업 초과 경고')).toBeInTheDocument();
    expect(screen.getByText('추가교부 +500,000원')).toBeInTheDocument();
    expect(screen.getByText('예정 -13,500,000원')).toBeInTheDocument();
    expect(screen.getAllByText('-1,500,000').length).toBeGreaterThanOrEqual(2);
  });

  it('re-applies simulator focus on repeated focusSeq navigation even after manual sub-view & chart toggles', () => {
    const simHook = createMockSimHook();

    const { rerender } = render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
        initialSubView="plan"
        initialShowBurnUp={true}
        focusSeq={1}
      />
    );

    expect(screen.getByTestId('unified-result-table')).toBeInTheDocument();
    expect(screen.getByTestId('unified-burnup-chart')).toBeInTheDocument();

    // User manually returns to categories and collapses burn-up chart
    fireEvent.click(screen.getByRole('button', { name: /과목별 대조/ }));
    fireEvent.click(screen.getByRole('button', { name: /소진 차트/ }));
    expect(screen.queryByTestId('unified-result-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unified-burnup-chart')).not.toBeInTheDocument();

    // User re-triggers Ctrl+K -> simulator shortcut (same initialSubView/initialShowBurnUp, incremented focusSeq)
    rerender(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
        initialSubView="plan"
        initialShowBurnUp={true}
        focusSeq={2}
      />
    );

    expect(screen.getByTestId('unified-result-table')).toBeInTheDocument();
    expect(screen.getByTestId('unified-burnup-chart')).toBeInTheDocument();
  });

  it('guards planned deletion inside SimulationResultTable with window.confirm and keeps SimulationSettleModal open when aborted', async () => {
    const deleteEntry = jest.fn();
    const settleEntry = jest.fn().mockResolvedValue(false);
    const simHook = createMockSimHook({ deleteEntry, settleEntry });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
        initialSubView="plan"
      />
    );

    // 1. Delete from table when confirm returns false -> must NOT delete
    fireEvent.click(screen.getByRole('button', { name: '표에서 예정 삭제' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteEntry).not.toHaveBeenCalled();

    // 2. Delete from table when confirm returns true -> deletes once
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '표에서 예정 삭제' }));
    expect(deleteEntry).toHaveBeenCalledWith('sim-1');
    confirmSpy.mockRestore();

    // 3. Aborted settlement (returns false from checkLimit failure) must keep settle modal open
    fireEvent.click(screen.getByRole('button', { name: '표에서 정산 전환' }));
    expect(screen.getByText('실제 지출 정산')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /실지출 집행 완료/ }));
    await waitFor(() => {
      expect(settleEntry).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('실제 지출 정산')).toBeInTheDocument();
  });

  it('keeps filter scope consistent between KPIs and 예정·소진 표 with an active-filter reset banner', async () => {
    const secondCat: BudgetCategory = {
      id: 'cat-2',
      name: '국내여비',
      policyProject: '감염병 예방관리',
      unitProject: '방역관리',
      detailedProject: '방역현장 점검',
      statItem: '202-01 국내여비',
      formationItem: '여비',
      totalBudget: 10000000,
      color: '#10b981',
      sortOrder: 1,
    };
    const thirdSim: SimulationEntry = {
      id: 'sim-3',
      categoryId: 'cat-2',
      detailedProject: '방역현장 점검',
      statItem: '202-01 국내여비',
      name: '현장 점검 여비',
      unitPrice: 100000,
      quantity: 3,
      amount: 300000,
      actionType: 'general',
      status: 'PLANNED',
      createdAt: '2026-10-03T00:00:00.000Z',
    };
    const twoStatSummaries: StatItemSimulationSummary[] = [
      ...statItemSummaries,
      {
        detailedProject: '방역현장 점검',
        statItem: '202-01 국내여비',
        totalBudget: 10000000,
        currentSpent: 2000000,
        currentRemaining: 8000000,
        simulatedExpenditure: 300000,
        simulatedGeneralExpenditure: 300000,
        simulatedDailyExpenditure: 0,
        finalExpectedBalance: 7700000,
        finalDailyExpenseRemaining: 0,
        dailyExpenseShortfall: 0,
        needsAdditionalIssuance: false,
        isDeficit: false,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      },
    ];
    const twoProjSummaries: ProjectSimulationSummary[] = [
      ...projectSummaries,
      {
        detailedProject: '방역현장 점검',
        totalBudget: 10000000,
        currentSpent: 2000000,
        currentRemaining: 8000000,
        simulatedExpenditure: 300000,
        simulatedGeneralExpenditure: 300000,
        simulatedDailyExpenditure: 0,
        finalExpectedBalance: 7700000,
        finalDailyExpenseRemaining: 0,
        dailyExpenseShortfall: 0,
        needsAdditionalIssuance: false,
        isDeficit: false,
        executionRate: 23,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
      },
    ];
    const simHook = createMockSimHook({
      categories: [...categories, secondCat],
      entries: [...simEntries, thirdSim],
      statItemSummaries: twoStatSummaries,
      projectSummaries: twoProjSummaries,
    });

    render(
      <BudgetDashboard
        categories={[...categories, secondCat]}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    // Filter to second category only via search
    const searchInput = screen.getByPlaceholderText('사업명 · 통계목 · 산출기초 · 문서번호 검색');
    fireEvent.change(searchInput, { target: { value: '방역현장' } });

    await waitFor(() => {
      expect(screen.getByText(/1개 통계목/)).toBeInTheDocument();
    });

    // Switch to '예정 · 소진 표' -> must show filtered 1 entry + active filter banner
    fireEvent.click(screen.getByRole('button', { name: /예정 · 소진 표/ }));
    expect(screen.getByText('예정 항목 1건')).toBeInTheDocument();
    expect(screen.getByText(/필터 적용 중/)).toBeInTheDocument();

    // Reset filters directly from banner -> all 3 entries restored
    fireEvent.click(screen.getByRole('button', { name: /필터 해제/ }));
    expect(screen.getByText('예정 항목 3건')).toBeInTheDocument();
  });

  it('registers bid_saving (낙찰차액) via SimulationInputModal, deducts available balance, excludes from execution rate, and hides settle button', () => {
    const addEntry = jest.fn();
    const bidSavingEntry: SimulationEntry = {
      id: 'sim-bid-1',
      categoryId: 'cat-1',
      detailedProject: '건강증진지원실 운영',
      statItem: '201-01 사무관리비',
      name: '양재천 페스티벌 용역 낙찰차액',
      unitPrice: 498000,
      quantity: 1,
      amount: 498000,
      actionType: 'bid_saving',
      status: 'PLANNED',
      createdAt: '2026-11-19T00:00:00.000Z',
    };

    // Total budget 20,000,000 | actual spent 8,000,000 (40.0%) | general planned 2,000,000 | daily planned 500,000 | bid_saving 498,000
    // Final expected balance = 12,000,000 - 2,000,000 - 498,000 = 9,502,000
    // Projected execution rate MUST STILL BE (8M + 2M) / 20M = 50.0% (bid_saving excluded!)
    const bidStatSummaries: StatItemSimulationSummary[] = [
      {
        ...statItemSummaries[0],
        simulatedBidSaving: 498000,
        finalExpectedBalance: 9502000,
      },
    ];
    const bidProjSummaries: ProjectSimulationSummary[] = [
      {
        ...projectSummaries[0],
        simulatedBidSaving: 498000,
        finalExpectedBalance: 9502000,
      },
    ];
    const simHook = createMockSimHook({
      entries: [...simEntries, bidSavingEntry],
      statItemSummaries: bidStatSummaries,
      projectSummaries: bidProjSummaries,
      addEntry,
    });

    render(
      <BudgetDashboard
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        simHook={simHook}
      />
    );

    // 1. Projected execution rate stays 50.0% (NOT 52.5%), while 유보 2.5% is shown separately
    expect(screen.getByText(/예정 50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/유보 2\.5%/)).toBeInTheDocument();

    // 2. General balance & total available deduct 498,000원
    expect(screen.getByText('9,502,000')).toBeInTheDocument();
    expect(screen.getByText('유보 -498,000원')).toBeInTheDocument();
    expect(screen.getByText('11,502,000')).toBeInTheDocument();
    expect(screen.getByText('유보 1건 (-498,000원)')).toBeInTheDocument();

    // 3. Policy & category cards show bid_saving badge separately and do NOT render '실지출 전환' for bid_saving
    expect(screen.getByText('낙찰차액 1건 · 498,000원')).toBeInTheDocument();
    fireEvent.click(screen.getByText('지역사회 통합건강증진'));
    fireEvent.click(screen.getByText('[사무관리비]'));
    expect(screen.getByText('양재천 페스티벌 용역 낙찰차액')).toBeInTheDocument();
    expect(screen.getByText('낙찰차액 · 유보')).toBeInTheDocument();
    // 2 planned expenditure items (sim-1, sim-2) get '실지출 전환', bid_saving does NOT
    expect(screen.getAllByRole('button', { name: /실지출 전환/ })).toHaveLength(2);

    // 4. Open SimulationInputModal -> select 낙찰차액 -> submit
    fireEvent.click(screen.getByRole('button', { name: /^지출 예정$/ }));
    const bidOptionBtn = screen.getByRole('button', { name: /낙찰차액/ });
    fireEvent.click(bidOptionBtn);
    expect(screen.getByText('낙찰차액 유보액 (자동 계산)')).toBeInTheDocument();
    expect(screen.getByText('🔒 가용 차감 · 집행률 제외')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('예: 양재천 페스티벌 용역 낙찰차액'), {
      target: { value: '행사 대행 낙찰차액' },
    });
    const selects = screen.getAllByRole('combobox');
    // selects[0] = month filter in main page, selects[1] = 세부사업, selects[2] = 통계목 inside modal
    const dpSelect = selects.find((el) => el.textContent?.includes('-- 세부사업 선택 --'))!;
    fireEvent.change(dpSelect, { target: { value: '건강증진지원실 운영' } });
    const stSelect = screen.getAllByRole('combobox').find((el) => el.textContent?.includes('-- 통계목 선택 --'))!;
    fireEvent.change(stSelect, { target: { value: '201-01 사무관리비' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '498000' } });
    fireEvent.click(screen.getByRole('button', { name: /항목 추가/ }));

    expect(addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '행사 대행 낙찰차액',
        actionType: 'bid_saving',
        unitPrice: 498000,
        quantity: 1,
        amount: 498000,
      })
    );
  });
});
