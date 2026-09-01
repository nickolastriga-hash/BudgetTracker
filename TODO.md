# TODO / Future Phases

Current state: [PROJECT_STATE.md](PROJECT_STATE.md). History: [CHANGELOG.md](CHANGELOG.md).

v1 scope was: expense/income logging, per-category monthly budgets, stats/charts, monthly recurring
transactions, all local-only. Deliberately deferred:

- **Trends' budget total doesn't prorate partial months** — `budgetTotalForRange` (in `trends.tsx`)
  counts a calendar month's full budget/goal even if a custom range only partially overlaps it. Fine
  for Month/Year, a known v1 simplification for Custom. Revisit if that reads as misleading in
  practice.
- **"Other"/"Other Income" are still a muted grey** (`#98989D`) after the 2026-08-31 palette cleanup,
  which only removed grey from the *pickable* `CATEGORY_COLORS` swatches and recolored Subscriptions
  (the one default category that had used a swatch grey). Left as a deliberate neutral-catch-all
  choice, not an oversight — revisit if that still reads as "there's a grey category" in practice.
- **Accounts / cloud backup** — no sign-in, no sync. Everything lives in AsyncStorage on-device only.
- **Category delete/reassignment** — categories are now editable (name/icon/color, via long-press
  in Budgets or `+` to add new) and AsyncStorage-backed (`lib/categories.ts`), but there's still no
  delete. Deleting needs a decision about what happens to a deleted category's existing
  transactions/budget (reassign to "Other" is the obvious default) — not built yet.
- **Weekly/biweekly recurring transactions** — `lib/recurring.ts` only supports monthly. The
  `RecurringTransaction` shape would need a discriminated union on frequency.
- **Per-month budget history** — a `Budget` is currently a single flat limit (plus at most one
  override and one scheduled future change, see `lib/budgets.ts`), not a full per-month history.
  Budgets gained its own month nav (2026-08-29) so a past/future month's spent-vs-limit can be
  *reviewed*, but that's still reading the same flat-limit-plus-overrides model, not storing a
  distinct record per month.
- **Multi-currency** — amounts are unitless numbers rendered with a hardcoded `$`.
- **Light/Dark/Auto override** — currently always follows the OS color scheme
  (`react-native`'s `useColorScheme`), no in-app theme preference like HabitTracker has.
- **Export / CSV** — no data export yet.
- **Editing a recurring series** — `RecurringTransaction`s can only be created (via the "Repeat
  monthly" checkbox when adding a transaction) or implicitly stopped (`lib/recurring.ts#deleteRecurring`,
  not wired to any UI). A standalone Bills tab briefly existed (2026-08-25 – 2026-08-26, listing every
  recurring item with add/edit/cancel) but was removed to make room for a dashboard-style redesign
  instead — revisit recurring-series management as part of that, rather than as its own tab. See
  CLAUDE.md's `lib/recurring.ts` bullet.
- ~~**Dashboard**~~ — done (2026-08-26): Home's old plain summary card was replaced with a donut-ring
  category breakdown + compact income/expense/net row + 6-month trend mini chart. See CLAUDE.md's
  "Home's dashboard card" bullet.
- ~~**Stats tab**~~ — removed (2026-08-26): its 6-month trend chart and category breakdown are now
  covered by Home's dashboard card and Transactions' Calendar view, so the standalone tab was
  dropped rather than kept as a third place showing similar numbers.
- ~~**Calendar view for Transactions**~~ — done (2026-08-26): a List/Calendar segmented toggle,
  swipeable (horizontal `pagingEnabled` ScrollView) or tappable, with a day-of-month grid showing
  that day's spend and a shared month/year nav (chevrons + a tap-to-open month/year picker modal,
  matching HabitTracker's shape — see CLAUDE.md's "Transactions List/Calendar" convention).
- ~~**Calendar view is expense-only**~~ — done (2026-08-27): day cells now show both expense (red)
  and income (green) via two separate maps.
- ~~**Category icon colors forced to red/green**~~ — reverted 2026-08-26: `CategoryBadge` uses the
  category's own color again, with a small red/green corner dot as the type cue. See CLAUDE.md's
  "Category icon colors are custom again" convention.
- ~~**Settings screen / demo data**~~ — done (2026-08-26): `app/settings.tsx`, reached via a
  `SettingsButton` on every tab, with a "Generate year-to-date data" feature. See CLAUDE.md's
  "Settings + demo data" convention.
- **No "clear demo data" companion** — `generateYearToDateDemoData()` is purely additive; there's no
  button to remove what it added, or to wipe all transactions/budgets generally. Running it more
  than once just piles up more data rather than replacing the previous batch.
