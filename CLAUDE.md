@AGENTS.md

# BudgetTracker

## Project Overview

A single-user, offline-first budget tracking app built with Expo Router. Users log expense/income
transactions against a fixed set of categories, set optional monthly spending limits per category,
and can mark a transaction as recurring monthly (e.g. rent, subscriptions) so it's regenerated
automatically each month. Four tabs (Home/Transactions/Budgets/Trends — Trends added 2026-08-30, see
its own bullet below), each opening with a `ScreenHeader` title (added 2026-08-26,
`components/screen-header.tsx` — 28/700, matching HabitTracker's own per-tab header sizing) plus a
`SettingsButton` in the header's top-right corner (also 2026-08-26, matching HabitTracker's
ProfileButton size/placement — a gear glyph instead of a profile avatar, since there's no accounts
system to show a profile for; opens `app/settings.tsx`, see its own bullet below):

- **Home** — "Home" header pinned above the scroll (2026-08-27, see the "Pinned headers" convention
  below), a month nav (same blue-chevrons/black-tappable-label/picker-modal shape as Transactions'
  below, added 2026-08-26, recolored 2026-08-27), a dashboard card (a donut ring of the navigated
  month's expense-by-category breakdown, center showing the top category's icon/amount/name; a
  compact income/expenses/net row; a 6-month income-vs-expense mini trend chart), a preview of up to
  3 budget categories' progress, and the month's most recent transactions. FAB opens the
  add-transaction modal.
- **Transactions** — "Transactions" header (a filter button — see below — plus `SettingsButton` in
  its top-right corner) pinned above the scroll, a Week/Month/Year/Custom range nav (2026-08-29, same
  chevrons-blue/label-black-tappable shape as Home's own, replacing an earlier month-only nav — see
  the "Transactions range selector" convention bullet below) above a List/Calendar segmented toggle
  plus a page-dot row (added 2026-08-26, dots added 2026-08-27; shown for every rangeType except
  Custom — Week and Year gained their own Calendar shapes 2026-09-01, see the "Transactions
  List/Calendar" convention bullet below for all three). List: all of the navigated range's
  transactions grouped by date with sticky per-date headers, tapping a row opens the same modal in
  edit mode. Calendar: a day-of-month grid in Month mode (pinned above the day-detail scroll, showing
  that day's expense in red/income in green, tap a day to expand its transactions below the grid); the
  same full month grid in Week mode but selectable/highlightable by whole calendar week instead of by
  day (each week is its own bounding rectangle, the real current week outlined blue by default, tap a
  week to select it — fills it blue and expands that week's transactions below); or a 12-month grid in
  Year mode (tap a month to expand that month's transactions below instead of a day). List and
  Calendar are pages of one horizontal
  `pagingEnabled` ScrollView for Month/Week/Year — swipe between them, or tap the toggle; Custom has
  no Calendar page (no single-grid shape fits an arbitrary range) and renders List alone, full-bleed.
  A funnel button next to `SettingsButton` (2026-08-29) opens a type/category filter that narrows
  every page at once — see the "Transactions filter" convention bullet below.
- **Budgets** — "Budgets" header, a month nav (same shape as Transactions'), then an Expense/Income
  segmented toggle plus a page-dot row (2026-08-29, replacing two stacked sections with two pages of
  one horizontal `pagingEnabled` ScrollView — swipe between them, or tap the toggle, same pattern as
  Transactions' List/Calendar). Expense page: a "Total Budgeted" summary card (over-100% categories
  called out in a red pill) above the expense category list, each with an optional monthly spending
  limit. Income page: an "Income Goals" summary card (goals reached called out in a green pill) above
  the income category list, each with an optional monthly income goal. Tap a row to set/edit/clear
  its limit/goal inline; progress bars flip semantics by page — an expense bar turns destructive red
  past 100% (over budget, bad), an income bar turns success green at/past 100% (goal reached, good).
  The toggle itself fills red/green on selection (same convention as add-transaction.tsx's own
  Expense/Income toggle) rather than a flat accent color. Progress (and `budget-editor.tsx`'s own
  spent-vs-limit, via a `month` query param carried from here) is computed against whatever month
  the nav is showing, not necessarily today's real calendar month — a `Budget`'s `monthlyLimit`
  still applies every month by default (see the `effectiveLimit`/`applyLimit` convention bullet
  below for the override/scheduled-change machinery), the nav just lets a past or future month's
  actual spent/earned be reviewed against that limit.
- **Trends** (added 2026-08-30) — "Trends" header, a Month/Year/Custom range nav (no Week option —
  see the screen's own convention bullet below), then an Expenses/Income/Net segmented toggle plus a
  page-dot row, same swipeable-pager pattern as Budgets' and Home's own pagers. Each page is a
  `CumulativeTrendChart` line — a running daily total of that type's actual transactions across the
  navigated range — against a flat, dashed budget/goal reference line (see the component's own bullet
  below) at that period's total budgeted/goal
  amount (summed from whichever categories actually have a budget/goal set), plus an actual-vs-budget summary
  row above the chart (a colored total, the budget total, and a green/red over-or-under pill). Net's
  page derives its line from the other two (`income - expense`, index-for-index) rather than its own
  transaction scan, and its "budgeted" reference is `incomeBudgetTotal - expenseBudgetTotal`. See the
  screen's own convention bullet below for the full mechanics.

All data is local — `AsyncStorage` only, no accounts, no sync. That's a deliberate v1 scope
decision, not an oversight; see [TODO.md](TODO.md) for what's intentionally deferred.

## Tech Stack

- **Expo SDK 54** (deliberately pinned below the current SDK 57 — see "Why SDK 54, not 57" below),
  React Native 0.81, React 19, React Compiler enabled (`experiments.reactCompiler` in `app.json`)
- **expo-router 6**, file-based routing under `src/app` (the `@/` path alias maps to `src/`, set in
  `tsconfig.json`). `NativeTabs` (`expo-router/unstable-native-tabs`) powers the tab bar, using the
  top-level `Icon`/`Label`/`VectorIcon` exports (`<NativeTabs.Trigger><Icon .../><Label>...</Label></NativeTabs.Trigger>`,
  `androidSrc` prop for the Android/web icon) — this is SDK 54's shape; SDK 56+ moved to a
  `NativeTabs.Trigger.Icon`/`.Label`/`.VectorIcon` dot-notation API instead, so don't copy examples
  from current Expo docs without checking which SDK they're for. There's a separate
  `_layout.web.tsx` fallback (`expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`/`TabSlot`) since
  `NativeTabs` doesn't render on web — same platform-file-override pattern used elsewhere (e.g.
  `hooks/use-color-scheme.web.ts`).
- **`ThemeProvider`/`DarkTheme`/`DefaultTheme` come from `@react-navigation/native`**, imported
  directly (`src/app/_layout.tsx`) — safe at SDK 54. **This becomes a hard Metro build error as of
  SDK 56+**, where expo-router stopped supporting `@react-navigation/native` as a direct dependency
  at all (even just for `useFocusEffect`) — if this project is ever upgraded past SDK 55, that
  import needs to move to whatever expo-router re-exports instead (`useFocusEffect`/`useIsFocused`
  already come from `'expo-router'` here, which works at both SDK 54 and 56+, so those don't need
  to change).

### Why SDK 54, not 57

`create-expo-app` scaffolded this project on SDK 57 originally. It was downgraded the same day
after discovering Apple's App Store build of Expo Go is frozen at SDK 54 — SDK 55+ has sat in
Apple's review queue without approval for months (confirmed via
[Expo's own changelog](https://expo.dev/changelog/expo-go-and-app-store-may-2026)), so a physical
iPhone running the App Store Expo Go app can't load anything newer. Options at the time were:
downgrade to SDK 54 (done — free, works immediately, matches HabitTracker's own pin), a self-signed
build via `sign.expo.dev` (works with SDK 57 but the provisioning profile expires ~weekly), or
`eas go` + TestFlight (needs a paid Apple Developer account). Revisit this pin once Apple approves
a newer Expo Go build, or if a dev-client build ever becomes the workflow instead of Expo Go.
- **TypeScript, strict**, project has zero `tsc --noEmit` errors — keep it that way.
- **react-native-svg** for Home's dashboard card (`CategoryRingChart`) and Trends' own
  `CumulativeTrendChart` (added 2026-08-30).
- **AsyncStorage** (`@react-native-async-storage/async-storage`) as the only persistence layer.
- **@expo/vector-icons** (`MaterialIcons`) for all icons — category icons, tab icons (via
  `NativeTabs.Trigger.VectorIcon` on native, plain `<MaterialIcons>` in the web tab bar), and UI
  chrome. iOS tab icons additionally use SF Symbols via the `sf` prop.
- No global state library — plain `useState` + `useFocusEffect` (from `expo-router`) re-fetching
  from storage per screen, same reasoning as most small offline-first RN apps: the data set is
  small, and a re-fetch on focus is simpler than keeping a store in sync.

## Coding Standards

- **No comments unless the *why* is non-obvious.** Keep it to short comments justifying a decision
  (e.g. why writes are queued, why recurring generation is batched by month).
- **No premature abstraction.** Small helpers like `toMonthStr`/`toDateStr` are redefined per file
  rather than shared — don't extract a shared util module until a *third* near-identical
  implementation shows up.
- **Functions over classes**, hooks over HOCs, everything is a function component.
- **Type-check and lint after every change**: `npx tsc --noEmit` and `npx expo lint` should both be
  clean before considering a change done.

## Folder Structure

```
src/
  app/
    _layout.tsx          Root Stack: (tabs) + add-transaction modal. Kicks off
                          generateDueTransactions() once per session, then hides
                          the splash screen.
    (tabs)/
      _layout.tsx         NativeTabs bar (native)
      _layout.web.tsx     Web fallback tab bar (expo-router/ui)
      index.tsx           Home
      transactions.tsx    Transactions — List/Calendar swipeable pages (added
                          2026-08-26), see the "Transactions List/Calendar"
                          convention bullet below.
      budgets.tsx         Budgets
      trends.tsx           Trends (added 2026-08-30) — Expense/Income/Net
                          swipeable pager of CumulativeTrendChart lines, see
                          the "Trends tab" convention bullet below.
    add-transaction.tsx   Add/edit modal — type toggle, amount, category grid,
                          a self-contained calendar-panel date picker (capped at
                          today), optional note, and (new transactions only) a
                          "Repeat monthly" checkbox that also creates a
                          RecurringTransaction. Edit mode adds a Delete button
                          that requires two taps (no Alert.alert dependency —
                          it doesn't behave consistently across web/native).
    category-editor.tsx   Add/edit-category modal, reached from Budgets (a `+`
                          button in each of the two section headers to add,
                          long-press a row to edit that category's
                          name/icon/color) — same AI-suggested-icon +
                          manual-grid-picker pattern as HabitTracker's
                          add-habit screen (see lib/category-icons.ts).
                          `type` is fixed per screen, not user-editable: the
                          add flow reads a `?type=expense|income` query param
                          (defaulting to expense) set by whichever Budgets
                          section's `+` button was tapped, so there's still no
                          in-form type toggle; editing keeps the category's
                          existing type. No delete yet, see TODO.md.
    budget-editor.tsx     Per-category budget modal, reached by tapping a row on
                          Budgets (`headerShown: false` in _layout.tsx — builds
                          its own header: category name left, a circular "X"
                          button right that calls router.back()). Body is a
                          plain ScrollView, not the tab's outer one, sized to
                          the full screen (not the old dropdown's clipped
                          panel). Holds the amount field, delete, a paged
                          12-month calendar grid (tap a square to set the
                          "starting on" month for the buttons below — see the
                          `applyLimit` convention bullet), and Reset-to-default.
    settings.tsx           Settings modal (added 2026-08-26), reached from any
                          tab's SettingsButton. `headerShown: true` in
                          _layout.tsx (native title "Settings", auto back
                          button) — no in-content title of its own, unlike
                          add-transaction/category-editor which follow the
                          same convention. One section so far: "Generate
                          demo data" (two-tap confirm, same pattern as
                          add-transaction's Delete), calls
                          lib/demo-data.ts#generateDemoData().

  lib/
    date-range.ts           Week/Month/Year/Custom range machinery (RangeType,
                          CustomRange, rangeBounds, shiftAnchor,
                          shiftCustomRange, daysBetween, monthsBetween, plus
                          the date-formatting helpers they're built from) —
                          extracted from Home/Transactions 2026-08-30 when
                          Trends became a 3rd near-identical copy, see the
                          "Custom date range" and "Trends tab" convention
                          bullets below for the full history. Also exports
                          MONTH_NAMES (a 12-short-month-name array, added
                          2026-09-01 once Transactions' new Year calendar page
                          became the 3rd near-identical copy — budgets.tsx's
                          month/year picker and range-picker-modal.tsx's own
                          month grid each had their own until then).
    transactions.ts       Transaction CRUD (AsyncStorage), month/category totals.
                          Writes go through a private promise-chain queue so two
                          rapid saves can't race on read-modify-write.
    budgets.ts             Budget (categoryId -> monthlyLimit) CRUD + progress calc.
                          Same write-queue pattern as transactions.ts. A Budget
                          record doesn't carry its own type — getBudgetProgress
                          takes the loaded Category[] and resolves each budget's
                          type from its category to decide whether "spent"
                          means expense-spent or income-earned (see the
                          "Income budgets" convention bullet below).
    categories.ts           AsyncStorage-backed category CRUD (seeded from 19
                          built-in defaults — 14 expense + 5 income — on first
                          read; the seeded rows are ordinary editable data
                          afterward, not special-cased). getCategory/
                          categoriesForType now take the loaded `Category[]`
                          as their first argument instead of reading a module-
                          level constant — every screen that renders a category
                          loads the list itself (useFocusEffect, same pattern as
                          transactions/budgets) rather than importing a fixed
                          array. Category.icon is typed against MaterialIcons'
                          own glyph names (`ComponentProps<typeof
                          MaterialIcons>['name']`), not a bare string, so a typo
                          fails tsc instead of failing silently. Also exports
                          CATEGORY_COLORS, the 12-swatch palette offered in
                          category-editor.tsx. Briefly lost its grey slot
                          2026-08-31 (swapped systemGray `#8E8E93` for a
                          second magenta pink `#FF2D95`, on the theory that
                          grey reads as "uncategorized"/disabled rather than a
                          real category identity) — reverted 2026-09-01 per
                          explicit feedback that grey should actually be
                          pickable, back to `#8E8E93` in the last slot with
                          the extra pink dropped; Subscriptions (the one
                          seeded default category the 08-31 change had
                          recolored) moved back to `#8E8E93` too. `#98989D`,
                          the muted grey `other_expense`/`other_income` use,
                          was untouched by either change — it's a different
                          hex, not a CATEGORY_COLORS slot, and a neutral tone
                          for a catch-all "Other" bucket is its own, separate
                          design call.
    category-icons.ts       Curated MaterialIcons set + offline keyword-based
                          suggestCategoryIcon(name), same shape as
                          HabitTracker's lib/habit-icons.ts (word-boundary
                          keyword matching, first-match-wins rule list, a
                          DEFAULT_CATEGORY_ICON fallback). No network call —
                          "AI" in the picker UI means this offline heuristic,
                          not a live model.
    recurring.ts            RecurringTransaction CRUD + generateDueTransactions(),
                          called once from the root layout. Monthly-only in v1
                          (dayOfMonth, clamped to each month's real length).
                          Materializes any owed months' transactions lazily on
                          launch rather than being scheduled ahead of time —
                          there's no OS-level scheduler involved. Only
                          add/get/delete + generateDueTransactions are
                          exported — `updateRecurring`/`nextDueDate` existed
                          briefly for a Bills management screen that was
                          removed 2026-08-26 (see TODO.md); re-add them if that
                          UI comes back.
    demo-data.ts            generateDemoData() (added 2026-08-26 as
                          generateYearToDateDemoData, renamed and extended
                          2026-08-31), called from settings.tsx. Backfills two
                          ranges with random expense/income transactions
                          (existing categories only, never creates new ones):
                          Jan 1 of the current year through today, plus (added
                          2026-08-31, per feedback that Trends' Year view and
                          year-over-year comparisons had nothing prior to
                          compare against) all of last year, Jan 1 through
                          Dec 31. Both ranges share one `backfillRange()`
                          helper (walks whole months, capping the final
                          month's last day at the range's own end — the
                          current year's range ends "today", last year's ends
                          its real Dec 31) which itself calls
                          `generateMonthTransactions()` per month, rather than
                          duplicating the month-walking loop per range. Also
                          sets a monthly limit/goal via lib/budgets.ts's
                          applyLimit on up to 6 expense categories (as
                          before) and, since 2026-08-31, up to 3 income
                          categories too (previously expense-only) — both
                          applied "onward" from the current year's January, so
                          the one recurring limit/goal covers both backfilled
                          years' worth of actuals. Purely additive — never
                          reads existing transactions/budgets before writing,
                          so it's safe to run against real data but will
                          double up if run twice. Sequential `await
                          addTransaction(...)` per generated row (same
                          read-modify-write-per-call shape as
                          generateDueTransactions above), not batched — fine
                          at this data volume (~200-300 rows across both
                          years), would need revisiting if the range or
                          per-month density grew much larger.

  components/
    range-picker-modal.tsx   RangePickerModal (extracted 2026-08-30 from Home/
                          Transactions' own near-identical copies once Trends
                          became a 3rd — see the "Custom date range" and
                          "Trends tab" convention bullets below). Renders
                          whichever of the 4 rangeType bodies (year-pager +
                          12-month grid / paged 12-years grid / month-pager +
                          day grid for week / same day grid for custom, two
                          taps) the caller is currently on — it doesn't need
                          to be told which rangeTypes a given screen offers,
                          since the caller's own segmented control already
                          restricts which values ever reach it (Trends never
                          passes 'week', for instance).
    cumulative-trend-chart.tsx  CumulativeTrendChart (added 2026-08-30) for
                          Trends — a react-native-svg `Polyline` running-total
                          line against a flat, dashed grey "Target" `Line` at
                          `budgetTotal`'s height (`budgetTotal: null` skips
                          the line entirely rather than drawing it at $0).
                          Takes `totalDays` (the full nominal period's day
                          count) separately from `points` (capped at today by
                          the caller — see the "Trends tab" convention bullet
                          below) as its x-axis domain, so a still-in-progress
                          period plots the actual line across only its
                          elapsed fraction of the width while the target line
                          keeps running out to the period's real end.
                          Bucketed by day regardless of the caller's range
                          type (Month/Year/Custom all resolve to a plain day
                          list via lib/date-range's daysBetween before
                          reaching here) — one rendering path instead of
                          three.
                          **A diagonal "paced" variant (2026-08-31, Expenses
                          only) came and went the same day.** It replaced the
                          flat line with one running from $0 on the period's
                          first day to `budgetTotal` on its last, plus an
                          ahead/behind status band filling the area between
                          the actual and pace lines (green/red per
                          `positiveIsGood`). Reverted the same day per
                          feedback: go back to one flat dotted reference line
                          for all three of Expense/Income/Net — there's no
                          `paced` prop, no band, and no per-type branching
                          any more. If a pace-style feature comes back later,
                          note it flipped the ahead/behind reading red/green
                          between paydays for Income (which arrives in lumps,
                          not a daily trickle) and Net inherited that same
                          lumpiness — that's *why* it was Expenses-only
                          before, not an oversight to fix by extending it to
                          all three.
                          **Visibility pass (2026-08-31, kept through the
                          revert above)**: the actual line gets a soft
                          `LinearGradient` fill under itself, namespaced with
                          `useId()` rather than a hardcoded gradient id,
                          since react-native-svg renders a real `<svg>` on
                          web and three of these charts (Expense/Income/Net)
                          are mounted at once — a fixed id would've had the
                          2nd and 3rd panel silently reuse the 1st's
                          gradient. A "Today" marker (a subtle dashed
                          vertical `Line` + label) appears when the period is
                          still in progress, at the same x where the actual
                          line currently stops — its label is
                          bottom-anchored, not top-anchored, because a
                          cumulative sum trends upward, so the actual line's
                          most recent point is usually already near the
                          *top* of the chart and a top label collided with it
                          constantly during testing. Press-and-hold-drag
                          scrubbing (added 2026-08-30, enhanced 2026-08-31 to
                          also show the scrubbed day's flat target value and
                          a colored "vs target" delta, not just the actual
                          total) shows a per-day callout via a transparent
                          touch-responder
                          `View` overlaid as a sibling of the `<Svg>` (not a
                          wrapper — same "ancestor Pressable around an Svg
                          triggers spurious console errors on web" reasoning
                          as CategoryRingChart's own tap handling), which
                          also reuses that component's `measureInWindow`-
                          plus-cached-offset approach to turn a touch's
                          `pageX` into a local x rather than trusting the
                          responder event's own `locationX` (proved
                          unreliable on web there, so this mirrors what
                          already worked instead of risking the same class
                          of bug again). Claims the responder on both the
                          start and move phases, and on both the capture and
                          bubble variants (`onStart/MoveShouldSetResponder`
                          plus their `...Capture` counterparts, added
                          2026-08-31 for reliability), on press-down rather
                          than after a hold delay, so a press-and-drag reads
                          as scrubbing as early and as reliably as the JS
                          responder system allows. Claiming the JS responder
                          alone doesn't actually stop the drag from also
                          paging the outer Expense/Income/Net pager, though —
                          that pager's horizontal scroll is driven by its own
                          native pan gesture recognizer, which lives outside
                          the JS responder system and doesn't care that some
                          child view "handled" the touch (found 2026-08-31:
                          an earlier trade-off note that used to live here
                          claimed swiping the chart wouldn't page the pager,
                          but it did). Fixed by having the chart call
                          `onScrubStart`/`onScrubEnd` props on touch-down/
                          touch-up, which `trends.tsx` wires to
                          `setIsScrubbing` and passes through as the pager
                          ScrollView's own `scrollEnabled={!isScrubbing}` —
                          actually disabling the pager for the drag's
                          duration rather than hoping responder claims alone
                          would keep it from noticing. The same day, Trends'
                          own outer vertical `ScrollView` was also dropped
                          for a plain non-scrolling `View` (see the "Trends
                          tab" convention bullet below) — it was a second
                          native pan-gesture recognizer competing for the
                          same drag, on top of the horizontal pager above.
                          Non-callout numeric labels (axis start/end dates,
                          "Target", "Today") are still drawn by the
                          caller/component with ThemedText, not SVG text —
                          same "SVG draws shapes, the screen draws text"
                          split as CategoryRingChart's center content — but
                          the callout itself is internal to this component
                          (it needs the chart's own x/y scaling to position
                          itself, unlike a caller-owned center label).
    category-ring-chart.tsx  Donut/ring chart (added 2026-08-26) for Home's dashboard card — stacked
                          react-native-svg `Circle`s, one per segment, each showing only its own
                          slice via strokeDasharray/strokeDashoffset. Small segments (their dash
                          would land under `MIN_VISIBLE_DASH`) are meant to be pre-merged by the
                          caller into one `RING_OTHER_KEY` wedge via the exported `groupRingSegments`
                          helper (same margin math as the component itself, so the threshold always
                          matches what would actually render) — done in `index.tsx`, not inside the
                          component, so the screen (which has the real Category data) knows what
                          landed in "Other" and can build a matching center callout. The legend below
                          the ring is unrelated — it lists real per-category breakdown with its own
                          "+N more" cutoff.
                          Tapping a segment (2026-08-27) selects it: a transparent `Pressable`
                          overlay (a sibling of the `<Svg>`, not a wrapper — react-native-svg's shapes
                          carry their own legacy touch-responder wiring, and a `Pressable` ancestor of
                          an `<Svg>` triggers spurious "Unknown event handler property" console errors
                          on web) hand-computes which segment was hit: `measureInWindow` on the outer
                          `View` (not the Pressable's own ref — same web console-error issue) plus the
                          tap's `pageX`/`pageY` gives a local point, undoing the -90deg display
                          rotation recovers the path's own angle, and a radial-distance check rejects
                          taps on the empty center or outside the ring. Selection is controlled
                          (`selectedKey`/`onSelectSegment`/`highlightColor` props) — the component
                          only knows keys/amounts/colors, so the caller owns what "selected" means and
                          re-renders the center `children` to match; index.tsx toggles a tapped
                          segment off (back to the total-expense default) if tapped again. The
                          selected segment's outline swaps to `highlightColor` and thickens slightly.
                          Each drawn segment is rendered with `strokeLinecap="round"`, trimmed on
                          both ends by a fixed `margin` (`desiredGap/2 + outlineStrokeWidth/2`,
                          folded into the dash's offset too) so segments read as separate rounded
                          pills rather than one connected loop. The margin is sized off the
                          *outline* circle's stroke width (the wider of the two stacked circles, not
                          the plain color one) since a round cap bleeds past its dash's mathematical
                          endpoint by half the stroke's own width — sizing the margin off the
                          narrower color stroke let the wider outline's own cap bleed into the next
                          segment (2026-08-27 fix; the previous version instead shrank a flat gap for
                          "many segments", which is what caused the overlap). This keeps a small,
                          constant, segment-count-independent gap between every pair of neighbors
                          regardless of how many segments there are — tightened the same day
                          (`OUTLINE_WIDTH` 3→2, `desiredGap` from a flat `OUTLINE_WIDTH * 2` to
                          `OUTLINE_WIDTH * 1.5`) per feedback that the gap was still wider than it
                          needed to be even after the overlap was fixed. A single 100%-share segment
                          skips all of this (no margin, no offset shift; there's nothing to separate
                          it from) and closes into one full unbroken circle instead of a pill with
                          its two round caps butted together. Each segment is also outlined by a
                          second, wider Circle drawn behind it in the same color as the card
                          (`outlineColor` prop, not a literal white — the caller passes `theme.card`
                          so it still looks right in dark mode) — reads as a white border in light
                          mode, a "cut out of the surface" border in dark mode either way. Rotated
                          -90deg (12 o'clock start) via the wrapping View's
                          `transform` style rather than each Circle's `rotation`/`origin` props — the
                          latter renders as an invalid `transform-origin` DOM attribute on web.
                          Center content is a plain absolutely-positioned View (children prop), not
                          SVG text, so callers reuse ThemedText/CategoryBadge there like anywhere
                          else in the app.
    category-badge.tsx      Colored circle + MaterialIcons glyph for a Category.
                          Tints from the category's own custom color by
                          default; an optional `color` prop overrides it
                          (transaction-row.tsx's only use, so a transaction's
                          icon reads as its type, not its category), and an
                          optional `type: CategoryType` draws a small red/
                          green corner dot instead, without overriding the
                          tint (used where the category color should survive
                          but the type should still be visible at a glance —
                          budgets.tsx, add-transaction.tsx, budget-editor.tsx).
                          `type` is ignored if `color` is also set. See the
                          "Category icon colors" convention bullet below for
                          the full back-and-forth on this.
    screen-header.tsx        ScreenHeader({title, right?}) — the 28/700
                          per-tab title, one per (tabs) screen (added
                          2026-08-26; `right` slot added same day for
                          SettingsButton below). Extracted as a real shared
                          component rather than redefined per file, unlike
                          this file's other small helpers — Home,
                          Transactions, and Budgets all needed the identical
                          treatment at once, crossing the no-premature-
                          abstraction rule's own 3-occurrence threshold.
    settings-button.tsx      SettingsButton (added 2026-08-26) — 34px
                          soft-accent circle + gear glyph, `router.push
                          ('/settings')`. Same size/shape/placement as
                          HabitTracker's own ProfileButton (top-right of every
                          tab's header row via ScreenHeader's `right` slot),
                          but a settings gear instead of a profile avatar —
                          this app has no accounts to show a profile for.
    progress-bar.tsx         Track + fill; takes a `type: 'expense' | 'income'`
                          prop (default 'expense') that decides the over-100%
                          fill color — destructive red for expense (over
                          budget, bad), success green for income (goal
                          reached, good).
    transaction-row.tsx      One transaction list row (icon, category, note,
                          signed amount) — shared by Home's recent list and the
                          Transactions tab. Takes a resolved `category` prop
                          (the caller looks it up via lib/categories.ts'
                          getCategory) rather than looking it up itself, since
                          categories are no longer a synchronously-importable
                          constant. Redesigned 2026-08-26 — see the
                          "Transaction rows redesigned" convention bullet
                          below.
    themed-text.tsx, themed-view.tsx, ...   From the Expo default template.

  constants/theme.ts      Colors.light / Colors.dark. Extends the template's
                          minimal palette with card/border/accent/success/
                          destructive/warning/textTertiary to cover the whole
                          app — same idea as HabitTracker's theme.ts, single
                          source of truth for every neutral/semantic color.
  hooks/use-theme.ts       useTheme() — resolves Colors[light|dark] against the
                          OS color scheme (no in-app Light/Dark/Auto override in
                          v1, unlike HabitTracker — see TODO.md).
```

## Important Conventions

- **Dates are `"YYYY-MM-DD"` strings**; months are `"YYYY-MM"`. Produced via manual
  `${y}-${pad(m)}` formatting rather than `toISOString()` in most places, since `Date`'s local
  getters (`getFullYear`/`getMonth`) are what the calendar picker and month nav actually need —
  `toISOString()` shifts to UTC and can land on the wrong local day.
- **Recurring transactions only support monthly frequency.** `RecurringTransaction.dayOfMonth` is
  clamped to each month's real last day (so a "31st" recurs on the 28th/29th/30th in shorter
  months). Weekly/biweekly would need a new discriminated union member — don't bolt it onto
  `dayOfMonth`.
- **Categories are AsyncStorage-backed and user-editable** (`lib/categories.ts`) — name/icon/color
  can be changed for any category, including the seeded defaults, via `category-editor.tsx` (Budgets'
  `+` button to add, long-press a row to edit). `type` is deliberately not editable through that
  screen — see its own entry above. There's still no delete: `Category.id` is a foreign key from
  both `Transaction` and `Budget`, so removing one needs to decide what happens to existing
  references (reassign to "Other" is the obvious default — mirrors how HabitTracker never actually
  deletes a habit's history either). See TODO.md.
- **Every screen that displays a category loads `Category[]` itself and passes it into
  `getCategory`/`categoriesForType`** rather than importing a fixed array — these two helpers take
  the loaded list as their first argument now. If you add a new screen that shows a category, load
  it the same way (`getCategories()` inside the screen's existing `useFocusEffect`/`Promise.all`
  fetch), don't reach for a module-level constant that no longer exists.
- **A `Budget`'s recurring `monthlyLimit` applies every month by default.** The Budgets screen
  gained its own month nav (2026-08-27ish, alongside the Expense/Income page split — see the
  screen's own bullet above) — progress there is computed against whatever month the nav is
  showing, passed through to `getBudgetProgress`/`effectiveLimit` and on to `budget-editor.tsx` via
  a `month` query param, not hardcoded to `toMonthStr(new Date())` the way Home's dashboard card
  still is. Two ways to deviate from the recurring default, both set from `budget-editor.tsx`'s
  modal via `lib/budgets.ts`'s `applyLimit(categoryId, startMonth, limit, scope)`: `scope:
  'once'` writes to `Budget.overrides["YYYY-MM"]`, a single month's limit with no effect on any
  other month; `scope: 'onward'` writes `Budget.scheduledChange: { startMonth, limit }`, a change to
  the recurring amount effective from `startMonth` on (past/current `startMonth` takes effect
  immediately, a future one shows as "Changing to $X in <month>" on the row until reached). Only one
  `scheduledChange` is kept at a time — a new `onward` change replaces it outright, there's no
  stacked history of future changes. `effectiveLimit(budget, monthStr)` resolves the three in
  priority order (exact-month override, then an in-effect scheduled change, then the plain
  default) and is the only place that should read a budget's limit — `getBudgetProgress` already
  calls it. `resetToDefault(categoryId, monthStr)` clears whichever of the two is currently
  governing that month.
- **Income budgets (added 2026-08-25)**: `Budget`/`applyLimit`/`effectiveLimit` are generic and were
  never expense-specific — the only thing that was expense-only was `getBudgetProgress` always
  reading `byCategoryTotals(transactions, monthStr, 'expense')` and the Budgets screen only ever
  listing expense categories. Fixed by having `getBudgetProgress` take the loaded `Category[]` and
  resolve each budget's `type` from `getCategory(categories, categoryId)?.type` (defaulting to
  `'expense'` if the category was deleted/missing), picking expense- or income-side
  `byCategoryTotals` accordingly. The Budgets screen renders "Expense Budgets" and "Income Goals" as
  two pages of one swipeable toggle (2026-08-29, see the screen's own bullet above — originally two
  stacked sections in one scroll), each with its own `+` (see `category-editor.tsx` above) and its
  own `ProgressBar type=` so the over-100% color means the right thing per page. `budget-editor.tsx`
  swaps its wording (placeholder "Monthly limit"/"Monthly goal", "spent"/"earned", badge tint
  destructive/success) off the same `category.type` check. There's no separate "goal" data shape —
  an income budget is a `Budget` like any other, just interpreted differently at render/progress
  time because its category happens to be type `'income'`.
- **Budgets Expense/Income pages (added 2026-08-29)** — replaced the two stacked sections (each with
  a summary card above it) with two pages of one horizontal `pagingEnabled` ScrollView, same
  swipe-or-tap-the-toggle pattern as Transactions' List/Calendar. The Expense/Income segmented
  control fills destructive-red/success-green on selection instead of a flat accent color — same
  convention as add-transaction.tsx's own type toggle — so the page's color, not just its label,
  says which one is active; the page-dot row below it is tinted to match for the same reason. Each
  summary card (`Total Budgeted` / `Income Goals`, both existing since the totals-and-status-pill
  work earlier the same day) now lives inside its own page instead of being one combined card with
  both blocks stacked — `overBudgetCount`/`goalsReachedCount` and their pills stayed put, just split
  across the two card instances. The section label + `+` add button is the one thing still shared
  across both pages rather than duplicated per page — it sits in the pinned header above the pager
  and swaps its text/handler off the `view` state, rather than living inside each page's own scroll.
- **A standalone Bills tab (added 2026-08-25) was removed again 2026-08-26** — it listed every
  `RecurringTransaction` with add/edit/cancel, but got pulled to make room for a dashboard-style
  redesign instead (see TODO.md). The "Repeat monthly" checkbox in add-transaction.tsx is
  unaffected and remains the only way to create a `RecurringTransaction`; `lib/recurring.ts`'s core
  CRUD + `generateDueTransactions()` is untouched, only the Bills-only exports were removed.
- **Category icon colors: custom per-category, except in transaction rows (settled 2026-08-26 after
  two reversals)** — `6da13da` forced every `CategoryBadge` to destructive-red/success-green via a
  `color` override; that was undone the same day (`type: CategoryType` prop instead, drawing a small
  red/green corner dot without overriding the icon tint) per feedback that custom colors should
  survive; then *that* was partially undone again after further feedback specifically about
  transaction rows. Landing point: `CategoryBadge` takes both `color` (hard override) and `type`
  (dot only, ignored if `color` is set) — **`transaction-row.tsx`** passes `color={typeColor}` so a
  transaction's own icon is always red/green (a transaction has one unambiguous type, and that's
  what the row redesign below leans on), while **`budgets.tsx`** (×2), **`add-transaction.tsx`**'s
  category grid, and **`budget-editor.tsx`** all pass `type={...}` and keep each category's own
  custom color with just the corner dot. Home's dashboard ring badge passes neither (always an
  expense category, unambiguous either way).
- **Transaction rows redesigned (2026-08-26)** — `transaction-row.tsx` (Home's recent list,
  Transactions' List and Calendar-day-detail lists) dropped the old 4px left accent bar and the
  small arrow-up/down glyph next to the amount, per feedback that the old look was dated. Now: a
  bigger 42px icon badge (up from 36), a bold color-coded amount carrying the expense/income cue on
  its own, and a trailing `chevron-right` (matching Budgets' rows) to reinforce tappability. The
  `group` list containers on Home (recent transactions) and Transactions (both List's date groups
  and Calendar's day-detail list) picked up `CardShadow` for a subtle elevated-card look, which
  required dropping their `overflow: 'hidden'` (shadows get clipped by it) — the only cost is a
  square instead of rounded corner on the first/last row's press-highlight, not worth the
  wrapper-View complexity to avoid.
- **Settings + demo data (added 2026-08-26, extended 2026-08-31)** — `app/settings.tsx`, reached via
  `SettingsButton` on every tab. First (only, so far) feature is "Generate demo data"
  (`lib/demo-data.ts#generateDemoData`, renamed from `generateYearToDateDemoData`), a
  two-tap-confirmed button that backfills random transactions across two ranges — this year's Jan 1
  through today, plus (2026-08-31, per feedback that Trends' Year view had nothing prior to compare
  against) all of last year — and sets a handful of both expense budgets *and* income goals
  (2026-08-31; previously expense-only) — for demoing/testing without hand-entering months of data.
  Purely additive (never clears/dedupes), so repeated taps pile up rather than reset; there's no
  companion "clear demo data" yet, see TODO.md.
- **Mutations to `transactions.ts`/`budgets.ts`/`recurring.ts` all go through the same
  promise-chain write-queue pattern** (`let writeQueue = Promise.resolve(); enqueue(fn)`) — copied
  across all three files rather than shared, per the no-premature-abstraction rule above, but keep
  it in sync if the pattern itself needs to change (e.g. if AsyncStorage read-modify-write races
  turn out to need a smarter merge than "last write wins").
- **Home's dashboard card (added 2026-08-26)** replaced the old plain income/expenses/net summary
  card. It uses the *navigated* month (`monthStr`, from Home's own month-nav state), not necessarily
  the real current month — consistent with the rest of Home, which has always read off `monthStr`
  rather than `toMonthStr(new Date())`. The ring's center defaults to the month's total expense
  (2026-08-27; was the top category before) with a "No expenses yet" empty state when there's none,
  and shows the tapped category (or the merged "Other" wedge) while one is selected — see
  `category-ring-chart.tsx`'s own bullet above for the tap-to-select mechanics. A legend sits between
  the ring and the income/expense/net
  row — a two-column wrap of up to 6 categories (color dot, name, % share of `totals.expense`), with
  a "+N more" line if there are more than that; defined inline in `index.tsx`, not a shared
  component. The mini trend chart (`MiniTrendChart` in `index.tsx`) was
  originally a smaller redraw of the old Stats tab's own `TrendChart` — Stats was removed
  2026-08-26 (its bar-chart-plus-breakdown content is now covered by Home's dashboard card and
  Transactions' Calendar view), so `MiniTrendChart` is the only survivor of that bar-chart shape.
- **Home's Expense/Income breakdown panel is a swipeable pager (added 2026-08-29)** — same
  horizontal `pagingEnabled`-ScrollView-plus-segmented-toggle pattern as Budgets' Expense/Income
  pages and Transactions' List/Calendar, applied to the ring chart + legend below the toggle
  (`index.tsx`). Unlike those two, this pager lives nested inside `dashboardCard` — a padded,
  `MaxContentWidth`-capped card, not the full screen — so its page width comes from an `onLayout`
  measurement of a wrapping `View` (`breakdownPanelWidth`) instead of `useWindowDimensions()`, and
  because a horizontal `ScrollView` doesn't size itself to its tallest child, each page also reports
  its own measured height via `onLayout` and the pager takes `Math.max` of the two
  (`breakdownPanelHeight`). Both pages are mounted at all times (`BreakdownPanel`, a local component
  parameterized by `type: TransactionType` — extracted here since the ring+legend JSX is large enough
  that duplicating it verbatim for both sides risked the two copies drifting) rather than only
  rendering whichever side the toggle is on, since a real pager needs the *other* page already in the
  DOM for a swipe to reveal it; `categoryBreakdown()` (a plain helper, not a hook) computes each
  side's category list once per render. Tapped-segment selection is two separate pieces of state,
  `selectedExpenseKey`/`selectedIncomeKey`, rather than one shared `selectedRingKey` — switching pages
  no longer clears the other page's selection, only navigating to a different range (`start`/`end`
  changing) does. The toggle still fills destructive-red/success-green on selection (unchanged from
  its original 2026-08-26 styling) and the page-dot row is tinted to match, same as Budgets' own
  Expense/Income toggle.
- **Transactions List/Calendar (added 2026-08-26, Calendar extended to Week/Year 2026-09-01)** —
  reachable for every rangeType except Custom (2026-09-01, see the "Transactions range selector"
  bullet below for the history); List and Calendar are pages of one horizontal `pagingEnabled`
  ScrollView (`transactions.tsx`), both reading the same shared `anchor`/`start`/`end` state so the
  range nav above them always applies to whichever page is active. A page-dot row (2026-08-27,
  same 6px/16px-active shape as HabitTracker's own swipe-page dots) sits below the segmented toggle
  as a passive readout of which page is active — the toggle itself still does the tapping. The
  segmented toggle calls `pagerRef.current.scrollTo({x, animated: false})` — `animated: true`
  silently no-ops on react-native-web here (a scroll-snap-type/smooth-scroll interaction, still fine
  on native), so the toggle jumps instantly rather than animating; swiping directly is unaffected
  either way. List is a `SectionList` (switched from a plain grouped `ScrollView` 2026-08-27, one
  section per date, one data item per section — the whole day's transaction array — so the existing
  card-with-dividers look survives unchanged) with `stickySectionHeadersEnabled`, so each date header
  freezes at the top while its card scrolls underneath.
  **Calendar (extended to Week and Year 2026-09-01)** — three separate components, one per rangeType,
  not one generalized component: an initial pass tried threading Week through the Month grid's own
  `CalendarView` (a `cells`/`periodKey` prop pair instead of a bare `month: Date`) but got reverted
  the same day, both because Week's actual design (below) turned out to need a different selection
  *unit* than Month (a whole week vs. a single day, which would have meant a granularity flag through
  nearly every branch of that component) and because generalizing a component for a caller that no
  longer needs the generalization is exactly what the no-premature-abstraction rule warns against —
  `CalendarView` is back to taking `month: Date` directly, its sole caller once more.
  `CalendarView` (Month) — a day-of-month grid (leading blanks + every day of the navigated month),
  `dayCell`/`dayCellInner` slightly condensed vertically (2026-09-01, `aspectRatio: 1.3` instead of a
  plain square, per feedback) so a 5-6-row month doesn't read taller than it needs to. Tapping a day
  selects it (fills its cell `theme.accent`, unselects any other) and expands that day's transactions
  below the grid; the real "today" gets a blue outline when nothing is selected. `WeekCalendarView`
  (Week) — per follow-up feedback that Week's Calendar page should keep the *whole month* visible
  rather than collapsing to just the one selected week's 7 days (an earlier same-day version did just
  that, reverted) — reuses the same day-of-month grid shape as `CalendarView`, but the
  selectable/highlightable unit is a whole calendar week (one grid row) instead of a single day: every
  row is padded to a full 7 cells (leading *and* trailing blanks, so a week is always drawable as one
  rectangle) and wrapped in its own bounding `weekRow` View instead of each day getting its own
  bordered `dayCellInner` — day cells inside are plain (no individual border/background) since the row
  itself is the highlight surface. Each row's own Sunday/Saturday bounds are computed directly off its
  grid position (`new Date(year, monthIndex, 1 - firstWeekday + rowIndex*7)` and `+6`) rather than via
  `startOfWeek` on any one cell, since a row's leading cells can be `null`. The real current week (by
  `lib/date-range`'s `startOfWeek(new Date())`, independent of wherever the outer nav's `anchor` has
  been paged to — same "today" idea as a day cell, just for a week) gets the blue outline by default;
  tapping any week's rectangle selects it — fills it `theme.accent` and expands that whole week's
  transactions (`formatRangeLabel`'d header, e.g. "AUG 2 – 8, 2026") below the grid, same "tap to
  expand" feel as a day in `CalendarView`. Selection resets when the visible month changes, same as
  Month's own day selection. `YearCalendarView` (Year) — a 3-row/4-column grid (same shape as
  `budget-editor.tsx`'s own year grid) of that year's 12 months, each showing its expense/income
  totals via `Map<monthStr, number>`s filtered on `t.date.startsWith(String(year))`; tapping a month
  selects it and expands that month's transactions below (`MONTH_NAMES[monthIndex]` labels the cells —
  see its own Folder Structure entry in `lib/date-range.ts` for why it's shared, not a new duplicate)
  — no further day-grid drill-down, per explicit feedback that a day grid *per month* would be more
  navigation than a quick glance calls for. All three calendar components originally pinned their
  grid above a separate inner `ScrollView` holding just the selected day's/week's/month's list
  (2026-08-27 for Month, carried through to Week and Year — "freeze panes", the "pin the date selector
  above a scrolling detail panel" shape HabitTracker's own calendar tab still uses) — reverted the
  same day (2026-09-01) per feedback that scrolling should be able to carry the grid away too, not
  just the list below it: each is now one plain `ScrollView` (grid, then the selected list) instead of
  a pinned grid plus a second inner scroll. Chevrons are
  `theme.accent`/blue and the range label is plain text/black (recolored 2026-08-27, per explicit
  feedback, to match HabitTracker's own arrows-blue/label-black scheme app-wide — this reverses the
  2026-08-26 "deliberate inversion" note that used to live here; there is no inversion anymore, both
  apps now agree).
- **Transactions range selector (added 2026-08-29)** — replaced the earlier month-only nav (chevrons
  plus a tap-to-open `MonthYearPickerModal`, year pager + 12-month grid) with the same Week/Month/Year
  `rangeType`/`anchor`/`rangeBounds`/`shiftAnchor`/`RangePickerModal` machinery as Home's own range
  selector (see Home's dashboard card bullet above) — `RangePickerModal` is defined locally in both
  `transactions.tsx` and `index.tsx` (2 occurrences, not yet 3), same no-premature-abstraction call as
  the modal it replaced here. The modal still uses `animationType="none"`, not `"fade"` — RNW's fade
  relies on a CSS `animationend` event to actually unmount, which doesn't reliably fire in every
  browser context and left the modal visually stuck open after `visible` went false; `"none"`
  sidesteps that class of bug entirely. List reads off `transactionsInRange(filteredTransactions,
  start, end)` now instead of `transactionsForMonth` (see `lib/transactions.ts`'s own comment on the
  two), so Week and Year modes total an arbitrary week or year, not just a month. Calendar originally
  had no week/year equivalent — a day-of-month grid has no other shape — so switching `rangeType`
  away from `'month'` snapped `view` back to `'list'`; Week and Year each gained their own Calendar
  shape 2026-09-01 (see the "Transactions List/Calendar" bullet above), so that reset now only fires
  for Custom, the one rangeType still without a Calendar page (a `useEffect` on `rangeType`, read via
  the functional `setState` form so it doesn't also need `view` in its dependency array) — the
  List/Calendar toggle and page-dot row render for every rangeType except Custom, which renders the
  same `transactionList` element directly, full-bleed, with no pager around it.
- **Custom date range (added 2026-08-30)** — a 4th "Custom" option alongside Week/Month/Year, on both
  Home and Transactions' range selectors. `rangeType`/`rangeBounds`/`RangePickerModal` all gained a
  `'custom'` case, backed by a new `CustomRange = { start: string; end: string | null }` piece of
  state — `end: null` means only the first of two taps has landed and the picker is mid-pick, waiting
  on a second. Tapping "Custom" opens the picker immediately if no range is set yet; the picker's day
  grid (reusing the same month-pager shape as the week picker's own day grid) takes two taps — first
  sets `start`, second sets `end` (a second tap earlier than `start` swaps rather than restarting) and
  auto-closes the modal via a `useEffect` keyed on `customRange` that fires only when `.end` goes from
  unset to set, so reopening the picker to edit an already-complete range doesn't immediately re-close
  it. Backing out mid-pick (closing with only `start` set) resets to `null` rather than leaving the
  range stuck on "Select end date". The label is a shared `formatRangeLabel(start, end)` helper
  (factored out of what was previously just the week case's inline logic, now reused by both week and
  custom) with a same-day special case rendering a single date instead of "Aug 10 – 10". The nav
  chevrons stay meaningful in custom mode via `shiftCustomRange`, which slides both `start` and `end`
  by the range's own length in days (a no-op — returns the input unchanged — until a complete range
  exists). Home's previous-period delta comparison (`computeDelta`) is `null` (no ▲/▼ shown) in custom
  mode until a complete range is picked, since there's no anchor-based "previous period" to fall back
  on the way week/month/year have; once picked, the comparison period is the same
  `shiftCustomRange`-shifted window one length back. Custom mode has no Calendar-page equivalent (no
  single-grid shape fits an arbitrary range the way a month/week/year grid does) — Transactions falls
  back to List, full-bleed, via the `rangeType !== 'custom'` effect (see the "Transactions
  List/Calendar" bullet above; Week and Year both gained their own Calendar shapes 2026-09-01, so
  Custom is now the only rangeType this fallback applies to). All of the above
  (`RangeType`/`CustomRange`/`rangeBounds`/
  `shiftAnchor`/`shiftCustomRange`/`formatRangeLabel`/`RangePickerModal`) started out duplicated
  per-file (2 occurrences, not yet 3, per the no-premature-abstraction rule) but got extracted to
  `lib/date-range.ts` + `components/range-picker-modal.tsx` the same day, once Trends became a 3rd
  near-identical copy — see the "Trends tab" bullet below and those two files' own Folder Structure
  entries above. Home's and Transactions' screens now import from there instead of redefining any of
  it locally.
- **Transactions filter (added 2026-08-29)** — a funnel button next to `SettingsButton` in the header
  (fills solid `theme.accent` with a small destructive dot badge when a filter is active, otherwise
  the same soft-accent-circle look as `SettingsButton`) opens `FilterModal`: an "All/Expenses/Income"
  segmented toggle plus a multi-select grid of category chips (same `categoryChip` shape as
  add-transaction.tsx's own category grid), filtered to whichever type is selected. Picking a type
  drops any already-selected category that no longer matches it (an income category selected under an
  'expense' filter could never match anything). Selections apply live — no separate Apply/Done step —
  via a `TransactionFilter = { type: 'all' | TransactionType; categoryIds: string[] }` that the screen
  runs every loaded transaction through once (`applyTransactionFilter`, empty `categoryIds` meaning
  "every category of whichever type") before either page ever sees them, so neither List nor Calendar
  has to know filtering exists — Calendar's per-day expense/income figures and its day-detail list
  narrow for free since they're already computed off the filtered set. "Clear filters" resets to
  `EMPTY_FILTER` and is disabled (greyed, no-op) when nothing is active.
- **Pinned headers + white backgrounds (2026-08-27)** — every tab's screen background switched from
  `theme.backgroundElement` (light grey) to `theme.background` (white), per explicit feedback; the
  grey remains in use elsewhere (pressed-row highlight, the ring chart's track color, disabled-button
  fill) since only the screen-level background was called out. Each tab's title/date-selector area
  is now pinned above its `ScrollView`/`SectionList` instead of scrolling away with the content
  ("freeze panes") — Home and Budgets' `ScreenHeader` (Home's also carries its month nav). Budgets'
  own pinned area originally kept its "EXPENSE BUDGETS"/"INCOME GOALS" section headers sticky via
  `ScrollView`'s `stickyHeaderIndices` when both sections shared one scroll; the 2026-08-29
  Expense/Income page split (see the screen's own bullet above) replaced that with a single section
  label + `+` button living in the pinned area itself, above a horizontal pager — so there's no
  `stickyHeaderIndices` on Budgets anymore, each page's own `ScrollView` is a plain single-section
  scroll. See the Transactions bullet above for that tab's own version of the pinned-header idea
  (`SectionList` sticky headers on List; Calendar's own day/week/month grid was pinned above a second
  inner scroll too until 2026-09-01, when that got reverted back to one plain scroll per the
  "Transactions List/Calendar" bullet's own note).
- **`react-native-draggable-flatlist`/reanimated-heavy list interactions have not been needed
  yet** — there's no drag-and-drop anywhere in this app. If one gets added, read HabitTracker's
  `CLAUDE.md` "Home habit reordering" bullet first; it documents a real, hard-won lesson about
  animating a transform over many native list children.
- **Trends tab (added 2026-08-30)** — a 4th tab, `app/(tabs)/trends.tsx`, showing cumulative actual
  spend/income against budgeted/goal totals over time. Range nav is Month/Year/Custom only (no Week —
  a 7-day cumulative-budget chart reads as less meaningful than a month or year one; the shared
  `RangePickerModal` still supports all four rangeTypes generically, this screen's own segmented
  control just never renders a Week pill). Below that, an Expenses/Income/Net segmented toggle plus a
  page-dot row drives a 3-page horizontal `pagingEnabled` pager (`TrendPanel`, one per type, all three
  mounted at once — same "pager needs every page already in the DOM for a swipe to reveal it" reasoning
  as Home's own `BreakdownPanel`), each reporting its own measured height via `onLayout` so the pager
  takes the tallest of the three. Each panel is a summary row (colored actual total, muted budget
  total, a green/red over-or-under diff pill — green means "under budget" for Expenses but "at/over
  goal" for Income/Net, via a `positiveIsGood` flip, same idea as `ProgressBar`'s own type-flipped
  over-100% semantics) above a `CumulativeTrendChart` (see its own Folder Structure entry above).
  - **Cumulative line**: `cumulativePoints()` walks every day in the range (`lib/date-range`'s
    `daysBetween`, so Month/Year/Custom all resolve to the same daily-granularity code path) and
    carries a running total forward through days with no transactions, so the line is continuous
    regardless of how sparse the data is. Capped at today (`actualEnd = end > todayStr ? todayStr :
    end`, a follow-up fix the same day) rather than running out flat to the period's real end — a
    still-in-progress month or year has no actual data past today, so the line simply stops there
    instead of implying a flat $0 pace for the rest of the period. The budget/goal reference line is
    unaffected by this cap — `budgetTotalForRange` below is still totaled against the period's full
    nominal `start`/`end`, which is the point: actual-to-date against the *whole* period's target, so
    pacing ahead or behind is visible at a glance. A period entirely in the future (`start` after
    today) naturally yields an empty `points` array this way (`daysBetween` with `start` past `end`
    just returns `[]`), which `CumulativeTrendChart` already renders as a blank chart.
  - **Budget reference line**: `budgetTotalForRange()` sums each relevant budget/goal's
    `effectiveLimit` (from `lib/budgets.ts`) across every calendar month the range touches
    (`lib/date-range`'s `monthsBetween`) — a month a custom range only partially overlaps still counts
    in full, not prorated, a deliberate v1 simplification. Only categories that actually have a
    budget/goal set contribute to this total (the scoping decision made explicitly for this feature) —
    an unset category's actual spend/income still moves the cumulative line, it just doesn't move the
    reference line. A total of exactly 0 (no budgets of that type at all) renders as `budgetTotal:
    null` so `CumulativeTrendChart` skips the reference line entirely instead of drawing it at $0.
    The reference line is flat, at `budgetTotal`'s height, for all three of Expense/Income/Net — a
    diagonal "paced" version (Expenses only, ramping from $0 to `budgetTotal` across the period) had
    a brief life on 2026-08-31 and was reverted the same day per feedback: back to one flat dotted
    line everywhere, no per-type branching. `totalDays` (`daysBetween(start, end).length`, the
    range's *full* nominal length, computed once in this screen and passed to every panel) still
    matters even for the flat line — it's the x-axis domain, so a still-in-progress period plots the
    actual line across only its elapsed fraction of the width while the flat target line keeps
    running the full way to the period's real end. See that component's own Folder Structure entry
    above for the full mechanics, including the 2026-08-31
    visibility pass (today marker, scrub-callout target delta) built on top of this same `totalDays`
    domain the same day.
  - **Net's own numbers are derived, not scanned**: `netPoints` is `incomePoints[i].actual -
    expensePoints[i].actual` per day (both arrays share the same day list so they line up
    index-for-index) rather than a third transaction pass, and `netBudgetTotal` is
    `incomeBudgetTotal - expenseBudgetTotal` — `null` (no reference line, nothing to compare against)
    unless at least one side actually has a budget/goal set.
  - **Negative-amount formatting**: Net's actual/budget totals can go negative, unlike Expense/Income's
    (which never do) — plain `` `$${amount.toLocaleString(...)}` `` renders a negative as "$-2,838.91"
    (`toLocaleString`'s minus sign lands after the digits start, not before the `$`), so Trends has its
    own `formatSigned()` that moves the sign in front of the `$` instead — a bug caught and fixed
    during this feature's own build via the Browser-pane verification workflow, not by inspection.
  - **No vertical scrolling (2026-08-31)**: unlike every other tab, the body below the pinned header
    is a plain `View`, not a `ScrollView` — per explicit feedback that this tab shouldn't scroll
    vertically, and because it was a second native pan-gesture recognizer competing with the chart's
    own scrub touch layer for the same drag (on top of the horizontal Expense/Income/Net pager below,
    which `onScrubStart`/`onScrubEnd` already handle — see `CumulativeTrendChart`'s own bullet above).
    The one card (range summary + pager) fits without scrolling in practice; this was a deliberate
    trade rather than an oversight, so don't reach for `ScrollView` here again without re-checking
    that trade-off first.
