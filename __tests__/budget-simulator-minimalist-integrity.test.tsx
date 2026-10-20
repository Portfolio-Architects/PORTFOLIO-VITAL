import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimulationSummaryCards } from '@/components/budget/ui/SimulationSummaryCards';
import { SimulationInputForm } from '@/components/budget/ui/SimulationInputForm';
import { SimulationBurnUpChart } from '@/components/budget/ui/SimulationBurnUpChart';
import { SimulationResultTable } from '@/components/budget/ui/SimulationResultTable';
import { QuickPlanModal } from '@/components/budget/ui/QuickPlanModal';
import { StatItemDetailModal } from '@/components/budget/ui/StatItemDetailModal';
import { BudgetSimulatorSkeleton } from '@/components/budget/ui/BudgetSimulatorSkeleton';
import { BudgetSimulator } from '@/components/budget/BudgetSimulator';
import * as useBudgetSimulatorModule from '@/hooks/useBudgetSimulator';
import {
  StatItemSimulationSummary,
  ProjectSimulationSummary,
  SimulationEntry,
  BudgetCategory,
  BudgetEntry,
} from '@/types';

// Mock Recharts ResponsiveContainer to render children in JSDOM
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

jest.mock('@/hooks/useBudgetSimulator', () => {
  const actual = jest.requireActual('@/hooks/useBudgetSimulator');
  return {
    ...actual,
    useBudgetSimulator: jest.fn(),
  };
});

beforeAll(() => {
  if (typeof window !== 'undefined') {
    window.scrollTo = jest.fn();
  }
});

describe('BudgetSimulator Minimalist Redesign & Functional Integrity Suite', () => {
  const sampleStatItems: StatItemSimulationSummary[] = [
    {
      detailedProject: '신체활동 활성화 사업',
      statItem: '201-01 사무관리비',
      totalBudget: 20000000,
      currentSpent: 8000000,
      currentRemaining: 12000000,
      simulatedExpenditure: 2000000,
      simulatedGeneralExpenditure: 2000000,
      simulatedDailyExpenditure: 500000,
      finalExpectedBalance: 10000000,
      finalDailyExpenseRemaining: 2000000,
      isDeficit: false,
      dailyExpenseIssued: 4000000,
      dailyExpenseSpent: 1500000,
      dailyExpenseRemaining: 2500000,
    },
    {
      detailedProject: '강남체력인증센터 운영',
      statItem: '201-02 공공운영비',
      totalBudget: 30000000,
      currentSpent: 12000000,
      currentRemaining: 18000000,
      simulatedExpenditure: 20000000,
      simulatedGeneralExpenditure: 20000000,
      simulatedDailyExpenditure: 0,
      finalExpectedBalance: -2000000,
      finalDailyExpenseRemaining: 0,
      isDeficit: true,
      dailyExpenseIssued: 0,
      dailyExpenseSpent: 0,
      dailyExpenseRemaining: 0,
    },
  ];

  const sampleProjects: ProjectSimulationSummary[] = [
    {
      detailedProject: '신체활동 활성화 사업',
      totalBudget: 20000000,
      currentSpent: 8000000,
      currentRemaining: 12000000,
      simulatedExpenditure: 2000000,
      finalExpectedBalance: 10000000,
      isDeficit: false,
      executionRate: 40,
      dailyExpenseIssued: 4000000,
      dailyExpenseSpent: 1500000,
      dailyExpenseRemaining: 2500000,
    },
    {
      detailedProject: '강남체력인증센터 운영',
      totalBudget: 30000000,
      currentSpent: 12000000,
      currentRemaining: 18000000,
      simulatedExpenditure: 20000000,
      finalExpectedBalance: -2000000,
      isDeficit: true,
      executionRate: 40,
      dailyExpenseIssued: 0,
      dailyExpenseSpent: 0,
      dailyExpenseRemaining: 0,
    },
  ];

  const sampleDetailedProjects = ['신체활동 활성화 사업', '강남체력인증센터 운영'];
  const getStatItemsForProject = (dp: string) => {
    if (dp === '신체활동 활성화 사업') return ['201-01 사무관리비'];
    if (dp === '강남체력인증센터 운영') return ['201-02 공공운영비'];
    return [];
  };

  const sampleSimulationEntries: SimulationEntry[] = [
    {
      id: 'sim-1',
      detailedProject: '신체활동 활성화 사업',
      statItem: '201-01 사무관리비',
      name: '건강걷기 홍보 현수막 제작',
      unitPrice: 100000,
      quantity: 20,
      amount: 2000000,
      memo: '양재천 코스 안내용',
      actionType: 'general',
      status: 'PLANNED',
      createdAt: '2026-10-15T09:00:00.000Z',
    },
    {
      id: 'sim-2',
      detailedProject: '신체활동 활성화 사업',
      statItem: '201-01 사무관리비',
      name: '현장 운영 다과 및 생수 구매',
      unitPrice: 5000,
      quantity: 100,
      amount: 500000,
      actionType: 'daily_expense',
      status: 'PLANNED',
      createdAt: '2026-10-16T09:00:00.000Z',
    },
    {
      id: 'sim-3',
      detailedProject: '강남체력인증센터 운영',
      statItem: '201-02 공공운영비',
      name: '체력측정 장비 정기 점검 용역',
      unitPrice: 500000,
      quantity: 2,
      amount: 1000000,
      actionType: 'general',
      status: 'SETTLED',
      settledDate: '2026-10-18',
      createdAt: '2026-10-10T09:00:00.000Z',
    },
  ];

  describe('1. SimulationSummaryCards', () => {
    it('renders all 6 KPI cards with 100% financial figures and daily expense sub-metrics', () => {
      render(
        <SimulationSummaryCards
          projectSummaries={sampleProjects}
          statItemSummaries={sampleStatItems}
        />
      );

      expect(screen.getByText('총 예산액')).toBeInTheDocument();
      expect(screen.getByText('50,000,000')).toBeInTheDocument();

      expect(screen.getByText('현재 집행액')).toBeInTheDocument();
      expect(screen.getByText('20,000,000')).toBeInTheDocument();
      expect(screen.getAllByText('40.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('교부 4,000,000원 포함')).toBeInTheDocument();

      expect(screen.getByText('현재 집행 잔액')).toBeInTheDocument();
      expect(screen.getByText('30,000,000')).toBeInTheDocument();
      expect(screen.getAllByText('60.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('+ 일상 미집행 2,500,000원')).toBeInTheDocument();
      expect(screen.getByText('실가용: 32,500,000원')).toBeInTheDocument();

      expect(screen.getByText('지출 예정액')).toBeInTheDocument();
      expect(screen.getByText('22,000,000')).toBeInTheDocument();

      expect(screen.getByText('최종 예상 잔액')).toBeInTheDocument();
      expect(screen.getByText('8,000,000')).toBeInTheDocument();
      expect(screen.getByText('10,500,000원 예상')).toBeInTheDocument();

      expect(screen.getByText('적자 발생 세부사업')).toBeInTheDocument();
      expect(screen.getByText('1개')).toBeInTheDocument();
      expect(screen.getByText('2,000,000원')).toBeInTheDocument();
      expect(screen.getByText('초과 경고')).toBeInTheDocument();
    });

    it('handles zero-budget and healthy balance without division by zero', () => {
      render(
        <SimulationSummaryCards
          projectSummaries={[
            {
              detailedProject: '테스트 사업',
              totalBudget: 0,
              currentSpent: 0,
              currentRemaining: 0,
              simulatedExpenditure: 0,
              finalExpectedBalance: 0,
              isDeficit: false,
              executionRate: 0,
            },
          ]}
          statItemSummaries={[]}
        />
      );

      expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('예산 초과·결손 사업 없음')).toBeInTheDocument();
      expect(screen.getByText('건전')).toBeInTheDocument();
    });
  });

  describe('2. SimulationInputForm', () => {
    it('treats Risk Monitoring chip prefill (editingEntry with id === "") as a new entry creation (onAddEntry)', () => {
      const onAddEntry = jest.fn();
      const onUpdateEntry = jest.fn();
      const onCancelEdit = jest.fn();

      // When clicking a Risk Monitoring chip in BudgetSimulator, editingEntry has id: ''
      const prefillEntry: SimulationEntry = {
        id: '',
        detailedProject: '신체활동 활성화 사업',
        statItem: '201-01 사무관리비',
        name: '[소진계획] 201-01 사무관리비 집행 예정',
        unitPrice: 12000000,
        quantity: 1,
        amount: 12000000,
        createdAt: '2026-10-20T09:00:00.000Z',
      };

      render(
        <SimulationInputForm
          detailedProjects={sampleDetailedProjects}
          getStatItemsForProject={getStatItemsForProject}
          statItemSummaries={sampleStatItems}
          editingEntry={prefillEntry}
          onAddEntry={onAddEntry}
          onUpdateEntry={onUpdateEntry}
          onCancelEdit={onCancelEdit}
        />
      );

      // Should display '확정 지출 예정 내역 입력' and '항목 추가', NOT '지출 예정 항목 수정'
      expect(screen.getByText('확정 지출 예정 내역 입력')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /항목 추가/ });
      fireEvent.click(submitBtn);

      expect(onAddEntry).toHaveBeenCalledTimes(1);
      expect(onAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          detailedProject: '신체활동 활성화 사업',
          statItem: '201-01 사무관리비',
          name: '[소진계획] 201-01 사무관리비 집행 예정',
          unitPrice: 12000000,
          quantity: 1,
          amount: 12000000,
          actionType: 'general',
        })
      );
      expect(onUpdateEntry).not.toHaveBeenCalled();
      expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });

    it('calls onUpdateEntry when editing an existing entry with a valid id', () => {
      const onAddEntry = jest.fn();
      const onUpdateEntry = jest.fn();
      const onCancelEdit = jest.fn();

      render(
        <SimulationInputForm
          detailedProjects={sampleDetailedProjects}
          getStatItemsForProject={getStatItemsForProject}
          statItemSummaries={sampleStatItems}
          editingEntry={sampleSimulationEntries[0]}
          onAddEntry={onAddEntry}
          onUpdateEntry={onUpdateEntry}
          onCancelEdit={onCancelEdit}
        />
      );

      expect(screen.getByText('지출 예정 항목 수정')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /수정 완료/ });
      fireEvent.click(submitBtn);

      expect(onUpdateEntry).toHaveBeenCalledTimes(1);
      expect(onUpdateEntry).toHaveBeenCalledWith(
        'sim-1',
        expect.objectContaining({
          name: '건강걷기 홍보 현수막 제작',
          unitPrice: 100000,
          quantity: 20,
          amount: 2000000,
        })
      );
      expect(onAddEntry).not.toHaveBeenCalled();
    });

    it('falls back actionType to general when switching from a daily-expense statItem to a statItem without dailyExpenseIssued', () => {
      const onAddEntry = jest.fn();

      render(
        <SimulationInputForm
          detailedProjects={sampleDetailedProjects}
          getStatItemsForProject={getStatItemsForProject}
          statItemSummaries={sampleStatItems}
          editingEntry={null}
          onAddEntry={onAddEntry}
          onUpdateEntry={jest.fn()}
          onCancelEdit={jest.fn()}
        />
      );

      const selects = screen.getAllByRole('combobox');
      // First select '신체활동 활성화 사업' -> '201-01 사무관리비' (which has dailyExpenseIssued = 4,000,000)
      fireEvent.change(selects[0], { target: { value: '신체활동 활성화 사업' } });
      fireEvent.change(selects[1], { target: { value: '201-01 사무관리비' } });

      // Pick '일상경비 지출' button
      const dailyBtn = screen.getByRole('button', { name: /일상경비 지출/ });
      fireEvent.click(dailyBtn);

      // Now switch detailedProject to '강남체력인증센터 운영' and statItem to '201-02 공공운영비' (which has dailyExpenseIssued = 0)
      fireEvent.change(selects[0], { target: { value: '강남체력인증센터 운영' } });
      fireEvent.change(selects[1], { target: { value: '201-02 공공운영비' } });

      // Fill name and unit price
      fireEvent.change(screen.getByPlaceholderText('예: AI 헬스체크업 키오스크 구매'), {
        target: { value: '공공요금 납부' },
      });
      fireEvent.change(screen.getByPlaceholderText('0'), {
        target: { value: '500000' },
      });

      fireEvent.click(screen.getByRole('button', { name: /항목 추가/ }));

      expect(onAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          detailedProject: '강남체력인증센터 운영',
          statItem: '201-02 공공운영비',
          actionType: 'general',
        })
      );
    });
  });

  describe('3. SimulationBurnUpChart', () => {
    const sampleCategories: BudgetCategory[] = [
      {
        id: 'cat-1',
        name: '사무관리비',
        detailedProject: '신체활동 활성화 사업',
        statItem: '201-01 사무관리비',
        totalBudget: 20000000,
        color: '#0f172a',
      },
    ];

    const sampleBudgetEntries: BudgetEntry[] = [
      {
        id: 'be-1',
        categoryId: 'cat-1',
        amount: 5000000,
        date: '2026-03-15',
        purpose: '상반기 홍보물 제작',
        actionType: 'general',
        isPlanned: false,
      },
    ];

    it('renders burn-up chart and project selector cleanly while excluding settled/daily_expense from general projection', () => {
      const entriesWithSettledAndDaily: SimulationEntry[] = [
        ...sampleSimulationEntries, // sim-1: general 2,000,000 (PLANNED), sim-2: daily_expense 500,000 (PLANNED)
        {
          id: 'sim-settled',
          name: '기정산 완료 항목',
          detailedProject: '신체활동 활성화 사업',
          statItem: '201-01 사무관리비',
          actionType: 'general',
          unitPrice: 3000000,
          quantity: 1,
          amount: 3000000,
          status: 'SETTLED',
          createdAt: '2026-04-01T09:00:00.000Z',
        },
      ];

      render(
        <SimulationBurnUpChart
          categories={sampleCategories}
          budgetEntries={sampleBudgetEntries}
          entries={entriesWithSettledAndDaily}
          projectSummaries={sampleProjects}
          availableDetailedProjects={sampleDetailedProjects}
        />
      );

      expect(screen.getByText('지출 예정액 반영 예산 소진 추세')).toBeInTheDocument();
      expect(screen.getByText('Commitment Burn-up')).toBeInTheDocument();
      // Actual spent: 5,000,000 / 20,000,000 = 25.0%
      expect(screen.getByText('현재 실집행 25.0%')).toBeInTheDocument();
      // Projected general spent: (5,000,000 + 2,000,000) / 20,000,000 = 35.0% (excludes 500k daily_expense & 3M SETTLED)
      expect(screen.getByText('예정 반영 35.0%')).toBeInTheDocument();
      expect(screen.getByText('실제 누적 소진율 (1~9월 실적)')).toBeInTheDocument();
      expect(screen.getByText('지출 예정액 반영 예상선 (9~11월 시뮬레이션)')).toBeInTheDocument();
      expect(screen.getByText('11월 100% 목표 가이드선')).toBeInTheDocument();
    });
  });

  describe('4. SimulationResultTable & SimulationEntryList', () => {
    it('supports switching between stat, project, and entry (grouped, table, cards) views and filters', () => {
      const onEditEntry = jest.fn();
      const onDeleteEntry = jest.fn();
      const onSettleEntry = jest.fn();

      render(
        <SimulationResultTable
          projectSummaries={sampleProjects}
          statItemSummaries={sampleStatItems}
          entries={sampleSimulationEntries}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
          onSettleEntry={onSettleEntry}
        />
      );

      // Default is stat view
      expect(screen.getByText('통계목별 잔액 (2)')).toBeInTheDocument();
      expect(screen.getByText('201-01 사무관리비')).toBeInTheDocument();
      expect(screen.getByText('201-02 공공운영비')).toBeInTheDocument();

      // Filter by '일상경비 교부목만'
      fireEvent.click(screen.getByRole('button', { name: /일상경비 교부목만/ }));
      expect(screen.getByText('201-01 사무관리비')).toBeInTheDocument();
      expect(screen.queryByText('201-02 공공운영비')).not.toBeInTheDocument();

      // Unfilter '일상경비 교부목만'
      fireEvent.click(screen.getByRole('button', { name: /일상경비 교부목만/ }));
      expect(screen.getByText('201-02 공공운영비')).toBeInTheDocument();

      // Switch to project view
      fireEvent.click(screen.getByRole('button', { name: /세부사업별 요약/ }));
      expect(screen.getByText('신체활동 활성화 사업')).toBeInTheDocument();
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();

      // Switch to entry list view
      fireEvent.click(screen.getByRole('button', { name: /등록 항목 리스트/ }));
      expect(screen.getByText(/시뮬레이션 확정 지출 목록/)).toBeInTheDocument();
      expect(screen.getByText('건강걷기 홍보 현수막 제작')).toBeInTheDocument();

      // Switch entry list sub-views: table -> cards -> grouped
      fireEvent.click(screen.getByRole('button', { name: /테이블 뷰/ }));
      expect(screen.getByText('항목명 / 비고')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /카드 뷰/ }));
      expect(screen.getByText('실제 e-호조 지출 반영 완료')).toBeInTheDocument();
    });
  });

  describe('5. QuickPlanModal', () => {
    const sampleCategory: BudgetCategory = {
      id: 'cat-1',
      name: '건강증진 홍보물 제작',
      detailedProject: '신체활동 활성화 사업',
      statItem: '201-01 사무관리비',
      formationItem: '사무관리비',
      totalBudget: 10000000,
      color: '#0f172a',
    };

    it('fills remaining balance and submits plan cleanly', () => {
      const onSavePlan = jest.fn();
      const onClose = jest.fn();

      render(
        <QuickPlanModal
          isOpen={true}
          onClose={onClose}
          category={sampleCategory}
          currentRemaining={3500000}
          onSavePlan={onSavePlan}
        />
      );

      expect(screen.getByText('건강증진 홍보물 제작')).toBeInTheDocument();
      expect(screen.getAllByText('3,500,000원').length).toBeGreaterThanOrEqual(1);

      // Click '잔액 전액 채우기'
      fireEvent.click(screen.getByRole('button', { name: '잔액 전액 채우기' }));
      expect(screen.getByText('0원 (100% 완전 소진)')).toBeInTheDocument();

      // Enter plan name and submit
      fireEvent.change(screen.getByPlaceholderText('지출 예정 품목명 또는 계획 내용을 입력하세요'), {
        target: { value: '연말 캠페인 리플렛 제작' },
      });

      fireEvent.click(screen.getByRole('button', { name: /소진 계획 등록/ }));

      expect(onSavePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'cat-1',
          name: '연말 캠페인 리플렛 제작',
          unitPrice: 3500000,
          quantity: 1,
          amount: 3500000,
        })
      );
    });
  });

  describe('6. Dual-Pipeline Accounting & Edge-Case Regressions (Rule R.3)', () => {
    it('prevents double-counting simulatedDailyExpenditure in SimulationSummaryCards projectedExecutionRate and uses finalDailyExpenseRemaining', () => {
      // Total budget: 20,000,000
      // Current spent: 8,000,000 (includes 4,000,000 dailyExpenseIssued)
      // Current remaining: 12,000,000
      // Simulated general: 2,000,000, Simulated daily: 500,000 -> Total simulatedExpenditure: 2,500,000
      // Final expected general balance: 10,000,000
      // Final daily remaining: 2,000,000 (down from 2,500,000)
      render(
        <SimulationSummaryCards
          projectSummaries={[
            {
              detailedProject: '신체활동 활성화 사업',
              totalBudget: 20000000,
              currentSpent: 8000000,
              currentRemaining: 12000000,
              simulatedExpenditure: 2500000,
              finalExpectedBalance: 10000000,
              isDeficit: false,
              executionRate: 40,
              dailyExpenseIssued: 4000000,
              dailyExpenseSpent: 1500000,
              dailyExpenseRemaining: 2500000,
              finalDailyExpenseRemaining: 2000000,
            },
          ]}
          statItemSummaries={sampleStatItems}
        />
      );

      // Projected general execution rate must be (20,000,000 - 10,000,000) / 20,000,000 = 50.0%
      // (NOT (8,000,000 + 2,500,000) / 20,000,000 = 52.5%)
      expect(screen.getByText('50.0%')).toBeInTheDocument();
      // Final combined balance (general 10,000,000 + finalDailyExpenseRemaining 2,000,000) = 12,000,000원 예상
      expect(screen.getByText('12,000,000원 예상')).toBeInTheDocument();
    });

    it('allows editing an existing PLANNED daily_expense entry without falsely triggering [일상경비 한도 초과] due to self-deduction', () => {
      const onUpdateEntry = jest.fn();
      // Suppose dailyExpenseIssued = 2,000,000, dailyExpenseSpent = 0
      // Existing PLANNED daily_expense entry has amount = 1,500,000
      // So statItemSummary.dailyExpenseRemaining is already deducted to 500,000!
      const statItemsWithDeductedDaily: StatItemSimulationSummary[] = [
        {
          detailedProject: '신체활동 활성화 사업',
          statItem: '201-01 사무관리비',
          totalBudget: 10000000,
          currentSpent: 2000000,
          currentRemaining: 8000000,
          simulatedExpenditure: 1500000,
          simulatedGeneralExpenditure: 0,
          simulatedDailyExpenditure: 1500000,
          finalExpectedBalance: 8000000,
          finalDailyExpenseRemaining: 500000,
          isDeficit: false,
          dailyExpenseIssued: 2000000,
          dailyExpenseSpent: 0,
          dailyExpenseRemaining: 500000,
        },
      ];

      const existingDailyEntry: SimulationEntry = {
        id: 'sim-daily-edit',
        detailedProject: '신체활동 활성화 사업',
        statItem: '201-01 사무관리비',
        name: '현장 다과 구매',
        unitPrice: 15000,
        quantity: 100,
        amount: 1500000,
        actionType: 'daily_expense',
        status: 'PLANNED',
        createdAt: '2026-10-16T09:00:00.000Z',
      };

      render(
        <SimulationInputForm
          detailedProjects={sampleDetailedProjects}
          getStatItemsForProject={getStatItemsForProject}
          statItemSummaries={statItemsWithDeductedDaily}
          editingEntry={existingDailyEntry}
          onAddEntry={jest.fn()}
          onUpdateEntry={onUpdateEntry}
          onCancelEdit={jest.fn()}
        />
      );

      // Update unitPrice from 15,000 to 16,000 -> amount = 1,600,000 (which is <= 2,000,000 effective limit)
      fireEvent.change(screen.getByPlaceholderText('0'), {
        target: { value: '16000' },
      });

      expect(screen.queryByText(/\[일상경비 한도 초과\]/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /수정 완료/ }));
      expect(onUpdateEntry).toHaveBeenCalledWith(
        'sim-daily-edit',
        expect.objectContaining({
          unitPrice: 16000,
          quantity: 100,
          amount: 1600000,
          actionType: 'daily_expense',
        })
      );
    });

    it('clears statItem when detailedProject is reset to empty string in SimulationInputForm', () => {
      render(
        <SimulationInputForm
          detailedProjects={sampleDetailedProjects}
          getStatItemsForProject={(dp) => (dp ? ['201-01 사무관리비'] : ['201-01 사무관리비', '201-02 공공운영비'])}
          statItemSummaries={sampleStatItems}
          editingEntry={null}
          onAddEntry={jest.fn()}
          onUpdateEntry={jest.fn()}
          onCancelEdit={jest.fn()}
        />
      );

      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      fireEvent.change(selects[0], { target: { value: '신체활동 활성화 사업' } });
      fireEvent.change(selects[1], { target: { value: '201-01 사무관리비' } });
      expect(selects[1].value).toBe('201-01 사무관리비');

      // Reset detailedProject to ""
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(selects[1].value).toBe('');
      expect(selects[1]).toBeDisabled();
    });

    it('handles outbound transfer (transferDirection === "out") as positive spend in SimulationBurnUpChart', () => {
      const categories: BudgetCategory[] = [
        {
          id: 'cat-1',
          name: '사무관리비',
          detailedProject: '신체활동 활성화 사업',
          statItem: '201-01 사무관리비',
          totalBudget: 10000000,
          color: '#0f172a',
        },
      ];
      const budgetEntries: BudgetEntry[] = [
        {
          id: 'be-out',
          categoryId: 'cat-1',
          amount: 2000000,
          date: '2026-05-10',
          purpose: '타 부서 이체 감액',
          actionType: 'transfer',
          transferDirection: 'out',
          isPlanned: false,
        },
      ];

      render(
        <SimulationBurnUpChart
          categories={categories}
          budgetEntries={budgetEntries}
          entries={[]}
          projectSummaries={sampleProjects}
          availableDetailedProjects={sampleDetailedProjects}
        />
      );

      // 2,000,000 outbound transfer out of 10,000,000 = 20.0% actual execution
      expect(screen.getByText('현재 실집행 20.0%')).toBeInTheDocument();
    });

    it('preserves exact 0 balances in StatItemDetailModal without falsy fallback and hides edit button on SETTLED entries', () => {
      const zeroRemainingSummary: StatItemSimulationSummary = {
        detailedProject: '신체활동 활성화 사업',
        statItem: '201-01 사무관리비',
        totalBudget: 10000000,
        currentSpent: 8000000,
        currentRemaining: 2000000,
        // General planned: 2,000,000 (exhausts general remaining to 0)
        // Daily planned: 500,000 (exhausts daily remaining to 0)
        // Total simulatedExpenditure = 2,500,000
        simulatedExpenditure: 2500000,
        simulatedGeneralExpenditure: 2000000,
        simulatedDailyExpenditure: 500000,
        finalExpectedBalance: 0,
        finalDailyExpenseRemaining: 0,
        isDeficit: false,
        dailyExpenseIssued: 2000000,
        dailyExpenseSpent: 1500000,
        dailyExpenseRemaining: 0,
      };

      const onEditSimEntry = jest.fn();

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="신체활동 활성화 사업"
          statItem="201-01 사무관리비"
          summary={zeroRemainingSummary}
          categories={[]}
          actualEntries={[]}
          simulationEntries={[sampleSimulationEntries[2]]} // SETTLED entry
          onEditSimEntry={onEditSimEntry}
        />
      );

      // Must NOT show '초과 5.0%' (which would happen if 0 fell back to 2,000,000 - 2,500,000 = -500,000)
      expect(screen.queryByText(/초과 5\.0%/)).not.toBeInTheDocument();
      expect(screen.getByText('잔여 0.0%')).toBeInTheDocument();

      // Switch to Tab 2 (시뮬레이션 예정 내역) and verify SETTLED entry has no edit button
      fireEvent.click(screen.getByRole('button', { name: /시뮬레이션 예정 내역/ }));
      expect(screen.getByText('체력측정 장비 정기 점검 용역')).toBeInTheDocument();
      expect(screen.queryByTitle('이 예정 내역 수정')).not.toBeInTheDocument();
    });

    it('renders BudgetSimulatorSkeleton including the 280px Burn-Up Chart skeleton block', () => {
      const { container } = render(<BudgetSimulatorSkeleton />);
      const chartSkeleton = container.querySelector('.h-\\[280px\\]');
      expect(chartSkeleton).toBeInTheDocument();
    });

    it('integrates BudgetSimulator and switches cleanly from editing an existing entry to Risk Monitoring chip creation mode', () => {
      const addEntryMock = jest.fn();
      const updateEntryMock = jest.fn();

      (useBudgetSimulatorModule.useBudgetSimulator as jest.Mock).mockReturnValue({
        categories: [],
        budgetEntries: [],
        entries: sampleSimulationEntries,
        availableDetailedProjects: sampleDetailedProjects,
        getStatItemsForProject,
        addEntry: addEntryMock,
        updateEntry: updateEntryMock,
        deleteEntry: jest.fn(),
        resetEntries: jest.fn(),
        loadTestPreset: jest.fn(),
        settleEntry: jest.fn(),
        projectSummaries: sampleProjects,
        statItemSummaries: sampleStatItems,
      });

      render(<BudgetSimulator />);

      // Click '등록 항목 리스트' tab and edit sim-1
      fireEvent.click(screen.getByRole('button', { name: /등록 항목 리스트/ }));
      const editBtns = screen.getAllByTitle('수정');
      fireEvent.click(editBtns[0]);

      // Form is now in Edit Mode ('지출 예정 항목 수정')
      expect(screen.getByText('지출 예정 항목 수정')).toBeInTheDocument();

      // Now click a Risk Monitoring chip ('신체활동 활성화 사업 (40.0% | 잔액 12,000,000원)')
      const riskChip = screen.getByRole('button', { name: /신체활동 활성화 사업.*40\.0%/ });
      fireEvent.click(riskChip);

      // Form must switch back to Creation Mode ('확정 지출 예정 내역 입력' / '항목 추가')
      expect(screen.getByText('확정 지출 예정 내역 입력')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /항목 추가/ }));

      expect(addEntryMock).toHaveBeenCalledTimes(1);
      expect(updateEntryMock).not.toHaveBeenCalled();
    });
  });
});

