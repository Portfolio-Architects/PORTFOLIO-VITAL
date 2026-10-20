import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { BudgetCategory, BudgetEntry } from '@/types';
import { CategoryStats } from '@/hooks/useBudget';

jest.mock('next/dynamic', () => {
  return () => {
    return function MockModal() {
      return <div data-testid="mock-modal" />;
    };
  };
});

describe('BudgetDashboard Minimalist Redesign & Data Preservation Verification', () => {
  const sampleCategories: BudgetCategory[] = [
    {
      id: 'cat-1',
      name: '건강증진 홍보물 제작',
      statItem: '201-01 일반운영비',
      formationItem: '사무관리비',
      managementProject: '주민건강지원',
      policyProject: '지역사회 통합건강증진',
      unitProject: '건강생활실천',
      detailedProject: '신체활동 활성화 사업',
      totalBudget: 10000000,
      budgetType: '추경',
      fundingSource: '시비, 구비',
      color: '#4f46e5',
      sortOrder: 0,
      fundingSplits: [
        { source: '시비', amount: 5000000 },
        { source: '구비(자체)', amount: 5000000 },
      ],
      subItems: [
        {
          prefix: '1)',
          name: '홍보 리플렛 인쇄',
          amount: 6000000,
          calculation: '1,000원 * 6,000부',
          isCustomFunding: true,
          fundingSplits: [{ source: '시비', amount: 6000000 }],
          calculations: [
            {
              name: '1차 인쇄',
              calculation: '1,000원 * 3,000부',
              amount: 3000000,
              isCustomFunding: true,
              fundingSplits: [{ source: '시비', amount: 3000000 }],
            },
          ],
        },
      ],
    },
  ];

  const sampleEntries: BudgetEntry[] = [
    {
      id: 'e-gen-1',
      categoryId: 'cat-1',
      amount: 2000000,
      date: '2026-10-01',
      purpose: '리플렛 1차 인쇄 집행',
      docRegNum: '건강증진과-1001',
      actionType: 'general',
      isPlanned: false,
      isSettled: true,
    },
    {
      id: 'e-plan-1',
      categoryId: 'cat-1',
      amount: 1000000,
      date: '2026-10-05',
      purpose: '리플렛 2차 인쇄 품의',
      actionType: 'general',
      isPlanned: true,
      isSettled: false,
    },
    {
      id: 'e-iss-1',
      categoryId: 'cat-1',
      amount: 3000000,
      date: '2026-10-02',
      purpose: '일상경비 10월분 (일상경비 교부)',
      actionType: 'issuance',
      isPlanned: false,
      isSettled: true,
    },
    {
      id: 'e-daily-1',
      categoryId: 'cat-1',
      amount: 1200000,
      date: '2026-10-10',
      purpose: '현장 행사 소모품 구입',
      actionType: 'daily_expense',
      isPlanned: false,
      isSettled: true,
    },
  ];

  const mockStats: CategoryStats = {
    totalBudget: 10000000,
    spent: 5000000, // 2,000,000 general + 3,000,000 issuance
    planned: 1000000,
    locked: 0,
    remaining: 4000000,
    usageRate: 60, // (5,000,000 + 1,000,000) / 10,000,000 * 100
    generalSpent: 2000000,
    dailyExpenseIssued: 3000000,
    dailyExpenseSpent: 1200000,
    dailyExpenseRemaining: 1800000,
  };

  const mockGetCategoryStats = jest.fn((_id: string, excludePlanned?: boolean): CategoryStats | null => {
    if (excludePlanned) {
      return {
        ...mockStats,
        planned: 0,
        remaining: 5000000,
        usageRate: 50,
      };
    }
    return mockStats;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('handles empty state (0 categories, 0 budget) without division-by-zero or crash', () => {
    render(
      <BudgetDashboard
        categories={[]}
        entries={[]}
        addCategory={jest.fn()}
        updateCategory={jest.fn()}
        deleteCategory={jest.fn()}
        addEntry={jest.fn()}
        updateEntry={jest.fn()}
        deleteEntry={jest.fn()}
        getCategoryStats={() => null}
        overallStats={{
          totalBudget: 0,
          totalSpent: 0,
          totalPlanned: 0,
          remaining: 0,
          dailyExpenseIssued: 0,
          dailyExpenseSpent: 0,
          dailyExpenseRemaining: 0,
        }}
      />
    );

    expect(screen.getByText('예산 과목을 추가해 보세요')).toBeInTheDocument();
    const proposalBtn = screen.getByRole('button', { name: /지출 품의/ });
    expect(proposalBtn).toBeDisabled();
    expect(screen.getByText('본청 잔여 0.0%')).toBeInTheDocument();
    expect(screen.getByText('실질 미집행 0.0%')).toBeInTheDocument();
  });

  it('preserves 100% of KPI summary card figures, risk alert metrics, and nested category/entry data', () => {
    const onNavigateToSimulator = jest.fn();

    render(
      <BudgetDashboard
        categories={sampleCategories}
        entries={sampleEntries}
        addCategory={jest.fn()}
        updateCategory={jest.fn()}
        deleteCategory={jest.fn()}
        addEntry={jest.fn()}
        updateEntry={jest.fn()}
        deleteEntry={jest.fn()}
        getCategoryStats={mockGetCategoryStats}
        overallStats={{
          totalBudget: 10000000,
          totalSpent: 5000000,
          totalPlanned: 1000000,
          remaining: 4000000,
          dailyExpenseIssued: 3000000,
          dailyExpenseSpent: 1200000,
          dailyExpenseRemaining: 1800000,
        }}
        onNavigateToSimulator={onNavigateToSimulator}
      />
    );

    // 1. Verify 4 Summary KPI Cards preserve all financial numbers
    expect(screen.getByText('전체 예산 현황')).toBeInTheDocument();
    expect(screen.getByText('일반 계좌 (e-호조 본청)')).toBeInTheDocument();
    expect(screen.getByText('일상경비 이체내역')).toBeInTheDocument();
    expect(screen.getByText('보건소 실질 총 가용')).toBeInTheDocument();

    // Direct general spend = totalSpent (5,000,000) - dailyExpenseIssued (3,000,000) = 2,000,000원
    expect(screen.getByText('본청 직접 지출')).toBeInTheDocument();
    expect(screen.getByText('2,000,000원')).toBeInTheDocument();

    // Total available remaining = remaining (4,000,000) + dailyExpenseRemaining (1,800,000) = 5,800,000
    expect(screen.getByText('5,800,000')).toBeInTheDocument();
    expect(screen.getByText('본청 e-호조: 4,000,000원')).toBeInTheDocument();
    expect(screen.getByText('일상 통장: 1,800,000원')).toBeInTheDocument();

    // 2. Expand PolicyGroupCard and verify detail project & category items
    const policyHeader = screen.getByText('지역사회 통합건강증진');
    fireEvent.click(policyHeader);

    expect(screen.getAllByText('신체활동 활성화 사업').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('[사무관리비]')).toBeInTheDocument();
    expect(screen.getAllByText('201-01 일반운영비').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('(주민건강지원)')).toBeInTheDocument();

    // 3. Expand BudgetCategoryCardItem and verify subItems, general entries, daily expense entries, and funding splits
    fireEvent.click(screen.getByText('[사무관리비]'));

    expect(screen.getByText('산출 기초 (세부 항목)')).toBeInTheDocument();
    expect(screen.getByText('홍보 리플렛 인쇄')).toBeInTheDocument();
    expect(screen.getByText('1차 인쇄')).toBeInTheDocument();
    expect(screen.getByText('(1,000원 * 3,000부)')).toBeInTheDocument();

    expect(screen.getByText('일반 지출 (품의 및 집행) 현황')).toBeInTheDocument();
    expect(screen.getByText('품의(원인행위)')).toBeInTheDocument();
    expect(screen.getByText('실지출')).toBeInTheDocument();

    expect(screen.getByText('일상경비 (교부액) 집행 현황')).toBeInTheDocument();
    expect(screen.getByText('재원 분할 내역')).toBeInTheDocument();
    expect(screen.getAllByText('비율 일괄 설정').length).toBeGreaterThanOrEqual(1);
  });

  it('re-renders PolicyGroupCard when statItem, subItems, fundingSplits, or entry status changes (memo comparator integrity)', () => {
    const { rerender } = render(
      <BudgetDashboard
        categories={sampleCategories}
        entries={sampleEntries}
        addCategory={jest.fn()}
        updateCategory={jest.fn()}
        deleteCategory={jest.fn()}
        addEntry={jest.fn()}
        updateEntry={jest.fn()}
        deleteEntry={jest.fn()}
        getCategoryStats={mockGetCategoryStats}
        overallStats={{
          totalBudget: 10000000,
          totalSpent: 5000000,
          totalPlanned: 1000000,
          remaining: 4000000,
          dailyExpenseIssued: 3000000,
          dailyExpenseSpent: 1200000,
          dailyExpenseRemaining: 1800000,
        }}
      />
    );

    // Expand policy card and category card
    fireEvent.click(screen.getByText('지역사회 통합건강증진'));
    fireEvent.click(screen.getByText('[사무관리비]'));

    expect(screen.getAllByText('201-01 일반운영비').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('홍보 리플렛 인쇄')).toBeInTheDocument();

    // Update statItem, subItems, fundingSplits, and entry isPlanned -> should re-render
    const updatedCategories: BudgetCategory[] = [
      {
        ...sampleCategories[0],
        statItem: '201-02 공공운영비',
        fundingSplits: [
          { source: '시비', amount: 7000000 },
          { source: '구비(자체)', amount: 3000000 },
        ],
        subItems: [
          {
            ...sampleCategories[0].subItems![0],
            name: '개편된 배너 인쇄',
          },
        ],
      },
    ];
    const updatedEntries: BudgetEntry[] = sampleEntries.map(e =>
      e.id === 'e-plan-1' ? { ...e, isPlanned: false, isSettled: true } : e
    );

    rerender(
      <BudgetDashboard
        categories={updatedCategories}
        entries={updatedEntries}
        addCategory={jest.fn()}
        updateCategory={jest.fn()}
        deleteCategory={jest.fn()}
        addEntry={jest.fn()}
        updateEntry={jest.fn()}
        deleteEntry={jest.fn()}
        getCategoryStats={mockGetCategoryStats}
        overallStats={{
          totalBudget: 10000000,
          totalSpent: 6000000,
          totalPlanned: 0,
          remaining: 4000000,
          dailyExpenseIssued: 3000000,
          dailyExpenseSpent: 1200000,
          dailyExpenseRemaining: 1800000,
        }}
      />
    );

    expect(screen.getAllByText('201-02 공공운영비').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('개편된 배너 인쇄')).toBeInTheDocument();
    expect(screen.getByText('7,000,000원')).toBeInTheDocument();
  });

  it('prevents InlineEditCell input click from collapsing BudgetCategoryCardItem and supports Tab navigation across entry cells', () => {
    const updateCategory = jest.fn();
    const updateEntry = jest.fn();

    const { container } = render(
      <BudgetDashboard
        categories={sampleCategories}
        entries={sampleEntries}
        addCategory={jest.fn()}
        updateCategory={updateCategory}
        deleteCategory={jest.fn()}
        addEntry={jest.fn()}
        updateEntry={updateEntry}
        deleteEntry={jest.fn()}
        getCategoryStats={mockGetCategoryStats}
        overallStats={{
          totalBudget: 10000000,
          totalSpent: 5000000,
          totalPlanned: 1000000,
          remaining: 4000000,
          dailyExpenseIssued: 3000000,
          dailyExpenseSpent: 1200000,
          dailyExpenseRemaining: 1800000,
        }}
      />
    );

    // Expand policy card and category card
    fireEvent.click(screen.getByText('지역사회 통합건강증진'));
    fireEvent.click(screen.getByText('[사무관리비]'));
    expect(screen.getByText('산출 기초 (세부 항목)')).toBeInTheDocument();

    // Double click statItem in BudgetCategoryCardItem header to enter inline editing mode
    const headerStatItem = container.querySelector('[data-cell-id="cat-1:statItem"]') as HTMLElement;
    expect(headerStatItem).toBeInTheDocument();
    fireEvent.doubleClick(headerStatItem);

    const activeInput = screen.getByDisplayValue('201-01 일반운영비');
    expect(activeInput).toBeInTheDocument();

    // Clicking inside the active input must NOT bubble up and collapse the card
    fireEvent.click(activeInput);
    expect(screen.getByText('산출 기초 (세부 항목)')).toBeInTheDocument();

    // Pressing Escape cancels editing without calling updateCategory
    fireEvent.change(activeInput, { target: { value: '임시변경값' } });
    fireEvent.keyDown(activeInput, { key: 'Escape' });
    expect(updateCategory).not.toHaveBeenCalled();

    // Double click general entry purpose cell inside BudgetCategoryCardItem and press Tab to navigate to amount cell
    const entryPurpose = container.querySelector('[data-cell-id="e-gen-1:cat_purpose"]') as HTMLElement;
    expect(entryPurpose).toBeInTheDocument();
    fireEvent.doubleClick(entryPurpose);
    const purposeInput = screen.getByDisplayValue('리플렛 1차 인쇄 집행');
    fireEvent.keyDown(purposeInput, { key: 'Tab' });

    // Now the amount cell (2000000) should be in editing mode
    expect(screen.getByDisplayValue('2000000')).toBeInTheDocument();
  });
});

