import AsyncStorage from '@react-native-async-storage/async-storage';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { removeBudget } from '@/lib/budgets';
import { reassignRecurringCategory } from '@/lib/recurring';
import { reassignTransactionsCategory } from '@/lib/transactions';

// Categories are AsyncStorage-backed (seeded from DEFAULT_CATEGORIES on first
// read) rather than a fixed list, so users can add their own and edit any
// category's icon/color/name — including the seeded defaults, which are
// just ordinary rows after the first seed, not special-cased. Deleting one
// reassigns its transactions/recurring series to that type's "Other"
// catch-all (see deleteCategory), which is why the two "Other" rows
// themselves can't be deleted.
export type CategoryType = 'expense' | 'income';
export type CategoryIcon = ComponentProps<typeof MaterialIcons>['name'];

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  type: CategoryType;
}

// Swatches offered in the category editor's color picker. The 2026-08-31
// "no grey" change (swapped the systemGray slot for a second, more magenta
// pink, on the theory that grey reads as "uncategorized"/"disabled" rather
// than a real category identity) was reverted 2026-09-01 per explicit
// feedback that grey should actually be pickable — back to systemGray
// '#8E8E93' in the last slot, with the standalone extra pink dropped rather
// than kept alongside it.
export const CATEGORY_COLORS = [
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#5AC8FA',
  '#007AFF',
  '#5856D6',
  '#AF52DE',
  '#FF2D55',
  '#A2845E',
  '#8E8E93',
] as const;

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Dining', icon: 'restaurant', color: '#FF9500', type: 'expense' },
  { id: 'groceries', name: 'Groceries', icon: 'local-grocery-store', color: '#34C759', type: 'expense' },
  { id: 'transport', name: 'Transport', icon: 'directions-car', color: '#5AC8FA', type: 'expense' },
  { id: 'housing', name: 'Housing', icon: 'home', color: '#AF52DE', type: 'expense' },
  { id: 'utilities', name: 'Utilities', icon: 'bolt', color: '#FFCC00', type: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: '#FF2D55', type: 'expense' },
  { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#BF5AF2', type: 'expense' },
  { id: 'health', name: 'Health', icon: 'local-hospital', color: '#FF3B30', type: 'expense' },
  { id: 'education', name: 'Education', icon: 'school', color: '#007AFF', type: 'expense' },
  { id: 'travel', name: 'Travel', icon: 'flight', color: '#00C7BE', type: 'expense' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'autorenew', color: '#8E8E93', type: 'expense' },
  { id: 'personal_care', name: 'Personal Care', icon: 'spa', color: '#FF6482', type: 'expense' },
  { id: 'gifts_donations', name: 'Gifts & Donations', icon: 'card-giftcard', color: '#30B0C7', type: 'expense' },
  { id: 'other_expense', name: 'Other', icon: 'more-horiz', color: '#98989D', type: 'expense' },
  { id: 'salary', name: 'Salary', icon: 'work', color: '#34C759', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'laptop-mac', color: '#5AC8FA', type: 'income' },
  { id: 'investments', name: 'Investments', icon: 'trending-up', color: '#AF52DE', type: 'income' },
  { id: 'gifts_income', name: 'Gifts', icon: 'card-giftcard', color: '#30B0C7', type: 'income' },
  { id: 'other_income', name: 'Other Income', icon: 'more-horiz', color: '#98989D', type: 'income' },
];

const STORAGE_KEY = '@budgettracker/categories';

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getCategories(): Promise<Category[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  return JSON.parse(raw) as Category[];
}

async function saveCategories(categories: Category[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function addCategory(data: Omit<Category, 'id'>): Promise<Category> {
  return enqueue(async () => {
    const categories = await getCategories();
    const category: Category = { ...data, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    await saveCategories([...categories, category]);
    return category;
  });
}

// `type` is intentionally not editable here — a budget category becoming an
// income category (or vice versa) mid-history would be a strange edit for a
// field that Budget/getBudgetProgress assume is stable.
export function updateCategory(id: string, data: Partial<Pick<Category, 'name' | 'icon' | 'color'>>): Promise<void> {
  return enqueue(async () => {
    const categories = await getCategories();
    const next = categories.map((c) => (c.id === id ? { ...c, ...data } : c));
    await saveCategories(next);
  });
}

// The seeded catch-all each type's deleted categories fall back to.
export const FALLBACK_CATEGORY_ID: Record<CategoryType, string> = {
  expense: 'other_expense',
  income: 'other_income',
};

export function isFallbackCategory(id: string): boolean {
  return id === FALLBACK_CATEGORY_ID.expense || id === FALLBACK_CATEGORY_ID.income;
}

// Removes a category and moves everything that referenced it onto its
// type's "Other" catch-all: transactions and recurring series are
// reassigned (history is kept, just recategorized), while its budget is
// dropped outright — merging a deleted category's limit into Other's would
// silently change a number the user never set. Resolves to how many
// transactions moved, for the UI's own confirmation copy.
export function deleteCategory(id: string): Promise<number> {
  return enqueue(async () => {
    if (isFallbackCategory(id)) throw new Error('The "Other" categories cannot be deleted.');
    const categories = await getCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) return 0;
    const fallbackId = FALLBACK_CATEGORY_ID[target.type];
    if (!categories.some((c) => c.id === fallbackId)) {
      throw new Error('The "Other" category this would move into is missing.');
    }
    const [moved] = await Promise.all([
      reassignTransactionsCategory(id, fallbackId),
      reassignRecurringCategory(id, fallbackId),
      removeBudget(id),
    ]);
    await saveCategories(categories.filter((c) => c.id !== id));
    return moved;
  });
}

export function getCategory(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function categoriesForType(categories: Category[], type: CategoryType): Category[] {
  return categories.filter((c) => c.type === type);
}
