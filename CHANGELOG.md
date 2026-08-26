# Changelog

Newest first.

## 2026-08-26 — Ring outline + legend

- Each `CategoryRingChart` segment now has an outline — a second, wider Circle drawn behind it in
  the card's own background color (not a literal white, so it still reads correctly in dark mode)
  instead of a flat colored arc butted against its neighbor.
- Added a legend to Home's dashboard card, between the ring and the income/expense/net row: up to 6
  categories with a color dot, name, and % share of this month's spending, plus a "+N more" line if
  there are more.

## 2026-08-26 — Rounded, separated ring segments

- Home's dashboard `CategoryRingChart` segments now use `strokeLinecap="round"` and a small gap
  between them (scaled by stroke width and segment count) instead of touching directly — each
  category's slice reads as its own rounded pill rather than one solid connected ring, including
  when there's only one expense category (it still gets a gap instead of closing into a full circle).

## 2026-08-26 — Transaction row redesign + icon color split

- `transaction-row.tsx` (Home's recent list, Transactions' List and Calendar-day-detail lists)
  redesigned per feedback that the previous look was dated: dropped the 4px left accent bar and the
  small arrow-up/down glyph, bumped the icon badge to 42px, made the amount bold and let its color
  alone carry the expense/income cue, and added a trailing `chevron-right` (matching Budgets' rows).
  The `group` list containers on Home and Transactions picked up a real `CardShadow` for a subtle
  elevated look (had to drop their `overflow: 'hidden'`, which was clipping it).
- Partially reverted the custom-icon-color change from earlier today: transaction rows specifically
  go back to solid destructive-red/success-green icons (a transaction has one unambiguous type) via
  a re-added `color` override on `CategoryBadge`; Budgets, add-transaction's category grid, and
  budget-editor keep the category's own custom color + the small type dot, since only the
  transaction lists were called out as the problem.

## 2026-08-26 — Custom icon colors again + Settings/demo data

- Reverted `CategoryBadge` to use each category's own custom color instead of forcing
  destructive-red/success-green — that "standardization" (6da13da) had gone too far per explicit
  feedback. It now takes an optional `type: CategoryType` instead of a `color` override, drawing a
  small red/green dot in the badge's corner so expense/income is still visible without overriding
  the icon's own tint. Migrated every call site (`transaction-row.tsx`, `budgets.tsx` ×2,
  `add-transaction.tsx`, `budget-editor.tsx`).
- New Settings screen (`app/settings.tsx`) reached via a `SettingsButton` (34px, top-right of every
  tab's `ScreenHeader` — same size/placement as HabitTracker's own ProfileButton, gear glyph instead
  of a profile avatar). First feature: "Generate year-to-date data" — two-tap-confirmed, backfills
  random expense/income transactions and monthly limits on a handful of categories from Jan 1 of the
  current year through today (`lib/demo-data.ts`), for demoing/testing without hand-entering months
  of data. Purely additive, no "clear" companion yet.

## 2026-08-26 — Per-tab headers + month nav polish

- Added a `ScreenHeader` title ("Home"/"Transactions"/"Budgets", 28/700 — new
  `components/screen-header.tsx`) to the top of each tab, sized to match HabitTracker's own per-tab
  header. Extracted as a real shared component (not redefined per file) since all three tabs needed
  it identically — crosses the no-premature-abstraction rule's 3-occurrence threshold.
- Reworked the month nav's coloring on both Transactions and Home: chevrons are black (plain
  navigation), the month label itself is blue and opens the month/year picker modal — the label is
  the one thing that's pressable, so it's the one thing colored to look pressable.
- Gave Home the same month/year picker modal Transactions got (previously Home's month label wasn't
  tappable at all) — same shape, defined locally in `index.tsx` rather than shared with
  `transactions.tsx`'s copy (2nd occurrence, under the 3-occurrence threshold).

## 2026-08-26 — Transactions month/year picker

- Replaced the month nav's fast-rewind/fast-forward year buttons with a tap-to-open month/year
  picker modal (year pager + 12-month grid), matching HabitTracker's own month-nav shape. Both the
  chevrons and the tappable month label are now `theme.accent` (blue) so the row reads as pressable.
- Fixed a second real web-preview bug found while building this: the modal's `animationType="fade"`
  never actually unmounted after `visible` went `false` — react-native-web's fade animation relies
  on a CSS `animationend` event that didn't reliably fire, leaving the modal stuck open. Switched to
  `animationType="none"`.

## 2026-08-26 — Transactions Calendar view + Stats removed

- Transactions gained a List/Calendar segmented toggle above the existing month nav (which now also
  has year fast-rewind/fast-forward buttons, not just month chevrons). List is the pre-existing
  grouped-by-date view; Calendar is a new day-of-month grid showing each day's expense total, tap a
  day to expand its transactions below the grid. The two are pages of one horizontal `pagingEnabled`
  ScrollView, so both swiping and tapping the toggle switch between them.
- Fixed a real bug found while building this: the toggle's `ScrollView.scrollTo({..., animated:
  true})` silently no-ops on react-native-web (page never moves) — switched the tap path to
  `animated: false`; swipe gestures were never affected.
- Removed the Stats tab (`app/(tabs)/stats.tsx`) — its 6-month trend chart and current-month category
  breakdown are now redundant with Home's dashboard card and Transactions' new Calendar view.
  Down to 3 tabs: Home, Transactions, Budgets.

## 2026-08-26 — Home dashboard

- Replaced Home's plain income/expenses/net summary card with a dashboard: a new
  `CategoryRingChart` (`components/category-ring-chart.tsx`, a stacked-`Circle` react-native-svg
  donut) showing the navigated month's expense-by-category breakdown, with the top category's
  icon/amount/name in the center; a compact income/expenses/net row below it; and a `MiniTrendChart`
  6-month income-vs-expense mini bar chart. Own visual style, not copying the reference screenshot
  that prompted it. Top-3 budget progress and recent transactions are unchanged below it.

## 2026-08-26 — Bills tab removed

- Removed the Bills tab, `app/bill-editor.tsx`, and the now-unused `updateRecurring`/`nextDueDate`/
  `transactionCountForRecurring` exports from `lib/recurring.ts` (core CRUD and
  `generateDueTransactions()` are untouched — the "Repeat monthly" checkbox in add-transaction.tsx
  still works exactly as before). Pulled to make room for a dashboard-style redesign instead of a
  standalone recurring-management tab. See TODO.md.

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
