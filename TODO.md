# TODO / Future Phases

v1 scope was: expense/income logging, per-category monthly budgets, stats/charts, monthly recurring
transactions, all local-only. Deliberately deferred:

- **Accounts / cloud backup** — no sign-in, no sync. Everything lives in AsyncStorage on-device only.
- **Custom categories** — the 19 built-in categories (14 expense, 5 income) in `lib/categories.ts`
  are fixed. Adding custom categories means deciding what happens to a category's existing
  transactions/budget on delete (reassign to "Other" is the obvious default).
- **Weekly/biweekly recurring transactions** — `lib/recurring.ts` only supports monthly. The
  `RecurringTransaction` shape would need a discriminated union on frequency.
- **Per-month budget history** — a `Budget` is currently a single flat limit, not tracked per month.
- **Multi-currency** — amounts are unitless numbers rendered with a hardcoded `$`.
- **Light/Dark/Auto override** — currently always follows the OS color scheme
  (`react-native`'s `useColorScheme`), no in-app theme preference like HabitTracker has.
- **Export / CSV** — no data export yet.
- **Editing a recurring series** — `RecurringTransaction`s can only be created (via the "Repeat
  monthly" checkbox when adding a transaction) or implicitly stopped (delete via
  `lib/recurring.ts#deleteRecurring`, not yet wired to any UI). There's no screen listing active
  recurring items or letting you edit/cancel one.
