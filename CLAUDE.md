@AGENTS.md

# BudgetTracker

## Project Overview

A single-user, offline-first budget tracking app built with Expo Router. Users log expense/income
transactions against a fixed set of categories, set optional monthly spending limits per category,
and can mark a transaction as recurring monthly (e.g. rent, subscriptions) so it's regenerated
automatically each month. Three tabs, each opening with a `ScreenHeader` title (added 2026-08-26,
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
- **Transactions** — "Transactions" header pinned above the scroll, a month nav (chevrons in
  `theme.accent`/blue — plain navigation, not the tappable control, but recolored 2026-08-27 to match
  HabitTracker's own arrows-blue/label-black scheme — the month label itself is plain text/black and
  opens a month/year picker modal on tap: a year pager plus a 12-month grid, replacing an earlier
  fast-rewind/fast-forward button pair) above a List/Calendar segmented toggle plus a page-dot row
  (added 2026-08-26, dots added 2026-08-27). List: all of that month's transactions grouped by date
  with sticky per-date headers, tapping a row opens the same modal in edit mode. Calendar: a
  day-of-month grid (pinned above the day-detail scroll) showing that day's expense (red) and income
  (green), tap a day to expand its transactions below the grid. The two are pages of one horizontal
  `pagingEnabled` ScrollView — swipe between them, or tap the toggle. See CLAUDE.md's "Transactions
  List/Calendar" convention bullet below.
- **Budgets** — "Budgets" header, then two sections: expense categories with an optional monthly
  spending limit, and income categories with an optional monthly income goal (added 2026-08-25). Tap
  a row to set/edit/clear its limit/goal inline; progress bars flip semantics by section — an expense
  bar turns destructive red past 100% (over budget, bad), an income bar turns success green at/past
  100% (goal reached, good). Progress is always against the *current* calendar month (no month nav
  here — a budget is a flat per-category limit/goal, not a per-month record).

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
- **react-native-svg** for Home's dashboard card (`CategoryRingChart`, `MiniTrendChart`).
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
                          year-to-date data" (two-tap confirm, same pattern as
                          add-transaction's Delete), calls
                          lib/demo-data.ts#generateYearToDateDemoData().

  lib/
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
                          category-editor.tsx.
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
    demo-data.ts            generateYearToDateDemoData() (added 2026-08-26),
                          called from settings.tsx. Backfills Jan 1 of the
                          current year through today with random expense/
                          income transactions (existing categories only,
                          never creates new ones) plus a monthly limit on up
                          to 6 expense categories via lib/budgets.ts's
                          applyLimit. Purely additive — never reads existing
                          transactions/budgets before writing, so it's safe to
                          run against real data but will double up if run
                          twice. Sequential `await addTransaction(...)` per
                          generated row (same read-modify-write-per-call
                          shape as generateDueTransactions above), not batched
                          — fine at this data volume (~100-150 rows for a
                          partial year), would need revisiting if the range or
                          per-month density grew much larger.

  components/
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
- **A `Budget`'s recurring `monthlyLimit` applies every month by default; the Budgets screen itself
  has no month nav** — progress there and on Home always computes against the *real current* month
  (`toMonthStr(new Date())`), regardless of what month is selected elsewhere in the app (e.g.
  Transactions). Two ways to deviate from the recurring default, both set from `budget-editor.tsx`'s
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
  `byCategoryTotals` accordingly. The Budgets screen now renders two sections — "Expense Budgets"
  and "Income Goals" — each with its own `+` (see `category-editor.tsx` above) and its own
  `ProgressBar type=` so the over-100% color means the right thing per section. `budget-editor.tsx`
  swaps its wording (placeholder "Monthly limit"/"Monthly goal", "spent"/"earned", badge tint
  destructive/success) off the same `category.type` check. There's no separate "goal" data shape —
  an income budget is a `Budget` like any other, just interpreted differently at render/progress
  time because its category happens to be type `'income'`.
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
- **Settings + demo data (added 2026-08-26)** — `app/settings.tsx`, reached via `SettingsButton` on
  every tab. First (only, so far) feature is "Generate year-to-date data"
  (`lib/demo-data.ts#generateYearToDateDemoData`), a two-tap-confirmed button that backfills random
  transactions + a handful of category budgets from Jan 1 of the current year through today — for
  demoing/testing without hand-entering months of data. Purely additive (never clears/dedupes), so
  repeated taps pile up rather than reset; there's no companion "clear demo data" yet, see TODO.md.
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
- **Transactions List/Calendar (added 2026-08-26)** — the two are pages of one horizontal
  `pagingEnabled` ScrollView (`transactions.tsx`), both reading the same shared `month` state so the
  month/year nav above them always applies to whichever page is active. A page-dot row (2026-08-27,
  same 6px/16px-active shape as HabitTracker's own swipe-page dots) sits below the segmented toggle
  as a passive readout of which page is active — the toggle itself still does the tapping. The
  segmented toggle calls `pagerRef.current.scrollTo({x, animated: false})` — `animated: true`
  silently no-ops on react-native-web here (a scroll-snap-type/smooth-scroll interaction, still fine
  on native), so the toggle jumps instantly rather than animating; swiping directly is unaffected
  either way. List is a `SectionList` (switched from a plain grouped `ScrollView` 2026-08-27, one
  section per date, one data item per section — the whole day's transaction array — so the existing
  card-with-dividers look survives unchanged) with `stickySectionHeadersEnabled`, so each date header
  freezes at the top while its card scrolls underneath. Calendar shows both expense (red) and income
  (green) per day (2026-08-27; was expense-only before) via two `Map<dateStr, number>`s built from
  that month's transactions; tapping a day expands its transactions in a list below the grid
  (`TransactionRow`, same as the List page), and the selection resets whenever the month changes. The
  day grid itself is pinned above a separate inner `ScrollView` holding only the selected day's list
  (2026-08-27, "freeze panes" — same "pin the date selector above a scrolling detail panel" shape as
  HabitTracker's own calendar tab) rather than the whole page being one ScrollView.
  The month nav itself (added 2026-08-26, replacing an earlier fast-rewind/fast-forward pair)
  matches HabitTracker's own month-nav shape: chevrons plus a tap-to-open `MonthYearPickerModal`
  (year pager + 12-month grid). Chevrons are `theme.accent`/blue and the month label is plain
  text/black (recolored 2026-08-27, per explicit feedback, to match HabitTracker's own
  arrows-blue/label-black scheme app-wide — this reverses the 2026-08-26 "deliberate inversion" note
  that used to live here; there is no inversion anymore, both apps now agree). The modal
  uses `animationType="none"`, not `"fade"` — RNW's fade relies on a CSS `animationend` event to
  actually unmount, which doesn't reliably fire in every browser context and left the modal visually
  stuck open after `visible` went false; `"none"` sidesteps that class of bug entirely.
  `MonthYearPickerModal` is defined locally in both `transactions.tsx` and `index.tsx` (Home's month
  nav got the identical treatment 2026-08-26 too — "same date-area treatment everywhere" was an
  explicit ask) rather than shared, per the no-premature-abstraction rule — 2 occurrences, not yet 3.
- **Pinned headers + white backgrounds (2026-08-27)** — every tab's screen background switched from
  `theme.backgroundElement` (light grey) to `theme.background` (white), per explicit feedback; the
  grey remains in use elsewhere (pressed-row highlight, the ring chart's track color, disabled-button
  fill) since only the screen-level background was called out. Each tab's title/date-selector area
  is now pinned above its `ScrollView`/`SectionList` instead of scrolling away with the content
  ("freeze panes") — Home and Budgets' `ScreenHeader` (Home's also carries its month nav); Budgets'
  two section headers ("EXPENSE BUDGETS"/"INCOME GOALS") are additionally sticky via `ScrollView`'s
  `stickyHeaderIndices`, which required flattening each header+group pair into direct ScrollView
  children instead of nesting them in one wrapping section `View` (`stickyHeaderIndices` addresses a
  `View`'s direct children by position). See the Transactions bullet above for that tab's own version
  of the same idea (`SectionList` sticky headers on List, a pinned day-grid on Calendar).
- **`react-native-draggable-flatlist`/reanimated-heavy list interactions have not been needed
  yet** — there's no drag-and-drop anywhere in this app. If one gets added, read HabitTracker's
  `CLAUDE.md` "Home habit reordering" bullet first; it documents a real, hard-won lesson about
  animating a transform over many native list children.
