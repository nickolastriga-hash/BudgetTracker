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
- **Accounts / cloud backup** — Phase 1 done (2026-09-17): an optional account (Settings → Account,
  Firebase Auth: email/password + Google + Apple), matching HabitTracker's own staged rollout. Signing
  in doesn't touch data yet — everything still lives in AsyncStorage on-device only. Data sync/backup
  (the actual point of having an account) is a separate future phase, not built.
- ~~**Category delete/reassignment**~~ — done (2026-09-14): `lib/categories.ts#deleteCategory`
  moves the category's transactions and recurring series to that type's "Other", drops its budget,
  and removes the row; reached from the category editor's two-tap Delete. The two "Other" rows can't
  be deleted. See CLAUDE.md's "Categories are AsyncStorage-backed" bullet.
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
- ~~**Multi-currency**~~ — mostly done (2026-09-14) as a display setting: Settings → CURRENCY picks
  a symbol and a number-format locale (`lib/currency.ts`, `hooks/use-currency.tsx`), and every
  amount in the app renders through `useCurrency().format`. Still single-currency: no per-transaction
  currency and no conversion, by design. See CLAUDE.md's "Currency is a display setting" bullet.
- ~~**Light/Dark/Auto override**~~ — done (2026-09-17): `hooks/use-theme-preference.tsx`
  (`ThemePreferenceProvider`/`useThemePreference`), matching HabitTracker's own hook of the same
  name — an AsyncStorage-backed preference, defaulting to `'system'` (the old always-follows-OS
  behavior), with `'light'`/`'dark'` pinning it. Set from Settings' new "APPEARANCE" section. See
  CLAUDE.md's `hooks/use-theme-preference.tsx` and Settings bullets.
- ~~**Export / CSV**~~ — done (2026-09-17): `lib/csv-export.ts#exportTransactionsCsv`, an "Export as
  CSV" row in Settings → DATA next to the JSON backup. One row per transaction (date, type, category
  name, amount, note, a Yes/No recurring flag), sorted chronologically. Same native-share-vs-web-
  download split as `lib/backup.ts`'s own export, but unrelated to it otherwise — this is a one-way,
  human-readable spreadsheet export, not a backup format `importBackup` can read back.
- **Wealth follow-ups (2026-09-13)** — savings goals, debt payoff planner, and net worth are all
  hand-entered (see CLAUDE.md's "Wealth tab data is hand-entered" bullet). Still open: net worth
  history sampled on a schedule rather than only when the page opens. ~~A goal contribution
  optionally logging a matching transaction; a debt payment doing the same~~ — done 2026-09-14, an
  "Also log as a transaction" Switch per goal/debt in their editors (see CLAUDE.md's "Payments can
  log transactions" bullet). ~~A Home card summarizing Wealth~~ — done 2026-09-14
  (`components/wealth-summary-card.tsx`).
- **Trends lost its Custom range** — with Trends now a card on Home (Month/Year only), the
  Week/Custom range types the old tab could show are gone. Revisit if a custom-range cumulative chart
  is missed.
- **App lock is PIN-only on web** — expo-local-authentication's web shim reports no hardware, so the
  biometric row never shows there. Fine for the dev-fallback web build; not worth a WebAuthn path.
- ~~**No standalone Recurring management screen**~~ — done (2026-09-03), moved twice on 2026-09-10:
  started as `app/recurring.tsx`, a modal reached via a "RECURRING" section in Settings; briefly a
  5th "Bills" tab; now the **Recurring page** of the Transactions tab's List/Calendar/Recurring pager
  (`app/(tabs)/transactions.tsx`) — every active series soonest-due-first with a two-tap "Stop" per
  row, and the tab's FAB opens add-transaction.tsx pre-checked to Repeat from that page. See
  CLAUDE.md's "A standalone Bills tab" convention bullet.
- ~~**Editing a recurring series after creation**~~ — done (2026-09-12): `lib/recurring.ts#updateRecurring`
  patches a series' amount/category/note (any frequency) and dayOfMonth (monthly only) — only future
  occurrences pick it up, past ones (including the transaction you're editing, unless you also hit
  the regular Save) are untouched. Reached from add-transaction.tsx's Repeats card (an Edit pencil
  next to Stop, its own compact amount/category/day panel — not a satellite of the screen's own
  fields, see CLAUDE.md's own bullet for why) and from the Recurring page's own row (its Edit pencil
  deep-links to the series' most recent transaction).
  Frequency itself (monthly/weekly/biweekly) still isn't editable — switching it would need to
  re-derive `lastGeneratedMonth`/`lastGeneratedDate` from scratch rather than patch a field; still
  only add a new series or stop this one for that. See CLAUDE.md's "Editing a recurring series"
  convention bullet.
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
