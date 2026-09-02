# Changelog

Newest first.

## 2026-09-01 — Week's Calendar redesigned to a whole-month grid with week-level selection

- Follow-up to the same-day change below, per feedback: Week mode's Calendar page no longer collapses
  to just the selected week's compact 7-day row — it now shows the whole month (same grid as Month's
  own `CalendarView`), with the selectable/highlightable unit being a whole calendar week (one grid
  row, wrapped in its own bounding rectangle) instead of a single day. The real current week gets a
  blue outline by default; tapping any week selects it (fills it blue) and expands that week's
  transactions below. Landed as a new `WeekCalendarView` component rather than a further-generalized
  `CalendarView` — `CalendarView` itself reverted back to its simpler `month: Date` signature (its
  sole caller again, once Week stopped needing a shared `cells`/`periodKey` abstraction that was only
  a few hours old). See CLAUDE.md's "Transactions List/Calendar" convention bullet.
- Month's own day-of-month grid cells (`dayCell`) are now slightly condensed vertically
  (`aspectRatio: 1.3` instead of a plain square), per feedback that a 5-6-row month read taller than
  it needed to.

## 2026-09-01 — Transactions: Calendar for Week/Year too; grey restored to category palette

- Transactions' Calendar page is no longer Month-only: a new Week mode showed just the selected
  week's 7 days (superseded the same day, see the entry above), and a new `YearCalendarView` gave
  Year mode its own Calendar shape — a 12-month grid (each cell showing that month's expense/income
  totals), tapping a month selects it and expands that month's transactions below, no further
  day-grid drill-down. Only Custom still has no Calendar page (no single-grid shape fits an arbitrary
  range); every other rangeType now shows the List/Calendar toggle and page-dot row. `MONTH_NAMES` (a
  12-short-month-name array) was extracted to `lib/date-range.ts` once Year's month-grid became the
  3rd near-identical copy (budgets.tsx and range-picker-modal.tsx each had their own). See CLAUDE.md's
  "Transactions List/Calendar" convention bullet.
- Reverted the 2026-08-31 "no grey" change to `CATEGORY_COLORS`: grey (`#8E8E93`) is back in the
  swatch picker per explicit feedback, and the second magenta pink that had replaced it is dropped.
  Subscriptions (the one seeded default category the 08-31 change had recolored) moved back to grey
  too. See CLAUDE.md's `categories.ts` bullet.

## 2026-08-31 — Demo data now covers last year and income goals too

- `generateYearToDateDemoData()` renamed to `generateDemoData()` and extended per feedback: it now
  backfills two ranges — this year's Jan 1 through today (as before) plus all of last year, Jan 1
  through Dec 31 — so Trends' Year view and year-over-year comparisons have a prior period to compare
  against. Also now sets a monthly goal on up to 3 income categories in addition to the existing
  expense-category budgets (previously expense-only), both applied "onward" from the current year's
  January so they cover both backfilled years. Settings' button/copy renamed to "Generate demo data"
  to match. See CLAUDE.md's `demo-data.ts` and "Settings + demo data" bullets.

## 2026-08-31 — Trends: dropped the diagonal pace line, fixed scrub-vs-swipe conflicts

- Reverted the diagonal "paced" budget line (Expenses only, added earlier the same day) back to one
  flat, dotted "Target" reference line for all three of Expense/Income/Net, per feedback — no more
  per-type branching, no ahead/behind status band. `CumulativeTrendChart` lost its `paced` prop
  entirely; the flat line, "Today" marker, gradient fill, and scrub callout (now always showing a
  flat target + "vs target" delta) are unchanged. See CLAUDE.md's `cumulative-trend-chart.tsx` bullet.
- Fixed two real bugs with dragging to scrub a chart: (1) it also swiped the outer Expense/Income/Net
  pager to the next page, even though the chart's touch overlay claimed the JS responder on
  touch-down — claiming the responder doesn't stop the pager, since its horizontal scroll is driven
  by a native pan gesture recognizer that lives outside the JS responder system entirely and has no
  idea a child view is "handling" the same touch. Fixed by having the chart call new
  `onScrubStart`/`onScrubEnd` props on touch-down/touch-up; `trends.tsx` wires those to an
  `isScrubbing` flag and passes `scrollEnabled={!isScrubbing}` to the pager `ScrollView`, actually
  disabling it for the drag's duration. (2) The touch itself was unreliable to begin with — per
  feedback, Trends' outer vertical `ScrollView` was a *second* native pan-gesture recognizer
  competing for the same drag; switched it to a plain, non-scrolling `View` (this tab's one card fits
  without scrolling). The chart's touch layer also now claims the responder on both the capture and
  bubble variants of both start/move (`onStart/MoveShouldSetResponderCapture` added alongside the
  existing non-capture handlers) for a faster, more reliable claim. See CLAUDE.md's Trends scrubbing
  and "No vertical scrolling" bullets for the full explanation.

## 2026-08-30 — Custom date range + new Trends tab

- Home and Transactions' Week/Month/Year range nav gained a 4th "Custom" option — two taps on a
  calendar day grid set a start/end range, and the nav chevrons slide the whole window by its own
  length. Once a 3rd screen (Trends, below) needed the same machinery, `rangeBounds`/`shiftAnchor`/
  `shiftCustomRange`/`RangePickerModal` were extracted out of their per-file duplicates into
  `lib/date-range.ts` and `components/range-picker-modal.tsx`; Home and Transactions now import from
  there instead.
- New **Trends** tab: a Month/Year/Custom range nav (no Week) plus a swipeable Expenses/Income/Net
  pager. Each page is a `CumulativeTrendChart` (`components/cumulative-trend-chart.tsx`, new
  react-native-svg component) — a running daily total of actual transactions, capped at today, against
  a flat grey dotted line at that period's total budgeted/goal amount (summed only from categories
  that actually have a limit/goal set). Net's line is derived from the other two (`income - expense`)
  rather than scanned separately. Press-and-hold-drag on the chart shows a per-day callout with that
  day's date, actual total, and budget total.

## 2026-08-27 — Ring gaps tightened + small segments grouped into "Other"

- Follow-up to the overlap fix below, per feedback that gaps were still too wide in places and some
  segments were still overlapping. Reduced `OUTLINE_WIDTH` from 3 to 2 and `desiredGap` from a flat
  `OUTLINE_WIDTH * 2` to `OUTLINE_WIDTH * 1.5` — smaller outline stroke means a smaller mandatory
  margin (13.5px vs 16px), which tightens the real visible gap between adjacent segments' colors
  from 12px to 7px of circumference while keeping the same non-overlap guarantee (verified the same
  way as before, against real rendered `stroke-dasharray`/`stroke-dashoffset` values).
- Segments too small to draw a real sliver (dash would land under a `MIN_VISIBLE_DASH` floor once
  the margin is trimmed off both ends) are now summed into one merged "Other" wedge instead of
  rendering as an invisible zero-length dash — on the same 11-category seeded data this turned 6
  invisible slivers into one visible grey (`otherColor`, caller passes `theme.textTertiary`) wedge.
  This is computed inside `CategoryRingChart` itself (generic, threshold tied to the same margin
  math that decides visibility) rather than in `index.tsx`'s data prep, and only affects the ring —
  the dashboard legend below it is unchanged and still lists real per-category breakdown with its
  own separate "+N more" cutoff.

## 2026-08-27 — Ring segments no longer overlap

- Fixed `CategoryRingChart` segments visually overlapping each other's rounded ends. The previous
  gap math shrank the flat gap between segments for "many segments" without accounting for how far a
  round line cap actually bleeds past its dash's mathematical endpoint (half the stroke's own
  width) — for the wider outline circle (26px) that bleed could exceed the shrunk gap entirely,
  letting one segment's outline paint over its neighbor's color. Replaced it with a fixed margin
  (`desiredGap/2 + outlineStrokeWidth/2`) trimmed from both ends of every segment's dash and folded
  into its offset, sized off the *outline's* stroke width (the widest of the two stacked circles) —
  this keeps a small, constant, count-independent gap between every pair of neighboring segments'
  painted pixels, verified directly against the rendered `stroke-dasharray`/`stroke-dashoffset`
  values (each segment's painted range lands exactly `desiredGap` inside its raw slice boundary on
  both sides). A side effect: a slice too small to fit a full margin on both sides now renders with
  `dash: 0` (invisible) rather than a forced 1px sliver that could still overlap its neighbor — seen
  on today's seeded demo data (11 expense categories, 6 too small to render a visible arc, matching
  the dashboard legend's own "+N more" cutoff). Single-segment behavior (skip the gap, close into one
  full circle) is unchanged.

## 2026-08-27 — White backgrounds, pinned headers, calendar income, page dots, arrow recolor

- Every tab's screen background switched from `theme.backgroundElement` (light grey) to
  `theme.background` (white) — Home, Transactions, Budgets. Modals (`add-transaction`,
  `category-editor`, `budget-editor`, `settings`) already used white and are unchanged.
- "Freeze panes": each tab's title/date-selector area is now pinned above its ScrollView instead of
  scrolling away with the content, matching a pattern Transactions already had.
  - Home: `ScreenHeader` + month nav pinned above the dashboard/budgets/recent-list scroll.
  - Budgets: `ScreenHeader` pinned above the scroll; "EXPENSE BUDGETS"/"INCOME GOALS" section
    headers are now sticky via `ScrollView`'s `stickyHeaderIndices` (each header/group pair had to
    become direct ScrollView children instead of being nested in one wrapping section View).
  - Transactions List: rewritten from a plain grouped `ScrollView` to a `SectionList`
    (`stickySectionHeadersEnabled`) — one section per date, one data item per section (the whole
    day's transaction array) so the existing card-with-dividers look survives unchanged; each date
    header now sticks to the top while its card scrolls underneath.
  - Transactions Calendar: the day-grid (`calendarCard`) is now pinned above a separate inner
    `ScrollView` holding only the selected day's transaction list, instead of the whole page being
    one ScrollView — same "pin the date selector above a scrolling detail panel" shape as
    HabitTracker's own calendar tab.
- Transactions' Calendar day cells now show income (green, `+$X`) alongside expense (red, `-$X`)
  instead of expense-only — a day with both renders two lines. Font/line-height on the day number
  and amount lines tightened so up to three lines (day, expense, income) still fit the small square
  cells.
- Added a page-dot row (List/Calendar) to Transactions below the segmented toggle — same shape as
  HabitTracker's own swipe-page dots (6px inactive, widens to 16px and turns accent when active). The
  segmented toggle still does the actual tapping; the dots are a passive readout of which page the
  pager is on.
- Flipped every date selector's coloring app-wide: chevrons are now `theme.accent` (blue) and the
  date/month/year label is plain text (black) — the reverse of the "black chevrons, blue label"
  convention from 2026-08-26 below, per explicit feedback. Covers Home's and Transactions' month
  nav, both screens' `MonthYearPickerModal` (year pager), add-transaction's `CalendarPicker`, and
  budget-editor's year nav.

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
