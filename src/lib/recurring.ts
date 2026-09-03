import AsyncStorage from '@react-native-async-storage/async-storage';

import { addTransaction, type TransactionType } from '@/lib/transactions';

export type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly';

interface RecurringBase {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  startDate: string; // YYYY-MM-DD, first occurrence
}

// Monthly keeps its own dayOfMonth (clamped to each month's real length) and
// walks lastGeneratedMonth forward a whole month at a time — unchanged from
// before frequency existed. Weekly/biweekly have no "day of month" of their
// own — the recurring weekday is just whichever day startDate falls on — and
// walk lastGeneratedDate forward 7 or 14 real days at a time instead.
export interface MonthlyRecurring extends RecurringBase {
  frequency: 'monthly';
  dayOfMonth: number; // 1-28, clamped so it's valid in every month
  lastGeneratedMonth?: string; // YYYY-MM, last month a transaction was materialized for
}

export interface WeeklyRecurring extends RecurringBase {
  frequency: 'weekly' | 'biweekly';
  lastGeneratedDate?: string; // YYYY-MM-DD, last date a transaction was materialized for
}

export type RecurringTransaction = MonthlyRecurring | WeeklyRecurring;

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
  const items = JSON.parse(raw) as Record<string, unknown>[];
  // Records written before frequency existed (every RecurringTransaction was
  // implicitly monthly back then) have no `frequency` field — treated as
  // 'monthly' here on read, rather than a one-time migration pass, same
  // "lazy, on-read" spirit as generateDueTransactions itself.
  return items.map((item) => (item.frequency ? item : { ...item, frequency: 'monthly' })) as unknown as RecurringTransaction[];
}

async function saveRecurring(items: RecurringTransaction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Omit distributed over each union member first, rather than a plain
// `Omit<RecurringTransaction, 'id'>` — the latter collapses the union into
// one shape and would let a 'weekly' input carry a stray `dayOfMonth` (or a
// 'monthly' one skip it) without tsc complaining.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

// lastGeneratedMonth/lastGeneratedDate are normally left for
// generateDueTransactions to fill in as it materializes each occurrence, but
// a caller that already seeded the first occurrence's own transaction by
// hand (add-transaction.tsx's "Repeat" checkbox creates that one directly,
// not via generateDue) passes it explicitly — otherwise the next session's
// generateDueTransactions would see nothing generated yet, start its cursor
// back at that same first occurrence, and double-log it.
export function addRecurring(data: DistributiveOmit<RecurringTransaction, 'id'>): Promise<RecurringTransaction> {
  return enqueue(async () => {
    const items = await getRecurring();
    const item = { ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as RecurringTransaction;
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

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Read-only: the next date this series is due, without materializing
// anything. Mirrors generateDueTransactions' own first-cursor computation
// for each frequency. Re-added 2026-09-03 for the Recurring management
// screen — it briefly existed for the removed Bills screen (see CLAUDE.md/
// TODO.md) and was dropped along with that screen, not because the idea was
// wrong.
export function nextDueDate(item: RecurringTransaction): string {
  if (item.frequency === 'monthly') {
    const nextMonth = item.lastGeneratedMonth ? addMonths(item.lastGeneratedMonth, 1) : item.startDate.slice(0, 7);
    return dateInMonth(nextMonth, item.dayOfMonth);
  }
  const stepDays = item.frequency === 'weekly' ? 7 : 14;
  return item.lastGeneratedDate ? addDays(item.lastGeneratedDate, stepDays) : item.startDate;
}

// Materializes any recurring items' occurrences from their start date up to
// (and including) today into real transactions. Batched lazily rather than
// scheduled ahead of time — same reasoning as habit reminders being
// generated lazily: there's no OS-level scheduler here, so a due occurrence
// only needs to exist once something actually asks "what's owed". Call once
// per app session (root layout), not per-screen-focus.
export async function generateDueTransactions(today: Date = new Date()): Promise<void> {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const currentMonth = `${y}-${m}`;
  const items = await getRecurring();
  if (items.length === 0) return;

  const updatedItems: RecurringTransaction[] = [];
  let anyGenerated = false;

  for (const item of items) {
    if (item.frequency === 'monthly') {
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
    } else {
      // Weekly/biweekly: 7 or 14 real days at a time from wherever
      // generation last left off (or startDate itself, for the very first
      // occurrence still owed).
      const stepDays = item.frequency === 'weekly' ? 7 : 14;
      let cursor = item.lastGeneratedDate ? addDays(item.lastGeneratedDate, stepDays) : item.startDate;
      let lastGeneratedDate = item.lastGeneratedDate;

      while (cursor <= todayStr) {
        await addTransaction({
          type: item.type,
          amount: item.amount,
          categoryId: item.categoryId,
          date: cursor,
          note: item.note,
          recurringId: item.id,
        });
        anyGenerated = true;
        lastGeneratedDate = cursor;
        cursor = addDays(cursor, stepDays);
      }

      updatedItems.push({ ...item, lastGeneratedDate });
    }
  }

  if (anyGenerated) {
    await enqueue(() => saveRecurring(updatedItems));
  }
}
