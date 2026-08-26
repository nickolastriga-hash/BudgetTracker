# Changelog

Newest first.

## 2026-08-25 — Bills tab

- New "Bills" tab (5th, after Budgets): lists every `RecurringTransaction` sorted by next-due date,
  with a `+` to add one and a tap to edit/cancel — the management screen recurring transactions
  never had (previously creatable only via add-transaction's "Repeat monthly" checkbox, with no way
  to view, edit, or cancel one afterward; see TODO.md's now-resolved "Editing a recurring series").
- New `app/bill-editor.tsx`: expense/income toggle, amount, category grid, a 1-31 day-of-month grid
  (recurrence is a day, not a specific date), optional note, two-tap "Cancel this bill" delete.
  Saving (add or edit) calls `generateDueTransactions()` immediately so a newly due bill posts its
  transaction without waiting for the next app launch.
- `lib/recurring.ts` gained `updateRecurring` (edits apply going forward only, `lastGeneratedMonth`
  untouched — same convention as a budget's `scheduledChange`) and `nextDueDate(item, today)`.
  `addMonths`/`dateInMonth` are now exported instead of file-private.
- Deleting a bill only stops future generation; transactions it already posted are left alone.

## 2026-08-25 — Income budgets/goals

- Budgets now has two sections: "Expense Budgets" (unchanged) and a new "Income Goals" section for
  income categories, each with its own `+` to add a category of that type
  (`category-editor.tsx?type=expense|income`).
- `lib/budgets.ts`'s `getBudgetProgress` now takes the loaded `Category[]` and resolves each
  budget's type from its category instead of always reading expense totals — an income budget's
  "spent" figure is that category's total *earned* this month instead.
- `ProgressBar` takes a new `type` prop: an expense bar still turns destructive red past 100% (over
  budget), an income bar turns success green at/past 100% instead (goal reached).
- `budget-editor.tsx` and the Budgets row list swap wording/badge tint (limit/goal,
  spent/earned, destructive/success) off the category's own type — no new data shape, an income
  budget is an ordinary `Budget` record.

## 2026-08-24 — Custom categories + icon editing

- Categories moved from a fixed constant to AsyncStorage-backed data (`lib/categories.ts`), seeded
  from the 19 built-ins on first read. `getCategory`/`categoriesForType` now take the loaded list as
  their first argument; every screen that shows a category loads it itself.
- New `app/category-editor.tsx` modal: add a category (Budgets' `+` button) or edit any category's
  name/icon/color (long-press a Budgets row). Icon picker offers an offline keyword-based "AI"
  suggestion (`lib/category-icons.ts`) plus a manual grid — same pattern as HabitTracker's
  `habit-icons.ts`/add-habit screen.

## 2026-08-24 — Design pass: red/green standardization + modernized cards

- Standardized expense=red/income=green across amounts, category icon tint, accent bars, the
  add-transaction type toggle/save button, and Home's Net figure (previously per-category colors
  and a neutral Net).
- Replaced flat hairline-bordered list rows with individually elevated rounded cards
  (`CardRadius`/`CardShadow` tokens) on Home, Transactions, and Budgets.

## 2026-08-23 — Downgraded to Expo SDK 54

- Scaffolded on SDK 57 by `create-expo-app`, then downgraded the same day: Apple's App Store build
  of Expo Go is frozen at SDK 54 (SDK 55+ stuck in review), so the SDK 57 project couldn't load via
  Expo Go on a physical iPhone at all. Ported `NativeTabs` to SDK 54's `Icon`/`Label`/`VectorIcon`
  API, moved `ThemeProvider` back to `@react-navigation/native`, dropped unused SDK57-only deps.

## 2026-08-23 — Initial scaffold

- Expo SDK 57 (later downgraded) + expo-router, TypeScript, local-only (AsyncStorage). Four tabs
  (Home/Transactions/Budgets/Stats), add/edit transaction modal, monthly per-category budgets,
  6-month trend + category breakdown chart, monthly recurring transactions.
