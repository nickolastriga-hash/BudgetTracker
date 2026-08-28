# Project State

_Last updated: 2026-08-27_

Snapshot of where the app stands. History: [CHANGELOG.md](CHANGELOG.md). Upcoming: [TODO.md](TODO.md).

## What's implemented

- **Ring is now tappable (2026-08-27)** — tapping a `CategoryRingChart` segment selects it, swapping
  the ring's center to that category's amount/name (or the merged "Other" wedge's total) and
  highlighting the segment's outline in `theme.accent`; tapping the same segment again deselects,
  back to the default center view, which is now the month's *total* expense rather than the top
  category. Hit-testing is hand-rolled (angle + radius math off a `Pressable` overlay, not `onPress`
  on the SVG shapes directly — that logs console errors on web) since react-native-svg shapes don't
  reliably take touch events cross-platform. See CLAUDE.md's `category-ring-chart.tsx` bullet.
- **Ring segments no longer overlap, gaps tightened, small ones grouped into "Other" (2026-08-27)** —
  `CategoryRingChart`'s gap between segments is a fixed margin sized off the wider outline circle's
  stroke width (accounting for how far its round line cap actually bleeds past the dash's endpoint),
  replacing a flat gap that shrank for "many segments" without accounting for that bleed — the
  shrunk gap could end up smaller than the outline's own cap radius, letting one segment's outline
  paint over its neighbor. Tightened further the same day (`OUTLINE_WIDTH` 3→2, smaller `desiredGap`
  factor) per feedback that the gap was still wider than it needed to be. Segments too small to draw
  a real sliver are now summed into one merged grey "Other" wedge instead of rendering invisibly.
  See CLAUDE.md's `category-ring-chart.tsx` bullet.
- **White backgrounds, pinned headers, sticky list headers, page dots, blue arrows (2026-08-27)** —
  every tab's screen background is now white (`theme.background`, was `theme.backgroundElement`
  grey). Home/Budgets' headers (Home's with its month nav) are pinned above their scroll instead of
  scrolling away; Budgets' two section headers are sticky via `stickyHeaderIndices`; Transactions'
  List is now a `SectionList` with sticky per-date headers, and its Calendar page pins the day grid
  above a separate scrollable day-detail list. Transactions' Calendar day cells show both expense
  (red) and income (green), not expense-only. Transactions gained a HabitTracker-style page-dot row
  under its List/Calendar toggle. Every date selector's chevrons are now blue/label black (reversed
  from the prior black-chevron/blue-label scheme). See CLAUDE.md's "Pinned headers + white
  backgrounds" and "Transactions List/Calendar" convention bullets.
- **Home, Transactions, Budgets** tabs (Expo Router `NativeTabs`, SDK 54; Stats was removed
  2026-08-26 — its content is now covered by Home's dashboard card and Transactions' Calendar view).
  Each opens with a `ScreenHeader` title (2026-08-26, new `components/screen-header.tsx`, 28/700 —
  matches HabitTracker's own per-tab header sizing). Home: a dashboard card — donut ring of the
  navigated month's expense-by-category breakdown (center: top category's icon/amount/name), a
  compact income/expenses/net row, and a 6-month trend mini chart — plus top-3 budget progress and
  recent transactions. Transactions: a shared month/year nav above a List/Calendar swipeable toggle
  (2026-08-26) — List is the full month grouped by date, Calendar is a day-of-month grid of that
  day's spend, tap a day to expand its transactions. Budgets: two sections — expense spending limits
  and income goals (2026-08-25), each with per-category inline edit.
- **Month/year nav (2026-08-26)** — Home and Transactions both got the same treatment: black
  chevrons (plain navigation) either side of a blue, tappable month label that opens a
  `MonthYearPickerModal` (year pager + 12-month grid), matching HabitTracker's month-nav shape.
  Defined locally in both `index.tsx` and `transactions.tsx` (2 occurrences, not yet shared per the
  no-premature-abstraction rule). Transactions' version replaced an earlier fast-rewind/fast-forward
  button pair. See CLAUDE.md's "Transactions List/Calendar" convention for both web workarounds
  (pager `scrollTo`'s `animated: false`, the picker modal's `animationType="none"`).
- **Home dashboard (2026-08-26)** — replaced the old plain income/expenses/net summary card with a
  `CategoryRingChart` (new `components/category-ring-chart.tsx`, stacked-`Circle` donut) plus a
  compact `MiniTrendChart`. See CLAUDE.md's dashboard bullet for the design.
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
  Only creatable via add-transaction's "Repeat monthly" checkbox — there's no standalone management
  screen (a Bills tab briefly existed 2026-08-25 through 2026-08-26 but was removed).
- **Design**: expense=red/income=green for amounts everywhere a transaction's type shows. Category
  *icons* went through two reversals on 2026-08-26 (forced red/green → custom color + dot → split:
  transaction rows stay red/green, everywhere else keeps the custom color + dot) — see CLAUDE.md's
  "Category icon colors" convention for the full history. Transaction rows themselves were
  redesigned the same day (bigger badge, no accent bar/arrow glyph, trailing chevron, `CardShadow`
  on the list containers) per feedback that the old look was dated. Elevated rounded-card list style
  (`CardRadius`/`CardShadow` in `constants/theme.ts`) across all tabs.
- **Settings + demo data (2026-08-26)** — new `SettingsButton` (34px, top-right of every tab's
  header, matches HabitTracker's ProfileButton placement/size) opens `app/settings.tsx`. One feature
  so far: "Generate year-to-date data" — two-tap-confirmed, backfills random expense/income
  transactions and a handful of category budgets from Jan 1 through today
  (`lib/demo-data.ts#generateYearToDateDemoData`). Purely additive, no "clear" companion yet.
- **Local-only** — AsyncStorage, no accounts/sync (deliberate v1 scope, see TODO.md).
- **Pinned to Expo SDK 54** (not the current 57) so the App Store build of Expo Go can run it —
  Apple's Expo Go approval has been stuck since SDK 55. See CLAUDE.md "Why SDK 54, not 57".

## Open verification items (2026-08-27)

- **Ring segments no longer overlap, gaps tightened, small ones grouped into "Other"** — verified
  mathematically against the actual rendered `stroke-dasharray`/`stroke-dashoffset` values on the
  same 11-category seeded data, twice (screenshots weren't available either time this session — the
  Browser pane wasn't displayed client-side): first pass confirmed every neighbor pair landed exactly
  `desiredGap` (6px) apart with zero overlap, but 6 of the 11 categories rendered invisibly
  (`dash: 0`) rather than grouping. After tightening the gap and adding "Other" grouping, re-verified
  against the re-rendered SVG: now only 6 segments draw (5 real categories + one grey `#98989D`
  "Other" wedge summing the other 6), the full cursor chain closes exactly back to the circumference
  at the wraparound seam, and the real gap between adjacent colors is 7px (down from 12px) with the
  same zero-overlap guarantee. Not yet given a visual (screenshot or on-device) pass.
- **White backgrounds, pinned headers, sticky list headers, page dots, blue arrows** — verified in
  the web preview with seeded demo data: root screen background is `rgb(255, 255, 255)` on all three
  tabs; Home's title stayed at the same viewport position before/after scrolling 400px while
  "RECENT TRANSACTIONS" moved up underneath it, confirming the pinned header; Budgets' "EXPENSE
  BUDGETS" header stayed pinned (`position: sticky`, solid white background fully covering scrolled
  rows) while "Food & Dining" scrolled to `top: -121`; Transactions' List showed 4
  `position: sticky` date headers with solid backgrounds; Transactions' Calendar showed a day with
  both `-$153` (expense) and `+$3.3k` (income) and, after tapping a day, the day-grid stayed put
  while the day's transaction list appeared below it; the page-dot row rendered as a 16px accent dot
  (active) next to a 6px grey dot (inactive); month/year labels computed to `rgb(0, 0, 0)` and their
  chevrons to `rgb(0, 122, 255)` on Home and Transactions. No console errors on any of the three
  tabs. `tsc --noEmit` and `expo lint` both clean. Not yet given an on-device pass.
- **Ring chart single-segment fix** — `CategoryRingChart` no longer subtracts the inter-segment gap
  when there's only one segment, so a category at 100% of the month's spend closes into a full
  circle instead of a pill with a visible seam. Verified two ways: a hand-reproduction of the
  component's exact gap/dash math confirmed `stroke-dasharray` covers the full circumference at
  100%, and the running web preview showed the same after adding a single real transaction. Also
  diagnosed (not a code bug) that a long-running native Metro process — up since before today's
  branch switch to `main` — was serving Expo Go a stale bundle; restarted with `expo start -c`.

## Stability

`tsc --noEmit` and `expo lint` both clean as of this update. No automated tests yet.

## Open verification items

- **Income budgets/goals (2026-08-25)** — verified in the web preview: creating an income category
  via Budgets' new second `+`, setting a goal on Salary through `budget-editor.tsx` (placeholder read
  "Monthly goal", saved correctly), and a seeded over-goal transaction rendering the progress fill as
  solid success-green (`rgb(52, 199, 89)`) instead of destructive-red. Not yet given an on-device
  pass — should behave identically to the pre-existing expense-budget UI it's a variant of, but
  hasn't been physically confirmed.
- **Home dashboard (2026-08-26)** — verified in the web preview: seeded transactions across 3
  expense categories + 1 income, confirmed the ring's center showed the correct top category
  ("$582.00 / HOUSING"), the income/expense/net row and 6-month trend labels (Mar–Aug) rendered, and
  the empty state ("No expenses yet") showed correctly with no transactions. No console errors from
  the new component. Not yet given an on-device pass.
- **Transactions List/Calendar (2026-08-26)** — verified in the web preview: the Calendar grid
  showed correct per-day expense totals ($95/$210/$582 on the seeded days), tapping a day expanded
  its transactions below the grid, and the List/Calendar segmented toggle correctly moved the pager
  (`scrollLeft` 0 ↔ 1280 confirmed directly). Found and fixed a real bug along the way: the toggle's
  `scrollTo({..., animated: true})` silently no-op'd on react-native-web — switched to
  `animated: false` for the tap path (swipe itself was unaffected). Then replaced the month nav's
  fast-rewind/fast-forward buttons with a tap-to-open month/year picker modal (blue chevrons +
  label, matching HabitTracker's shape) — found and fixed a second real bug here too: the modal's
  `animationType="fade"` never unmounted on `visible: false` (RNW's fade depends on a CSS
  `animationend` event that didn't fire), fixed by switching to `animationType="none"`. Verified the
  full flow: open picker, change year, select a month, modal closes and header updates. Not yet
  given an on-device pass.
- **Screen headers + arrow recolor (2026-08-26)** — verified in the web preview: "Home"/
  "Transactions"/"Budgets" all render at the top of their tab; the month label's computed color is
  `rgb(0, 122, 255)` (theme.accent) on both Home and Transactions, and the chevrons are
  `rgb(0, 0, 0)` (theme.text) on Transactions; Home's own month/year picker modal opens, selects a
  month, and closes correctly (`modalCount` 1 → 0). Not yet given an on-device pass.
- **Settings/demo data (2026-08-26)** — verified in the web preview: generated demo data via
  Settings ("Added 130 transactions and set 6 category budgets"), confirmed it showed up correctly
  on Home/Budgets. Not yet given an on-device pass.
- **Category icon colors + transaction row redesign (2026-08-26, supersedes an earlier verification
  of the custom-color-everywhere version)** — verified in the web preview: transaction-row icons are
  back to solid red/green (`rgb(255,59,48)`/`rgb(52,199,89)`, confirmed on Housing/Groceries/
  Transport/Salary rows), while Home's dashboard ring badge (not reverted) still shows Housing's own
  purple (`rgb(175,82,222)`), and Budgets still renders its category-colored badges correctly —
  confirming the split landed where intended. Confirmed the list containers picked up a real
  `boxShadow` (`rgba(0,0,0,0.08) 0px 2px 6px 0px`) on both Home and Transactions. No console errors.
  Not yet given an on-device pass.

## Repo

https://github.com/nickolastriga-hash/BudgetTracker
