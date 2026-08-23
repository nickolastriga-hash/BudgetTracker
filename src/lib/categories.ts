import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

// Fixed, offline category set (no custom categories in v1 — see TODO.md).
// icon names are @expo/vector-icons MaterialIcons glyphs, used both as the
// NativeTabs-style small icon and in category chips/lists.
export type CategoryType = 'expense' | 'income';
export type CategoryIcon = ComponentProps<typeof MaterialIcons>['name'];

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  type: CategoryType;
}

export const EXPENSE_CATEGORIES: Category[] = [
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
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', icon: 'work', color: '#34C759', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'laptop-mac', color: '#5AC8FA', type: 'income' },
  { id: 'investments', name: 'Investments', icon: 'trending-up', color: '#AF52DE', type: 'income' },
  { id: 'gifts_income', name: 'Gifts', icon: 'card-giftcard', color: '#30B0C7', type: 'income' },
  { id: 'other_income', name: 'Other Income', icon: 'more-horiz', color: '#98989D', type: 'income' },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategory(id: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id);
}

export function categoriesForType(type: CategoryType): Category[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}
