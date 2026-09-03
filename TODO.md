# TODO / Future Phases

Current state: [PROJECT_STATE.md](PROJECT_STATE.md). History: [CHANGELOG.md](CHANGELOG.md).

v1 scope was: expense/income logging, per-category monthly budgets, stats/charts, monthly recurring
transactions, all local-only. Deliberately deferred:

- **Trends' budget total doesn't prorate partial months** — `budgetTotalForRange` (in `trends.tsx`)
  counts a calendar month's full budget/goal even if a custom range only partially overlaps it. Fine
  for Month/Year, a known v1 simplification for Custom. Revisit if that reads as misleading in
  practice.
- **"Other"/"Other Income" are still a muted grey** (`#98989D`, a different hex than any
  `CATEGORY_COLORS` swatch — grey is a regular pickable swatch again as of the 2026-09-01 revert, see
  CLAUDE.md's `categories.ts` bullet). Left as a deliberate neutral-catch-all choice, not an oversight
  — revisit if that still reads as "there's a grey category" in practice.
- **Accounts / cloud backup** — no sign-in, no sync. Everything lives in AsyncStorage on-device only.
- **Category delete/reassignment** — categories are now editable (name/icon/color, via long-press
  in Budgets or `+` to add new) and AsyncStorage-backed (`lib/categories.ts`), but there's still no
  delete. Deleting needs a decision about what happens to a deleted category's existing
  transactions/budget (reassign to "Other" is the obvious default) — not built yet.
- ~~**Weekly/biweekly recurring transactions**~~ — done (2026-09-03): `RecurringTransaction` is now
  a discriminated union on `frequency` (`monthly` | `weekly` | `biweekly`); add-transaction.tsx's
  checkbox became "Repeat" plus a Weekly/Biweekly/Monthly segmented toggle (Monthly still the
  default). See CLAUDE.md's `lib/recurring.ts` bullet for the full mechanics, including how existing
  monthly-only records migrate on read.
- **Per-month budget history** — a `Budget` is currently a single flat limit (plus at most one
  override and one scheduled future change, see `lib/budgets.ts`), not a full per-month history.
  Budgets gained its own month nav (2026-08-29) so a past/future month's spent-vs-limit can be
  *reviewed*, but that's still reading the same flat-limit-plus-overrides model, not storing a
  distinct record per month.
- **Multi-currency** — amounts are unitless numbers rendered with a hardcoded `$`.
- **Light/Dark/Auto override** — currently always follows the OS color scheme
  (`react-native`'s `useColorScheme`), no in-app theme preference like HabitTracker has.
- **Export / CSV** — no data export yet.
- ~~**No standalone Recurring management screen**~~ — done (2026-09-03): `app/recurring.tsx`, a
  modal reached via a "RECURRING" section in Settings (not its own tab — the earlier Bills tab was
  deliberately removed 2026-08-26, see CLAUDE.md), lists every active series soonest-due-first with a
  two-tap "Stop" per row. **Still not covered**: editing a series' amount/day/category after
  creation — only stop it entirely and set up a new one. See CLAUDE.md's `recurring.tsx` bullet.
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
- ~~**Settings screen / demo data**~~ — done (2026-08-26, extended 2026-08-31 to also cover last
  year and income goals): `app/settings.tsx`, reached via a `SettingsButton` on every tab, with a
  "Generate demo data" feature. See CLAUDE.md's "Settings + demo data" convention.
- **No "clear demo data" companion** — `generateDemoData()` is purely additive; there's no
  button to remove what it added, or to wipe all transactions/budgets generally. Running it more
  than once just piles up more data rather than replacing the previous batch.
