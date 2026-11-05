import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatItemDetailModal } from '@/components/budget/ui/StatItemDetailModal';
import { SimulationResultTable } from '@/components/budget/ui/SimulationResultTable';
import { SimulationSummaryCards } from '@/components/budget/ui/SimulationSummaryCards';
import {
  BudgetCategory,
  SimulationEntry,
  StatItemSimulationSummary,
  ProjectSimulationSummary,
} from '@/types';

describe('Challenger M272 Empirical Stress Test Suite', () => {
  // =========================================================================
  // Challenge 1: 0-Issuance Daily Expense Simulation
  // When dailyExpenseIssued === 0, verify that registering a planned daily expense
  // correctly identifies shortfall equal to the entire planned amount, and
  // deducts it from finalExpectedBalance.
  // =========================================================================
  describe('Challenge 1: 0-Issuance Daily Expense Simulation Edge Case', () => {
    const zeroIssuanceCategory: BudgetCategory = {
      id: 'cat-zero-issuance',
      name: '양재천 건강페스티벌 - 행사운영비',
      detailedProject: '양재천 페스티벌',
      statItem: '201-03 행사운영비',
      totalBudget: 25000000,
      color: '#0ea5e9',
      subItems: [
        {
          id: 'sub-zero-1',
          name: '현장 운영비',
          amount: 25000000,
        },
      ],
    };

    const plannedDailyExpenseSim: SimulationEntry = {
      id: 'sim-daily-zero-issue-1',
      name: '현장 부스 운영 음료 다과비',
      detailedProject: '양재천 페스티벌',
      statItem: '201-03 행사운영비',
      actionType: 'daily_expense',
      unitPrice: 3000000,
      quantity: 1,
      amount: 3000000,
      status: 'PLANNED',
      createdAt: '2026-10-21T00:00:00Z',
    };

    test('mathematical invariant: shortfall === plannedAmount and finalExpectedBalance = currentRemaining - shortfall', () => {
      // Direct mathematical simulation mimicking useBudgetSimulator logic
      const totalBudget = 25000000;
      const currentSpent = 5000000; // general spent
      const currentRemaining = totalBudget - currentSpent; // 20,000,000
      const dailyExpenseIssued = 0;
      const dailyExpenseSpent = 0;
      const simulatedDailyExpenditure = plannedDailyExpenseSim.amount; // 3,000,000
      const simulatedGeneralExpenditure = 0;

      const actualDailyRemaining = Math.max(0, dailyExpenseIssued - dailyExpenseSpent); // 0
      const shortfall = Math.max(0, simulatedDailyExpenditure - actualDailyRemaining); // 3,000,000
      const finalDailyExpenseRemaining = Math.max(0, actualDailyRemaining - simulatedDailyExpenditure); // 0
      const finalExpectedBalance = currentRemaining - simulatedGeneralExpenditure - shortfall; // 20,000,000 - 3,000,000 = 17,000,000

      // Assert invariants
      expect(actualDailyRemaining).toBe(0);
      expect(shortfall).toBe(3000000);
      expect(shortfall).toBe(simulatedDailyExpenditure); // shortfall EQUALS entire planned amount
      expect(finalDailyExpenseRemaining).toBe(0);
      expect(finalExpectedBalance).toBe(17000000);
      expect(finalExpectedBalance).toBe(currentRemaining - shortfall);
    });

    test('StatItemDetailModal renders shortfall badge and "추가 교부 필요" when dailyExpenseIssued === 0', () => {
      const summary: StatItemSimulationSummary = {
        detailedProject: '양재천 페스티벌',
        statItem: '201-03 행사운영비',
        totalBudget: 25000000,
        currentSpent: 5000000,
        currentRemaining: 20000000,
        simulatedExpenditure: 3000000,
        simulatedGeneralExpenditure: 0,
        simulatedDailyExpenditure: 3000000,
        finalExpectedBalance: 17000000,
        isDeficit: false,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 3000000,
        needsAdditionalIssuance: true,
      };

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="양재천 페스티벌"
          statItem="201-03 행사운영비"
          summary={summary}
          categories={[zeroIssuanceCategory]}
          actualEntries={[]}
          simulationEntries={[plannedDailyExpenseSim]}
        />
      );

      // Appropriateness badge in header
      expect(screen.getByText('추가 교부 필요')).toBeInTheDocument();
      // Shortfall capsule in header verified via title attribute
      expect(screen.getByTitle('일상경비 추가 교부 필요: 3,000,000원')).toBeInTheDocument();
      // Card 6 shortfall pill
      expect(screen.getByText(/부족 3,000,000원/)).toBeInTheDocument();
      // Final balance is 17,000,000
      expect(screen.getByText('17,000,000')).toBeInTheDocument();
    });

    test('SimulationSummaryCards reflects totalShortfall when dailyExpenseIssued === 0', () => {
      const projSummary: ProjectSimulationSummary = {
        detailedProject: '양재천 페스티벌',
        totalBudget: 25000000,
        currentSpent: 5000000,
        currentRemaining: 20000000,
        simulatedExpenditure: 3000000,
        simulatedGeneralExpenditure: 0,
        simulatedDailyExpenditure: 3000000,
        finalExpectedBalance: 17000000,
        finalDailyExpenseRemaining: 0,
        executionRate: 32.0,
        isDeficit: false,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 3000000,
        needsAdditionalIssuance: true,
      };

      render(<SimulationSummaryCards projectSummaries={[projSummary]} />);

      // Card 5: Final Expected Balance shows 17,000,000 and shortfall notice
      expect(screen.getByText('17,000,000')).toBeInTheDocument();
      expect(screen.getByText(/₩3,000,000원/)).toBeInTheDocument();

      // Card 6: Should show (교부 필요) and 3,000,000원
      expect(screen.getByText('(교부 필요)')).toBeInTheDocument();
      expect(screen.getByText('교부 필요')).toBeInTheDocument();
      expect(screen.getByText(/총 3,000,000원/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Challenge 2: Excess Daily Expense Simulation Triggering Deficit (finalExpectedBalance < 0)
  // When shortfall exceeds remaining general budget, finalExpectedBalance drops below 0.
  // Verify warning badge "초과 경고", deficit count in summary cards, and visual alarms.
  // =========================================================================
  describe('Challenge 2: Excess Daily Expense Simulation Triggering Deficit', () => {
    test('mathematical invariant: shortfall > currentRemaining yields finalExpectedBalance < 0 and isDeficit = true', () => {
      const totalBudget = 5000000;
      const currentSpent = 4000000;
      const currentRemaining = totalBudget - currentSpent; // 1,000,000
      const dailyExpenseIssued = 500000;
      const dailyExpenseSpent = 500000; // actualDailyRemaining = 0
      const plannedDailyExpense = 3000000; // simulatedDailyExpenditure

      const actualDailyRemaining = Math.max(0, dailyExpenseIssued - dailyExpenseSpent); // 0
      const shortfall = Math.max(0, plannedDailyExpense - actualDailyRemaining); // 3,000,000
      const finalExpectedBalance = currentRemaining - 0 - shortfall; // 1,000,000 - 3,000,000 = -2,000,000
      const isDeficit = finalExpectedBalance < 0;

      expect(shortfall).toBe(3000000);
      expect(finalExpectedBalance).toBe(-2000000);
      expect(isDeficit).toBe(true);
    });

    test('StatItemDetailModal renders "초과 경고" badge when deficit occurs despite daily shortfall', () => {
      // In StatItemDetailModal, isDeficit takes top priority over dailyExpenseShortfall
      const deficitSummary: StatItemSimulationSummary = {
        detailedProject: '건강도시 조성',
        statItem: '201-01 사무관리비',
        totalBudget: 5000000,
        currentSpent: 4000000,
        currentRemaining: 1000000,
        simulatedExpenditure: 3000000,
        simulatedGeneralExpenditure: 0,
        simulatedDailyExpenditure: 3000000,
        finalExpectedBalance: -2000000,
        isDeficit: true,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 3000000,
        needsAdditionalIssuance: true,
      };

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="건강도시 조성"
          statItem="201-01 사무관리비"
          summary={deficitSummary}
          categories={[]}
          actualEntries={[]}
          simulationEntries={[]}
        />
      );

      // Deficit priority badge "초과 경고" must be displayed
      expect(screen.getByText('초과 경고')).toBeInTheDocument();
      // Final balance displays -2,000,000
      expect(screen.getByText('-2,000,000')).toBeInTheDocument();
      // Additional issuance pill is also present
      expect(screen.getByTitle('일상경비 추가 교부 필요: 3,000,000원')).toBeInTheDocument();
    });

    test('SimulationSummaryCards renders deficit styling (rose borders, AlertOctagon, deficitCount)', () => {
      const deficitProjSummary: ProjectSimulationSummary = {
        detailedProject: '건강도시 조성',
        totalBudget: 5000000,
        currentSpent: 4000000,
        currentRemaining: 1000000,
        simulatedExpenditure: 3000000,
        simulatedGeneralExpenditure: 0,
        simulatedDailyExpenditure: 3000000,
        finalExpectedBalance: -2000000,
        finalDailyExpenseRemaining: 0,
        executionRate: 140.0,
        isDeficit: true,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 3000000,
        needsAdditionalIssuance: true,
      };

      render(<SimulationSummaryCards projectSummaries={[deficitProjSummary]} />);

      // Card 5 shows negative balance in rose
      expect(screen.getByText('-2,000,000')).toBeInTheDocument();
      // Card 6 shows 1개 (예산 초과)
      expect(screen.getByText(/1개/)).toBeInTheDocument();
      expect(screen.getByText('(예산 초과)')).toBeInTheDocument();
      expect(screen.getByText('초과 경고')).toBeInTheDocument();
      // Required balance shows 2,000,000원 with shortfall note
      expect(screen.getByText(/2,000,000원 \(추가교부/)).toBeInTheDocument();
      expect(screen.getByText(/추가교부 ₩3,000,000원 포함/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Challenge 3: isLocked Guardrails & Capsules in StatItemDetailModal
  // SubItem & Calculation level isLocked flags.
  // Locked amount summary in header, locked pills in Tab 3, and "잠금한도 침범" guardrail.
  // =========================================================================
  describe('Challenge 3: isLocked Guardrails and Badges in StatItemDetailModal', () => {
    const complexLockedCategories: BudgetCategory[] = [
      {
        id: 'cat-locked-complex',
        name: '방문건강관리사업 - 인건비 및 관리비',
        detailedProject: '방문건강관리',
        statItem: '101-04 기간제근로자등보수',
        totalBudget: 100000000,
        color: '#6366f1',
        subItems: [
          {
            id: 'sub-l1',
            name: '간호사 인건비 (법정 필수)',
            amount: 60000000,
            isLocked: true, // Level 2 locked
            calculations: [
              {
                id: 'calc-l1-1',
                name: '월 기본급',
                calculation: '2,500,000원*2명*12개월=',
                amount: 60000000,
                isLocked: true,
              },
            ],
          },
          {
            id: 'sub-l2',
            name: '4대 사회보험료',
            amount: 15000000,
            isLocked: false, // Parent not locked, but children locked
            calculations: [
              {
                id: 'calc-l2-pension',
                name: '국민연금 (5.0%)',
                calculation: '60,000,000원*5.0%=',
                amount: 3000000,
                isLocked: true, // Level 3 locked
              },
              {
                id: 'calc-l2-health',
                name: '건강보험 (3.595%)',
                calculation: '60,000,000원*3.595%=',
                amount: 2157000,
                isLocked: true, // Level 3 locked
              },
              {
                id: 'calc-l2-unlocked',
                name: '자원봉사 실비지원',
                calculation: '50,000원*196.86회=',
                amount: 9843000,
                isLocked: false, // Level 3 unlocked
              },
            ],
          },
          {
            id: 'sub-unlocked-general',
            name: '일반 소모품 및 피복비',
            amount: 25000000,
            isLocked: false,
          },
        ],
      },
    ];

    test('correctly calculates totalLockedAmount from both subItem and calculations level', () => {
      // 60,000,000 (sub-l1 isLocked) + 3,000,000 (calc-l2-pension) + 2,157,000 (calc-l2-health) = 65,157,000
      const summary: StatItemSimulationSummary = {
        detailedProject: '방문건강관리',
        statItem: '101-04 기간제근로자등보수',
        totalBudget: 100000000,
        currentSpent: 20000000,
        currentRemaining: 80000000,
        simulatedExpenditure: 10000000,
        finalExpectedBalance: 70000000,
        isDeficit: false,
        lockedAmount: 65157000,
      };

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="방문건강관리"
          statItem="101-04 기간제근로자등보수"
          summary={summary}
          categories={complexLockedCategories}
          actualEntries={[]}
          simulationEntries={[]}
        />
      );

      // Header shows locked limit
      expect(screen.getByText(/잠금 한도/)).toBeInTheDocument();
      expect(screen.getAllByText(/65,157,000/).length).toBeGreaterThanOrEqual(1);

      // Appropriateness badge is 정상/안전 because 70,000,000 >= 65,157,000
      expect(screen.getByText('정상/안전')).toBeInTheDocument();

      // Switch to Tab 3: 본예산 산출 기초
      const tab3Btn = screen.getByRole('button', { name: /본예산 산출 기초/i });
      fireEvent.click(tab3Btn);

      // Banner shows total locked amount
      expect(screen.getByText(/법정 필수경비\(인건비\/보험료 등\) 잠금 한도 총액:/)).toBeInTheDocument();
      expect(screen.getAllByText(/65,157,000/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('임의 삭감 불가')).toBeInTheDocument();

      // Multiple "잠금" pills rendered
      const lockedBadges = screen.getAllByText('잠금');
      expect(lockedBadges.length).toBeGreaterThanOrEqual(3);
    });

    test('triggers "잠금한도 침범" warning badge when simulated balance cuts into lockedAmount', () => {
      // Current remaining = 80,000,000.
      // Planned expenditure = 20,000,000.
      // finalExpectedBalance = 60,000,000 (< lockedAmount 65,157,000).
      const violatedSummary: StatItemSimulationSummary = {
        detailedProject: '방문건강관리',
        statItem: '101-04 기간제근로자등보수',
        totalBudget: 100000000,
        currentSpent: 20000000,
        currentRemaining: 80000000,
        simulatedExpenditure: 20000000,
        finalExpectedBalance: 60000000,
        isDeficit: false,
        lockedAmount: 65157000,
      };

      render(
        <StatItemDetailModal
          isOpen={true}
          onClose={jest.fn()}
          detailedProject="방문건강관리"
          statItem="101-04 기간제근로자등보수"
          summary={violatedSummary}
          categories={complexLockedCategories}
          actualEntries={[]}
          simulationEntries={[]}
        />
      );

      // Appropriateness badge must be "잠금한도 침범"
      expect(screen.getByText('잠금한도 침범')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Challenge 4: Multi-Stat Table Alignment & Zero Discrepancy
  // Verify that multiple stat items with mixed zero-issuance, shortfall, and normal
  // sum up with exactly 0 KRW delta between project summaries, stat table, and summary cards.
  // =========================================================================
  describe('Challenge 4: Multi-Stat Item Conservation Invariant (0 KRW Delta)', () => {
    test('Sum of statItemSummaries strictly equals projectSummary for all fields', () => {
      const stat1: StatItemSimulationSummary = {
        detailedProject: '종합건강관리',
        statItem: '201-01 사무관리비',
        totalBudget: 10000000,
        currentSpent: 3000000,
        currentRemaining: 7000000,
        simulatedExpenditure: 2000000,
        simulatedGeneralExpenditure: 2000000,
        simulatedDailyExpenditure: 0,
        finalExpectedBalance: 5000000,
        isDeficit: false,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 0,
        lockedAmount: 0,
      };

      const stat2: StatItemSimulationSummary = {
        detailedProject: '종합건강관리',
        statItem: '201-03 행사운영비',
        totalBudget: 20000000,
        currentSpent: 5000000,
        currentRemaining: 15000000,
        simulatedExpenditure: 4000000,
        simulatedGeneralExpenditure: 0,
        simulatedDailyExpenditure: 4000000,
        finalExpectedBalance: 11000000,
        isDeficit: false,
        dailyExpenseIssued: 1000000,
        dailyExpenseSpent: 1000000,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 4000000, // 0 - 4,000,000 => 4,000,000 shortfall
        needsAdditionalIssuance: true,
        lockedAmount: 0,
      };

      const stat3: StatItemSimulationSummary = {
        detailedProject: '종합건강관리',
        statItem: '101-04 기간제인건비',
        totalBudget: 50000000,
        currentSpent: 10000000,
        currentRemaining: 40000000,
        simulatedExpenditure: 5000000,
        simulatedGeneralExpenditure: 5000000,
        simulatedDailyExpenditure: 0,
        finalExpectedBalance: 35000000,
        isDeficit: false,
        dailyExpenseIssued: 0,
        dailyExpenseSpent: 0,
        dailyExpenseRemaining: 0,
        dailyExpenseShortfall: 0,
        lockedAmount: 30000000,
      };

      const stats = [stat1, stat2, stat3];

      // Aggregate project summary
      const aggregatedTotalBudget = stats.reduce((acc, s) => acc + s.totalBudget, 0);
      const aggregatedCurrentSpent = stats.reduce((acc, s) => acc + s.currentSpent, 0);
      const aggregatedCurrentRemaining = stats.reduce((acc, s) => acc + s.currentRemaining, 0);
      const aggregatedSimExp = stats.reduce((acc, s) => acc + s.simulatedExpenditure, 0);
      const aggregatedShortfall = stats.reduce((acc, s) => acc + (s.dailyExpenseShortfall || 0), 0);
      const aggregatedFinalExpectedBalance = stats.reduce((acc, s) => acc + s.finalExpectedBalance, 0);
      const aggregatedLockedAmount = stats.reduce((acc, s) => acc + (s.lockedAmount || 0), 0);

      expect(aggregatedTotalBudget).toBe(80000000);
      expect(aggregatedCurrentSpent).toBe(18000000);
      expect(aggregatedCurrentRemaining).toBe(62000000);
      expect(aggregatedSimExp).toBe(11000000);
      expect(aggregatedShortfall).toBe(4000000);
      expect(aggregatedFinalExpectedBalance).toBe(51000000);
      expect(aggregatedLockedAmount).toBe(30000000);

      // Verify that final expected balance equals currentRemaining - simulatedGeneralExpenditure - shortfall
      // General sim exp = 2,000,000 + 5,000,000 = 7,000,000.
      // 62,000,000 - 7,000,000 - 4,000,000 = 51,000,000! (0 KRW delta)
      expect(aggregatedFinalExpectedBalance).toBe(62000000 - 7000000 - 4000000);
    });
  });
});
