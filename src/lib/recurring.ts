import AsyncStorage from '@react-native-async-storage/async-storage';

import { addTransaction, getTransactions, type TransactionType } from '@/lib/transactions';

// v1 only supports monthly recurrence (the common bill/subscription case) —
// weekly can be added later without changing this shape (frequency: 'monthly'
// would just become a discriminated union member).
export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  dayOfMonth: number; // 1-28, clamped so it's valid in every month
  startDate: string; // YYYY-MM-DD, first month this is due
  lastGeneratedMonth?: string; // YYYY-MM, last month a transaction was materialized for
}

const STORAGE_KEY = '@budgettracker/recurring';

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getRecurring(): Promise<RecurringTransaction[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as RecurringTransaction[];
}

async function saveRecurring(items: RecurringTransaction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addRecurring(data: Omit<RecurringTransaction, 'id' | 'lastGeneratedMonth'>): Promise<RecurringTransaction> {
  return enqueue(async () => {
    const items = await getRecurring();
    const item: RecurringTransaction = { ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    await saveRecurring([...items, item]);
    return item;
  });
}

export function deleteRecurring(id: string): Promise<void> {
  return enqueue(async () => {
    const items = await getRecurring();
    await saveRecurring(items.filter((r) => r.id !== id));
  });
}

function addMonths(monthStr: string, count: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateInMonth(monthStr: string, dayOfMonth: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(dayOfMonth, lastDayOfMonth);
  return `${monthStr}-${String(day).padStart(2, '0')}`;
}

// Materializes any recurring items' occurrences from their start month up to
// (and including) the current month into real transactions. Batched by month
// rather than scheduled ahead of time — same reasoning as habit reminders
// being generated lazily: there's no OS-level scheduler here, so a due
// occurrence only needs to exist once something actually asks "what's owed".
// Call once per app session (root layout), not per-screen-focus.
export async function generateDueTransactions(today: Date = new Date()): Promise<void> {
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const items = await getRecurring();
  if (items.length === 0) return;

  const updatedItems: RecurringTransaction[] = [];
  let anyGenerated = false;

  for (const item of items) {
    const startMonth = item.startDate.slice(0, 7);
    let cursor = item.lastGeneratedMonth ? addMonths(item.lastGeneratedMonth, 1) : startMonth;
    let lastGeneratedMonth = item.lastGeneratedMonth;

    while (cursor <= currentMonth) {
      await addTransaction({
        type: item.type,
        amount: item.amount,
        categoryId: item.categoryId,
        date: dateInMonth(cursor, item.dayOfMonth),
        note: item.note,
        recurringId: item.id,
      });
      anyGenerated = true;
      lastGeneratedMonth = cursor;
      cursor = addMonths(cursor, 1);
    }

    updatedItems.push({ ...item, lastGeneratedMonth });
  }

  if (anyGenerated) {
    await enqueue(() => saveRecurring(updatedItems));
  }
}

export async function transactionCountForRecurring(id: string): Promise<number> {
  const transactions = await getTransactions();
  return transactions.filter((t) => t.recurringId === id).length;
}
