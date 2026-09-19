@AGENTS.md

# BudgetTracker

## Project Overview

A single-user, offline-first budget tracking app built with Expo Router. Users log expense/income
transactions against a fixed set of categories, set optional monthly spending limits per category,
and can mark a transaction as recurring monthly (e.g. rent, subscriptions) so it's regenerated
automatically each month. Five tabs (Home/Transactions/Calendar/Budgets/Wealth — Calendar split out of Transactions
2026-09-10; Wealth took the 5th slot 2026-09-13 from Trends, whose content became a card on Home — see
the "Five tabs is the ceiling" convention bullet below for why a 6th tab wasn't an option), each opening
with a `ScreenHeader` title (added 2026-08-26,
`components/screen-header.tsx` — 28/700, matching HabitTracker's own per-tab header sizing) plus a
`SettingsButton` in the header's top-right corner (also 2026-08-26, matching HabitTracker's
ProfileButton size/placement — a gear glyph instead of a profile avatar, since there's no accounts
system to show a profile for; opens `app/settings.tsx`, see its own bullet below):

- **Home** — "Home" header pinned above the scroll (2026-08-27, see the "Pinned headers" convention
  below), a month nav (same blue-chevrons/black-tappable-label/picker-modal shape as Transactions'
  below, added 2026-08-26, recolored 2026-08-27), a dashboard card (a donut ring of the navigated
  month's expense-by-category breakdown, center showing the top category's icon/amount/name; a
  compact income/expenses/net row; a 6-month income-vs-expense mini trend chart), every budgeted
  category's progress (2026-09-02; was capped at a 3-category preview with no way to see the rest,
  removed per feedback), and the month's most recent transactions. FAB opens the add-transaction
  modal.
- **Transactions** — "Transactions" header (a filter button — see below — plus `SettingsButton` in
  its top-right corner) pinned above the scroll, a Week/Month/Year/Custom range nav (2026-08-29, same
  chevrons-blue/label-black-tappable shape as Home's own, replacing an earlier month-only nav — see
  the "Transactions range selector" convention bullet below) above a List/Recurring segmented toggle
  plus a page-dot row (toggle added 2026-08-26 as List/Calendar, dots 2026-08-27; Calendar moved to
  its own tab and Recurring joined 2026-09-10 — see the "Transactions List/Calendar" and "A
  standalone Bills tab" convention bullets below). List: all of the navigated range's transactions
  grouped by date with sticky per-date headers, tapping a row opens the same modal in edit mode.
  Recurring: every active `RecurringTransaction` series soonest-due-first with a two-tap Stop and an
  Edit (added 2026-09-12, deep-links to add-transaction.tsx's series editor) per row — not
  period-scoped, so the range nav hides (opacity 0, layout kept) while it's showing, and the tab's
  FAB opens the add-transaction modal with `?repeat=1` from there. The two are pages of one
  horizontal `pagingEnabled` ScrollView — swipe between them, or tap the toggle. A funnel button
  next to `SettingsButton` (2026-08-29) opens a type/category filter that narrows both pages at once
  — see the "Transactions filter" convention bullet below.
- **Calendar** (split out of Transactions 2026-09-10, per feedback that it should be its own tab) —
  "Calendar" header, a Week/Month/Year range nav (no Custom — no single-grid shape fits an arbitrary
  range, which is the same reason Custom never had a Calendar page back when this lived inside
  Transactions), then the grid for that range: a day-of-month grid in Month mode (that day's expense
  in red/income in green, tap a day to expand its transactions below the grid); the same full month
  grid in Week mode but selectable/highlightable by whole calendar week instead of by day (each week
  is its own bounding rectangle, the real current week outlined blue by default, tap a week to select
  it — fills it blue and expands that week's transactions below); or a 12-month grid in Year mode
  (tap a month to expand that month's transactions below instead of a day). No type/category filter
  here, unlike Transactions. FAB opens the add-transaction modal.
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
- **Wealth** (added 2026-09-13, replacing the Trends tab — see the "Five tabs is the ceiling"
  convention bullet below) — "Wealth" header, a Goals/Debts/Net Worth segmented toggle plus a page-dot
  row and one section label + `+` button that swaps per page (same pinned-header-over-a-pager shape as
  Budgets), then three pages of one horizontal `pagingEnabled` ScrollView. **Goals**: a "Total saved"
  summary card (goals-reached pill) above every `SavingsGoal` row, a progress bar that goes
  success-green at 100% (`ProgressBar type="income"` semantics). Tap a row → `goal-editor.tsx`. **Debts**: a "Total owed"
  card carrying the payoff planner — an "Extra per month" field (a Snowball/Avalanche strategy toggle
  sat beside it until 2026-09-19, removed as an unwanted choice; the planner is snowball-only now, and
  persisted via `lib/debts.ts#savePlanSettings`), with the simulated result ("Debt-free Oct 2027 · 14
  months · $444 in interest", or a red "payments don't outrun the interest" warning), a "Minimums
  only: N months, $X in interest" caption whenever paying minimums would be slower, and a
  `DebtPayoffChart` (stacked per-debt balance bands melting to zero, press-and-drag readout — see its own Folder Structure entry) — above every `Debt` row. Tap a row → `debt-editor.tsx`.
  **Goal and debt rows share one two-line shape (2026-09-19, per feedback that they were too busy):**
  badge + name on the left and the row's one number right-aligned bold (a goal's `saved / target`, a
  debt's balance) on line 1, then the progress bar, then a single muted caption merging what used to
  be two or three separate stacked lines — a goal's `48% · by Mar 2027 · $371.43/mo` (or "Goal
  reached" in success, "deadline passed" in destructive), a debt's `36% paid · 22.99% APR · Apr 2031`
  (or "Paid off"). Dropped in the process: the trailing `chevron-right` (the amount now sits flush
  right, rows are still pressable) and a debt's per-row minimum payment, which the summary card
  already totals and the editor still shows — a fourth caption part didn't fit at phone width.
  New goals/debts/accounts default to the next unused `CATEGORY_COLORS` slot rather than always the
  same swatch (offset per kind: red for debts, green for goals, blue for accounts), since the payoff
  chart stacks by color and two debts left on one default were indistinguishable there. **Net Worth**: a hero card (assets − liabilities, signed, a date-positioned
  `NetWorthChart` line once ≥2 history snapshots exist) above ASSETS and LIABILITIES groups; the
  liabilities group merges manual liability `Account`s with every tracked `Debt` (tagged "From Debts",
  tapping one opens the debt editor) so a card on the Debts page isn't entered twice. Each `Add` link /
  the pinned `+` → `account-editor.tsx`. The former Trends content (an Expenses/Income/Net pager of
  `CumulativeTrendChart`s) lives on Home now as `components/trends-card.tsx` — see the "Trends tab"
  convention bullet below, whose mechanics still apply.
All data is local — `AsyncStorage` only, no sync. That was a deliberate v1 scope decision; as of
2026-09-17 there's an optional account (Settings → Account, Firebase Auth: email/password + Google +
Apple, matching HabitTracker's own Account screen) — this is Phase 1 of the same staged rollout
HabitTracker used (see TODO.md's "Accounts / cloud backup"). As of 2026-09-19 (Phase 2) a signed-in
user also gets a manual cloud backup: Settings → Account's "Cloud backup" card uploads/restores the
same JSON payload `lib/backup.ts` builds to one Firestore document (`backups/{uid}`, rules in
`firestore.rules`) via `lib/cloud-backup.ts`. Restore replaces local data, same as file restore. No
automatic or per-record sync, deliberately: that would need timestamps/tombstones on every record. See [TODO.md](TODO.md) for what else is intentionally deferred.

## Tech Stack

- **Expo SDK 57** (upgraded 2026-09-04 from SDK 54 — see "SDK 54 → 57 upgrade" below), React Native
  0.86, React 19.2, React Compiler enabled (`experiments.reactCompiler` in `app.json`) — the compiler
  auto-memoizes plain expressions project-wide, so **don't wrap a value in `useMemo`/`useCallback`
  "for performance"** the way pre-compiler React code would; a hand-written memo the compiler can't
  prove matches its own analysis makes it skip optimizing the component entirely rather than risk it
  (`react-hooks/preserve-manual-memoization` — see the upgrade bullet below for a real instance of
  this biting Home's dashboard card).
- **expo-router 7**, file-based routing under `src/app` (the `@/` path alias maps to `src/`, set in
  `tsconfig.json`). `NativeTabs` (`expo-router/unstable-native-tabs`) powers the tab bar using the
  **dot-notation compound API** — `NativeTabs.Trigger.Icon`/`.Label`/`.VectorIcon` (not top-level
  `Icon`/`Label`/`VectorIcon` exports, which stopped existing as of SDK 55+ and don't typecheck here
  — see the upgrade bullet below if old examples turn up online). The icon prop is `src` paired with
  `sf` (`sf` wins on iOS, `src` wins on Android/web) — there's no `androidSrc` prop any more. There's
  a separate `_layout.web.tsx` fallback (`expo-router/ui`'s `Tabs`/`TabList`/`TabTrigger`/`TabSlot`,
  a different and more stable API that didn't need any upgrade changes) since `NativeTabs` doesn't
  render on web — same platform-file-override pattern used elsewhere (e.g.
  `hooks/use-color-scheme.web.ts`).
- **`ThemeProvider`/`DarkTheme`/`DefaultTheme` come from `'expo-router'` itself** (`src/app/_layout.tsx`),
  not `@react-navigation/native` — that package isn't even a direct dependency any more (removed
  2026-09-04; expo-router vendors its own fork and re-exports the same objects/component from it).
  Importing them from `@react-navigation/native` directly is a hard Metro build error as of SDK 56+,
  which is exactly why this project was pinned to SDK 54 for a while — see the upgrade bullet below.
  (`useFocusEffect`/`useIsFocused` already came from `'expo-router'` before this upgrade and needed
  no change.)

### SDK 54 → 57 upgrade (2026-09-04)

`create-expo-app` originally scaffolded this project on SDK 57, but it was downgraded to SDK 54 the
same day (2026-08-xx) after discovering Apple's App Store build of Expo Go was frozen at SDK 54 —
see git history / the old TODO note for that reasoning if it's still useful context. That pin was
lifted 2026-09-04 once Apple approved a newer Expo Go build (confirmed the hard way: a physical
device running the updated App Store Expo Go app refused to open this project at SDK 54 with "Project
is incompatible... installed version of Expo Go is for SDK 57.0.0"). Upgrade mechanics:
`npx expo install expo@^57.0.0` then `npx expo install --fix` to bring every other Expo/RN package
along to its SDK-57-compatible version (`expo-doctor` — 21/21 checks — confirms the result); manual
follow-up fixes were: (1) `(tabs)/_layout.tsx`'s `NativeTabs` icon/label JSX moved to the dot-notation
API described above; (2) `_layout.tsx`'s theme imports moved off `@react-navigation/native` (removed
from `package.json` entirely once nothing else referenced it) onto `'expo-router'`; (3) the newer
`eslint-config-expo` brought React Compiler's stricter lint rules along with it, which surfaced real
(if inconsequential) issues across the existing codebase — nine `useEffect(() => setState(...), [dep])`
"reset on change" call sites were rewritten to the render-time-adjustment pattern React's own docs
recommend instead (`if (prevKey !== key) { setPrevKey(key); setState(...); }`, called directly in the
render body, not in an effect); `use-color-scheme.web.ts`'s mount-only hydration-flag effect was
rewritten as a `useSyncExternalStore` (cleaner than a workaround either way — no hydration-flicker
render pass); `category-ring-chart.tsx`'s `laidOut` computation swapped a `let cursor` variable
mutated across a `.map()` for an immutable `.reduce()`; and Home's `expenseBreakdown`/
`incomeBreakdown`/`expenseRingSegments`/`incomeRingSegments` had their manual `useMemo` wrappers
removed outright (see the tech-stack bullet above — with React Compiler on, they were actively
fighting the compiler's own memoization rather than helping).
- **TypeScript, strict**, project has zero `tsc --noEmit` errors — keep it that way.
- **react-native-svg** for Home's dashboard card (`CategoryRingChart`) and Trends' own
  `CumulativeTrendChart` (added 2026-08-30).
- **AsyncStorage** (`@react-native-async-storage/async-storage`) as the only persistence layer.
- **expo-local-authentication + expo-crypto** (added 2026-09-13) for the optional app lock —
  biometrics are the device's own, the PIN is a salted SHA-256 in AsyncStorage; see `lib/app-lock.ts`.
  `app.json` carries the `expo-local-authentication` config plugin with a `faceIDPermission` string
  (`NSFaceIDUsageDescription` — without it iOS silently falls back to the device passcode).
- **expo-file-system (the `File`/`Paths` API, not `/legacy`) + expo-sharing + expo-document-picker**
  (added 2026-09-13) for JSON backup/restore — see `lib/backup.ts`. On web, backup is a Blob download
  and restore reads the picked `File` directly; neither sharing nor the native `File` class is touched
  there.
- **firebase (`@firebase/auth`) + `@react-native-google-signin/google-signin` + `expo-apple-authentication`**
  (added 2026-09-17) for the optional Settings → Account sign-in — see `lib/firebase.ts`/`lib/auth.ts`/
  `hooks/use-auth.tsx`/`app/account.tsx`, copied structure-for-structure from HabitTracker's own
  Firebase Auth setup (see that project's CLAUDE.md if this needs revisiting). Auth is imported from
  the scoped `@firebase/auth` package, not the friendlier `firebase/auth` — the top-level `firebase`
  wrapper's `"./auth"` export has no `"react-native"` condition, so it always resolves to the browser
  build (missing `getReactNativePersistence`) regardless of platform; `@firebase/auth` does define
  that condition. `getReactNativePersistence`'s own import still needs a `@ts-expect-error` even from
  the scoped package — its exports map lists a generic `"types"` key ahead of its `"react-native"`
  one, so TypeScript's *type* resolution picks the generic (web-only) declaration file regardless of
  the `customConditions: ["react-native"]` Expo's tsconfig sets for the real Metro resolution; the
  function is genuinely there at runtime, just not in the `.d.ts` TypeScript reaches for. Google/Apple
  native sign-in need a dev-client build (`eas.json`, added the same day) — neither works in Expo Go.
  Uses a separate Firebase project from HabitTracker's (`budgettracker-443b5`) so the two apps' users
  stay isolated, but the same Apple Developer team/Sign-in-with-Apple key (`S9ZMRL29U6`, originally
  provisioned for HabitTracker) — Apple keys can serve multiple App IDs under one team, so this one's
  configured App IDs were extended to cover `com.nicktriga.budgettracker` too rather than minting a
  new key.
- **@expo/vector-icons** (`MaterialIcons`) for all icons — category icons, tab icons (via
  `NativeTabs.Trigger.VectorIcon` on native, plain `<MaterialIcons>` in the web tab bar), and UI
  chrome. iOS tab icons additionally use SF Symbols via the `sf` prop.
- No global state library — plain `useState` + `useFocusEffect` (from `expo-router`) re-fetching
  from storage per screen, same reasoning as most small offline-first RN apps: the data set is
  small, and a re-fetch on focus is simpler than keeping a store in sync.

## Coding Standards

- **No em dashes (`—`) in user-facing copy** (2026-09-13, per explicit feedback that they read as
  AI-written). Use a comma, a period, a colon, parentheses, or the app's existing `·` separator for
  label-style joins ("Monthly · next Sep 25", "by Mar 2027 · $642.86/mo"); a bare `-` for empty-cell
  placeholders. Code comments and docs are fine. Every UI string was swept clean the same day, so a
  new `—` in JSX text or a string literal is a regression, not a style choice.
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
      transactions.tsx    Transactions — List/Recurring swipeable pages
                          (List/Calendar 2026-08-26; Recurring joined and
                          Calendar left for its own tab 2026-09-10), see the
                          "Transactions List/Calendar" convention bullet
                          below. The Recurring page
                          (`RecurringView`/`RecurringRow`, local) groups every
                          active `RecurringTransaction` into a forecast — Due
                          This Week/Due This Month/Later, via
                          `lib/recurring.ts#nextDueDate` (2026-09-12,
                          replacing one flat soonest-due-first list; see the
                          "Recurring page forecast grouping + row redesign"
                          convention bullet below), with a two-tap Stop
                          per row (local `confirming` state, not lifted) and,
                          since 2026-09-12, an Edit pencil that routes to
                          edit-recurring.tsx (that series' own id, directly —
                          see the "Editing a recurring series" convention
                          bullet below for how this got simpler on 2026-09-17)
                          rather than duplicating an editor here;
                          `applyTransactionFilter` is generic over anything
                          with a type + categoryId so the header's filter
                          narrows this page too. The tab's FAB opens
                          `/add-transaction?repeat=1` from this page (plain
                          `/add-transaction` elsewhere) — creation logic
                          lives entirely in add-transaction.tsx, nothing is
                          duplicated here.
      calendar.tsx        Calendar (2026-09-10) — the CalendarView (Month) /
                          WeekCalendarView (Week) / YearCalendarView (Year)
                          grids, moved verbatim out of transactions.tsx
                          where they'd been the Calendar page of its pager
                          since 2026-08-26 (see the "Transactions
                          List/Calendar" convention bullet for their
                          mechanics — still accurate, just a different
                          file). Own Week/Month/Year range nav
                          (`CalendarRange`, an Extract of RangeType — never
                          'custom'), a FAB, and a RangePickerModal driven
                          the same way Home's is (customRange always null).
                          No filter; loads transactions/categories itself on
                          focus, same as every other tab.
      budgets.tsx         Budgets
      wealth.tsx           Wealth (added 2026-09-13, in the tab slot Trends
                          used to hold — trends.tsx is gone, its content is
                          components/trends-card.tsx on Home). Goals/Debts/
                          Net Worth pager; loads goals, debts, plan
                          settings, accounts, and net-worth history on
                          focus and records a net-worth snapshot for today
                          on every load (see lib/net-worth.ts). Owns a
                          small NetWorthChart (react-native-svg Polyline,
                          x positioned by snapshot date — deliberately not
                          CumulativeTrendChart, which assumes a fixed daily
                          domain and a target line). See the "Wealth tab"
                          bullet in Project Overview.
    add-transaction.tsx   Add/edit modal — type toggle, amount, category grid,
                          a self-contained calendar-panel date picker (capped at
                          today), optional note, and a Repeat card (new
                          transactions) or a Repeats/Stop card (editing one
                          that belongs to an active series) — see the
                          "Repeat card redesign" convention bullet below for
                          the full shape; both start pre-checked/opened when
                          reached as `?repeat=1` (added 2026-09-10 for
                          Transactions' FAB on its Recurring page) doesn't
                          apply to the edit-mode card, only the new-
                          transaction Switch. Creates a RecurringTransaction
                          of the chosen frequency (the seed transaction
                          carries that series' id via `recurringId`, added
                          2026-09-02 — previously only the *later*,
                          auto-generated occurrences did, so editing the
                          very first transaction of a new series couldn't
                          find its way back to it). Edit mode adds a Delete
                          button that requires two taps (no Alert.alert
                          dependency — it doesn't behave consistently across
                          web/native), and, when the transaction being
                          edited still belongs to an active recurring series
                          (cross-referenced against `getRecurring()`, not
                          just a truthy `recurringId` — a series already
                          stopped leaves that id on its past transactions as
                          a harmless marker, not something to re-offer
                          stopping for), the Repeats card's own two-tap Stop
                          — a second place (alongside Transactions' Recurring
                          page, see its own bullet above) a recurring series
                          can be found and canceled, useful when you're
                          already looking at one of its transactions rather
                          than hunting for it in the full list. Stopping only
                          clears the `RecurringTransaction` record going
                          forward; it doesn't touch transactions the series
                          already generated, same as canceling a
                          subscription doesn't refund what was already paid.
                          The Repeats card also gained an Edit pencil
                          (2026-09-12, next to Stop) that originally revealed
                          its own compact amount/category/day panel inline;
                          as of 2026-09-17 it instead routes to the standalone
                          edit-recurring.tsx (see its own Folder Structure
                          entry and the "Editing a recurring series"
                          convention bullet below for why).
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
                          existing type. Edit mode ends with a two-tap
                          "Delete category" (2026-09-14) plus a hint line
                          stating what will move ("2 transactions and 1
                          recurring will move to Other."), hidden for the
                          two "Other" catch-alls — see the "Categories are
                          AsyncStorage-backed" convention bullet for the
                          reassignment rules.
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
                          `monthCell`'s `paddingVertical` bumped `Spacing.two`→`Spacing.three`
                          (2026-09-01, per feedback it still read squished).
    edit-recurring.tsx     Standalone editor for one RecurringTransaction series
                          (added 2026-09-17), reached from either place a series
                          can be found — Transactions' Recurring page and
                          add-transaction.tsx's own Repeats card — both routing
                          to `/edit-recurring?id=<recurringId>`. Same
                          `headerShown: false`/own-header-with-X shape as
                          budget-editor.tsx above. Replaces what used to be a
                          sub-panel inline inside add-transaction.tsx's Repeats
                          card (reached from the Recurring page only by finding
                          *some* transaction the series had generated and
                          opening its edit screen) — see the "Editing a
                          recurring series" convention bullet below for why
                          that indirection got flagged as confusing and cut.
                          Frequency chips, amount, the frequency-specific day/
                          month/interval fields, and a category grid, all
                          seeded from the series record itself; Save calls
                          `updateRecurring`, a two-tap Stop at the bottom calls
                          `deleteRecurring`, both then `router.back()`.
    settings.tsx           Settings modal (added 2026-08-26; a "HELP"
                          section with a single "How BudgetTracker works"
                          row into tutorial.tsx sits between ACCOUNT and
                          APPEARANCE since 2026-09-19), reached from any
                          tab's SettingsButton. `headerShown: true` in
                          _layout.tsx (native title "Settings", auto back
                          button) — no in-content title of its own, unlike
                          add-transaction/category-editor which follow the
                          same convention. An "ACCOUNT" section (2026-09-17,
                          first section, matching HabitTracker's own
                          placement) is a single row into account.tsx (see
                          its own entry below) — subtitle is the signed-in
                          email, or "Sign In" in accent color when signed
                          out (a `subtitleColor` prop added to this file's
                          local `SettingsRow` just for this row). An
                          "APPEARANCE" section (added
                          2026-09-17) is the standard 3-option
                          SegmentedControl (Light/Dark/Auto,
                          `light-mode`/`dark-mode`/`brightness-auto` icons)
                          wired straight to `useThemePreference()` — no local
                          state of its own, the control's `value`/`onChange`
                          are the hook's `preference`/`setPreference`
                          directly. Below that, "Generate demo data"
                          (two-tap confirm, same pattern as add-transaction's
                          Delete), calls lib/demo-data.ts#generateDemoData().
                          Used to also carry a "RECURRING" section (a single
                          row into a recurring-management modal) — removed
                          2026-09-10 once that modal's content moved into
                          the Transactions tab's Recurring page (see
                          (tabs)/transactions.tsx above and the "A standalone
                          Bills tab" convention bullet below); nothing in
                          Settings duplicates it any more. Gained a
                          "SECURITY" section (2026-09-13: an App lock Switch
                          — on routes through set-pin.tsx, off is immediate
                          — plus, once enabled, a "Use Face ID/Fingerprint"
                          Switch when the device has enrolled biometrics and
                          a "Change PIN" row) and a "DATA" section (Back up
                          to file / Restore from file, the latter two-tap,
                          both via lib/backup.ts; an "Export as CSV" row
                          between them, added 2026-09-17, via
                          lib/csv-export.ts — a one-way spreadsheet export,
                          unrelated to the JSON backup format Restore reads).
                          `SettingsRow` takes an
                          optional `right` node that replaces its chevron —
                          how the Switch rows are built.
    account.tsx            Sign up / log in / log out (2026-09-17, Firebase
                          Auth: email/password + native Google/Apple
                          Sign-In — see lib/auth.ts), reached from Settings'
                          Account row. Not to be confused with
                          account-editor.tsx below (a net-worth Account for
                          the Wealth tab, unrelated). Own EditorHeader
                          (title "Account", an X `router.back()`), same
                          shape as every other `headerShown: false` editor
                          here — HabitTracker's own version of this screen
                          instead uses a plain back-link/ScrollView with no
                          i18n dependency, both adapted here since this app
                          has neither `EditorHeader`'s absence nor a
                          translation layer to preserve. Signed out: email +
                          password fields, forgot-password link, a
                          Log in/Sign up mode toggle, a divider, "Continue
                          with Google", and (iOS only, gated on
                          `AppleAuthentication.isAvailableAsync()`) Apple's
                          own `AppleAuthenticationButton` — App Store
                          Guidelines require Apple's own button component
                          there, not a custom-styled Pressable like Google's.
                          Signed in: email, a Log out button, and a two-tap
                          Delete account (HabitTracker's version uses
                          `Alert.alert` for this confirm; this app's own
                          convention is two-tap instead, see add-transaction
                          Delete, so that's what this screen uses too).
                          `GoogleSignin.configure({webClientId})` runs from
                          a mount effect, not module top level — expo-router
                          eagerly requires every file under app/ at startup,
                          so a top-level call would run on every launch
                          whether this screen was ever opened or not, with
                          no try/catch around it. Signed in also shows a
                          "Cloud backup" card (Back up now, two-tap Restore
                          from cloud, last-backed-up time) backed by
                          lib/cloud-backup.ts, uploaded only on tap.
                          Deleting the account removes the cloud backup
                          first (best-effort, in lib/auth.ts).
    goal-editor.tsx        Add/edit a SavingsGoal (2026-09-13), reached from
                          Wealth's Goals page. Own EditorHeader (see
                          components/editor-header.tsx), name (first field —
                          an in-header pencil was tried 2026-09-19 and
                          reverted the same day), target
                          amount, an optional deadline (a Switch revealing a
                          year-nav + 12-month grid, same shape as
                          budget-editor's), then the shared ColorPicker/
                          IconPicker. Edit mode adds a progress card, an
                          "ADD MONEY" row (amount + green add / red
                          withdraw buttons — a withdrawal is a negative
                          contribution) with a contribution list, and a
                          two-tap Delete. A logged contribution is editable
                          (2026-09-19): tapping its row (or its pencil)
                          swaps it for an amount field plus a +/- toggle, so
                          a deposit entered as a withdrawal can be corrected
                          rather than deleted and re-added; × still removes
                          one. Saving calls lib/goals.ts#updateContribution,
                          which patches the linked transaction too (amount,
                          and on a flipped sign the type/category/note move
                          between the goal's expense category and the income
                          catch-all). A contribution logged while logging was
                          off has no transaction and doesn't grow one here.
                          The date is editable too (same day): the row's
                          "Change date" link reveals the shared
                          components/calendar-picker.tsx, capped at today,
                          and updateContribution moves the linked
                          transaction's date with it. Contributions reload
                          just the goal record (`reloadGoal`), not the form
                          fields, so unsaved edits survive.
    debt-editor.tsx        Add/edit a Debt (2026-09-13), from Wealth's Debts
                          page or a "From Debts" liability row. Name,
                          current balance, starting balance (optional —
                          blank means "same as current"; saving clamps it to
                          at least the current balance so paydown never
                          reads negative), APR %, minimum/month, color, icon.
                          Edit mode adds a paid-down card, a "RECORD A
                          PAYMENT" row (reduces the balance via
                          lib/debts.ts#recordPayment — deliberately doesn't
                          log a transaction, see that module's comment), and
                          a two-tap Delete.
    account-editor.tsx     Add/edit a net-worth Account (2026-09-13). An
                          Asset/Liability SegmentedControl (preset by
                          `?kind=` from the Net Worth page's per-section Add
                          links; the pinned + opens it as asset). Name is the
                          first field, above that toggle (2026-09-19),
                          balance, color, icon, two-tap Delete. Edit mode
                          adds an "ADD OR DEDUCT" row (2026-09-19: amount +
                          green add / red deduct, persisted immediately,
                          clamped at 0); the balance field itself still
                          sets a whole new value. debt-editor's payment row
                          gained a matching red "Add" (new charge/interest,
                          no transaction logged).
    tutorial.tsx           Onboarding tour (2026-09-19) — 7 swipeable
                          slides (welcome, one per tab, recurring, settings),
                          each a glyph + title + body + a checklist card,
                          over the same pagingEnabled-ScrollView + page-dots
                          shape as every other pager here. Skip (hidden on
                          the last slide) and Next / "Get started" both call
                          lib/onboarding.ts#markTutorialSeen then
                          router.back(). Deliberately text and icons, not
                          screenshots: screenshots would go stale with every
                          restyle and need light and dark copies.
                          Opened automatically on first launch from
                          _layout.tsx (after the splash hides, so it doesn't
                          delay startup) and on demand from Settings' HELP
                          row.
    set-pin.tsx            Two-step PIN entry (choose, confirm) over the
                          shared PinPad (2026-09-13). Reached from Settings'
                          App lock Switch (turning on) and Change PIN row
                          (`?mode=change`); a mismatch restarts from step 1.
                          Calls lib/app-lock.ts#setPin then
                          useAppLock().refresh() so the Switch flips only
                          once a PIN actually exists.

  lib/
    currency.ts             Display-only currency + number-locale setting
                          (2026-09-14): CURRENCIES (20 codes, each with a
                          symbol, decimals, and prefix/suffix position),
                          LOCALES ('system' + 15 tags whose separators
                          actually differ), CurrencySettings, formatMoney
                          ("$1,234.56", "-$5.00" with the sign in front of
                          the symbol, "1.234,56 €"), formatMoneyCompact
                          ("$1.2k" for chart axes / calendar cells). No
                          conversion — amounts stay unitless numbers, this
                          only decides how they're drawn. An unsupported
                          locale tag on a minimal Intl falls back to the
                          device default rather than throwing. Persisted
                          under '@budgettracker/currency', which backup.ts
                          excludes like the theme preference.
    goals.ts                SavingsGoal CRUD + contributions (2026-09-13),
                          same write-queue shape as budgets.ts. A goal's
                          "saved" is the sum of its hand-entered
                          contributions, not derived from transactions —
                          money set aside isn't an expense, and the ledger
                          deliberately doesn't model transfers.
                          `goalProgress` computes saved/remaining/percent
                          plus monthsLeft (counting the current month, so a
                          goal due this month has 1 left, 0 once past) and
                          neededPerMonth off an optional `targetMonth`.
    debts.ts                Debt CRUD + `recordPayment` + the payoff planner
                          (2026-09-13). `simulatePayoff(debts, settings)` is
                          a month-by-month amortization: interest accrues at
                          apr/12, every debt gets its minimum, and the rest
                          of a fixed budget (sum of *all* minimums + the
                          extra — a paid-off debt's minimum rolls into the
                          next target, the snowball idea) goes to the
                          current target (smallest balance first — the
                          avalanche/highest-APR alternative was removed
                          2026-09-19, see wealth.tsx). Returns months,
                          total interest, debt-free month, per-debt payoff
                          months, and `unreachable` when a month ends with
                          more owed than it started (payments < interest) —
                          capped at 600 months either way. Also returns
                          `order` (the attack order) and a `schedule` of
                          PayoffMonth entries — index 0 is today before any
                          payment, index i ≥ 1 the end of month i-1 after
                          its interest and payment, each with per-debt
                          balances and the total — which is what
                          DebtPayoffChart draws. The simulation itself is
                          one private `run(order, budget, rollover, start)`
                          shared with `simulateMinimumsOnly(debts,
                          strategy)`, the chart's comparison baseline: every
                          debt pays only its own minimum, no extra, no
                          rollover (what actually happens to someone paying
                          statement minimums). Strategy + extra persist
                          separately under '@budgettracker/debt-plan'
                          (`getPlanSettings`/`savePlanSettings`).
    net-worth.ts            Account CRUD (kind: asset | liability) + a
                          NetWorthSnapshot history (2026-09-13). History is
                          recorded lazily by the Wealth screen on load
                          (`recordNetWorthSnapshot` — replaces a same-day
                          point, skips one identical to the previous point)
                          rather than by every balance write, same on-read
                          spirit as generateDueTransactions. Doesn't import
                          debts.ts — the screen merges debts into
                          liabilities itself — so the two write-queues stay
                          independent.
    onboarding.ts           hasSeenTutorial/markTutorialSeen (2026-09-19)
                          over one device-level flag
                          ('@budgettracker/onboarding-seen'), excluded from
                          backup.ts like the other device keys — restoring
                          someone else's backup shouldn't decide whether
                          you've seen the tutorial.
    app-lock.ts             App-lock config (2026-09-13): `enabled`, a
                          random-UUID `salt`, `pinHash` (SHA-256 of
                          `${salt}:${pin}` via expo-crypto), `useBiometrics`.
                          Hashing is honesty, not security — a 4-digit PIN
                          is brute-forceable offline in milliseconds; the
                          threat model is a picked-up phone, not extracted
                          storage. Exports APP_LOCK_STORAGE_KEY so backup.ts
                          can exclude it.
    backup.ts               JSON backup/restore (2026-09-13). Enumerates every
                          '@budgettracker/*' AsyncStorage key by prefix
                          (values kept as raw JSON strings) minus two
                          device-level ones — the app-lock config and the
                          theme preference — so a new lib module's key is
                          included the moment it exists, no hand-kept list.
                          `getLastBackupDate`/`markBackedUp` (2026-09-19) track
                          the last file or cloud backup on this device under
                          a device-level excluded key; Settings → DATA shows
                          it and turns warning-colored after 30 days.
                          `clearAllData` (same day) wipes the same key set,
                          behind Settings' two-tap "Delete all data".
                          `parseBackup` validates shape/version/per-entry
                          JSON with user-readable errors; `restoreBackup`
                          replaces (removes every current data key first,
                          then multiSet), never merges. `exportBackup`:
                          native writes `Paths.cache/budgettracker-backup-
                          <date>.json` and hands it to expo-sharing; web
                          triggers a Blob download. `importBackup`: expo-
                          document-picker with type '*/*' (some Android
                          pickers mis-type .json and would hide it), text
                          read via the native `File` class or the web
                          `File` object.
    csv-export.ts           exportTransactionsCsv() (2026-09-17) — every
                          transaction as CSV (date, type, category name,
                          amount, note, a Yes/No recurring flag via
                          recurring.ts#isActiveRecurring), sorted
                          chronologically. Same native-share-vs-web-download
                          split as backup.ts's exportBackup, reusing its
                          exported `ExportOutcome` type rather than
                          redefining an identical one — but otherwise
                          unrelated: this is a one-way, human-readable
                          export, not something importBackup could ever
                          read back.
    firebase.ts             Firebase app + Auth singleton (2026-09-17),
                          structure copied from HabitTracker's own file of
                          the same name. `auth` is exported as `Auth`;
                          `getReactNativePersistence(AsyncStorage)` backs
                          native sessions so login survives an app restart,
                          `getAuth(app)` (browser persistence) backs web.
                          Imports from the scoped `@firebase/auth` package
                          rather than `firebase/auth` — see the Tech Stack
                          bullet above for why, including the
                          `@ts-expect-error` `getReactNativePersistence`
                          itself still needs. `firebaseConfig` is this
                          app's own project (`budgettracker-443b5`), not
                          HabitTracker's — deliberately separate so the two
                          apps' signed-in users don't overlap. No Firestore
                          export yet (HabitTracker's does, for its own
                          Phase 3 cloud backup) — this app has no data-sync
                          phase built, so nothing needs it.
    auth.ts                 Email/password + Google/Apple-credential sign
                          up/in/out, sendPasswordReset (swallows
                          auth/user-not-found so the UI can't be used to
                          enumerate accounts), deleteCurrentUser (surfaces
                          auth/requires-recent-login as a friendly re-login
                          prompt), onAuthStateChanged subscription, friendly
                          error mapping (2026-09-17, verbatim copy of
                          HabitTracker's lib/auth.ts of the same name, minus
                          its deleteCloudBackup call in account deletion —
                          this app has no cloud backup to clean up yet). No
                          data-layer coupling — nothing else in this app
                          knows or cares whether a user is signed in.
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
                          called once from the root layout. Materializes any
                          owed occurrences lazily on launch rather than being
                          scheduled ahead of time — there's no OS-level
                          scheduler involved (this is an offline Expo Go app
                          with no background execution; "auto-logged on
                          schedule" means "materialized the next time the app
                          opens," not real-time while closed — see
                          add-transaction.tsx's own bullet below for where
                          that series is also manageable per-transaction, and
                          (tabs)/transactions.tsx's own bullet above for its
                          Recurring page). `updateRecurring` existed briefly
                          for the old Bills management screen removed
                          2026-08-26 (see TODO.md), then came back for real
                          2026-09-12 (see the "Editing a recurring series"
                          convention bullet below) — it patches
                          amount/categoryId/note (any frequency) and
                          dayOfMonth (monthly only) in place, keeping
                          `lastGeneratedMonth`/`lastGeneratedDate` untouched
                          since neither of those edits invalidates the
                          existing cursor (`dateInMonth` reads the item's
                          *current* dayOfMonth at generation time, so a
                          changed day just takes effect the next time the
                          cursor's month is reached). Frequency itself still
                          isn't editable there — switching monthly to
                          weekly/biweekly or back would need to re-derive
                          the cursor field from scratch rather than patch one,
                          different enough to be its own feature if it's ever
                          needed. `nextDueDate` did
                          come back (2026-09-03, read-only: the next date a
                          series is due, without materializing anything —
                          mirrors generateDueTransactions' own first-cursor
                          math per frequency) for the recurring-management
                          screen this function was originally re-added for
                          (2026-09-03's app/recurring.tsx, since folded into
                          the Transactions tab's Recurring page — see the "A
                          standalone Bills tab" convention bullet) and still
                          used by transactions.tsx's RecurringView today to
                          sort/label its list. `isActiveRecurring(recurringId,
                          recurring)` (2026-09-12) is the one place that
                          checks whether a transaction's `recurringId` still
                          points at an existing series, rather than trusting
                          the id's mere presence — see transaction-row.tsx's
                          own bullet above for why that distinction matters
                          for its recurring badge.
                          `RecurringTransaction` is a discriminated union on
                          `frequency` (2026-09-03, was monthly-only before —
                          `dayOfMonth` was a bare field on one flat shape):
                          `'monthly'` keeps `dayOfMonth` (1-28, clamped to
                          each month's real length) and walks
                          `lastGeneratedMonth` forward a whole month at a
                          time, unchanged from before; `'weekly'`/`'biweekly'`
                          have no day-of-month concept of their own — the
                          recurring weekday is just whichever day `startDate`
                          falls on — and walk `lastGeneratedDate` forward 7 or
                          14 real days at a time instead. `getRecurring()`
                          migrates old stored records with no `frequency`
                          field to `'monthly'` lazily on read (no batch
                          migration pass — same "lazy, on-read" spirit as
                          `generateDueTransactions` itself), so pre-2026-09-03
                          data keeps working untouched. `addRecurring`'s
                          param type is a *distributive* `Omit` over that
                          union (a plain `Omit` collapses the union and would
                          let a `'weekly'` input carry a stray `dayOfMonth`
                          without tsc complaining). It also gained an
                          optional `lastGeneratedMonth`/`lastGeneratedDate`
                          (2026-09-02, was previously always
                          omitted/undefined) — a caller that already manually
                          created the first occurrence's own transaction
                          (add-transaction.tsx's "Repeat" checkbox does
                          exactly this) passes it so generateDueTransactions'
                          cursor starts at the *next* occurrence instead of
                          re-generating the one that's already there; fixed a
                          real double-log bug where reopening the app later
                          the same period a recurring transaction was created
                          would materialize a second copy of it.
                          **3 more frequencies + a unified cursor (2026-09-12)**
                          — `yearly` (`month` 1-12 + a leap-year-aware clamped
                          `dayOfMonth`), `everyNMonths` (a custom
                          `intervalMonths` 2-11 + `dayOfMonth`), and
                          `semimonthly` (`dayOfMonth1`/`dayOfMonth2`, no
                          ordering assumed between them) joined the union.
                          Rather than add two more branch-shapes to
                          `generateDueTransactions`' existing monthly-cursor-
                          vs-day-step-cursor split, every variant's cursor
                          unified onto one field, `lastGeneratedDate` (monthly
                          dropped `lastGeneratedMonth`) — `getRecurring()`
                          migrates old stored monthly records still carrying
                          `lastGeneratedMonth` by deriving the equivalent date
                          (`dateInMonth(lastGeneratedMonth, dayOfMonth)`), the
                          same lazy-on-read spirit as the frequency backfill
                          above. A new exported `nextOccurrenceAfter(item,
                          cursorDate)` is the one place that knows how to step
                          any frequency forward from a date — used by
                          `generateDueTransactions`' now-single loop,
                          `nextDueDate`, and add-transaction.tsx's live "next
                          on" preview (previously a separate duplicate
                          implementation there). Its parameter type,
                          `RecurringFrequencySpec`, is deliberately narrower
                          than `RecurringTransaction` (just `frequency` + the
                          fields that frequency needs) so the preview can
                          build one from in-progress form state before any
                          real record exists — every `RecurringTransaction` is
                          still structurally a valid spec, so real records
                          pass through unchanged. Unifying the cursor also
                          fixed a real behavior quirk as a side effect: monthly
                          used to materialize its occurrence as soon as its
                          calendar month began (cursor was a bare `YYYY-MM`),
                          so a bill due the 25th could appear already-added on
                          the 1st; now every frequency waits for its actual
                          date, matching weekly/biweekly's always-correct
                          behavior. `RecurringEdit` gained optional
                          `dayOfMonth2`/`month`/`intervalMonths`, and
                          `updateRecurring` switches on frequency to know
                          which apply.
                          **Frequency itself became editable, and the day cap
                          was a bug (both 2026-09-16)** — the "frequency isn't
                          editable" line above didn't survive long: per
                          feedback, `RecurringEdit` is now `{ amount,
                          categoryId, note? } & RecurringFrequencySpec` (the
                          same spec type `nextOccurrenceAfter` takes) instead
                          of a sparse per-field patch, so the caller always
                          passes a complete frequency description — including
                          `frequency` itself — for what the series should
                          look like after the edit, never an ambiguous
                          "which old field survives" merge. `updateRecurring`
                          simplified accordingly to one plain object-literal
                          return instead of a per-frequency switch (see
                          add-transaction.tsx's own bullet below for how the
                          series editor drives this). Switching frequency
                          needs no special cursor handling — exactly the
                          payoff of the `lastGeneratedDate` unification above:
                          `lastGeneratedDate` is left untouched, and
                          `nextOccurrenceAfter` just steps forward from that
                          same cursor date using whichever frequency is now
                          selected. Separately, `dayOfMonth`'s "1-28" cap
                          turned out to be a real bug, not a deliberate
                          simplification — `dateInMonth`'s clamping already
                          handles a 30th/31st pick correctly (landing on
                          Feb's real last day, same idea as a 31st already
                          did for monthly before this), so the type comment
                          and every UI day-stepper's artificial `Math.min(28,
                          …)` ceiling were both wrong; both now allow 1-31.
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
                          **Seeds Wealth data too (2026-09-18)** — per
                          feedback that Wealth had nothing to demo, three
                          `seedGoals`/`seedDebts`/`seedAccounts` helpers add
                          a fixed, hand-picked set of savings goals ("Emergency
                          Fund", "Vacation", "New Laptop" — one already at
                          100%+, for a "Goal reached" example), debts
                          ("Credit Card"/"Car Loan"/"Student Loan", spanning
                          a range of balances so the payoff planner has
                          something to snowball through), and
                          net-worth accounts (three assets + a "Mortgage"
                          liability, so the Net Worth screen's liabilities
                          group shows both a manual entry and the
                          "From Debts" merged ones at once). Fixed values
                          rather than randomized like the transaction
                          backfill above — a believable name/number spread
                          reads better for a demo than random ones would.
                          Colors offset the same way each editor's own
                          "next unused palette slot" default does (goal
                          `CATEGORY_COLORS` start at index 3, debt at 0,
                          account at 6 — see those screens' own bullets),
                          computed off each list's length *before* seeding
                          so a demo entry lands on the same color a
                          hand-added one would have gotten right after it.

  components/
    debt-payoff-chart.tsx    DebtPayoffChart (2026-09-13, same-day follow-up
                          per feedback that the snowball calculator needed
                          a graph) — balance-over-time for a PayoffPlan:
                          one stacked react-native-svg Polygon band per
                          debt in the plan's attack order, stacked bottom-
                          up in *reverse* so the current target is the top
                          band and the top edge is the total owed (each
                          band melts to nothing at its payoff month rather
                          than layers above it dropping when one below
                          vanishes) and a press-and-drag callout (month,
                          total left, per-debt balances). A dashed
                          "minimums only" comparison Polyline ran over the
                          same months until 2026-09-19, removed per
                          feedback as confusing: side by side with the
                          filled regions it invited reading a debt's
                          payoff under the plan against the same debt's
                          payoff under the baseline — two different
                          timelines that legitimately differ (rollover
                          alone, with no extra, moves them apart). The
                          comparison survives as the summary card's plain
                          "Minimums only: N months, $X in interest"
                          caption, where it can't be misread as one
                          timeline. Also dropped with it: the callout's own
                          minimums-only figure, the legend's dash swatch,
                          and `curvePath` (the baseline was its only
                          caller; regions use `roundedRegion`).
                          Touch layer / measureInWindow / pager-
                          disabling via onScrubStart/onScrubEnd are copied
                          from CumulativeTrendChart, not shared — see that
                          file for the reasoning; wealth.tsx wires the
                          callbacks to `scrollEnabled={!isScrubbing}` on
                          both its horizontal pager and the Debts page's
                          own vertical ScrollView (same fix Home uses for
                          TrendsCard). Sits inside the Debts summary card
                          with a color legend; hidden while the plan is
                          unreachable. **Redesigned the same day per
                          feedback** (a real 3-debt, 25-year plan on a
                          phone read as one flat featureless wedge with
                          dotted fragments): the chart now draws its own
                          axes — dollar gridlines at a 1/2/5×10ⁿ "nice"
                          step with `$20k`-style labels, the axis top
                          rounded up to that step, and calendar ticks
                          under the plot (quarters / half-years / years /
                          every 2 or 5 years depending on how many months
                          the plan spans, labels skipped where they'd crowd
                          the fixed "Today"/end labels); bands fill with a
                          per-debt top-to-bottom gradient (0.95→0.6 alpha,
                          ids namespaced via useId like CumulativeTrendChart)
                          and each band's top edge is stroked in the card
                          color so two same-colored debts still separate;
                          the minimums-only line is a real dash
                          (`5,4`), not the `0.5,6` round-cap dots that
                          rendered as disconnected specks. `lib/debts.ts#
                          run` no longer stops at the first stalled month —
                          it keeps filling the schedule to MAX_MONTHS and
                          just flags `unreachable`, so the baseline always
                          spans the plan's own months instead of
                          flat-lining at a truncated value. Height 200.
                          **Axis overlap + a modernization pass (2026-09-18)**
                          — per feedback that the chart "looked old school"
                          and had labels overlapping. Two real bugs, not
                          just polish: (1) the y-axis `$Xk` gridline labels
                          were plain text with no backdrop, so one landing
                          over a debt's colored band (any plan with a large
                          top band, not just an edge case) read as
                          low-contrast or outright illegible — fixed with a
                          small `theme.card` pill behind each one, same
                          "halo behind a label that might sit over anything"
                          idea as a map pin's own label. (2) the x-axis tick
                          interval was chosen off point-count brackets (`n
                          <= 84 ? 12 : n <= 180 ? 24 : 60`) with no idea how
                          wide the chart actually rendered, and only checked
                          crowding against the *right* fixed end-label, never
                          the left "Today" one — a long horizon on a narrow
                          phone chart could still pack more ticks than the
                          width could legibly hold. Replaced with
                          `MIN_TICK_PX`-budgeted interval selection (the
                          smallest of `TICK_INTERVALS_MONTHS` — quarterly up
                          to every 50 years — whose resulting tick count
                          fits `plotWidth / MIN_TICK_PX`) plus a symmetric
                          `EDGE_GAP_PX` crowding check on both ends, so
                          spacing is correct at any chart width and any plan
                          length instead of only the specific `n` ranges the
                          old brackets happened to have been tuned against.
                          Visual refresh alongside: gridlines and the bottom
                          axis/tick marks switched from solid `theme.border`
                          hairlines to a soft dotted style (`1,5`) with round
                          caps — closer to how Victory/Recharts draw a grid
                          by default, less like a spreadsheet's own ruled
                          lines — and `PADDING_TOP` 14→20 so the topmost
                          gridline's pill isn't flush against the card's own
                          edge. Reproduced and verified via the Browser pane
                          at a 375px mobile width against a synthetic
                          25-year mortgage-scale debt (the demo data's own
                          3 debts alone don't run long enough to have
                          exercised the old bracket's failure mode) —
                          confirmed both the pill fixes the on-fill overlap
                          and the new tick spacing reads cleanly at that
                          width.
                          **Curve smoothing, same day, immediate follow-up**
                          — the pass above fixed the real bugs but kept the
                          same underlying shape, which didn't read as a
                          redesign per further feedback. Every band's top
                          edge (and the dashed minimums-only comparison
                          line) switched from a straight-segment
                          `Polygon`/`Polyline` through every monthly point
                          to one smooth curve — a small Catmull-Rom-to-
                          cubic-Bezier helper (`curveCommands`/`curvePath`)
                          building an SVG `<Path>` `d` string instead. This
                          is the single change that does the most to move
                          the chart from "spreadsheet line chart" toward how
                          a modern finance app draws a balance over time; a
                          payoff-month kink in the underlying data (a debt
                          clearing frees up budget, genuinely changing the
                          payoff rate) now reads as a soft bend rather than
                          a sharp corner, a common and accepted stylization
                          for this kind of chart — the monthly values
                          themselves are unchanged, and the scrub/callout
                          still always snaps to a real data point regardless
                          of how the curve between two points is drawn.
                          Gradient stops also deepened (0.95/0.6 alpha →
                          1/0.4) for more contrast, and the edge stroke
                          width bumped 1.5→2 to read clearly against the
                          richer fill. The scrub indicator gained the same
                          two-circle "halo behind a solid dot" treatment
                          most chart libraries use (a `fillOpacity={0.16}`
                          ring behind the existing solid one) instead of a
                          single flat dot, and the callout's corner radius
                          grew 10→14 with a bit more padding to match.
    upcoming-bills-card.tsx  UpcomingBillsCard (2026-09-14) — Home's "next 7
                          days" strip of recurring series, windowed off the
                          same lib/recurring.ts#nextDueDate the Transactions
                          tab's Recurring page sorts by. Not range-scoped
                          (always the real next week from today). Section
                          title + a red "$X due this week" pill, one row per
                          series (note or category name, "Tomorrow"/"Wed,
                          Sep 16" + an "in Nd" pill, signed amount, tap →
                          edit-recurring.tsx), and an "expected in / going
                          out" footer when both types land. Returns null
                          when no series exist at all; an "event-available"
                          empty card when some exist but none are due.
    wealth-summary-card.tsx  WealthSummaryCard (2026-09-14, the TODO.md
                          follow-up) — Home's one-glance Wealth card: net
                          worth headline (assets − liabilities − debts, same
                          merge as the Wealth tab; green/red by sign) over
                          two tiles, Goals ("1 of 2 reached", total saved)
                          and Debts ("Debt-free Apr 2030" via
                          simulatePayoff, or "All paid off" / "No debts
                          tracked" / "Payments below interest", plus total
                          owed). The whole card is a Pressable into
                          /wealth. Returns null until at least one
                          goal/debt/account exists. Home loads goals, debts,
                          plan settings, and accounts on focus for it.
    trends-card.tsx          TrendsCard (2026-09-13) — everything the Trends
                          tab used to render below its range nav (the
                          Expenses/Income/Net toggle + dots, the three-page
                          pager, TrendPanel, budgetTotalForRange,
                          cumulativePoints, formatSigned), moved verbatim
                          minus the manual useMemo wrappers (React Compiler
                          — see Tech Stack). Takes transactions/budgets/
                          categories/start/end from Home plus an
                          `onScrubbingChange` callback Home wires to its
                          outer ScrollView's `scrollEnabled`. See the
                          "Trends tab" convention bullet.
    calendar-picker.tsx      CalendarPicker({selected, onSelect,
                          maxDateStr?}) (2026-09-19) — a month-pager + day
                          grid for picking one YYYY-MM-DD date, with an
                          optional ceiling (both callers pass today). Lived
                          inline in add-transaction.tsx until goal-editor's
                          contribution rows needed the same thing; extracted
                          at the 2nd caller rather than the 3rd the
                          no-premature-abstraction rule asks for, since
                          that rule is about small per-file helpers and this
                          is a stateful ~70-line component whose copy would
                          have drifted. Distinct from
                          range-picker-modal.tsx's own day grid, which picks
                          a two-tap range, not a single date.
    editor-header.tsx        EditorHeader({title, badge?, onChangeTitle?,
                          titlePlaceholder?}) (2026-09-13) — the
                          own-header-with-X shape every `headerShown: false`
                          editor modal uses; extracted once goal/debt/
                          account editors would've been copies 3-5 of
                          budget-editor's inline version (budget-editor and
                          edit-recurring migrated onto it the same day). The
                          X carries accessibilityLabel="Close". Passing
                          An `onChangeTitle` pencil variant was
                          added and reverted on 2026-09-19 — see the file's
                          own comment; a dedicated first-position Name field
                          won out.
    icon-color-picker.tsx    ColorPicker + IconPicker + resolveIcon
                          (2026-09-13) — category-editor's swatch row and
                          AI-suggested/manual-grid icon picker, extracted for
                          the same 3+-copies reason; category-editor uses
                          them now too. `IconPicker` value `null` means auto
                          (follows the name via suggestCategoryIcon), so
                          callers hold `CategoryIcon | null` and save
                          `resolveIcon(value, name)`.
    pin-pad.tsx              PinPad (2026-09-13) — 4 dots + a 3×4 keypad,
                          shared by the lock screen and set-pin.tsx; a
                          `bottomLeft` slot is where the lock screen puts its
                          biometric button. PIN_LENGTH = 4.
    lock-screen.tsx          LockScreen (2026-09-13) — absolute-fill overlay
                          the root layout renders as a sibling above the
                          Stack (not a route), null while unlocked. Prompts
                          biometrics once per lock via a ref guard (reset
                          when `locked` flips off), else PIN entry with an
                          "Incorrect PIN" state.
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
                          **Stray-dot bug fixed (2026-09-01)**: a segment whose `dash` computes to 0
                          (too small to draw after margin trim — e.g. a grouped "Other" wedge left
                          with under 1% once one category dominates) isn't actually invisible: SVG's
                          `strokeLinecap="round"` still paints a round dot at a zero-length dash's
                          position instead of nothing. Fixed by skipping that segment's `<Circle>`s
                          entirely once `dash <= 0`. Same fix also closes the *dominant* segment into
                          a full untrimmed circle whenever it's the only one that will actually
                          render (`bigEnoughCount <= 1`), not just when `laidOut.length === 1` —
                          previously a 99%/1%-style split still trimmed the big segment's margin for
                          a neighbor that wasn't really there, leaving a gap. Found by reproducing in
                          the Browser pane and reading the live SVG's own `stroke-dasharray` values
                          (a synthetic re-render via `XMLSerializer`+`<img>`+canvas rasterization gave
                          a false-negative here — the dot only reproduces in the live inline SVG, not
                          a detached re-render — so trust the DOM over a synthetic repro when the two
                          disagree).
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
    segmented-control.tsx    SegmentedControl({options, value, onChange,
                          style?}) (added 2026-09-10) — the one segmented
                          toggle, replacing nine per-file copies (Home ×2,
                          Transactions ×3, Budgets, Trends ×2,
                          add-transaction ×2) of an outlined rounded-rect
                          with a solid accent-filled segment, per feedback
                          that the outlined block looked dated. A borderless
                          pill track in `backgroundElement`; the selected
                          option is a raised thumb (`theme.segmentThumb`, a
                          dedicated token — plain `card` is darker than the
                          track in dark mode and read as recessed) with a
                          subtle shadow, its text/icon tinted by the option's
                          own `color` (red/green for the Expense/Income
                          toggles, so the color still says which side is
                          active — see the "Budgets Expense/Income pages"
                          bullet; accent otherwise). The thumb is one
                          absolutely-positioned `Animated.View` that
                          springs to `index × segmentWidth` (segments are
                          equal-width, so it's arithmetic off the track's
                          `onLayout`, no per-segment measuring) — a same-day
                          follow-up, per feedback that the first version's
                          per-option background snapped; first position is
                          `setValue`, not animated, so it doesn't slide in
                          from the left on mount. Plain RN `Animated`, not
                          reanimated (still not a dependency). 340 max
                          width by default (was 280 — three icon+label
                          options were cramped); callers override via
                          `style` (Transactions' 4-option range toggle 400,
                          Home's breakdown toggle 200, add-transaction full
                          width).
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
                          reached, good). Expense bars also turn
                          `theme.warning` amber from 80% (exported
                          `BUDGET_WARNING_THRESHOLD`, 2026-09-14) so a
                          nearly-spent budget stands out before it's blown;
                          income has no warning band, since nearing a goal
                          isn't a problem.
    transaction-row.tsx      One transaction list row (icon, category, note,
                          signed amount) — shared by Home's recent list and the
                          Transactions tab. Takes a resolved `category` prop
                          (the caller looks it up via lib/categories.ts'
                          getCategory) rather than looking it up itself, since
                          categories are no longer a synchronously-importable
                          constant. Redesigned 2026-08-26 — see the
                          "Transaction rows redesigned" convention bullet
                          below. Shows a small `event-repeat` glyph after the
                          category name via an `isRecurring` boolean prop the
                          caller resolves (2026-09-10, initially keyed off a
                          bare `transaction.recurringId` truthiness check;
                          changed 2026-09-12 to `lib/recurring.ts
                          #isActiveRecurring(transaction.recurringId,
                          recurring)` instead, per feedback that the old
                          version was confusing — `recurringId` itself is
                          still left on a transaction forever once set, so
                          the original version kept showing the badge on rows
                          a since-stopped series generated; now every caller
                          also loads `getRecurring()` and the badge reflects
                          the series' *current* state, disappearing once it's
                          stopped).
    themed-text.tsx, themed-view.tsx, ...   From the Expo default template.

  constants/theme.ts      Colors.light / Colors.dark. Extends the template's
                          minimal palette with card/border/accent/success/
                          destructive/warning/textTertiary to cover the whole
                          app — same idea as HabitTracker's theme.ts, single
                          source of truth for every neutral/semantic color.
                          `segmentThumb` (2026-09-10) is SegmentedControl's
                          selected-thumb fill, see that component's entry.
  hooks/use-theme.ts       useTheme() — resolves Colors[scheme] against
                          useThemePreference()'s resolved scheme. Used to read
                          the OS color scheme directly (no in-app override);
                          see use-theme-preference.tsx below for why that
                          changed 2026-09-17 — TODO.md's note about this
                          being missing, unlike HabitTracker, no longer
                          applies.
  hooks/use-currency.tsx   CurrencyProvider + useCurrency() (2026-09-14) —
                          same AsyncStorage-backed provider shape as
                          use-theme-preference, mounted in _layout.tsx
                          inside ThemePreferenceProvider. Returns
                          `{ settings, setSettings, symbol, format, compact }`;
                          every screen/component that shows an amount calls
                          `const { format } = useCurrency()` and renders
                          `{format(x)}` — the per-file `formatAmount` /
                          `formatSigned` helpers and every hardcoded `$` are
                          gone (the sweep was mechanical: `${formatAmount(x)}`
                          → `{format(x)}`). `symbol` is the bare sign next to
                          amount inputs; `compact` is for calendar cells and
                          the payoff chart's axis. Set from Settings'
                          "CURRENCY" section: two rows (Currency, Number
                          format) each opening an OptionPickerModal whose
                          rows show a live sample amount.
  hooks/use-theme-preference.tsx  ThemePreferenceProvider + useThemePreference()
                          (added 2026-09-17, matching HabitTracker's own hook
                          of the same name) — an in-app Light/Dark/Auto
                          override, AsyncStorage-backed
                          (`@budgettracker/theme-preference`). `'system'`
                          (the default, and the only behavior that existed
                          before this) tracks the OS scheme via
                          hooks/use-color-scheme(.web).ts; `'light'`/`'dark'`
                          pin it regardless of the OS. Wraps the whole app
                          from src/app/_layout.tsx, which split into an outer
                          `RootLayout` (just the provider) and an inner
                          `RootLayoutInner` (everything that used to be the
                          whole component) since a hook needs to render
                          underneath its own provider, not beside it. Also
                          calls `Appearance.setColorScheme` on native (a
                          no-op guarded out on web, where the shim doesn't
                          implement it) so native chrome that reads UIKit's
                          trait collection directly — NativeTabs' own tab bar
                          material, not styled through any RN prop — doesn't
                          stay stuck on the OS's scheme when the app
                          overrides away from it; same fix HabitTracker uses
                          for the identical gap. `_layout.tsx` also gained an
                          explicit `<StatusBar>` synced to the resolved
                          scheme, since its default behavior otherwise follows
                          the OS's own appearance rather than this app's,
                          which would leave status bar icons unreadable
                          against this app's actual background once the two
                          can differ. Set from Settings — see that screen's
                          own bullet above.
  hooks/use-app-lock.tsx   AppLockProvider + useAppLock() (2026-09-13) —
                          owns enabled/locked/biometricsAvailable/
                          biometricLabel/useBiometrics plus refresh,
                          unlockWithPin, unlockWithBiometrics,
                          setUseBiometrics, disable. Mounted from
                          src/app/_layout.tsx inside ThemePreferenceProvider.
                          Locks on cold start when a PIN exists, and on
                          AppState 'active' after ≥30s in 'background' —
                          only 'background', never 'inactive', because iOS
                          goes inactive for the biometric prompt itself (and
                          Control Center etc.) and re-locking on that would
                          loop. `authenticateAsync` runs with
                          `disableDeviceFallback: true` — the app has its
                          own PIN fallback, and the OS passcode sheet would
                          be a third way in this app never verified.
                          expo-local-authentication's web shim reports no
                          hardware, so web is PIN-only with no branch.
  hooks/use-auth.tsx       AuthProvider + useAuth() (2026-09-17, verbatim
                          structure from HabitTracker's own hook of the
                          same name) — exposes { user, loading } off
                          Firebase's onAuthStateChanged, mounted from
                          src/app/_layout.tsx inside
                          ThemePreferenceProvider (same nesting position as
                          AppLockProvider/CurrencyProvider). `loading`
                          starts true so account.tsx shows a neutral
                          spinner instead of flashing "signed out" before a
                          persisted session restores on launch.
```

## Important Conventions

- **Dates are `"YYYY-MM-DD"` strings**; months are `"YYYY-MM"`. Produced via manual
  `${y}-${pad(m)}` formatting rather than `toISOString()` in most places, since `Date`'s local
  getters (`getFullYear`/`getMonth`) are what the calendar picker and month nav actually need —
  `toISOString()` shifts to UTC and can land on the wrong local day.
- **Recurring transactions support 6 frequencies**: monthly, weekly, biweekly (weekly/biweekly added
  2026-09-03), plus yearly, everyNMonths (a custom interval), and semimonthly (twice a month — all
  three added 2026-09-12, researched off how YNAB/Monarch Money/Copilot Money handle recurring
  bills). `RecurringTransaction` is a discriminated union on `frequency`. Monthly/everyNMonths/yearly
  clamp their `dayOfMonth` to the real length of whichever month they land in (so a "31st" recurs on
  the 28th/29th/30th in shorter months, and yearly's clamp is leap-year aware for Feb 29); weekly/
  biweekly have no `dayOfMonth` at all — their recurring weekday is implicit in `startDate`;
  semimonthly carries two independent clamped days (`dayOfMonth1`/`dayOfMonth2`). As of 2026-09-12
  every frequency's cursor is the same field, `lastGeneratedDate` (a real date, not a `YYYY-MM`
  month string) — monthly used to track `lastGeneratedMonth` instead, which meant a monthly item
  materialized as soon as its calendar month began rather than when its actual day arrived (a bill
  due the 25th could show up already-added on the 1st); unifying the cursor onto a real date, via one
  `nextOccurrenceAfter(item, cursorDate)` stepping function used by both `generateDueTransactions`
  and the read-only `nextDueDate`/preview math, fixed that as a side effect of adding the 3 new
  frequencies rather than as a separate change. See `lib/recurring.ts`'s own Folder Structure bullet
  for the full mechanics (including how pre-2026-09-12 monthly records with the old
  `lastGeneratedMonth` field migrate lazily on read). A further frequency (e.g. daily) would be a new
  union member, same pattern.
- **Recurring page forecast grouping + row redesign (2026-09-12)** — Transactions' Recurring page
  (see the "A standalone Bills tab" bullet below for its own history) replaced its one flat
  soonest-due-first list with 3 sections — Due This Week / Due This Month / Later — bucketed off
  `nextDueDate`. There's no "Overdue"/"Due Today" bucket: `generateDueTransactions` always catches a
  series up to today before any screen renders (root layout, before the splash screen hides), so
  `nextDueDate` is never today or in the past in practice, only ever tomorrow-or-later — building an
  Overdue bucket would've been dead code. `RecurringRow` also picked up a small "Tomorrow"/"in Nd"
  pill next to the next-due date, shown only for This-Week rows (This-Month/Later rows just keep the
  plain date text — the section header already conveys the timeframe, a redundant "in 23d" pill would
  be noise), plus a bumped amount font size for emphasis. `add-transaction.tsx`'s Repeat card's
  frequency picker moved from a 3-option `SegmentedControl` to a horizontally-scrolling chip row (6
  options no longer fit that component's compact 2-4-segment design) and gained inline steppers for
  everyNMonths' interval and semimonthly's second day; the edit-mode series editor gained matching
  extra fields per frequency (a month chip row for yearly, an interval stepper for everyNMonths, a
  second day stepper for semimonthly).
- **Categories are AsyncStorage-backed and user-editable** (`lib/categories.ts`) — name/icon/color
  can be changed for any category, including the seeded defaults, via `category-editor.tsx` (Budgets'
  `+` button to add, long-press a row to edit). `type` is deliberately not editable through that
  screen — see its own entry above. **Delete landed 2026-09-14**: `lib/categories.ts#deleteCategory`
  reassigns the category's transactions (`transactions.ts#reassignTransactionsCategory`) and
  recurring series (`recurring.ts#reassignRecurringCategory`) to that type's seeded catch-all
  (`FALLBACK_CATEGORY_ID`: `other_expense`/`other_income`), drops its budget outright (merging a
  deleted limit into Other's would silently change a number the user never set), then removes the
  row — history is kept, just recategorized, same spirit as HabitTracker never deleting a habit's
  history. The two "Other" rows themselves refuse deletion (`isFallbackCategory`), and the editor
  hides the button for them. `budgets.ts` imports from `categories.ts` type-only now (it inlines the
  one `getCategory` call it had) so `categories.ts` can import `removeBudget` without a runtime
  cycle.
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
- **A standalone Bills tab (added 2026-08-25) was removed 2026-08-26, briefly re-added 2026-09-10,
  and folded into Transactions as a third pager page the same day** — the original tab listed every
  `RecurringTransaction` with add/edit/cancel, but got pulled to make room for a dashboard-style
  redesign instead (see TODO.md). Recurring series went from completely unmanageable after creation
  (2026-09-02: cancelable per-transaction, see add-transaction.tsx's own bullet above) to a full "see
  every series in one place" screen (2026-09-03: app/recurring.tsx, reached from Settings' "RECURRING"
  row) without reviving a dedicated tab. On 2026-09-10, per feedback, that modal's list-and-stop
  content became a 5th "Bills" tab with its own FAB — then, per immediate follow-up feedback that
  (a) "Bills" oversold what is just a recurring-transaction list (no due dates, no paid/unpaid state)
  and (b) Transactions + Recurring was two tabs for the same kind of thing, it moved again the same
  day into `(tabs)/transactions.tsx` as the third page of the existing List/Calendar pager
  (List/Calendar/**Recurring**; Custom's pager is List/Recurring since it has no Calendar page). Back
  to four tabs; app/recurring.tsx and (tabs)/bills.tsx are both gone, as is Settings' "RECURRING"
  row. On the Recurring page the range nav is hidden with `opacity: 0` + `pointerEvents: 'none'`
  rather than unmounted, so the view toggle below it doesn't jump when the pager settles there; the
  header's type/category filter narrows this page too (`applyTransactionFilter` went generic); and
  the tab's existing FAB opens add-transaction with `?repeat=1` from this page — the one thing the
  old Settings-modal version never had, since it only ever *linked out* to that checkbox. Fixed
  alongside (and kept): `BottomTabInset` (constants/theme.ts) had no `web` case, so on web every
  tab's FAB sat at `bottom: 0` with nothing accounting for `(tabs)/_layout.web.tsx`'s own floating
  pill tab bar and ended up entirely covered by it (same stacking-order issue as any two overlapping
  `position: absolute` siblings, the later-painted one wins); `web: 76` matches that bar's measured
  height. `lib/recurring.ts`'s core CRUD + `generateDueTransactions()` was untouched by all of this —
  only ever the screen-level plumbing moved. Editing a series' amount/category/day after creation was
  still not built at this point — see the "Editing a recurring series" convention bullet below for
  when that landed (2026-09-12; frequency itself followed 2026-09-16, per that bullet's own note).
- **Category icon colors: custom per-category everywhere; the expense/income cue lives elsewhere on
  the row, not on the icon (settled 2026-09-12 after four reversals)** — `6da13da` forced every
  `CategoryBadge` to destructive-red/success-green via a `color` override; that was undone the same
  day (`type: CategoryType` prop instead, drawing a small red/green corner dot without overriding the
  icon tint) per feedback that custom colors should survive; then *that* was partially undone again
  after further feedback specifically about transaction rows, which went back to the hard `color`
  override there only. That carve-out was itself reverted 2026-09-12 per feedback that a
  transaction's icon burying its category's own color wasn't worth it just for a redundant type cue.
  `CategoryBadge` still takes both `color` (hard override, kept for any future caller that needs it)
  and `type` (a small corner dot, ignored if `color` is set) — **`budgets.tsx`** (×2),
  **`add-transaction.tsx`**'s category grid, and **`budget-editor.tsx`** pass `type={...}` and keep
  each category's own custom color with just the dot; Home's dashboard ring badge passes neither
  (always an expense category, unambiguous either way). **`transaction-row.tsx`** passes neither —
  per the same-day follow-up feedback that even the corner dot wasn't an obvious enough expense/
  income cue, it instead renders its own `typePill`, a small "Expense"/"Income" text pill (soft
  destructive/success-tinted background, same `color + '1a'` convention as Budgets' own
  over-budget/goal-reached pills) — **paired with the amount in a right-aligned column, not inline
  next to the category name**. An inline-next-to-the-name placement was tried first and reverted the
  same day: on a narrow phone width the pill competed with the category name (and the recurring
  glyph) for the same shrinking row, truncating ordinary names like "Shopping" to "Shoppi...". Stacked
  above the amount instead, the pill has its own space and reads naturally as "this label describes
  the amount below it," while the category name column is free to show in full.
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
- **Settings + demo data (added 2026-08-26, extended 2026-08-31, 2026-09-03, and 2026-09-18, trimmed
  2026-09-10)** — `app/settings.tsx`, reached via `SettingsButton` on every tab. "Generate demo data"
  (`lib/demo-data.ts#generateDemoData`, renamed from `generateYearToDateDemoData`), a
  two-tap-confirmed button that backfills random transactions across two ranges — this year's Jan 1
  through today, plus (2026-08-31, per feedback that Trends' Year view had nothing prior to compare
  against) all of last year — and sets a handful of both expense budgets *and* income goals
  (2026-08-31; previously expense-only) — for demoing/testing without hand-entering months of data.
  Also seeds a fixed set of sample savings goals, debts, and net-worth accounts (2026-09-18, per
  feedback that Wealth had nothing to demo) — see `lib/demo-data.ts`'s own Folder Structure entry for
  what exactly gets added. Purely additive (never clears/dedupes), so repeated taps pile up rather
  than reset; there's no companion "clear demo data" yet, see TODO.md. A "RECURRING" section briefly sat above it
  (2026-09-03: a single row into app/recurring.tsx, its subtitle a live "N active" count) — removed
  2026-09-10 once that screen's content moved into the Transactions tab's Recurring page (see the "A
  standalone Bills tab" bullet above); Settings is back to just the one section.
- **Amount field: tap-to-focus, no autofocus (2026-09-18)** — the amount `TextInput` used to carry
  `autoFocus={!isEditing}`, popping the numeric keypad the instant a new transaction was started,
  before anything was even tapped; removed per feedback. The `$`/amount pair is now wrapped in a
  `Pressable` that calls `.focus()` on the input via a ref, so tapping the `$` sign itself (plain
  `ThemedText`, not part of the input) opens the keypad too, not just tapping the digits. A checkmark
  button appears next to the input only while it's focused (tracked via `onFocus`/`onBlur`) and calls
  `Keyboard.dismiss()` — needed because the `decimal-pad` keyboard type has no built-in "Done" key on
  Android to close it with otherwise.
- **Repeat card redesign (2026-09-10)** — add-transaction.tsx's recurring UI was a bare checkbox
  row ("Repeat" + a checkbox glyph) for new transactions and a plain text link
  ("Repeats {frequency} — stop repeating") for editing one, per explicit feedback that both looked
  dated. Landing point: one `repeatCard` shape (icon circle, title, a subtitle that states what will
  actually happen, a control on the right) used both places. New transaction: a `Switch` (not the old
  checkbox), subtitle live-previews `"{frequency} · next on {date}"` via a new `nextOccurrence()`
  helper (mirrors `lib/recurring.ts`'s own cursor math for a series that doesn't exist yet, so the
  preview doesn't need one to compute against) — the Weekly/Biweekly/Monthly `SegmentedControl` now
  sits inside the card, below a divider, instead of as a separate element beneath the checkbox.
  Editing a transaction in an active series: subtitle shows `"Next on {date} · since {date}"` (real
  `nextDueDate`/`startDate` this time, a real record exists), and a pill "Stop" button (destructive
  color, two-tap — first tap fills it solid destructive with "Confirm", matching the tap-again
  pattern used elsewhere in this screen) replaces the old bare text link. Stopping no longer makes the
  card disappear: a `stoppedRecurring` flag keeps it mounted in a "Repeating stopped / No more will be
  added. Past ones stay." state instead, so there's some acknowledgement of what just happened rather
  than the row silently vanishing.
- **Editing a recurring series (added 2026-09-12, self-contained panel same day per feedback)** —
  `lib/recurring.ts#updateRecurring` patches a series' amount/categoryId/note (any frequency) and
  dayOfMonth (monthly only); see that function's own bullet above for why frequency itself stayed
  out of scope and why the monthly cursor doesn't need adjusting when dayOfMonth changes. Reached two
  ways, both landing on the same editor rather than building a second one: (1) add-transaction.tsx's
  Repeats card gained an Edit pencil next to Stop — tapping it reveals a compact panel with its own
  amount input, a day-of-month stepper (monthly only) on the same row, a horizontally-scrolling
  category chip row, and a "Save series" button. An earlier version of this panel reused the screen's
  own amount/category/note fields above instead of carrying its own — reverted the same day per
  feedback that it read as more description than function (a long explanatory caption, a scroll back
  up to actually change anything): the panel now seeds its own state straight from the series record
  (not from whatever this transaction's own fields happen to show, which can have drifted from the
  series after the fact) and needs no caption, since editing here plainly can't touch the transaction
  you're looking at — there's no shared field for it to reach through. (2) `(tabs)/transactions.tsx`'s
  Recurring page — `RecurringRow` gained a matching Edit pencil next to its own Stop, which doesn't
  reimplement any of this: `handleEditRecurring` finds that series' most recent transaction (by date,
  off the full unfiltered `transactions` list so the header's type/category filter can't hide the
  only match — a series always has at least its seed transaction, see add-transaction.tsx's own
  bullet on how that's created) and routes to `/add-transaction?id=<that transaction's id>`, landing
  on the exact same Repeats-card editor as (1).
  **Frequency became editable too (2026-09-16), per follow-up feedback** — the series editor panel
  gained its own frequency chip row (same `FREQUENCY_OPTIONS` chips as the new-transaction Repeat
  card) above the amount row; switching it there shows/hides the relevant day/month/interval fields
  below without resetting any of them, so a value the series already had (or the panel was last set
  to) just carries over rather than blanking out. `lib/recurring.ts#updateRecurring` no longer takes
  a sparse per-field patch — see that function's own bullet above for the reworked `RecurringEdit`
  shape and why switching frequency needs no special cursor handling now.
  **The day-of-month cap was a bug, not a deliberate limit (2026-09-16)** — every day stepper
  (monthly/everyNMonths/yearly/semimonthly's two) was artificially capped at 28, on top of the real
  per-month clamping `dateInMonth`/`dateInYear` already do correctly; raised to 31 everywhere (a
  30th/31st pick now lands on Feb's real last day exactly like it already did for a 31st before this
  fix — the cap just hid the 29th-31st range from ever being pickable).
  **Pulled out into its own screen, `edit-recurring.tsx` (2026-09-17), per feedback that reaching it
  from the Recurring page was too indirect to feel like editing a series at all** — (2)'s
  `handleEditRecurring` used to search for that series' most recent transaction and open *its* edit
  screen just to reach the Repeats card's own pencil, which put two separate amount/category pickers
  (one for that one transaction, one for the whole series) on one screen at once — easy to blur which
  one you were changing. Both entry points now route straight to `/edit-recurring?id=<recurringId>`:
  (2) passes the tapped row's id directly (no more searching `transactions` for a stand-in), and (1)'s
  Repeats-card pencil does the same with `activeRecurring.id` instead of toggling the old inline
  panel open. The panel's own fields (frequency chips, amount, conditional day/month/interval
  fields, category grid, Save) moved into that new screen close to verbatim — same look, same
  behavior — plus its own header (title, an X `router.back()`, matching `budget-editor.tsx`'s own
  shape) and its own Stop control at the bottom, so stopping a series no longer requires being on the
  Recurring page or already looking at one of its transactions. add-transaction.tsx gained a
  `useFocusEffect` that re-fetches just `activeRecurring` (not the transaction's own fields, which it
  shouldn't clobber with unsaved edits) on every focus — necessary now that editing happens on a
  screen you navigate away to and back from: without it, the Repeats card would keep showing the
  series' pre-edit frequency/amount/next-due-date until the whole add-transaction modal was closed
  and reopened. If that refresh finds the series gone (stopped from the new screen instead of this
  one), it sets `stoppedRecurring` too, so the card still settles into its "stopped" state instead of
  just disappearing.
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
  `category-ring-chart.tsx`'s own bullet above for the tap-to-select mechanics. The center total's own
  Text (`ringAmount`, all three variants) gained `numberOfLines`/`adjustsFontSizeToFit`/`maxWidth`
  (2026-09-01, per feedback — a large total like a full year's income had nothing to shrink against
  and could overflow the ring's safe interior instead of shrinking to fit, unlike the label below it
  which already had this treatment). A legend sits between
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
- **Transactions List/Calendar (added 2026-08-26, Calendar extended to Week/Year 2026-09-01; on
  2026-09-10 a Recurring page joined and Calendar left for its own tab)** — Transactions' pager is
  now List + Recurring (`PAGES` in `transactions.tsx`, one horizontal `pagingEnabled` ScrollView);
  List reads the shared `anchor`/`start`/`end` state so the range nav applies to it, Recurring isn't
  period-scoped so the nav hides (layout kept) while it's showing — see the "A standalone Bills tab"
  bullet for that page's history. The space the hidden nav leaves behind isn't blank, either
  (2026-09-10, per feedback): `RecurringSummary` overlays it (absolutely positioned over that same,
  still-reserved box, so there's no separate height to keep in sync with the nav's own) with a count
  ("N recurring transactions") and, per type that actually has one, a monthly-equivalent total
  ("-$1,416.67/mo · +$3,000.00/mo") — `monthlyEquivalent()` normalizes each series' amount by its real
  occurrences-per-month (52/12 weeks, 26/12 fortnights, 1 for monthly) rather than a flat ×4, so a
  weekly series doesn't quietly undercount months with a 5th occurrence. Computed off
  `filteredRecurring`, so the header's type/category filter narrows these totals too, same as it
  narrows the row list below. The three calendar grids described below now live in
  `(tabs)/calendar.tsx` behind their own Week/Month/Year nav (per feedback that Calendar should be a
  tab, not a page); the component-level notes here still describe them accurately. The Custom-has-
  no-Calendar special case (a `pagesFor(rangeType)` that dropped the page, and before that a
  full-bleed List with no pager) went away with the move — Calendar's own nav simply never offers
  Custom. A
  page-dot row (2026-08-27,
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
  for Custom, the one rangeType still without a Calendar page — until 2026-09-10, when Calendar
  became its own tab and that reset (and the `useEffect` on `rangeType` that did it) went away
  entirely; Transactions' List/Recurring pager is the same for every rangeType now.
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
  `shiftCustomRange`-shifted window one length back. Custom mode has no Calendar equivalent (no
  single-grid shape fits an arbitrary range the way a month/week/year grid does) — since 2026-09-10
  that's simply the Calendar tab's own nav not offering Custom (see the "Transactions List/Calendar"
  bullet above for how Transactions used to special-case it while Calendar was one of its pages). All of the above
  (`RangeType`/`CustomRange`/`rangeBounds`/
  `shiftAnchor`/`shiftCustomRange`/`formatRangeLabel`/`RangePickerModal`) started out duplicated
  per-file (2 occurrences, not yet 3, per the no-premature-abstraction rule) but got extracted to
  `lib/date-range.ts` + `components/range-picker-modal.tsx` the same day, once Trends became a 3rd
  near-identical copy — see the "Trends tab" bullet below and those two files' own Folder Structure
  entries above. Home's and Transactions' screens now import from there instead of redefining any of
  it locally.
- **Transactions search (added 2026-09-14)** — a magnifier button left of the funnel toggles a pill
  search row under the title (autofocused; the button flips to `search-off` and fills accent while
  open). `applySearch` runs after `applyTransactionFilter` on both List and Recurring, matching the
  note or the category's name case-insensitively — so "coffee" finds a note and "Groceries" a
  category. Closing the row clears the query too, so a hidden query can never silently narrow the
  list. Separate from the funnel's filter state (its badge doesn't reflect the query; the open row
  is the cue), but both feed the same "No matching transactions" empty state.
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
- **Five tabs is the ceiling (2026-09-13)** — Expo's `NativeTabs` hard-caps Android at 5 tabs (the
  docs say so outright) and iOS's `UITabBarController` shoves a 6th into an automatic "More…" tab on
  iPhone. So when Savings Goals / Debt Payoff / Net Worth needed a home, a 6th tab wasn't an option;
  per explicit choice, **Wealth took Trends' slot** and Trends' content became a card on Home rather
  than folding Calendar back into Transactions (a decision already made the other way 2026-09-10) or
  cramming Budgets to five pages. If a further top-level area ever comes up, the same constraint
  applies: something has to move into a card or a modal, not a 6th tab.
- **Wealth tab data is hand-entered, not derived from transactions (2026-09-13)** — a goal's saved
  amount is its contributions, a debt's balance is whatever was last typed or paid down via "Record a
  payment", an account's balance is updated by hand. That's deliberate for an offline app with no bank
  sync: setting money aside isn't an expense, a card payment is already logged as whatever it bought,
  and a loan payment splits into principal/interest the ledger can't see. The one cross-link is Net
  Worth counting every Debt as a liability automatically (merged on the screen, not in lib) so a card
  isn't entered twice. Net-worth history is sampled lazily whenever the Net Worth page loads (one
  point per day something changed), not on every balance write — same on-read spirit as
  generateDueTransactions.
- **Payments can log transactions, per goal/debt (2026-09-14)** — the one deliberate crack in the
  "hand-entered" rule above, and opt-in: `Debt.logPayments`/`paymentCategoryId` and
  `SavingsGoal.logContributions`/`contributionCategoryId`, set from an "Also log as a transaction"
  Switch in each editor's RECORD A PAYMENT / ADD MONEY section (edit mode only, since that's the only
  place a payment happens), which reveals a horizontal expense-category chip row (defaults to
  `other_expense`). The choice writes to the record the moment it's flipped, not on Save, because
  `lib/debts.ts#recordPayment` and `lib/goals.ts#addContribution` read it off the stored record and a
  payment can be made without ever tapping Save. A debt payment writes an expense dated today, note
  "Payment: <name>", and nothing links it back (there's no payment record on a Debt), so undoing one
  is two manual steps. A goal contribution writes an expense ("Savings: <name>") and stores the
  transaction's id on the `GoalContribution`, so removing the contribution (the × in the list) deletes
  its transaction too; a withdrawal writes the matching *income* into `other_income` ("Withdrawal:
  <name>"), not a negative expense, so the ledger nets out. Both lib modules now import
  `lib/transactions.ts` (which imports nothing, so no cycle); their write-queues stay separate.
- **App lock (2026-09-13)** — off by default; Settings' App lock Switch routes through `set-pin.tsx`
  (the toggle only reads on once a PIN exists) and turning it off is immediate, since the session
  already got past the lock screen. Face ID/Touch ID/fingerprint when the device has enrolled
  biometrics (a per-device sub-toggle, default on), PIN otherwise or as fallback. Re-locks after 30s in
  the background, not on `inactive` — see `hooks/use-app-lock.tsx`'s Folder Structure entry for why
  that distinction is load-bearing on iOS. The lock config never leaves the device: `lib/backup.ts`
  excludes it from exports and restores.
- **Backup/restore is replace, not merge (2026-09-13)** — the file becomes the whole truth for every
  data key, including ones it doesn't mention. Per explicit choice over a merge, which would double up
  data the way repeated demo-data runs already do. Two-tap confirm on Restore in Settings, and the
  subtitle tells the user to back up first. Keys are enumerated by the '@budgettracker/' prefix at
  runtime, so any new lib module's storage is covered without touching backup.ts — the only thing to
  remember when adding a device-level setting (like the theme preference, or the currency setting
  added 2026-09-14) is to add its key to backup.ts's `EXCLUDED_KEYS`.
- **Currency is a display setting, not data (2026-09-14)** — Settings' CURRENCY section picks a
  symbol (20 currencies, `lib/currency.ts#CURRENCIES`) and a number-format locale separately, so
  someone can show "1.234,56 €" or "€1,234.56" as they prefer. Nothing is converted and nothing is
  stored on a transaction; switching currency just relabels every existing amount. That's the
  deliberate v1 reading of TODO.md's old "multi-currency" item: one ledger, one currency, your
  choice of which. The one rule for new code: never write a literal `$` in UI copy — take `format`
  (or `symbol`/`compact`) from `useCurrency()`.
- **Home gained Upcoming Bills and Wealth cards (2026-09-14)** — see their Folder Structure entries.
  Order on Home is now dashboard → UPCOMING BILLS → TRENDS → EXPENSE BUDGETS → INCOME GOALS →
  WEALTH → RECENT TRANSACTIONS. Both cards hide themselves entirely when there's nothing to show
  (no recurring series / no goals, debts, or accounts) rather than rendering an empty shell.
- **Trends moved into Home as `TrendsCard` (2026-09-13)** — the bullet below still describes the
  chart mechanics accurately; what changed: it reads Home's own Month/Year range (so no Week, and the
  Custom option the tab used to offer is gone with it), sits in a "TRENDS" section between the
  dashboard card and the budgets list, and the "No vertical scrolling" sub-bullet no longer applies —
  Home *is* a vertical ScrollView, so it toggles `scrollEnabled={!isScrubbing}` for the drag's
  duration via the card's `onScrubbingChange`, the same trick the card's own horizontal pager uses.
- **Trends tab (added 2026-08-30; a Home card since 2026-09-13, see above)** — was a tab,
  `app/(tabs)/trends.tsx`, showing cumulative actual
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
