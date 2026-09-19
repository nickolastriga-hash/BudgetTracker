import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryIcon } from '@/lib/categories';
import { toDateStr } from '@/lib/date-range';

// Net worth is the sum of hand-entered account balances (checking, savings,
// car, house — anything you'd update by hand since there's no bank sync)
// minus liabilities. Debts from lib/debts.ts count as liabilities too, so a
// tracked credit card doesn't have to be entered twice; the screen merges
// them (see wealth.tsx) rather than this module importing debts.ts, which
// would otherwise pull both write-queues into one dependency chain.
export type AccountKind = 'asset' | 'liability';

export interface Account {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  kind: AccountKind;
  balance: number;
  createdAt: string; // YYYY-MM-DD
}

export interface NetWorthSnapshot {
  date: string; // YYYY-MM-DD
  assets: number;
  liabilities: number;
}

const STORAGE_KEY = '@budgettracker/accounts';
const HISTORY_STORAGE_KEY = '@budgettracker/net-worth-history';

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

export async function getAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Account[];
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export type AccountFields = Pick<Account, 'name' | 'icon' | 'color' | 'kind' | 'balance'>;

export function addAccount(data: AccountFields): Promise<Account> {
  return enqueue(async () => {
    const accounts = await getAccounts();
    const account: Account = {
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: toDateStr(new Date()),
    };
    await saveAccounts([...accounts, account]);
    return account;
  });
}

export function updateAccount(id: string, data: Partial<AccountFields>): Promise<void> {
  return enqueue(async () => {
    const accounts = await getAccounts();
    await saveAccounts(accounts.map((a) => (a.id === id ? { ...a, ...data } : a)));
  });
}

export function deleteAccount(id: string): Promise<void> {
  return enqueue(async () => {
    const accounts = await getAccounts();
    await saveAccounts(accounts.filter((a) => a.id !== id));
  });
}

export async function getNetWorthHistory(): Promise<NetWorthSnapshot[]> {
  const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as NetWorthSnapshot[];
}

// Debts count as liabilities but live in lib/debts.ts, so callers pass their
// summed balance in rather than this module importing it (see top comment).
export function netWorthTotals(accounts: Account[], debtBalance: number): { assets: number; liabilities: number } {
  return {
    assets: accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.balance, 0),
    liabilities: accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.balance, 0) + debtBalance,
  };
}

// History is a series of "what the totals were on the day something
// changed" points, recorded lazily by the Net Worth page whenever it loads
// and once per app launch from the root layout (no scheduler — same on-read spirit as generateDueTransactions) rather
// than by every balance write. A same-day snapshot is replaced in place;
// one identical to the previous point is skipped so an untouched week
// doesn't pile up redundant points.
export function recordNetWorthSnapshot(snapshot: NetWorthSnapshot): Promise<NetWorthSnapshot[]> {
  return enqueue(async () => {
    const history = await getNetWorthHistory();
    const last = history[history.length - 1];
    if (last && last.date !== snapshot.date && last.assets === snapshot.assets && last.liabilities === snapshot.liabilities) {
      return history;
    }
    const next = [...history.filter((s) => s.date !== snapshot.date), snapshot].sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}
