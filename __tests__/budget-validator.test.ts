import {
  validateBudgetEntryMutation,
  calculateCategoryLockedAmount,
  resolveLinkedSubItem,
  computeDailyExpenseStats,
  computeGeneralBudgetStats,
} from '@/lib/server/budget-validator';
import { BudgetCategory, BudgetEntry } from '@/types';

describe('Budget Validator Unit Tests (e-호조 회계 및 5대 재정 제약 검증)', () => {
  const mockCategory: BudgetCategory = {
    id: 'cat-health-1',
    name: '신체활동 활성화 사업',
    totalBudget: 50_000_000,
    color: '#3b82f6',
    policyProject: '건강증진',
    unitProject: '신체활동',
    detailedProject: '걷기활성화',
    statItem: '일반수용비',
    subItems: [
      {
        id: 'sub-open-1',
        name: '현수막 및 홍보물 제작',
        amount: 5_000_000,
        isLocked: false,
        calculations: [
          {
            id: 'calc-open-1-1',
            name: '가로등 배너',
            calculation: '100,000원 x 20개',
            amount: 2_000_000,
            isLocked: false,
          },
          {
            id: 'calc-locked-1-2',
            name: '대형 육교 현수막 (동결)',
            calculation: '1,500,000원 x 2개',
            amount: 3_000_000,
            isLocked: true,
          },
        ],
      },
      {
        id: 'sub-locked-parent-2',
        name: '기념품 제작 (사업계획 변경 잠금)',
        amount: 10_000_000,
        isLocked: true,
        calculations: [
          {
            id: 'calc-child-of-locked-2-1',
            name: '스포츠 양말',
            calculation: '10,000원 x 1,000명',
            amount: 10_000_000,
            isLocked: false, // parent is locked!
          },
        ],
      },
    ],
  };

  const sampleCategories: BudgetCategory[] = [mockCategory];

  describe('1. E2EE and Category Existence Validation', () => {
    it('cleanly passes when entry has no categoryId (E2EE encrypted payload bypass)', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: { id: 'enc-entry-1', amount: 10_000_000 },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(true);
    });

    it('returns status 400 and INVALID_CATEGORY when categoryId does not exist in categories', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-invalid-cat',
          categoryId: 'non-existent-cat',
          amount: 1_000_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
        expect(result.code).toBe('INVALID_CATEGORY');
        expect(result.error).toContain('Invalid category ID');
      }
    });

    it('bypasses expenditure checks for transfer and correction action types', () => {
      const transferResult = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-transfer',
          categoryId: 'cat-health-1',
          actionType: 'transfer',
          amount: 200_000_000, // exceeds budget, but transfer is adjustment!
        },
        currentEntries: [],
        categories: sampleCategories,
      });
      expect(transferResult.valid).toBe(true);

      const correctionResult = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-correction',
          categoryId: 'cat-health-1',
          actionType: 'correction',
          amount: 200_000_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });
      expect(correctionResult.valid).toBe(true);
    });
  });

  describe('2. SubItem and Calculation Lock Verification', () => {
    it('blocks mutation if linkedSubItemId refers to directly locked subItem', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-locked-sub',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'sub-locked-parent-2',
          amount: 500_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('LOCKED_SUB_ITEM');
        expect(result.error).toContain('[잠금 상태]');
      }
    });

    it('blocks mutation if linkedSubItemId refers to a self-locked calculation', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-locked-calc',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-locked-1-2',
          amount: 500_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('LOCKED_SUB_ITEM');
      }
    });

    it('blocks mutation if child calculation is unlocked but its parent subItem is locked', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-parent-locked',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-child-of-locked-2-1',
          amount: 500_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('LOCKED_SUB_ITEM');
      }
    });

    it('allows mutation if actionType is settle, even if linkedSubItemId is locked', () => {
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-settle-locked',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-locked-1-2',
          actionType: 'settle',
          amount: 500_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('3. SubItem Ceiling Limit Enforcement', () => {
    it('blocks mutation when cumulative usage exceeds subItem amount limit', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'prev-entry-1',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-open-1-1',
          amount: 1_800_000,
          date: '2026-05-01',
          purpose: '1차 배너',
        },
      ];

      // Limit is 2,000,000. 1.8M + 500k = 2.3M > 2.0M
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-sub-exceed',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-open-1-1',
          amount: 500_000,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('SUB_ITEM_LIMIT_EXCEEDED');
        expect(result.error).toContain('[산출내역 한도 초과]');
        expect(result.details?.subLimit).toBe(2_000_000);
        expect(result.details?.newUsage).toBe(2_300_000);
      }
    });

    it('allows mutation when cumulative usage with transfer deductions stays within limit', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'prev-entry-1',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-open-1-1',
          amount: 1_800_000,
          date: '2026-05-01',
          purpose: '1차 배너',
        },
        {
          id: 'prev-transfer-1',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-open-1-1',
          actionType: 'transfer',
          amount: 500_000, // transfers deduct: 1.8M - 0.5M = 1.3M
          date: '2026-05-05',
          purpose: '타 비목 전출',
        },
      ];

      // 1.3M + 600k = 1.9M <= 2.0M limit
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-sub-pass',
          categoryId: 'cat-health-1',
          linkedSubItemId: 'calc-open-1-1',
          amount: 600_000,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('4. e-호조 Daily Expense (daily_expense) Isolation Pipeline', () => {
    it('blocks actual daily_expense expenditure when exceeding issuance balance', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'issue-1',
          categoryId: 'cat-health-1',
          actionType: 'issuance',
          amount: 3_000_000, // Issued: 3M
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 1차 교부',
        },
        {
          id: 'daily-spent-1',
          categoryId: 'cat-health-1',
          actionType: 'daily_expense',
          amount: 2_500_000, // Spent: 2.5M
          isPlanned: false,
          date: '2026-06-05',
          purpose: '홍보물 발송 우편료',
        },
      ];

      // Total daily usage would become 2.5M + 1.0M = 3.5M > 3.0M issued!
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'daily-spent-2',
          categoryId: 'cat-health-1',
          actionType: 'daily_expense',
          amount: 1_000_000,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('DAILY_EXPENSE_LIMIT_EXCEEDED');
        expect(result.error).toContain('[일상경비 한도 초과]');
        expect(result.details?.dailyIssued).toBe(3_000_000);
        expect(result.details?.dailySpent).toBe(3_500_000);
      }
    });

    it('does NOT block planned daily_expense entries against actual issuance balance', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'issue-1',
          categoryId: 'cat-health-1',
          actionType: 'issuance',
          amount: 1_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 교부',
        },
      ];

      // Planned daily expense can be proposed before actual secondary issuance is made
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'daily-plan-1',
          categoryId: 'cat-health-1',
          actionType: 'daily_expense',
          amount: 2_000_000,
          isPlanned: true,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('5. General Budget Ceiling and Zero Double-Counting Invariant (Rule R)', () => {
    it('enforces total budget ceiling on actual expenditure including locked amount and daily issuance', () => {
      // Total budget = 50,000,000.
      // Locked amount in cat = 3M (calc-locked-1-2) + 10M (sub-locked-parent-2) = 13M.
      // General spent = 30M. Daily issuance = 5M.
      // Total usage = 30M + 5M + 13M = 48M.
      const existingEntries: BudgetEntry[] = [
        {
          id: 'spent-1',
          categoryId: 'cat-health-1',
          actionType: 'general',
          amount: 30_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '행사 대행 용역',
        },
        {
          id: 'issue-1',
          categoryId: 'cat-health-1',
          actionType: 'issuance',
          amount: 5_000_000,
          isPlanned: false,
          date: '2026-06-02',
          purpose: '일상경비 교부',
        },
      ];

      // Adding 3,000,000: 48M + 3M = 51M > 50M total budget!
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'spent-over',
          categoryId: 'cat-health-1',
          actionType: 'general',
          amount: 3_000_000,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(409);
        expect(result.code).toBe('BUDGET_CEILING_EXCEEDED');
        expect(result.error).toContain('[예산 한도 초과]');
        expect(result.details?.totalBudget).toBe(50_000_000);
        expect(result.details?.totalUsage).toBe(51_000_000);
      }
    });

    it('strictly avoids double-counting planned daily_expense in general budget planned totals', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'issue-1',
          categoryId: 'cat-health-1',
          actionType: 'issuance',
          amount: 5_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 교부',
        },
        {
          id: 'daily-planned-1',
          categoryId: 'cat-health-1',
          actionType: 'daily_expense',
          amount: 4_000_000,
          isPlanned: true,
          date: '2026-06-10',
          purpose: '예정된 일상경비 지출',
        },
      ];

      const generalStats = computeGeneralBudgetStats(existingEntries, 5_000_000, 0);

      // ★ Rule R Invariant:
      // planned must be 0 because daily_expense planned is excluded!
      expect(generalStats.planned).toBe(0);
      // spent is generalSpent (0) + dailyExpenseIssued (5M) = 5M
      expect(generalStats.spent).toBe(5_000_000);
      expect(generalStats.totalUsageActual).toBe(5_000_000);
      expect(generalStats.totalUsagePlanned).toBe(5_000_000);
    });

    it('correctly handles update action simulating replacement of existing entry', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'entry-update-test',
          categoryId: 'cat-health-1',
          actionType: 'general',
          amount: 2_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '원래 200만원',
        },
      ];

      // Updating entry from 2M to 36M:
      // 36M + 13M (locked) = 49M <= 50M -> should pass!
      const passResult = validateBudgetEntryMutation({
        action: 'update',
        entryId: 'entry-update-test',
        entryData: {
          amount: 36_000_000,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(passResult.valid).toBe(true);

      // Updating entry from 2M to 38M:
      // 38M + 13M (locked) = 51M > 50M -> should be blocked!
      const failResult = validateBudgetEntryMutation({
        action: 'update',
        entryId: 'entry-update-test',
        entryData: {
          amount: 38_000_000,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(failResult.valid).toBe(false);
      if (!failResult.valid) {
        expect(failResult.code).toBe('BUDGET_CEILING_EXCEEDED');
      }
    });
  });

  describe('6. Helper Functions Unit Tests', () => {
    it('calculateCategoryLockedAmount correctly sums all locked items', () => {
      const locked = calculateCategoryLockedAmount(mockCategory);
      // sub-locked-parent-2 (10M) + calc-locked-1-2 (3M) = 13M
      expect(locked).toBe(13_000_000);
    });

    it('resolveLinkedSubItem resolves direct subItems and nested calculations', () => {
      const direct = resolveLinkedSubItem(mockCategory, 'sub-open-1');
      expect(direct).not.toBeNull();
      expect(direct?.isLocked).toBe(false);

      const nested = resolveLinkedSubItem(mockCategory, 'calc-locked-1-2');
      expect(nested).not.toBeNull();
      expect(nested?.isLocked).toBe(true);

      const parentLocked = resolveLinkedSubItem(mockCategory, 'calc-child-of-locked-2-1');
      expect(parentLocked).not.toBeNull();
      expect(parentLocked?.isLocked).toBe(true);

      const notFound = resolveLinkedSubItem(mockCategory, 'unknown-sub');
      expect(notFound).toBeNull();
    });

    it('computeDailyExpenseStats returns correct issued, spent, and planned amounts', () => {
      const entries: BudgetEntry[] = [
        {
          id: '1',
          categoryId: 'cat-1',
          purpose: '교부',
          date: '2026-06-01',
          actionType: 'issuance',
          amount: 10_000_000,
          isPlanned: false,
        },
        {
          id: '2',
          categoryId: 'cat-1',
          purpose: '지출',
          date: '2026-06-02',
          actionType: 'daily_expense',
          amount: 3_000_000,
          isPlanned: false,
        },
        {
          id: '3',
          categoryId: 'cat-1',
          purpose: '예정',
          date: '2026-06-03',
          actionType: 'daily_expense',
          amount: 2_000_000,
          isPlanned: true,
          isSettled: false,
        },
        {
          id: '4',
          categoryId: 'cat-1',
          purpose: '정산완료',
          date: '2026-06-04',
          actionType: 'daily_expense',
          amount: 1_000_000,
          isPlanned: true,
          isSettled: true,
        }, // settled excluded
      ];

      const stats = computeDailyExpenseStats(entries);
      expect(stats.issued).toBe(10_000_000);
      expect(stats.spent).toBe(3_000_000);
      expect(stats.planned).toBe(2_000_000);
    });
  });
});
