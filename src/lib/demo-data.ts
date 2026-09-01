import { applyLimit } from '@/lib/budgets';
import { categoriesForType, getCategories, type Category } from '@/lib/categories';
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
// ones). Purely additive — existing transactions/budgets are left alone, so
// running it twice just adds a second batch on top.
export async function generateDemoData(): Promise<DemoDataResult> {
  const categories = await getCategories();
  const expenseCategories = categoriesForType(categories, 'expense');
  const incomeCategories = categoriesForType(categories, 'income');
  if (expenseCategories.length === 0) return { transactions: 0, budgets: 0 };

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

  return { transactions: txCount, budgets: budgetCategories.length + goalCategories.length };
}
