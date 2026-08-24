import AsyncStorage from '@react-native-async-storage/async-storage';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

// Categories are AsyncStorage-backed (seeded from DEFAULT_CATEGORIES on first
// read) rather than a fixed list, so users can add their own and edit any
// category's icon/color/name — including the seeded defaults, which are
// just ordinary rows after the first seed, not special-cased. There's no
// delete yet: Transaction.categoryId/Budget.categoryId are foreign keys with
// no reassignment UI, see TODO.md.
export type CategoryType = 'expense' | 'income';
export type CategoryIcon = ComponentProps<typeof MaterialIcons>['name'];

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  type: CategoryType;
}

// Swatches offered in the category editor's color picker.
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

export function getCategory(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function categoriesForType(categories: Category[], type: CategoryType): Category[] {
  return categories.filter((c) => c.type === type);
}
