import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StatItemDetailModal } from '@/components/budget/ui/StatItemDetailModal';
import { SimulationResultTable } from '@/components/budget/ui/SimulationResultTable';
import { BudgetCategory, BudgetEntry, SimulationEntry, StatItemSimulationSummary, ProjectSimulationSummary } from '@/types';

describe('StatItemDetailModal & SimulationResultTable Integration', () => {
  const mockCategories: BudgetCategory[] = [
    {
      id: 'cat-1',
      name: '강남체력인증센터 운영 - 사무관리비',
      detailedProject: '강남체력인증센터 운영',
      statItem: '201-01 사무관리비',
      totalBudget: 17339000,
      color: '#4f46e5',
      subItems: [
        {
          id: 'sub-1',
          name: '센터 운영 소모품',
          amount: 5000000,
          prefix: '1)',
          calculation: '50,000원*100개=',
          calculations: [
            {
              id: 'calc-1',
              name: '사무용품',
              calculation: '25,000원*50개=',
              amount: 1250000,
            },
            {
              id: 'calc-2',
              name: '위생용품',
              calculation: '25,000원*150개=',
              amount: 3750000,
            },
          ],
        },
      ],
    },
    {
      id: 'cat-2',
      name: '강남체력인증센터 운영 - 행사운영비',
      detailedProject: '강남체력인증센터 운영',
      statItem: '201-03 행사운영비',
      totalBudget: 2000000,
      color: '#06b6d4',
      subItems: [],
    },
  ];

  const mockActualEntries: BudgetEntry[] = [
    {
      id: 'entry-1',
      categoryId: 'cat-1',
      date: '2026-03-20',
      purpose: '체력인증센터 복사용지 및 토너 구매',
      amount: 154000,
      actionType: 'general',
      docRegNum: '보건행정과-1024',
      memo: '행정 지원 물품',
      isPlanned: false,
    },
    {
      id: 'entry-2',
      categoryId: 'cat-1',
      date: '2026-04-10',
      purpose: '상반기 체력인증센터 운영을 위한 일상경비 교부',
      amount: 4000000,
      actionType: 'issuance',
      docRegNum: '보건행정과-2048',
      memo: '일상경비 운영 계좌 이체',
      isPlanned: false,
    },
    {
      id: 'entry-planned-1',
      categoryId: 'cat-1',
      date: '2026-05-01',
      purpose: '소진 예정 품의 (미집행 계획)',
      amount: 2000000,
      actionType: 'general',
      isPlanned: true, // Should be excluded from rawActualList
    },
  ];

  const mockSimulationEntries: SimulationEntry[] = [
    {
      id: 'sim-1',
      name: '체력측정 전담요원 하반기 피복비',
      detailedProject: '강남체력인증센터 운영',
      statItem: '201-01 사무관리비',
      unitPrice: 150000,
      quantity: 6,
      amount: 900000,
      memo: '체력측정 전담요원 하반기 지자체 유니폼 지원',
      status: 'PLANNED',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  const mockSummary: StatItemSimulationSummary = {
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    totalBudget: 17339000,
    currentSpent: 4154000,
    currentRemaining: 13185000,
    simulatedExpenditure: 900000,
    finalExpectedBalance: 12285000,
    isDeficit: false,
    dailyExpenseIssued: 4000000,
    dailyExpenseSpent: 1000000,
    dailyExpenseRemaining: 3000000,
  };

  const mockProjectSummary: ProjectSimulationSummary = {
    detailedProject: '강남체력인증센터 운영',
    totalBudget: 210120000,
    currentSpent: 127599300,
    currentRemaining: 82520700,
    simulatedExpenditure: 900000,
    finalExpectedBalance: 81620700,
    executionRate: 60.7,
    isDeficit: false,
    dailyExpenseIssued: 4000000,
    dailyExpenseSpent: 1000000,
    dailyExpenseRemaining: 3000000,
  };

  describe('StatItemDetailModal Unit Tests', () => {
    test('renders modal header with detailedProject and statItem correctly', () => {
      const handleClose = jest.fn();

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={handleClose}
          detailedProject="강남체력인증센터 운영"
          statItem="201-01 사무관리비"
          summary={mockSummary}
          categories={mockCategories}
          actualEntries={mockActualEntries}
          simulationEntries={mockSimulationEntries}
        />
      );

      // Check header items
      expect(screen.getByText('강남체력인증센터 운영')).toBeInTheDocument();
      expect(screen.getByText('201-01 사무관리비')).toBeInTheDocument();
      expect(screen.getByText('세부 지출원장 및 시뮬레이션')).toBeInTheDocument();

      // Check KPI values
      expect(screen.getByText('₩17,339,000')).toBeInTheDocument(); // 총 예산액
      expect(screen.getAllByText('₩4,154,000').length).toBeGreaterThanOrEqual(1); // 현재 실집행액
      expect(screen.getByText('₩13,185,000')).toBeInTheDocument(); // 현재 집행 잔액
      expect(screen.getAllByText('₩900,000').length).toBeGreaterThanOrEqual(1); // 시뮬레이션 예정액
      expect(screen.getByText('₩12,285,000')).toBeInTheDocument(); // 최종 예상 잔액
    });

    test('displays actual expenditure list and filters by keyword and actionType', () => {
      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="강남체력인증센터 운영"
          statItem="201-01 사무관리비"
          summary={mockSummary}
          categories={mockCategories}
          actualEntries={mockActualEntries}
          simulationEntries={mockSimulationEntries}
        />
      );

      // Tab 1 (Actual) is active by default. Checks entries
      expect(screen.getByText('체력인증센터 복사용지 및 토너 구매')).toBeInTheDocument();
      expect(screen.getByText('상반기 체력인증센터 운영을 위한 일상경비 교부')).toBeInTheDocument();
      // Planned budget entry should NOT appear in actual tab
      expect(screen.queryByText('소진 예정 품의 (미집행 계획)')).not.toBeInTheDocument();

      // Search keyword filter
      const searchInput = screen.getByPlaceholderText('품의 목적, 문서번호, 비고 검색...');
      fireEvent.change(searchInput, { target: { value: '복사용지' } });

      expect(screen.getByText('체력인증센터 복사용지 및 토너 구매')).toBeInTheDocument();
      expect(screen.queryByText('상반기 체력인증센터 운영을 위한 일상경비 교부')).not.toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('상반기 체력인증센터 운영을 위한 일상경비 교부')).toBeInTheDocument();
    });

    test('switches to simulation tab and shows simulation entries', () => {
      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="강남체력인증센터 운영"
          statItem="201-01 사무관리비"
          summary={mockSummary}
          categories={mockCategories}
          actualEntries={mockActualEntries}
          simulationEntries={mockSimulationEntries}
        />
      );

      // Click Simulation Tab
      const simTabButton = screen.getByRole('button', { name: /시뮬레이션 예정 내역/i });
      fireEvent.click(simTabButton);

      expect(screen.getByText('체력측정 전담요원 하반기 피복비')).toBeInTheDocument();
      expect(screen.getByText('₩150,000')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('체력측정 전담요원 하반기 지자체 유니폼 지원')).toBeInTheDocument();
    });

    test('switches to subItems tab and shows budget calculation foundation', () => {
      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="강남체력인증센터 운영"
          statItem="201-01 사무관리비"
          summary={mockSummary}
          categories={mockCategories}
          actualEntries={mockActualEntries}
          simulationEntries={mockSimulationEntries}
        />
      );

      // Click SubItems Tab
      const subItemsTabButton = screen.getByRole('button', { name: /본예산 산출 기초/i });
      fireEvent.click(subItemsTabButton);

      expect(screen.getByText('센터 운영 소모품')).toBeInTheDocument();
      expect(screen.getByText('₩5,000,000')).toBeInTheDocument();
      expect(screen.getByText('50,000원*100개=')).toBeInTheDocument();
      expect(screen.getByText('사무용품')).toBeInTheDocument();
      expect(screen.getByText('25,000원*50개=')).toBeInTheDocument();
      expect(screen.getByText('위생용품')).toBeInTheDocument();
      expect(screen.getByText('25,000원*150개=')).toBeInTheDocument();
    });
  });

  describe('SimulationResultTable Integration with StatItemDetailModal', () => {
    test('clicking on statItem opens StatItemDetailModal popup', () => {
      render(
        <SimulationResultTable
          categories={mockCategories}
          budgetEntries={mockActualEntries}
          projectSummaries={[mockProjectSummary]}
          statItemSummaries={[mockSummary]}
          entries={mockSimulationEntries}
          onDeleteEntry={jest.fn()}
        />
      );

      // Verify that statItem button is rendered
      const statButton = screen.getByTitle('클릭하여 세부 지출내역(e-호조 원장 및 산출기초) 조회');
      expect(statButton).toBeInTheDocument();
      expect(statButton).toHaveTextContent('201-01 사무관리비');

      // Before click: Modal is not visible
      expect(screen.queryByText('세부 지출원장 및 시뮬레이션')).not.toBeInTheDocument();

      // Click the statItem button
      fireEvent.click(statButton);

      // After click: Modal opens with stat item details
      expect(screen.getByText('세부 지출원장 및 시뮬레이션')).toBeInTheDocument();
      expect(screen.getByText('체력인증센터 복사용지 및 토너 구매')).toBeInTheDocument();

      // Click close button
      const closeButton = screen.getByRole('button', { name: '닫기' });
      fireEvent.click(closeButton);

      // Modal is closed
      expect(screen.queryByText('세부 지출원장 및 시뮬레이션')).not.toBeInTheDocument();
    });
  });
});
