import AsyncStorage from '@react-native-async-storage/async-storage';

import { byCategoryTotals, type Transaction } from '@/lib/transactions';

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
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

export function setBudget(categoryId: string, monthlyLimit: number): Promise<void> {
  return enqueue(async () => {
    const budgets = await getBudgets();
    const existing = budgets.find((b) => b.categoryId === categoryId);
    const next = existing
      ? budgets.map((b) => (b.categoryId === categoryId ? { ...b, monthlyLimit } : b))
      : [...budgets, { categoryId, monthlyLimit }];
    await saveBudgets(next);
  });
}

export function removeBudget(categoryId: string): Promise<void> {
  return enqueue(async () => {
    const budgets = await getBudgets();
    await saveBudgets(budgets.filter((b) => b.categoryId !== categoryId));
  });
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
    return {
      categoryId: b.categoryId,
      limit: b.monthlyLimit,
      spent,
      percent: b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0,
    };
  });
}
