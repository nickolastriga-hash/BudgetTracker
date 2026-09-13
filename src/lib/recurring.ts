import AsyncStorage from '@react-native-async-storage/async-storage';

import { addTransaction, type TransactionType } from '@/lib/transactions';

export type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly' | 'everyNMonths' | 'semimonthly';

interface RecurringBase {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  startDate: string; // YYYY-MM-DD, first occurrence
  lastGeneratedDate?: string; // YYYY-MM-DD, last date a transaction was materialized for
}

// Monthly keeps its own dayOfMonth (clamped to each month's real length).
// Weekly/biweekly have no "day of month" of their own — the recurring
// weekday is just whichever day startDate falls on.
export interface MonthlyRecurring extends RecurringBase {
  frequency: 'monthly';
  dayOfMonth: number; // 1-31, clamped to each month's real length (so a 30th/31st pick still lands on Feb's last day)
}

export interface WeeklyRecurring extends RecurringBase {
  frequency: 'weekly' | 'biweekly';
}

// Annual bills/renewals — insurance, memberships, domain names. month is
// 1-12; dayOfMonth is clamped to that month's real length each year (so a
// Feb 29 pick still lands somewhere sane on non-leap years).
export interface YearlyRecurring extends RecurringBase {
  frequency: 'yearly';
  month: number; // 1-12
  dayOfMonth: number; // 1-31, clamped to `month`'s real length
}

// A custom N-month interval — quarterly, semi-annual, etc. — without a
// dedicated frequency each. Same dayOfMonth clamping as monthly.
export interface EveryNMonthsRecurring extends RecurringBase {
  frequency: 'everyNMonths';
  intervalMonths: number; // 2-11 (1 would just be monthly, 12 just yearly)
  dayOfMonth: number;
}

// Semi-monthly — mainly for paychecks. Two independent days per month, not
// necessarily 14/15 days apart; each clamped to that month's real length.
export interface SemiMonthlyRecurring extends RecurringBase {
  frequency: 'semimonthly';
  dayOfMonth1: number;
  dayOfMonth2: number;
}

export type RecurringTransaction = MonthlyRecurring | WeeklyRecurring | YearlyRecurring | EveryNMonthsRecurring | SemiMonthlyRecurring;

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
  return items.map((raw) => {
    // Records written before frequency existed (every RecurringTransaction
    // was implicitly monthly back then) have no `frequency` field — treated
    // as 'monthly' here on read, rather than a one-time migration pass, same
    // "lazy, on-read" spirit as generateDueTransactions itself.
    const item = raw.frequency ? raw : { ...raw, frequency: 'monthly' };
    // Records written before the cursor unified onto lastGeneratedDate
    // tracked monthly's cursor as lastGeneratedMonth (a YYYY-MM string)
    // instead — migrated lazily here the same way, deriving the equivalent
    // date from the month + the item's own dayOfMonth.
    if (item.frequency === 'monthly' && !item.lastGeneratedDate && item.lastGeneratedMonth) {
      return { ...item, lastGeneratedDate: dateInMonth(item.lastGeneratedMonth as string, item.dayOfMonth as number) };
    }
    return item;
  }) as unknown as RecurringTransaction[];
}

async function saveRecurring(items: RecurringTransaction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Whether a transaction's recurringId still points at a series that exists
// (i.e. hasn't been stopped) — a transaction's own recurringId is left in
// place forever once set, as a permanent "this came from a series" marker
// (see transaction-row.tsx), so callers that want to reflect the series'
// *current* state — the recurring badge on a transaction row, in
// particular — check against the live list instead of the id alone.
export function isActiveRecurring(recurringId: string | undefined, recurring: RecurringTransaction[]): boolean {
  return !!recurringId && recurring.some((r) => r.id === recurringId);
}

// Omit distributed over each union member first, rather than a plain
// `Omit<RecurringTransaction, 'id'>` — the latter collapses the union into
// one shape and would let e.g. a 'weekly' input carry a stray `dayOfMonth`
// without tsc complaining.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

// lastGeneratedDate is normally left for generateDueTransactions to fill in
// as it materializes each occurrence, but a caller that already seeded the
// first occurrence's own transaction by hand (add-transaction.tsx's "Repeat"
// switch creates that one directly, not via generateDue) passes it
// explicitly — otherwise the next session's generateDueTransactions would
// see nothing generated yet, start its cursor back at that same first
// occurrence, and double-log it.
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

// Amount/category/note plus a full RecurringFrequencySpec — the caller
// always passes a complete spec for whichever frequency the series should
// have *after* this edit (frequency included), not a sparse patch, so
// there's never an ambiguous "which old field survives" question when the
// frequency itself is being changed.
export type RecurringEdit = { amount: number; categoryId: string; note?: string } & RecurringFrequencySpec;

// Patches a series' amount/category/note and its frequency (2026-09-16:
// frequency became editable here too, not just its day/month/interval
// fields) — the fields worth correcting after creation without stopping the
// series and setting up a new one. Switching frequency doesn't need to
// re-derive lastGeneratedDate from scratch the way it would have before the
// cursor unified onto a single date field (see generateDueTransactions'
// own comment) — it's left untouched, and nextOccurrenceAfter just starts
// stepping from that same cursor date using the *new* frequency's rule.
// Only changes what generateDueTransactions creates from here on —
// already-generated transactions, including this series' own past rows,
// keep whatever they already have, same as Stop leaves history alone.
export function updateRecurring(id: string, edit: RecurringEdit): Promise<void> {
  return enqueue(async () => {
    const items = await getRecurring();
    const updated = items.map((item): RecurringTransaction => {
      if (item.id !== id) return item;
      return {
        id: item.id,
        type: item.type,
        startDate: item.startDate,
        lastGeneratedDate: item.lastGeneratedDate,
        ...edit,
      };
    });
    await saveRecurring(updated);
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

// Same clamping idea as dateInMonth, one level up — for yearly items, whose
// month is fixed but the year advances.
function dateInYear(year: number, month: number, dayOfMonth: number): string {
  return dateInMonth(`${year}-${String(month).padStart(2, '0')}`, dayOfMonth);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The minimal frequency-specific shape nextOccurrenceAfter actually reads —
// narrower than RecurringTransaction (no id/amount/categoryId/etc.) so
// add-transaction.tsx's live "next on" preview can build one straight from
// its in-progress form state, before any RecurringTransaction record exists.
// Every RecurringTransaction variant is structurally a valid
// RecurringFrequencySpec (a strict superset of fields), so real records pass
// through here unchanged too.
export type RecurringFrequencySpec =
  | { frequency: 'weekly' }
  | { frequency: 'biweekly' }
  | { frequency: 'monthly'; dayOfMonth: number }
  | { frequency: 'everyNMonths'; intervalMonths: number; dayOfMonth: number }
  | { frequency: 'yearly'; month: number; dayOfMonth: number }
  | { frequency: 'semimonthly'; dayOfMonth1: number; dayOfMonth2: number };

// The one place that knows how to step any frequency forward from a given
// cursor date to its next occurrence — used by generateDueTransactions
// (which loops it forward, materializing as it goes), nextDueDate
// (read-only, single step) below, and add-transaction.tsx's preview, so
// there's exactly one implementation of each frequency's stepping rule
// rather than several that could drift.
export function nextOccurrenceAfter(item: RecurringFrequencySpec, cursorDate: string): string {
  switch (item.frequency) {
    case 'weekly':
      return addDays(cursorDate, 7);
    case 'biweekly':
      return addDays(cursorDate, 14);
    case 'monthly':
      return dateInMonth(addMonths(cursorDate.slice(0, 7), 1), item.dayOfMonth);
    case 'everyNMonths':
      return dateInMonth(addMonths(cursorDate.slice(0, 7), item.intervalMonths), item.dayOfMonth);
    case 'yearly':
      return dateInYear(Number(cursorDate.slice(0, 4)) + 1, item.month, item.dayOfMonth);
    case 'semimonthly': {
      const monthStr = cursorDate.slice(0, 7);
      const candidates = [dateInMonth(monthStr, item.dayOfMonth1), dateInMonth(monthStr, item.dayOfMonth2), dateInMonth(addMonths(monthStr, 1), item.dayOfMonth1)].filter(
        (d) => d > cursorDate
      );
      candidates.sort();
      return candidates[0];
    }
  }
}

// Read-only: the next date this series is due, without materializing
// anything. Used by both add-transaction.tsx's live "next on" preview and
// the Recurring page's forecast grouping/sort.
export function nextDueDate(item: RecurringTransaction): string {
  return item.lastGeneratedDate ? nextOccurrenceAfter(item, item.lastGeneratedDate) : item.startDate;
}

// Materializes any recurring items' occurrences from their start date up to
// (and including) today into real transactions. Batched lazily rather than
// scheduled ahead of time — same reasoning as habit reminders being
// generated lazily: there's no OS-level scheduler here, so a due occurrence
// only needs to exist once something actually asks "what's owed". Call once
// per app session (root layout), not per-screen-focus.
//
// One loop shape for every frequency via nextOccurrenceAfter — previously
// monthly walked a separate month-cursor loop that admitted an occurrence as
// soon as its calendar month began (so a bill due the 25th could appear
// already-materialized on the 1st); unifying onto a real date cursor fixes
// that, matching weekly/biweekly's always-correct "the actual date has
// arrived" behavior.
export async function generateDueTransactions(today: Date = new Date()): Promise<void> {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const items = await getRecurring();
  if (items.length === 0) return;

  const updatedItems: RecurringTransaction[] = [];
  let anyGenerated = false;

  for (const item of items) {
    let cursor = item.lastGeneratedDate ? nextOccurrenceAfter(item, item.lastGeneratedDate) : item.startDate;
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
      cursor = nextOccurrenceAfter(item, cursor);
    }

    updatedItems.push({ ...item, lastGeneratedDate } as RecurringTransaction);
  }

  if (anyGenerated) {
    await enqueue(() => saveRecurring(updatedItems));
  }
}
