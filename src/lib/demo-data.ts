import { applyLimit } from '@/lib/budgets';
import { CATEGORY_COLORS, categoriesForType, getCategories, type Category } from '@/lib/categories';
import { suggestCategoryIcon } from '@/lib/category-icons';
import { addDebt, getDebts } from '@/lib/debts';
import { toDateStr, toMonthStr } from '@/lib/date-range';
import { addContribution, addGoal, getGoals } from '@/lib/goals';
import { addAccount, getAccounts, type AccountKind } from '@/lib/net-worth';
import { addTransaction } from '@/lib/transactions';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAmount(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

export interface DemoDataResult {
  transactions: number;
  budgets: number;
  goals: number;
  debts: number;
  accounts: number;
}

// Fixed, hand-picked demo entries rather than randomized like the
// transaction backfill above — a believable spread of goal/debt/account
// names and numbers reads better for a demo than random ones would, and
// there's no existing chart/screen behavior that benefits from randomizing
// them the way the transaction volume does.
const DEMO_GOALS: { name: string; targetAmount: number; monthsUntilDeadline: number | null; contributions: number[] }[] = [
  { name: 'Emergency Fund', targetAmount: 10000, monthsUntilDeadline: 8, contributions: [800, 800, 600, 900] },
  { name: 'Vacation', targetAmount: 2500, monthsUntilDeadline: null, contributions: [300, 450, 500] },
  { name: 'New Laptop', targetAmount: 1500, monthsUntilDeadline: 2, contributions: [500, 500, 600] },
];

const DEMO_DEBTS: { name: string; originalBalance: number; balance: number; apr: number; minPayment: number }[] = [
  { name: 'Credit Card', originalBalance: 5000, balance: 3200, apr: 22.99, minPayment: 85 },
  { name: 'Car Loan', originalBalance: 18000, balance: 11400, apr: 6.9, minPayment: 310 },
  { name: 'Student Loan', originalBalance: 25000, balance: 19800, apr: 5.5, minPayment: 220 },
];

const DEMO_ACCOUNTS: { name: string; kind: AccountKind; balance: number }[] = [
  { name: 'Checking Account', kind: 'asset', balance: 3200 },
  { name: 'Savings', kind: 'asset', balance: 8500 },
  { name: 'Car', kind: 'asset', balance: 14000 },
  { name: 'Mortgage', kind: 'liability', balance: 245000 },
];

// Palette offsets match each editor's own "next unused slot" default (see
// goal-editor.tsx/debt-editor.tsx/account-editor.tsx) so demo entries land
// on the same colors a hand-added one would have gotten.
async function seedGoals(): Promise<number> {
  const existing = await getGoals();
  const today = new Date();
  for (let i = 0; i < DEMO_GOALS.length; i++) {
    const def = DEMO_GOALS[i];
    const goal = await addGoal({
      name: def.name,
      icon: suggestCategoryIcon(def.name),
      color: CATEGORY_COLORS[(3 + existing.length + i) % CATEGORY_COLORS.length],
      targetAmount: def.targetAmount,
      targetMonth:
        def.monthsUntilDeadline == null
          ? undefined
          : toMonthStr(new Date(today.getFullYear(), today.getMonth() + def.monthsUntilDeadline, 1)),
    });
    for (let m = 0; m < def.contributions.length; m++) {
      const monthsAgo = def.contributions.length - 1 - m;
      const date = toDateStr(new Date(today.getFullYear(), today.getMonth() - monthsAgo, 5));
      await addContribution(goal.id, def.contributions[m], date);
    }
  }
  return DEMO_GOALS.length;
}

async function seedDebts(): Promise<number> {
  const existing = await getDebts();
  for (let i = 0; i < DEMO_DEBTS.length; i++) {
    const def = DEMO_DEBTS[i];
    await addDebt({
      name: def.name,
      icon: suggestCategoryIcon(def.name),
      color: CATEGORY_COLORS[(0 + existing.length + i) % CATEGORY_COLORS.length],
      originalBalance: def.originalBalance,
      balance: def.balance,
      apr: def.apr,
      minPayment: def.minPayment,
    });
  }
  return DEMO_DEBTS.length;
}

async function seedAccounts(): Promise<number> {
  const existing = await getAccounts();
  for (let i = 0; i < DEMO_ACCOUNTS.length; i++) {
    const def = DEMO_ACCOUNTS[i];
    await addAccount({
      name: def.name,
      icon: suggestCategoryIcon(def.name),
      color: CATEGORY_COLORS[(6 + existing.length + i) % CATEGORY_COLORS.length],
      kind: def.kind,
      balance: def.balance,
    });
  }
  return DEMO_ACCOUNTS.length;
}

// One month's worth of random expense/income transactions, `rangeEnd`-capped
// (so the caller's still-in-progress current month stops at today instead of
// running out to that month's real last day) — shared by both of
// generateDemoData's backfill passes below rather than duplicated per call.
async function generateMonthTransactions(
  y: number,
  m: number, // 0-indexed
  lastDay: number,
  expenseCategories: Category[],
  incomeCategories: Category[],
  salary: Category | undefined
): Promise<number> {
  let txCount = 0;
  const dateStr = (day: number) => `${y}-${pad(m + 1)}-${pad(day)}`;

  if (salary) {
    await addTransaction({
      type: 'income',
      amount: randomAmount(3200, 4800),
      categoryId: salary.id,
      date: dateStr(Math.min(1, lastDay)),
    });
    txCount++;
  }

  if (incomeCategories.length > 1 && Math.random() < 0.3) {
    const category = incomeCategories[randomInt(0, incomeCategories.length - 1)];
    await addTransaction({
      type: 'income',
      amount: randomAmount(150, 900),
      categoryId: category.id,
      date: dateStr(randomInt(1, lastDay)),
    });
    txCount++;
  }

  const expenseCount = randomInt(10, 18);
  for (let i = 0; i < expenseCount; i++) {
    const category = expenseCategories[randomInt(0, expenseCategories.length - 1)];
    await addTransaction({
      type: 'expense',
      amount: randomAmount(8, 180),
      categoryId: category.id,
      date: dateStr(randomInt(1, lastDay)),
    });
    txCount++;
  }

  return txCount;
}

// Walks every month from `rangeStart` through `rangeEnd` (inclusive),
// generating one month of transactions per iteration via
// generateMonthTransactions above. `rangeEnd` itself may be a partial month
// (e.g. "today" for the current, still-in-progress month) — every other
// month in the range always fills out to its own real last day.
async function backfillRange(
  rangeStart: Date,
  rangeEnd: Date,
  expenseCategories: Category[],
  incomeCategories: Category[],
  salary: Category | undefined
): Promise<number> {
  let txCount = 0;
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor <= rangeEnd) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const isRangeEndMonth = y === rangeEnd.getFullYear() && m === rangeEnd.getMonth();
    const lastDay = isRangeEndMonth ? rangeEnd.getDate() : new Date(y, m + 1, 0).getDate();
    txCount += await generateMonthTransactions(y, m, lastDay, expenseCategories, incomeCategories, salary);
    cursor = new Date(y, m + 1, 1);
  }
  return txCount;
}

// Backfills random expense/income transactions across two ranges — this
// year's Jan 1 through today, plus all of last year (added 2026-08-31, per
// feedback that Trends' Year view and year-over-year comparisons had nothing
// prior to compare the current year against) — plus a monthly limit/goal on
// a handful of both expense and income categories (income goals added the
// same day; previously only expense categories got a budget), so Home/
// Transactions/Budgets/Trends all have something to show without hand-
// entering months of data. Existing categories only (never creates new
// ones). Also seeds a handful of savings goals, debts, and net-worth
// accounts (2026-09-18, per feedback that Wealth had nothing to demo) via
// seedGoals/seedDebts/seedAccounts above — fixed, hand-picked entries rather
// than randomized, since a believable name/number spread reads better for a
// demo than random ones would. Purely additive — existing data is left
// alone, so running it twice just adds a second batch on top.
export async function generateDemoData(): Promise<DemoDataResult> {
  const categories = await getCategories();
  const expenseCategories = categoriesForType(categories, 'expense');
  const incomeCategories = categoriesForType(categories, 'income');
  if (expenseCategories.length === 0) return { transactions: 0, budgets: 0, goals: 0, debts: 0, accounts: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const salary = incomeCategories.find((c) => c.id === 'salary') ?? incomeCategories[0];

  const ytdCount = await backfillRange(new Date(year, 0, 1), today, expenseCategories, incomeCategories, salary);
  const priorYearCount = await backfillRange(
    new Date(year - 1, 0, 1),
    new Date(year - 1, 11, 31),
    expenseCategories,
    incomeCategories,
    salary
  );
  const txCount = ytdCount + priorYearCount;

  // Applied "onward" from this year's January, same as before — a
  // scheduledChange with a past/current startMonth takes effect immediately
  // (see lib/budgets.ts's applyLimit convention), so this covers both years'
  // worth of backfilled actuals under the one recurring limit/goal.
  const janStr = `${year}-01`;
  const budgetCategories = expenseCategories.slice(0, Math.min(6, expenseCategories.length));
  for (const category of budgetCategories) {
    await applyLimit(category.id, janStr, randomAmount(150, 900), 'onward');
  }
  const goalCategories = incomeCategories.slice(0, Math.min(3, incomeCategories.length));
  for (const category of goalCategories) {
    await applyLimit(category.id, janStr, randomAmount(2500, 5500), 'onward');
  }

  const goalsCount = await seedGoals();
  const debtsCount = await seedDebts();
  const accountsCount = await seedAccounts();

  return {
    transactions: txCount,
    budgets: budgetCategories.length + goalCategories.length,
    goals: goalsCount,
    debts: debtsCount,
    accounts: accountsCount,
  };
}
