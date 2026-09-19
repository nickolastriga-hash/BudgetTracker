import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryIcon } from '@/lib/categories';
import { toDateStr, toMonthStr } from '@/lib/date-range';
import { addTransaction, deleteTransaction, updateTransaction } from '@/lib/transactions';

// A savings goal is a target amount saved toward by hand ("Add money"), not
// derived from transactions — a goal is money set aside, which the
// expense/income ledger deliberately doesn't model (moving $200 into an
// emergency fund isn't an expense). Same lib shape as budgets.ts. The
// reverse direction is opt-in per goal: with `logContributions` on, adding
// money also writes an expense transaction in `contributionCategoryId`
// (and a withdrawal writes the matching income, so the ledger nets out),
// for someone who budgets their savings like any other monthly outgoing.
export interface GoalContribution {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // negative = withdrawal
  transactionId?: string; // the ledger entry this contribution wrote, removed with it
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  targetAmount: number;
  targetMonth?: string; // YYYY-MM — optional deadline
  contributions: GoalContribution[];
  createdAt: string; // YYYY-MM-DD
  logContributions?: boolean;
  contributionCategoryId?: string; // expense category a contribution's transaction lands in
}

const STORAGE_KEY = '@budgettracker/goals';

let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getGoals(): Promise<SavingsGoal[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SavingsGoal[];
}

async function saveGoals(goals: SavingsGoal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export type GoalFields = Pick<
  SavingsGoal,
  'name' | 'icon' | 'color' | 'targetAmount' | 'targetMonth' | 'logContributions' | 'contributionCategoryId'
>;

export function addGoal(data: GoalFields): Promise<SavingsGoal> {
  return enqueue(async () => {
    const goals = await getGoals();
    const goal: SavingsGoal = { ...data, id: newId(), contributions: [], createdAt: toDateStr(new Date()) };
    await saveGoals([...goals, goal]);
    return goal;
  });
}

export function updateGoal(id: string, data: Partial<GoalFields>): Promise<void> {
  return enqueue(async () => {
    const goals = await getGoals();
    await saveGoals(goals.map((g) => (g.id === id ? { ...g, ...data } : g)));
  });
}

export function deleteGoal(id: string): Promise<void> {
  return enqueue(async () => {
    const goals = await getGoals();
    await saveGoals(goals.filter((g) => g.id !== id));
  });
}

// A withdrawal's transaction is income, not a negative expense, so it lands
// in the income catch-all rather than the goal's chosen expense category.
const WITHDRAWAL_CATEGORY_ID = 'other_income';

export function addContribution(goalId: string, amount: number, date: string): Promise<void> {
  return enqueue(async () => {
    const goals = await getGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const contribution: GoalContribution = { id: newId(), amount, date };
    if (goal.logContributions && goal.contributionCategoryId) {
      const isWithdrawal = amount < 0;
      const transaction = await addTransaction({
        type: isWithdrawal ? 'income' : 'expense',
        amount: Math.abs(amount),
        categoryId: isWithdrawal ? WITHDRAWAL_CATEGORY_ID : goal.contributionCategoryId,
        date,
        note: `${isWithdrawal ? 'Withdrawal' : 'Savings'}: ${goal.name}`,
      });
      contribution.transactionId = transaction.id;
    }
    await saveGoals(
      goals.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, contribution] } : g))
    );
  });
}

// Edit an already-logged contribution. Its linked transaction (if the goal
// had logging on when it was added) is patched to match — including a flipped
// sign, which moves the entry between the goal's expense category and the
// income catch-all. A contribution logged while logging was off has no
// transaction and doesn't grow one here; turning logging on is forward-only,
// same as it is for adding.
export function updateContribution(goalId: string, contributionId: string, amount: number): Promise<void> {
  return enqueue(async () => {
    const goals = await getGoals();
    const goal = goals.find((g) => g.id === goalId);
    const existing = goal?.contributions.find((c) => c.id === contributionId);
    if (!goal || !existing) return;
    await saveGoals(
      goals.map((g) =>
        g.id === goalId
          ? { ...g, contributions: g.contributions.map((c) => (c.id === contributionId ? { ...c, amount } : c)) }
          : g
      )
    );
    if (existing.transactionId) {
      const isWithdrawal = amount < 0;
      await updateTransaction(existing.transactionId, {
        type: isWithdrawal ? 'income' : 'expense',
        amount: Math.abs(amount),
        categoryId: isWithdrawal ? WITHDRAWAL_CATEGORY_ID : (goal.contributionCategoryId ?? WITHDRAWAL_CATEGORY_ID),
        note: `${isWithdrawal ? 'Withdrawal' : 'Savings'}: ${goal.name}`,
      });
    }
  });
}

export function removeContribution(goalId: string, contributionId: string): Promise<void> {
  return enqueue(async () => {
    const goals = await getGoals();
    const removed = goals.find((g) => g.id === goalId)?.contributions.find((c) => c.id === contributionId);
    await saveGoals(
      goals.map((g) =>
        g.id === goalId ? { ...g, contributions: g.contributions.filter((c) => c.id !== contributionId) } : g
      )
    );
    if (removed?.transactionId) await deleteTransaction(removed.transactionId);
  });
}

export function goalSaved(goal: SavingsGoal): number {
  return goal.contributions.reduce((sum, c) => sum + c.amount, 0);
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  percent: number; // 0-1+
  // Months left through the deadline, counting the current month (so a
  // goal due this month has 1 month left, not 0); null without a deadline,
  // 0 once the deadline month has passed.
  monthsLeft: number | null;
  neededPerMonth: number | null;
}

export function goalProgress(goal: SavingsGoal, today: Date = new Date()): GoalProgress {
  const saved = goalSaved(goal);
  const remaining = Math.max(0, goal.targetAmount - saved);
  const percent = goal.targetAmount > 0 ? saved / goal.targetAmount : 0;
  let monthsLeft: number | null = null;
  if (goal.targetMonth) {
    const [ty, tm] = goal.targetMonth.split('-').map(Number);
    const [y, m] = toMonthStr(today).split('-').map(Number);
    monthsLeft = Math.max(0, (ty - y) * 12 + (tm - m) + 1);
  }
  const neededPerMonth = monthsLeft === null ? null : monthsLeft === 0 ? remaining : remaining / monthsLeft;
  return { saved, remaining, percent, monthsLeft, neededPerMonth };
}
