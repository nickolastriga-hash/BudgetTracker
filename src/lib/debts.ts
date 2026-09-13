import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryIcon } from '@/lib/categories';
import { toDateStr, toMonthStr } from '@/lib/date-range';

// A debt is tracked by its current balance, updated by hand (edit the
// balance, or "Record a payment") — not derived from expense transactions,
// since a card payment is already logged as whatever it bought, and a loan
// payment splits into principal/interest the ledger has no way to know.
export interface Debt {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  originalBalance: number; // what the progress bar measures paydown against
  balance: number;
  apr: number; // annual percentage rate, e.g. 19.99
  minPayment: number; // per month
  createdAt: string; // YYYY-MM-DD
}

// Snowball pays the smallest balance first (quick wins), avalanche the
// highest APR first (least total interest) — the two standard strategies
// every payoff planner offers.
export type PayoffStrategy = 'snowball' | 'avalanche';

export interface DebtPlanSettings {
  strategy: PayoffStrategy;
  extraMonthly: number; // on top of every debt's minimum, aimed at the current target
}

const STORAGE_KEY = '@budgettracker/debts';
const PLAN_STORAGE_KEY = '@budgettracker/debt-plan';
export const DEFAULT_PLAN_SETTINGS: DebtPlanSettings = { strategy: 'snowball', extraMonthly: 0 };

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getDebts(): Promise<Debt[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Debt[];
}

async function saveDebts(debts: Debt[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

export type DebtFields = Pick<Debt, 'name' | 'icon' | 'color' | 'originalBalance' | 'balance' | 'apr' | 'minPayment'>;

export function addDebt(data: DebtFields): Promise<Debt> {
  return enqueue(async () => {
    const debts = await getDebts();
    const debt: Debt = {
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: toDateStr(new Date()),
    };
    await saveDebts([...debts, debt]);
    return debt;
  });
}

export function updateDebt(id: string, data: Partial<DebtFields>): Promise<void> {
  return enqueue(async () => {
    const debts = await getDebts();
    await saveDebts(debts.map((d) => (d.id === id ? { ...d, ...data } : d)));
  });
}

export function deleteDebt(id: string): Promise<void> {
  return enqueue(async () => {
    const debts = await getDebts();
    await saveDebts(debts.filter((d) => d.id !== id));
  });
}

export function recordPayment(id: string, amount: number): Promise<void> {
  return enqueue(async () => {
    const debts = await getDebts();
    await saveDebts(debts.map((d) => (d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d)));
  });
}

export async function getPlanSettings(): Promise<DebtPlanSettings> {
  const raw = await AsyncStorage.getItem(PLAN_STORAGE_KEY);
  if (!raw) return DEFAULT_PLAN_SETTINGS;
  return { ...DEFAULT_PLAN_SETTINGS, ...(JSON.parse(raw) as Partial<DebtPlanSettings>) };
}

export function savePlanSettings(settings: DebtPlanSettings): Promise<void> {
  return enqueue(() => AsyncStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(settings)));
}

// One point of a plan's balance-over-time schedule. `schedule[0]` is today
// (before any payment); `schedule[i]` for i >= 1 is the state at the end of
// month `addMonths(start, i - 1)`, after that month's interest and payment.
export interface PayoffMonth {
  month: string; // YYYY-MM the entry describes (today's month for index 0)
  balances: Record<string, number>; // debt id -> remaining balance (0 once paid off)
  total: number;
}

export interface PayoffPlan {
  months: number;
  totalInterest: number;
  debtFreeMonth: string | null; // YYYY-MM; null when nothing is owed or the plan never pays off
  perDebt: Record<string, { payoffMonth: string | null; interest: number }>;
  // Payments never outrun the interest accruing on at least one debt, so
  // the simulation was cut off rather than run forever.
  unreachable: boolean;
  // Debts in the order the plan attacks them (smallest balance first for
  // snowball, highest APR first for avalanche) — the chart stacks in this
  // order so the current target is always the top band.
  order: Debt[];
  schedule: PayoffMonth[];
}

const MAX_MONTHS = 600;

function addMonths(monthStr: string, n: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  return toMonthStr(new Date(y, m - 1 + n, 1));
}

function orderFor(debts: Debt[], strategy: PayoffStrategy): Debt[] {
  return debts
    .filter((d) => d.balance > 0)
    .sort((a, b) => (strategy === 'snowball' ? a.balance - b.balance : b.apr - a.apr));
}

// Standard month-by-month amortization: every month, interest accrues on
// each remaining balance at apr/12 and every debt gets its minimum. With
// `rollover` (the real plan), the rest of a fixed monthly budget — the sum
// of *all* minimums (a paid-off debt's minimum keeps rolling into the next
// target, which is the whole "snowball" idea) plus the extra — goes to the
// strategy's current target. Without it (the "minimums only" baseline the
// chart draws for comparison) each debt only ever pays its own minimum and
// nothing rolls anywhere, which is what actually happens to someone paying
// statement minimums. Payments are assumed at the end of each month
// starting with the current one, so a debt cleared in the first simulated
// month is "paid off" this month.
function run(order: Debt[], monthlyBudget: number, rollover: boolean, startMonth: string): PayoffPlan {
  const perDebt: PayoffPlan['perDebt'] = {};
  for (const d of order) perDebt[d.id] = { payoffMonth: null, interest: 0 };
  const balances = new Map(order.map((d) => [d.id, d.balance]));
  const snapshot = (month: string): PayoffMonth => {
    const entry: Record<string, number> = {};
    let total = 0;
    for (const d of order) {
      const bal = Math.max(0, balances.get(d.id) ?? 0);
      entry[d.id] = bal;
      total += bal;
    }
    return { month, balances: entry, total };
  };
  const schedule: PayoffMonth[] = [snapshot(startMonth)];
  const finish = (month: number, totalInterest: number, unreachable: boolean): PayoffPlan => ({
    months: month,
    totalInterest,
    debtFreeMonth: unreachable || month === 0 ? null : addMonths(startMonth, month - 1),
    perDebt,
    unreachable,
    order,
    schedule,
  });
  if (balances.size === 0) return finish(0, 0, false);

  // Once a month ends with more owed than it started, the plan can never
  // finish — but the schedule keeps filling out to MAX_MONTHS anyway rather
  // than stopping at the first stalled month, so the chart's minimums-only
  // baseline always covers the real plan's months (it can never finish
  // sooner than the plan, whose budget is a superset); the flag is what
  // reports it.
  let stalled = false;
  let month = 0;
  let totalInterest = 0;
  while (balances.size > 0 && month < MAX_MONTHS) {
    month++;
    const owedBefore = [...balances.values()].reduce((s, b) => s + b, 0);
    for (const d of order) {
      const bal = balances.get(d.id);
      if (bal === undefined) continue;
      const interest = (bal * d.apr) / 100 / 12;
      balances.set(d.id, bal + interest);
      perDebt[d.id].interest += interest;
      totalInterest += interest;
    }
    let budget = monthlyBudget;
    for (const d of order) {
      const bal = balances.get(d.id);
      if (bal === undefined) continue;
      const pay = Math.min(d.minPayment, bal, budget);
      balances.set(d.id, bal - pay);
      budget -= pay;
    }
    if (rollover) {
      for (const d of order) {
        if (budget <= 0) break;
        const bal = balances.get(d.id);
        if (bal === undefined) continue;
        const pay = Math.min(budget, bal);
        balances.set(d.id, bal - pay);
        budget -= pay;
      }
    }
    for (const d of order) {
      const bal = balances.get(d.id);
      if (bal !== undefined && bal <= 0.005) {
        balances.delete(d.id);
        perDebt[d.id].payoffMonth = addMonths(startMonth, month - 1);
      }
    }
    schedule.push(snapshot(addMonths(startMonth, month - 1)));
    const owedAfter = [...balances.values()].reduce((s, b) => s + b, 0);
    if (balances.size > 0 && owedAfter >= owedBefore) stalled = true;
  }
  return finish(month, totalInterest, stalled || balances.size > 0);
}

export function simulatePayoff(debts: Debt[], settings: DebtPlanSettings, today: Date = new Date()): PayoffPlan {
  const order = orderFor(debts, settings.strategy);
  const monthlyBudget = debts.reduce((sum, d) => sum + d.minPayment, 0) + settings.extraMonthly;
  return run(order, monthlyBudget, true, toMonthStr(today));
}

// The comparison baseline: every debt pays only its own minimum, forever,
// with no extra and no rollover. The chart draws its total as a dashed line
// over the real plan so the gap between the two is the plan's payoff.
export function simulateMinimumsOnly(debts: Debt[], strategy: PayoffStrategy, today: Date = new Date()): PayoffPlan {
  const order = orderFor(debts, strategy);
  const monthlyBudget = debts.reduce((sum, d) => sum + d.minPayment, 0);
  return run(order, monthlyBudget, false, toMonthStr(today));
}
