import AsyncStorage from '@react-native-async-storage/async-storage';

import { byCategoryTotals, type Transaction } from '@/lib/transactions';

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
  // Single-month-only overrides ("YYYY-MM" -> limit), independent of the recurring default.
  overrides?: Record<string, number>;
  // A pending change to the recurring default, effective from startMonth onward. At most one
  // at a time (applying a new "onward" change replaces it) — keeps effectiveLimit's resolution
  // simple instead of reconciling a stacked history of changes.
  scheduledChange?: { startMonth: string; limit: number };
}

const STORAGE_KEY = '@budgettracker/budgets';

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getBudgets(): Promise<Budget[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Budget[];
}

async function saveBudgets(budgets: Budget[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
}

export type LimitScope = 'once' | 'onward';

// Sets a category's limit. scope 'onward' changes the recurring default effective from
// startMonth (creating the budget if it didn't exist); scope 'once' only affects startMonth
// itself, leaving the recurring default untouched.
export function applyLimit(
  categoryId: string,
  startMonth: string,
  limit: number,
  scope: LimitScope
): Promise<void> {
  return enqueue(async () => {
    const budgets = await getBudgets();
    const existing = budgets.find((b) => b.categoryId === categoryId);
    const base: Budget = existing ?? { categoryId, monthlyLimit: 0 };
    const updated: Budget =
      scope === 'once'
        ? { ...base, overrides: { ...base.overrides, [startMonth]: limit } }
        : { ...base, scheduledChange: { startMonth, limit } };
    const next = existing
      ? budgets.map((b) => (b.categoryId === categoryId ? updated : b))
      : [...budgets, updated];
    await saveBudgets(next);
  });
}

export function removeBudget(categoryId: string): Promise<void> {
  return enqueue(async () => {
    const budgets = await getBudgets();
    await saveBudgets(budgets.filter((b) => b.categoryId !== categoryId));
  });
}

// Clears whichever change currently governs monthStr (a same-month override, or a scheduled
// change already in effect), reverting that month back to the recurring default.
export function resetToDefault(categoryId: string, monthStr: string): Promise<void> {
  return enqueue(async () => {
    const budgets = await getBudgets();
    const next = budgets.map((b) => {
      if (b.categoryId !== categoryId) return b;
      if (b.overrides?.[monthStr] != null) {
        const { [monthStr]: _removed, ...rest } = b.overrides;
        return { ...b, overrides: rest };
      }
      if (b.scheduledChange && b.scheduledChange.startMonth <= monthStr) {
        const { scheduledChange: _removed, ...rest } = b;
        return rest;
      }
      return b;
    });
    await saveBudgets(next);
  });
}

export function effectiveLimit(budget: Budget, monthStr: string): number {
  if (budget.overrides?.[monthStr] != null) return budget.overrides[monthStr];
  if (budget.scheduledChange && budget.scheduledChange.startMonth <= monthStr) {
    return budget.scheduledChange.limit;
  }
  return budget.monthlyLimit;
}

export interface BudgetProgress {
  categoryId: string;
  limit: number;
  spent: number;
  percent: number; // 0-1+, can exceed 1 when over budget
}

export function getBudgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  monthStr: string
): BudgetProgress[] {
  const spentByCategory = byCategoryTotals(transactions, monthStr, 'expense');
  return budgets.map((b) => {
    const spent = spentByCategory[b.categoryId] ?? 0;
    const limit = effectiveLimit(b, monthStr);
    return {
      categoryId: b.categoryId,
      limit,
      spent,
      percent: limit > 0 ? spent / limit : 0,
    };
  });
}
