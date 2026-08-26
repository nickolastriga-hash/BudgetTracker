# TODO / Future Phases

Current state: [PROJECT_STATE.md](PROJECT_STATE.md). History: [CHANGELOG.md](CHANGELOG.md).

v1 scope was: expense/income logging, per-category monthly budgets, stats/charts, monthly recurring
transactions, all local-only. Deliberately deferred:

- **Accounts / cloud backup** — no sign-in, no sync. Everything lives in AsyncStorage on-device only.
- **Category delete/reassignment** — categories are now editable (name/icon/color, via long-press
  in Budgets or `+` to add new) and AsyncStorage-backed (`lib/categories.ts`), but there's still no
  delete. Deleting needs a decision about what happens to a deleted category's existing
  transactions/budget (reassign to "Other" is the obvious default) — not built yet.
- **Weekly/biweekly recurring transactions** — `lib/recurring.ts` only supports monthly. The
  `RecurringTransaction` shape would need a discriminated union on frequency.
- **Per-month budget history** — a `Budget` is currently a single flat limit, not tracked per month.
- **Multi-currency** — amounts are unitless numbers rendered with a hardcoded `$`.
- **Light/Dark/Auto override** — currently always follows the OS color scheme
  (`react-native`'s `useColorScheme`), no in-app theme preference like HabitTracker has.
- **Export / CSV** — no data export yet.
- ~~**Editing a recurring series**~~ — done (2026-08-25): the new Bills tab lists every
  `RecurringTransaction` and `bill-editor.tsx` edits/cancels one. See CLAUDE.md's "Bills" bullet.
- **Bills paid/unpaid tracking** — Bills only manages the recurring *schedule*; it doesn't track
  whether a given month's occurrence has actually been paid yet (transactions still post
  automatically on launch, same as before). A "mark as paid" per-month status would need a new
  field and would change generation from automatic to gated on that status.
