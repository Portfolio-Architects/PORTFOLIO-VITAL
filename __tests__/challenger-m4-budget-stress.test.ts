// Mock next/server to bypass Next.js server-side loading issues in Jest JSDOM
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn().mockImplementation((body, init) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      }),
    },
  };
});

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  validateBudgetEntryMutation,
  calculateCategoryLockedAmount,
  resolveLinkedSubItem,
  computeDailyExpenseStats,
  computeGeneralBudgetStats,
} from '@/lib/server/budget-validator';
import { POST, GET, withSheetLock } from '@/app/api/data/route';
import { invalidateSheetCache } from '@/lib/server/storage-service';
import { BudgetCategory, BudgetEntry } from '@/types';

function createPostRequest(body: any): any {
  return {
    url: 'http://localhost:3001/api/data',
    json: async () => body,
  };
}

function createGetRequest(url: string): any {
  return {
    url,
  };
}

describe('Challenger M4-2: e-호조 Fiscal Accounting Adversarial Stress Tests', () => {
  jest.setTimeout(30000);

  const testDataDir = path.join(
    os.tmpdir(),
    `vital-challenger-m4-stress-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );

  beforeAll(async () => {
    process.env.VITAL_TEST_DATA_DIR = testDataDir;
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterAll(async () => {
    delete process.env.VITAL_TEST_DATA_DIR;
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    invalidateSheetCache();
  });

  // Base test categories for unit and integration testing
  const mockHealthCategory: BudgetCategory = {
    id: 'cat-physical-health',
    name: '신체활동 활성화 사업',
    totalBudget: 10_000_000, // 10,000,000 KRW
    color: '#10b981',
    policyProject: '건강증진',
    unitProject: '신체활동',
    detailedProject: '걷기활성화',
    statItem: '일반운영비',
    subItems: [
      {
        id: 'sub-promo-unlocked',
        name: '홍보물 제작 (열림)',
        amount: 3_000_000, // 3M
        isLocked: false,
        calculations: [
          {
            id: 'calc-banner-unlocked',
            name: '가로등 배너',
            calculation: '100,000원 x 10개',
            amount: 1_000_000, // 1M
            isLocked: false,
          },
          {
            id: 'calc-banner-locked',
            name: '육교 대형 현수막 (동결)',
            calculation: '2,000,000원 x 1개',
            amount: 2_000_000, // 2M
            isLocked: true, // Self locked
          },
        ],
      },
      {
        id: 'sub-souvenir-locked-parent',
        name: '기념품 구입 (상위 잠금)',
        amount: 4_000_000, // 4M
        isLocked: true, // Parent locked
        calculations: [
          {
            id: 'calc-towel-child-unlocked',
            name: '기념 타월',
            calculation: '4,000원 x 1,000장',
            amount: 4_000_000, // 4M
            isLocked: false, // Child marked unlocked, but parent is locked!
          },
        ],
      },
      {
        id: 'sub-pure-unlocked',
        name: '체험 부스 용품',
        amount: 3_000_000, // 3M
        isLocked: false,
      },
    ],
  };

  const sampleCategories: BudgetCategory[] = [mockHealthCategory];

  // =========================================================================
  // 1. BOUNDARY CONDITIONS ON E-호조 RULES: ZERO-WON BOUNDARIES & 1-WON OVERFLOW
  // =========================================================================
  describe('1. Boundary Conditions: Zero-Won Boundaries & 1-Won Overflows', () => {
    it('1.1: Exact Zero-Won Exhaustion: allows spending up to exact ceiling, blocks 1-won overflow', () => {
      // Total budget is 10,000,000.
      // Locked amount in category = 2,000,000 (calc-banner-locked) + 4,000,000 (sub-souvenir-locked-parent) = 6,000,000.
      // Available general spending = 10,000,000 - 6,000,000 = 4,000,000.
      const existingEntries: BudgetEntry[] = [
        {
          id: 'entry-spend-1',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 3_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '1차 물품 구입',
        },
      ];

      // Exact boundary: 3,000,000 + 1,000,000 + 6,000,000 = 10,000,000 (Exactly 0 won remaining!)
      const exactMatch = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-exact-boundary',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1_000_000,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(exactMatch.valid).toBe(true);

      // Exact 1-Won Overflow: 3,000,000 + 1,000,001 + 6,000,000 = 10,000,001 (> 10,000,000)
      const oneWonOverflow = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-one-won-over',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1_000_001,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(oneWonOverflow.valid).toBe(false);
      if (!oneWonOverflow.valid) {
        expect(oneWonOverflow.status).toBe(409);
        expect(oneWonOverflow.code).toBe('BUDGET_CEILING_EXCEEDED');
        expect(oneWonOverflow.details?.totalBudget).toBe(10_000_000);
        expect(oneWonOverflow.details?.totalUsage).toBe(10_000_001);
      }
    });

    it('1.2: Exact 0-Won entry when budget is fully exhausted (Delta = 0) passes without error', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'entry-spend-full',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 4_000_000, // exhausts available 4M exactly
          isPlanned: false,
          date: '2026-06-01',
          purpose: '전액 소진',
        },
      ];

      // 0-won entry added to zero-remaining category
      const zeroEntry = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-zero-won',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 0,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(zeroEntry.valid).toBe(true);

      // 1-won entry added to zero-remaining category fails
      const oneWonAttempt = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-one-won-fail',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(oneWonAttempt.valid).toBe(false);
      if (!oneWonAttempt.valid) {
        expect(oneWonAttempt.code).toBe('BUDGET_CEILING_EXCEEDED');
      }
    });

    it('1.3: SubItem Ceiling: exact limit boundary passes, exact 1-won overflow fails', () => {
      // sub-promo-unlocked has limit 3,000,000.
      const existingEntries: BudgetEntry[] = [
        {
          id: 'sub-spend-1',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'sub-promo-unlocked',
          amount: 2_999_999,
          date: '2026-06-01',
          purpose: '홍보물 1차',
        },
      ];

      // Exact 1-won remaining to hit ceiling (2,999,999 + 1 = 3,000,000)
      const exactMatch = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'sub-spend-exact',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'sub-promo-unlocked',
          amount: 1,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(exactMatch.valid).toBe(true);

      // 2-won added -> 2,999,999 + 2 = 3,000,001 (1-won overflow beyond 3,000,000 limit)
      const overflow = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'sub-spend-overflow',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'sub-promo-unlocked',
          amount: 2,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(overflow.valid).toBe(false);
      if (!overflow.valid) {
        expect(overflow.status).toBe(409);
        expect(overflow.code).toBe('SUB_ITEM_LIMIT_EXCEEDED');
        expect(overflow.details?.subLimit).toBe(3_000_000);
        expect(overflow.details?.newUsage).toBe(3_000_001);
      }
    });

    it('1.4: Nested Calculation Ceiling: exact limit boundary passes, exact 1-won overflow fails', () => {
      // calc-banner-unlocked limit is 1,000,000
      const existingEntries: BudgetEntry[] = [
        {
          id: 'calc-spend-1',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-banner-unlocked',
          amount: 999_999,
          date: '2026-06-01',
          purpose: '배너 1차',
        },
      ];

      // Exactly 1 won left
      const exactCalc = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'calc-spend-exact',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-banner-unlocked',
          amount: 1,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(exactCalc.valid).toBe(true);

      // 2 won added -> 1,000,001 > 1,000,000
      const overflowCalc = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'calc-spend-over',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-banner-unlocked',
          amount: 2,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(overflowCalc.valid).toBe(false);
      if (!overflowCalc.valid) {
        expect(overflowCalc.code).toBe('SUB_ITEM_LIMIT_EXCEEDED');
        expect(overflowCalc.details?.subLimit).toBe(1_000_000);
        expect(overflowCalc.details?.newUsage).toBe(1_000_001);
      }
    });
  });

  // =========================================================================
  // 2. COMPLEX HIERARCHICAL LOCK INHERITANCE
  // =========================================================================
  describe('2. Hierarchical Lock Inheritance: Parent vs Child Status', () => {
    it('2.1: Calculation is marked unlocked, but parent SubItem is locked -> MUST BE BLOCKED', () => {
      // sub-souvenir-locked-parent isLocked: true
      // calc-towel-child-unlocked isLocked: false
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-child-unlocked-parent-locked',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-towel-child-unlocked',
          amount: 50_000,
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

    it('2.2: Parent SubItem is unlocked, but calculation is self-locked -> MUST BE BLOCKED', () => {
      // sub-promo-unlocked isLocked: false
      // calc-banner-locked isLocked: true
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-child-locked-parent-unlocked',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-banner-locked',
          amount: 100_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LOCKED_SUB_ITEM');
      }
    });

    it('2.3: Parent SubItem is unlocked, calculation is unlocked -> ALLOWED', () => {
      // sub-promo-unlocked isLocked: false
      // calc-banner-unlocked isLocked: false
      const result = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-both-unlocked',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-banner-unlocked',
          amount: 500_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(result.valid).toBe(true);
    });

    it('2.4: Action type settle is permitted even on a locked calculation or parent', () => {
      const settleResult = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'entry-settle-locked',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'calc-towel-child-unlocked',
          actionType: 'settle',
          amount: 100_000,
        },
        currentEntries: [],
        categories: sampleCategories,
      });

      expect(settleResult.valid).toBe(true);
    });

    it('2.5: Category locked amount calculation correctly computes sum of locked elements without double-counting', () => {
      const lockedSum = calculateCategoryLockedAmount(mockHealthCategory);
      // sub-promo-unlocked: calc-banner-locked (2M)
      // sub-souvenir-locked-parent: parent locked (4M) -> child calc-towel (4M) is NOT re-added!
      // sub-pure-unlocked: 0
      // Total locked sum = 2,000,000 + 4,000,000 = 6,000,000
      expect(lockedSum).toBe(6_000_000);
    });
  });

  // =========================================================================
  // 3. E-호조 DAILY EXPENSE (DAILY_EXPENSE) DUAL PIPELINE & ZERO DOUBLE-COUNTING
  // =========================================================================
  describe('3. e-호조 Daily Expense Dual Pipeline & Zero Double-Counting Invariant', () => {
    it('3.1: Actual daily_expense expenditure cannot exceed issuance: exact boundary passes, 1-won overflow fails', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'issuance-entry-1',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 2_000_000, // 2M issued
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 1차 교부',
        },
        {
          id: 'daily-expense-spent-1',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 1_500_000, // 1.5M spent
          isPlanned: false,
          date: '2026-06-05',
          purpose: '운영비 지출',
        },
      ];

      // Exact match: 1.5M + 500,000 = 2,000,000 <= 2,000,000 issued
      const exactDaily = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'daily-expense-exact',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 500_000,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(exactDaily.valid).toBe(true);

      // Exact 1-won overflow: 1.5M + 500,001 = 2,000,001 > 2,000,000 issued
      const overflowDaily = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'daily-expense-overflow',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 500_001,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(overflowDaily.valid).toBe(false);
      if (!overflowDaily.valid) {
        expect(overflowDaily.status).toBe(409);
        expect(overflowDaily.code).toBe('DAILY_EXPENSE_LIMIT_EXCEEDED');
        expect(overflowDaily.details?.dailyIssued).toBe(2_000_000);
        expect(overflowDaily.details?.dailySpent).toBe(2_000_001);
      }
    });

    it('3.2: Planned daily expense (isPlanned: true) bypasses 409 lock to allow deficit simulation (Rule R)', () => {
      const existingEntries: BudgetEntry[] = [
        {
          id: 'issuance-entry-1',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 1_000_000, // 1M issued
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 교부',
        },
      ];

      // Planned daily expense of 5M exceeds 1M issued, but isPlanned: true MUST be allowed
      const plannedDaily = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'daily-planned-simulation',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 5_000_000,
          isPlanned: true,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });

      expect(plannedDaily.valid).toBe(true);
    });

    it('3.3: Issuance itself is charged against general budget ceiling, preventing over-issuance', () => {
      // Total budget = 10,000,000. Locked = 6,000,000. Available general = 4,000,000.
      const existingEntries: BudgetEntry[] = [
        {
          id: 'general-spent-1',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 2_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일반 지출',
        },
      ];

      // Issuing 2,000,000: 2M general + 2M issuance + 6M locked = 10,000,000 <= 10M -> Passes!
      const exactIssuance = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'issuance-exact',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 2_000_000,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(exactIssuance.valid).toBe(true);

      // Issuing 2,000,001: 2M + 2,000,001 + 6M = 10,000,001 > 10M -> Fails with BUDGET_CEILING_EXCEEDED!
      const overIssuance = validateBudgetEntryMutation({
        action: 'add',
        entryData: {
          id: 'issuance-over',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 2_000_001,
          isPlanned: false,
        },
        currentEntries: existingEntries,
        categories: sampleCategories,
      });
      expect(overIssuance.valid).toBe(false);
      if (!overIssuance.valid) {
        expect(overIssuance.code).toBe('BUDGET_CEILING_EXCEEDED');
      }
    });

    it('3.4: Zero Double-Counting Invariant: Planned daily expense is strictly excluded from general planned totals', () => {
      const mixedEntries: BudgetEntry[] = [
        {
          id: 'issue-1',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 2_000_000,
          isPlanned: false,
          date: '2026-06-01',
          purpose: '일상경비 교부',
        },
        {
          id: 'gen-spent-1',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1_000_000,
          isPlanned: false,
          date: '2026-06-02',
          purpose: '일반 지출',
        },
        {
          id: 'daily-spent-actual-1',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 1_200_000,
          isPlanned: false,
          date: '2026-06-03',
          purpose: '실제 일상경비 지출',
        },
        {
          id: 'daily-planned-1',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 3_000_000,
          isPlanned: true,
          date: '2026-06-15',
          purpose: '예정 일상경비 (중복 합산 금지 대상)',
        },
        {
          id: 'gen-planned-1',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 800_000,
          isPlanned: true,
          date: '2026-06-20',
          purpose: '일반 예정 지출',
        },
      ];

      const generalStats = computeGeneralBudgetStats(mixedEntries, 2_000_000, 6_000_000);

      // Invariant 1: spent = generalSpent (1M) + dailyExpenseIssued (2M) = 3M
      expect(generalStats.spent).toBe(3_000_000);

      // Invariant 2: planned MUST equal ONLY gen-planned-1 (800k).
      // daily-planned-1 (3M) MUST NOT be included!
      expect(generalStats.planned).toBe(800_000);

      // Invariant 3: totalUsageActual = spent (3M) + locked (6M) = 9M
      expect(generalStats.totalUsageActual).toBe(9_000_000);

      // Invariant 4: totalUsagePlanned = spent (3M) + planned (800k) + locked (6M) = 9,800,000
      // (If double counted, it would be 12,800,000!)
      expect(generalStats.totalUsagePlanned).toBe(9_800_000);
    });
  });

  // =========================================================================
  // 4. END-TO-END /api/data ROUTE INTEGRATION UNDER ISOLATED TEST DIR
  // =========================================================================
  describe('4. /api/data Route POST & GET Fiscal Integration', () => {
    const seedCategories = async () => {
      const catFile = path.join(testDataDir, 'BUDGET_CATEGORIES.json');
      await fs.writeFile(catFile, JSON.stringify([mockHealthCategory], null, 2), 'utf-8');
      const entryFile = path.join(testDataDir, 'BUDGET_ENTRIES.json');
      await fs.writeFile(entryFile, JSON.stringify([], null, 2), 'utf-8');
      invalidateSheetCache();
    };

    beforeEach(async () => {
      await seedCategories();
    });

    it('4.1: POST /api/data allows valid budget entry addition and persists to disk', async () => {
      const req = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-api-valid-1',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1_500_000,
          date: '2026-06-01',
          purpose: 'API 등록 테스트',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify persistence via GET
      const getRes = await GET(createGetRequest('http://localhost:3001/api/data?sheet=BUDGET_ENTRIES'));
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.data).toHaveLength(1);
      expect(getJson.data[0].id).toBe('entry-api-valid-1');
      expect(getJson.data[0].amount).toBe(1_500_000);
    });

    it('4.2: POST /api/data returns 409 and BUDGET_CEILING_EXCEEDED when entry exceeds budget', async () => {
      // Available budget is 4M (10M total - 6M locked).
      // Attempting to post 4,000,001 KRW:
      const req = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-api-over',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 4_000_001,
          date: '2026-06-01',
          purpose: '초과 등록 시도',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('BUDGET_CEILING_EXCEEDED');
      expect(json.error).toContain('[예산 한도 초과]');

      // Verify disk was NOT mutated
      const getRes = await GET(createGetRequest('http://localhost:3001/api/data?sheet=BUDGET_ENTRIES'));
      const getJson = await getRes.json();
      expect(getJson.data).toHaveLength(0);
    });

    it('4.3: POST /api/data returns 409 and LOCKED_SUB_ITEM when attempting to spend on locked subItem', async () => {
      const req = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-api-locked',
          categoryId: 'cat-physical-health',
          linkedSubItemId: 'sub-souvenir-locked-parent',
          amount: 100_000,
          date: '2026-06-01',
          purpose: '잠긴 비목 지출 시도',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('LOCKED_SUB_ITEM');
      expect(json.error).toContain('[잠금 상태]');
    });

    it('4.4: POST /api/data returns 409 and DAILY_EXPENSE_LIMIT_EXCEEDED when daily expense exceeds issuance', async () => {
      // 1. First add an issuance entry of 1,000,000 KRW
      const issuanceReq = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-issue-1',
          categoryId: 'cat-physical-health',
          actionType: 'issuance',
          amount: 1_000_000,
          date: '2026-06-01',
          purpose: '1차 교부',
        },
      });
      const issueRes = await POST(issuanceReq);
      expect(issueRes.status).toBe(200);

      // 2. Now attempt to spend 1,000,001 KRW in daily expense
      const spendReq = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-daily-over',
          categoryId: 'cat-physical-health',
          actionType: 'daily_expense',
          amount: 1_000_001,
          date: '2026-06-02',
          purpose: '한도 초과 일상경비 지출',
        },
      });

      const spendRes = await POST(spendReq);
      expect(spendRes.status).toBe(409);
      const json = await spendRes.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('DAILY_EXPENSE_LIMIT_EXCEEDED');
      expect(json.error).toContain('[일상경비 한도 초과]');
    });

    it('4.5: POST /api/data returns 400 and INVALID_CATEGORY for non-existent categoryId', async () => {
      const req = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-bad-cat',
          categoryId: 'non-existent-category-id',
          amount: 50_000,
          date: '2026-06-01',
          purpose: '잘못된 카테고리',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_CATEGORY');
    });

    it('4.6: POST /api/data handles update action replacing old amount and enforcing ceiling', async () => {
      // Seed initial entry of 1,000,000 KRW
      const initReq = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'add',
        data: {
          id: 'entry-update-target',
          categoryId: 'cat-physical-health',
          actionType: 'general',
          amount: 1_000_000,
          date: '2026-06-01',
          purpose: '원래 100만원',
        },
      });
      await POST(initReq);

      // Available total is 4M. Updating to 4M: 4M + 6M locked = 10M -> Passes!
      const updatePassReq = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'update',
        id: 'entry-update-target',
        data: {
          amount: 4_000_000,
        },
      });
      const passRes = await POST(updatePassReq);
      expect(passRes.status).toBe(200);

      // Updating to 4,000,001 KRW: 4,000,001 + 6M locked = 10,000,001 > 10M -> Fails 409!
      const updateFailReq = createPostRequest({
        sheet: 'BUDGET_ENTRIES',
        action: 'update',
        id: 'entry-update-target',
        data: {
          amount: 4_000_001,
        },
      });
      const failRes = await POST(updateFailReq);
      expect(failRes.status).toBe(409);
      const failJson = await failRes.json();
      expect(failJson.code).toBe('BUDGET_CEILING_EXCEEDED');
    });
  });
});
