# Project State

_Last updated: 2026-08-25_

Snapshot of where the app stands. History: [CHANGELOG.md](CHANGELOG.md). Upcoming: [TODO.md](TODO.md).

## What's implemented

- **Home, Transactions, Budgets, Bills, Stats** tabs (Expo Router `NativeTabs`, SDK 54). Home: month
  summary (income/expense/net), top-3 budget progress, recent transactions, FAB to add.
  Transactions: full month list grouped by date. Budgets: two sections — expense spending limits and
  income goals (2026-08-25), each with per-category inline edit. Bills (2026-08-25): every recurring
  bill/income sorted by next-due date, `+` to add one directly, tap to edit/cancel. Stats: 6-month
  income/expense trend chart + current-month category breakdown (react-native-svg).
- **Bills (2026-08-25)** — new tab + `app/bill-editor.tsx` give `RecurringTransaction`s the
  management screen they never had (previously creatable only via add-transaction's "Repeat
  monthly" checkbox, with no way to view/edit/cancel afterward). `lib/recurring.ts` gained
  `updateRecurring` (edits apply going forward only) and `nextDueDate()`. Deleting a bill only stops
  future generation — past transactions it already posted are untouched. See CLAUDE.md's "Bills"
  bullet.
- **Income budgets/goals (2026-08-25)** — Budgets now has an "Income Goals" section alongside
  "Expense Budgets", each with its own `+` to add a category of that type. `lib/budgets.ts`'s
  `getBudgetProgress` resolves a budget's type from its category rather than assuming expense;
  `ProgressBar` takes a `type` prop so an income bar turns success-green at/past goal instead of
  destructive-red. `budget-editor.tsx` swaps its wording/badge tint the same way. See CLAUDE.md
  "Income budgets" convention for the full design.
- **Add/edit transaction** (`app/add-transaction.tsx`) — modal, expense/income toggle, amount,
  category grid, custom calendar date picker (capped at today), note, optional "Repeat monthly"
  (creates a `RecurringTransaction`).
- **Categories are AsyncStorage-backed and user-editable** (`lib/categories.ts`, seeded from 19
  built-ins on first read). `app/category-editor.tsx`: add new (Budgets' `+`) or edit
  name/icon/color (long-press a Budgets row) — icon picker has an offline keyword-based "AI"
  suggestion (`lib/category-icons.ts`, same pattern as HabitTracker's `habit-icons.ts`) plus a
  manual grid. No delete yet.
- **Recurring transactions** — monthly only, materialized lazily on app launch (`lib/recurring.ts`).
- **Design**: standardized expense=red/income=green everywhere a transaction's type shows (amounts,
  category icons, accent bars, toggles, buttons) — not just per-category colors. Elevated
  rounded-card list style (`CardRadius`/`CardShadow` in `constants/theme.ts`) across all four tabs.
- **Local-only** — AsyncStorage, no accounts/sync (deliberate v1 scope, see TODO.md).
- **Pinned to Expo SDK 54** (not the current 57) so the App Store build of Expo Go can run it —
  Apple's Expo Go approval has been stuck since SDK 55. See CLAUDE.md "Why SDK 54, not 57".

## Stability

`tsc --noEmit` and `expo lint` both clean as of this update. No automated tests yet.

## Open verification items

- **Income budgets/goals (2026-08-25)** — verified in the web preview: creating an income category
  via Budgets' new second `+`, setting a goal on Salary through `budget-editor.tsx` (placeholder read
  "Monthly goal", saved correctly), and a seeded over-goal transaction rendering the progress fill as
  solid success-green (`rgb(52, 199, 89)`) instead of destructive-red. Not yet given an on-device
  pass — should behave identically to the pre-existing expense-budget UI it's a variant of, but
  hasn't been physically confirmed.
- **Bills (2026-08-25)** — verified in the web preview: added a Housing bill (day 15, this being
  added on the 25th), confirmed it immediately posted a matching Aug 15 transaction, that the Bills
  row showed "Next due September 15" afterward, that editing loaded the saved amount/note back
  correctly, and that deleting (two-tap) removed it from Bills while leaving the Aug 15 transaction
  in place. Not yet given an on-device pass.

## Repo

https://github.com/nickolastriga-hash/BudgetTracker
