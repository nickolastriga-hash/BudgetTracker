@AGENTS.md

# BudgetTracker

## Project Overview

A single-user, offline-first budget tracking app built with Expo Router. Users log expense/income
transactions against a fixed set of categories, set optional monthly spending limits per category,
and can mark a transaction as recurring monthly (e.g. rent, subscriptions) so it's regenerated
automatically each month. Four tabs:

- **Home** — month nav, an income/expenses/net summary card, a preview of up to 3 budget
  categories' progress, and the month's most recent transactions. FAB opens the add-transaction modal.
- **Transactions** — month nav, all of that month's transactions grouped by date. Tapping a row
  opens the same modal in edit mode.
- **Budgets** — every expense category with an optional monthly limit; tap a row to set/edit/clear
  its limit inline. Progress is always against the *current* calendar month (no month nav here —
  a budget is a flat per-category limit, not a per-month record).
- **Stats** — a 6-month income-vs-expense bar chart (react-native-svg) and a current-month
  spending-by-category breakdown with progress bars.

All data is local — `AsyncStorage` only, no accounts, no sync. That's a deliberate v1 scope
decision, not an oversight; see [TODO.md](TODO.md) for what's intentionally deferred.

## Tech Stack

- **Expo SDK 57**, React Native 0.86, React 19, React Compiler enabled (`experiments.reactCompiler`
  in `app.json`)
- **expo-router 7**, file-based routing under `src/app` (the `@/` path alias maps to `src/`, set in
  `tsconfig.json`). `NativeTabs` (`expo-router/unstable-native-tabs`) powers the tab bar, with a
  separate `_layout.web.tsx` fallback (`expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`/`TabSlot`)
  since `NativeTabs` doesn't render on web — same platform-file-override pattern used elsewhere
  (e.g. `hooks/use-color-scheme.web.ts`).
- **As of SDK 56, expo-router no longer works alongside `@react-navigation/native`** — importing
  anything from that package (even just for `useFocusEffect`) throws a hard Metro build error at
  bundle time. Use `useFocusEffect`/`useIsFocused` re-exported from `'expo-router'` itself instead;
  don't add `@react-navigation/native` as a dependency.
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
      stats.tsx           Stats
    add-transaction.tsx   Add/edit modal — type toggle, amount, category grid,
                          a self-contained calendar-panel date picker (capped at
                          today), optional note, and (new transactions only) a
                          "Repeat monthly" checkbox that also creates a
                          RecurringTransaction. Edit mode adds a Delete button
                          that requires two taps (no Alert.alert dependency —
                          it doesn't behave consistently across web/native).

  lib/
    transactions.ts       Transaction CRUD (AsyncStorage), month/category totals.
                          Writes go through a private promise-chain queue so two
                          rapid saves can't race on read-modify-write.
    budgets.ts             Budget (categoryId -> monthlyLimit) CRUD + progress calc.
                          Same write-queue pattern as transactions.ts.
    categories.ts           Fixed, offline category list (14 expense + 5 income) —
                          no custom categories in v1, see TODO.md. Category.icon is
                          typed against MaterialIcons' own glyph names
                          (`ComponentProps<typeof MaterialIcons>['name']`), not a
                          bare string, so a typo fails tsc instead of failing silently.
    recurring.ts            RecurringTransaction CRUD + generateDueTransactions(),
                          called once from the root layout. Monthly-only in v1
                          (dayOfMonth, clamped to each month's real length).
                          Materializes any owed months' transactions lazily on
                          launch rather than being scheduled ahead of time —
                          there's no OS-level scheduler involved.

  components/
    category-badge.tsx      Colored circle + MaterialIcons glyph for a Category.
    progress-bar.tsx         Track + fill; fill color switches to destructive red
                          past 100%.
    transaction-row.tsx      One transaction list row (icon, category, note,
                          signed amount) — shared by Home's recent list and the
                          Transactions tab.
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
- **Categories are fixed** (`lib/categories.ts`) — there's no add/edit/delete-category UI. If you
  add custom categories later, `Category.id` is used as a foreign key from both `Transaction` and
  `Budget`, so a delete needs to decide what happens to existing references (reassign to "Other" is
  the obvious default — mirrors how HabitTracker never actually deletes a habit's history either).
- **A `Budget` is a flat monthly limit, not tied to a specific month** — there's no history of past
  limits. Budgets/Home always compute progress against the *current* month regardless of what month
  is selected elsewhere in the app.
- **Mutations to `transactions.ts`/`budgets.ts`/`recurring.ts` all go through the same
  promise-chain write-queue pattern** (`let writeQueue = Promise.resolve(); enqueue(fn)`) — copied
  across all three files rather than shared, per the no-premature-abstraction rule above, but keep
  it in sync if the pattern itself needs to change (e.g. if AsyncStorage read-modify-write races
  turn out to need a smarter merge than "last write wins").
- **`react-native-draggable-flatlist`/reanimated-heavy list interactions have not been needed
  yet** — there's no drag-and-drop anywhere in this app. If one gets added, read HabitTracker's
  `CLAUDE.md` "Home habit reordering" bullet first; it documents a real, hard-won lesson about
  animating a transform over many native list children.
