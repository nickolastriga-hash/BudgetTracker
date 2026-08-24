# Project State

_Last updated: 2026-08-24_

Snapshot of where the app stands. History: [CHANGELOG.md](CHANGELOG.md). Upcoming: [TODO.md](TODO.md).

## What's implemented

- **Home, Transactions, Budgets, Stats** tabs (Expo Router `NativeTabs`, SDK 54). Home: month summary
  (income/expense/net), top-3 budget progress, recent transactions, FAB to add. Transactions: full
  month list grouped by date. Budgets: per-category monthly limits with inline edit. Stats: 6-month
  income/expense trend chart + current-month category breakdown (react-native-svg).
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

## Repo

No git remote as of this update — local commits only.
