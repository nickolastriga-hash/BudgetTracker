import { applyLimit } from '@/lib/budgets';
import { categoriesForType, getCategories } from '@/lib/categories';
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

// Backfills Jan 1 of the current year through today with random expense/
// income transactions (existing categories only — never creates new ones)
// plus a monthly limit on a handful of expense categories, so Home/
// Transactions/Budgets all have something to show without hand-entering
// months of data. Purely additive — existing transactions/budgets are left
// alone, so running it twice just adds a second batch on top.
export async function generateYearToDateDemoData(): Promise<DemoDataResult> {
  const categories = await getCategories();
  const expenseCategories = categoriesForType(categories, 'expense');
  const incomeCategories = categoriesForType(categories, 'income');
  if (expenseCategories.length === 0) return { transactions: 0, budgets: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const salary = incomeCategories.find((c) => c.id === 'salary') ?? incomeCategories[0];

  let txCount = 0;
  let cursor = new Date(year, 0, 1);

  while (cursor <= today) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
    const lastDay = isCurrentMonth ? today.getDate() : new Date(y, m + 1, 0).getDate();
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

    cursor = new Date(y, m + 1, 1);
  }

  const janStr = `${year}-01`;
  const budgetCategories = expenseCategories.slice(0, Math.min(6, expenseCategories.length));
  for (const category of budgetCategories) {
    await applyLimit(category.id, janStr, randomAmount(150, 900), 'onward');
  }

  return { transactions: txCount, budgets: budgetCategories.length };
}
