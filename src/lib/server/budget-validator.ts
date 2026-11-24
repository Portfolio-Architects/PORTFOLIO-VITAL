import { BudgetCategory, BudgetEntry, BudgetSubItem, BudgetCalculation } from '@/types';

export type BudgetValidationErrorCode =
  | 'INVALID_CATEGORY'
  | 'LOCKED_SUB_ITEM'
  | 'SUB_ITEM_LIMIT_EXCEEDED'
  | 'DAILY_EXPENSE_LIMIT_EXCEEDED'
  | 'BUDGET_CEILING_EXCEEDED';

export interface BudgetValidationSuccess {
  valid: true;
}

export interface BudgetValidationFailure {
  valid: false;
  status: 400 | 409;
  code: BudgetValidationErrorCode;
  error: string;
  details?: {
    categoryId?: string;
    subLimit?: number;
    newUsage?: number;
    dailyIssued?: number;
    dailySpent?: number;
    totalBudget?: number;
    totalUsage?: number;
  };
}

export type BudgetValidationResult = BudgetValidationSuccess | BudgetValidationFailure;

export interface BudgetValidationContext {
  action: 'add' | 'update';
  entryData: Partial<BudgetEntry> | any;
  entryId?: string;
  currentEntries: (BudgetEntry | any)[];
  categories: (BudgetCategory | any)[];
}

/**
 * Pure helper: Computes the sum of all locked sub-items and calculations for a category.
 */
export function calculateCategoryLockedAmount(cat: BudgetCategory | any): number {
  let lockedAmount = 0;
  if (cat && Array.isArray(cat.subItems)) {
    cat.subItems.forEach((sub: any) => {
      if (sub.isLocked) {
        lockedAmount += Number(sub.amount) || 0;
      } else if (Array.isArray(sub.calculations)) {
        sub.calculations.forEach((calc: any) => {
          if (calc.isLocked) lockedAmount += Number(calc.amount) || 0;
        });
      }
    });
  }
  return lockedAmount;
}

/**
 * Pure helper: Resolves a linked sub-item or calculation and determines its lock status.
 */
export function resolveLinkedSubItem(
  cat: BudgetCategory | any,
  linkedSubItemId: string
): { item: BudgetSubItem | BudgetCalculation | any; isLocked: boolean; parentSubItem?: any } | null {
  if (!cat || !Array.isArray(cat.subItems)) return null;

  // 1. Direct subItem check
  const directSub = cat.subItems.find((s: any) => s.id === linkedSubItemId);
  if (directSub) {
    return {
      item: directSub,
      isLocked: Boolean(directSub.isLocked),
    };
  }

  // 2. Nested calculation check
  for (const parentSub of cat.subItems) {
    if (Array.isArray(parentSub.calculations)) {
      const calc = parentSub.calculations.find((c: any) => c.id === linkedSubItemId);
      if (calc) {
        const isSelfLocked = Boolean(calc.isLocked);
        const isParentLocked = Boolean(parentSub.isLocked);
        return {
          item: calc,
          isLocked: isSelfLocked || isParentLocked,
          parentSubItem: parentSub,
        };
      }
    }
  }

  return null;
}

/**
 * Pure helper: Computes daily expense statistics (issued, spent, planned).
 */
export function computeDailyExpenseStats(entries: (BudgetEntry | any)[]): {
  issued: number;
  spent: number;
  planned: number;
} {
  const issued = entries
    .filter((e) => !e.isPlanned && e.actionType === 'issuance')
    .reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0);

  const spent = entries
    .filter((e) => !e.isPlanned && e.actionType === 'daily_expense')
    .reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0);

  const planned = entries
    .filter((e) => e.isPlanned && !e.isSettled && e.actionType === 'daily_expense')
    .reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0);

  return { issued, spent, planned };
}

/**
 * Pure helper: Computes general expenditure statistics with daily expense issuance charged
 * and planned daily expense excluded from general planned sum (Zero Double-Counting Invariant).
 */
export function computeGeneralBudgetStats(
  entries: (BudgetEntry | any)[],
  dailyExpenseIssued: number,
  lockedAmount: number
): {
  spent: number;
  planned: number;
  totalUsagePlanned: number;
  totalUsageActual: number;
} {
  const generalSpent = entries
    .filter(
      (e) =>
        !e.isPlanned &&
        (!e.actionType ||
          e.actionType === 'general' ||
          e.actionType === 'correction' ||
          e.actionType === 'transfer')
    )
    .reduce((sum: number, e) => {
      const amt = Number(e.amount) || 0;
      if (e.actionType === 'transfer') return sum - amt;
      return sum + amt;
    }, 0);

  const spent = generalSpent + dailyExpenseIssued;

  // ★ Rule R Invariant: Planned daily expense & bid_saving (집행유보) are excluded from general planned sum
  // because dailyExpenseIssued is already included in spent and bid_saving is an unspendable reserve (not expenditure).
  const generalPlanned = entries
    .filter((e) => e.isPlanned && !e.isSettled && e.actionType !== 'daily_expense' && e.actionType !== 'bid_saving')
    .reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0);

  const totalUsageActual = spent + lockedAmount;
  const totalUsagePlanned = spent + generalPlanned + lockedAmount;

  return {
    spent,
    planned: generalPlanned,
    totalUsageActual,
    totalUsagePlanned,
  };
}

/**
 * Pure function: Validates an incoming budget entry mutation against e-Hojo fiscal rules:
 * 1. Valid Category existence
 * 2. SubItem / Calculation Lock status
 * 3. SubItem budget ceiling
 * 4. Daily Expense (daily_expense) issuance balance isolation
 * 5. General budget ceiling with zero double-counting
 */
export function validateBudgetEntryMutation(context: BudgetValidationContext): BudgetValidationResult {
  const { action, entryData, entryId, currentEntries, categories } = context;

  let tempRows = [...currentEntries];
  if (action === 'add') {
    tempRows.push(entryData);
  } else if (action === 'update' && entryId) {
    const idx = tempRows.findIndex((r: any) => r.id === entryId);
    if (idx !== -1) {
      tempRows[idx] = { ...tempRows[idx], ...entryData };
    }
  }

  const targetEntry =
    action === 'add' ? entryData : tempRows.find((r: any) => r.id === entryId) || entryData;

  // E2EE support: if the payload is encrypted (no categoryId in plaintext), skip server-side budget validation
  if (!targetEntry || !targetEntry.categoryId) {
    return { valid: true };
  }

  const categoryId = targetEntry.categoryId;
  const cat = categories.find((c: any) => c.id === categoryId);

  if (!cat) {
    return {
      valid: false,
      status: 400,
      code: 'INVALID_CATEGORY',
      error: 'Invalid category ID',
      details: { categoryId },
    };
  }

  const actionType = targetEntry.actionType || 'general';

  // Transfers, corrections, and bid_saving (집행유보·불용 확정) do not add net actual expenditures
  if (actionType === 'transfer' || actionType === 'correction' || actionType === 'bid_saving') {
    return { valid: true };
  }

  const catEntries = tempRows.filter((e: any) => e.categoryId === categoryId);
  const lockedAmount = calculateCategoryLockedAmount(cat);

  // 1 & 2. SubItem / Calculation Lock and Ceiling Check
  const linkedSubItemId = targetEntry.linkedSubItemId;
  if (linkedSubItemId && actionType !== 'settle') {
    const resolved = resolveLinkedSubItem(cat, linkedSubItemId);
    if (resolved) {
      if (resolved.isLocked) {
        return {
          valid: false,
          status: 409,
          code: 'LOCKED_SUB_ITEM',
          error: `[잠금 상태] 선택한 산출내역은 예산 지출이 방지(잠금)되어 있습니다.`,
          details: { categoryId, subLimit: Number(resolved.item.amount) || 0 },
        };
      }

      const subLimit = Number(resolved.item.amount) || 0;
      if (subLimit > 0) {
        const linkedEntries = catEntries.filter(
          (en: any) => en.linkedSubItemId === linkedSubItemId && en.actionType !== 'settle'
        );
        const newUsage = linkedEntries.reduce((sum: number, en: any) => {
          const amt = Number(en.amount) || 0;
          if (en.actionType === 'correction') return sum + amt;
          if (en.actionType === 'transfer') return sum - amt;
          return sum + amt;
        }, 0);

        if (newUsage > subLimit) {
          return {
            valid: false,
            status: 409,
            code: 'SUB_ITEM_LIMIT_EXCEEDED',
            error: `[산출내역 한도 초과] 선택한 산출내역의 한도(${subLimit.toLocaleString()}원)를 초과하여 등록을 차단합니다. (누적 계산액: ${newUsage.toLocaleString()}원)`,
            details: { categoryId, subLimit, newUsage },
          };
        }
      }
    }
  }

  // 3. e-호조 Daily Expense (daily_expense) Isolation Pipeline
  const dailyStats = computeDailyExpenseStats(catEntries);
  if (actionType === 'daily_expense') {
    const isEntryPlanned = targetEntry.isPlanned === true;
    const totalDailyUsage = isEntryPlanned
      ? dailyStats.spent + dailyStats.planned
      : dailyStats.spent;

    // 실집행(!isEntryPlanned) 시에는 교부 잔액 초과를 엄격히 차단
    if (!isEntryPlanned && totalDailyUsage > dailyStats.issued) {
      return {
        valid: false,
        status: 409,
        code: 'DAILY_EXPENSE_LIMIT_EXCEEDED',
        error: `[일상경비 한도 초과] 일상경비 교부 잔액(${dailyStats.issued.toLocaleString()}원)을 초과하여 등록을 차단합니다. (누적 지출액: ${totalDailyUsage.toLocaleString()}원)`,
        details: { categoryId, dailyIssued: dailyStats.issued, dailySpent: totalDailyUsage },
      };
    }
  }

  // 4 & 5. General Budget Expenditure Ceiling & Zero Double-Counting Guard
  if (actionType !== 'settle' && actionType !== 'daily_expense') {
    const generalStats = computeGeneralBudgetStats(catEntries, dailyStats.issued, lockedAmount);
    const isEntryPlanned = targetEntry.isPlanned === true;
    const totalUsage = isEntryPlanned
      ? generalStats.totalUsagePlanned
      : generalStats.totalUsageActual;

    const totalBudget = Number(cat.totalBudget) || 0;
    // 실집행(!isEntryPlanned) 시에는 가용 예산 초과를 엄격히 하드 차단
    if (!isEntryPlanned && totalBudget > 0 && totalUsage > totalBudget) {
      return {
        valid: false,
        status: 409,
        code: 'BUDGET_CEILING_EXCEEDED',
        error: `[예산 한도 초과] 등록하려는 금액이 해당 예산 과목의 잔액을 초과하여 등록을 차단합니다. (누적 실집행액: ${totalUsage.toLocaleString()}원 / 총예산: ${totalBudget.toLocaleString()}원)`,
        details: { categoryId, totalBudget, totalUsage },
      };
    }
  }

  return { valid: true };
}
