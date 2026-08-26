@AGENTS.md

# BudgetTracker

## Project Overview

A single-user, offline-first budget tracking app built with Expo Router. Users log expense/income
transactions against a fixed set of categories, set optional monthly spending limits per category,
and can mark a transaction as recurring monthly (e.g. rent, subscriptions) so it's regenerated
automatically each month. Five tabs:

- **Home** — month nav, an income/expenses/net summary card, a preview of up to 3 budget
  categories' progress, and the month's most recent transactions. FAB opens the add-transaction modal.
- **Transactions** — month nav, all of that month's transactions grouped by date. Tapping a row
  opens the same modal in edit mode.
- **Budgets** — two sections: expense categories with an optional monthly spending limit, and
  income categories with an optional monthly income goal (added 2026-08-25). Tap a row to
  set/edit/clear its limit/goal inline; progress bars flip semantics by section — an expense bar
  turns destructive red past 100% (over budget, bad), an income bar turns success green at/past
  100% (goal reached, good). Progress is always against the *current* calendar month (no month nav
  here — a budget is a flat per-category limit/goal, not a per-month record).
- **Bills** (added 2026-08-25) — the management screen `RecurringTransaction`s never had: every
  recurring bill/income, sorted by next-due date, with a `+` to add one directly and a tap to
  edit/cancel it. See `lib/recurring.ts` and `app/bill-editor.tsx` below.
- **Stats** — a 6-month income-vs-expense bar chart (react-native-svg) and a current-month
  spending-by-category breakdown with progress bars.

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
- **react-native-svg** for the Stats trend chart.
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
      transactions.tsx    Transactions
      budgets.tsx         Budgets
      bills.tsx           Bills — flat list of RecurringTransactions sorted by
                          lib/recurring.ts's nextDueDate(), a `+` to
                          bill-editor (new) and tap-a-row to bill-editor?id=...
                          (edit). Calls generateDueTransactions() on focus too
                          (idempotent, safe alongside the root layout's launch
                          call) so due dates shown are never stale mid-session.
      stats.tsx           Stats
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
    bill-editor.tsx        Add/edit a RecurringTransaction directly (reached
                          from Bills, not from add-transaction's checkbox).
                          Same header-with-close-button shell as
                          budget-editor.tsx. Fields: expense/income toggle,
                          amount, category grid, a 1-31 day-of-month grid
                          (recurrence is a day-of-month, not a specific date —
                          no month/year context needed), optional note. New
                          bills default `startDate` to today, so if the chosen
                          day already passed this month the very first
                          occurrence is generated immediately (same
                          already-past-this-month behavior as add-transaction's
                          "Repeat monthly" checkbox). Both add and edit call
                          `generateDueTransactions()` before navigating back so
                          a just-added bill materializes without waiting for
                          next launch. Edit mode's Delete ("Cancel this bill")
                          is the same two-tap pattern as add-transaction, and
                          only stops future generation — `deleteRecurring`
                          never touches transactions already posted.

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
                          called once from the root layout (and again from
                          Bills on focus — see (tabs)/bills.tsx above).
                          Monthly-only in v1 (dayOfMonth, clamped to each
                          month's real length). Materializes any owed months'
                          transactions lazily on launch rather than being
                          scheduled ahead of time — there's no OS-level
                          scheduler involved. `updateRecurring` edits apply
                          going forward only (like a budget's scheduledChange —
                          `lastGeneratedMonth` is left alone). `nextDueDate(item,
                          today)` derives the next date a transaction will post
                          for the Bills list, assuming generateDueTransactions
                          already ran this session.

  components/
    category-badge.tsx      Colored circle + MaterialIcons glyph for a Category.
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
                          constant.
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
- **Bills (added 2026-08-25)** closes the gap TODO.md used to flag ("no screen listing active
  recurring items or letting you edit/cancel one"): a new tab lists every `RecurringTransaction`
  sorted by `nextDueDate()`, `bill-editor.tsx` adds/edits/cancels them directly, and
  `lib/recurring.ts` gained `updateRecurring`/`nextDueDate` to support it. The "Repeat monthly"
  checkbox in add-transaction.tsx is unchanged and still the other way to create one — both paths
  write the same `RecurringTransaction` shape, so either screen can manage what the other created.
- **Mutations to `transactions.ts`/`budgets.ts`/`recurring.ts` all go through the same
  promise-chain write-queue pattern** (`let writeQueue = Promise.resolve(); enqueue(fn)`) — copied
  across all three files rather than shared, per the no-premature-abstraction rule above, but keep
  it in sync if the pattern itself needs to change (e.g. if AsyncStorage read-modify-write races
  turn out to need a smarter merge than "last write wins").
- **`react-native-draggable-flatlist`/reanimated-heavy list interactions have not been needed
  yet** — there's no drag-and-drop anywhere in this app. If one gets added, read HabitTracker's
  `CLAUDE.md` "Home habit reordering" bullet first; it documents a real, hard-won lesson about
  animating a transform over many native list children.
