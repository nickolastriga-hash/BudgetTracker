import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { CategoryRingChart, groupRingSegments, RING_OTHER_KEY } from '@/components/category-ring-chart';
import { ProgressBar } from '@/components/progress-bar';
import { RangePickerModal } from '@/components/range-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { effectiveLimit, getBudgetProgress, getBudgets, type Budget, type BudgetProgress } from '@/lib/budgets';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { monthsBetween, rangeBounds, shiftAnchor, toMonthStr, type RangeType } from '@/lib/date-range';
import { getRecurring, isActiveRecurring, type RecurringTransaction } from '@/lib/recurring';
import {
  byCategoryTotalsInRange,
  getTransactions,
  rangeTotals,
  transactionsInRange,
  type Transaction,
  type TransactionType,
} from '@/lib/transactions';

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Compares this period's figure against the equivalent previous period
// (previous month/year, per whatever shiftAnchor(-1) resolves to).
// `goodDirection` decides which way is "positive" — up for income/net, down
// for expenses (spending less is the good outcome there). No prior-period
// data (previous === 0) reads as "New" rather than a meaningless ±∞%, and no
// data in *either* period renders nothing at all.
function computeDelta(
  current: number,
  previous: number,
  goodDirection: 'up' | 'down'
): { label: string; tone: 'positive' | 'negative' | 'neutral' } | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { label: 'New', tone: 'neutral' };
  const diff = current - previous;
  if (diff === 0) return { label: '—', tone: 'neutral' };
  const pct = Math.round((Math.abs(diff) / Math.abs(previous)) * 100);
  const arrow = diff > 0 ? '▲' : '▼';
  const tone: 'positive' | 'negative' = (goodDirection === 'up') === (diff > 0) ? 'positive' : 'negative';
  return { label: `${arrow} ${pct}%`, tone };
}

// Year mode's budget preview: each budget's limit is summed across every
// month the year touches (lib/date-range's monthsBetween, same approach as
// Trends' own budgetTotalForRange) rather than read off a single month —
// effectiveLimit already resolves overrides/scheduledChange per month, so a
// budget that only started partway through the year (monthlyLimit: 0 before
// its scheduledChange's startMonth) naturally sums to just the months it was
// actually in effect for, and a budget scheduled to *drop* to 0 partway
// through sums to just the months before that. Actuals are pulled from the
// same start/end range rather than "this month", so spent/earned lines up
// with whatever the limit is summing over.
function budgetProgressForRange(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  start: string,
  end: string
): BudgetProgress[] {
  const months = monthsBetween(start, end);
  const spentByCategory = byCategoryTotalsInRange(transactions, start, end, 'expense');
  const earnedByCategory = byCategoryTotalsInRange(transactions, start, end, 'income');
  return budgets.map((b) => {
    const type = getCategory(categories, b.categoryId)?.type ?? 'expense';
    const spent = (type === 'income' ? earnedByCategory : spentByCategory)[b.categoryId] ?? 0;
    const limit = months.reduce((sum, m) => sum + effectiveLimit(b, m), 0);
    return { categoryId: b.categoryId, type, limit, spent, percent: limit > 0 ? spent / limit : 0 };
  });
}

// Shared by both breakdown panels below (expense and income each call this
// with their own `type`) rather than computed inline per panel — same data
// shape, just filtered/sorted for whichever side is being shown.
function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  start: string,
  end: string,
  type: TransactionType
) {
  const byCategory = byCategoryTotalsInRange(transactions, start, end, type);
  return Object.entries(byCategory)
    .map(([categoryId, amount]) => ({ categoryId, amount, category: getCategory(categories, categoryId) }))
    .filter((e) => e.category)
    .sort((a, b) => b.amount - a.amount);
}
type BreakdownEntry = ReturnType<typeof categoryBreakdown>[number];

// Small ▲/▼N% readout under a summary column's amount — renders nothing for
// computeDelta's null case (no data in either period to compare) rather
// than an empty reserved slot, since not every column always has one.
function DeltaLabel({ delta }: { delta: { label: string; tone: 'positive' | 'negative' | 'neutral' } | null }) {
  const theme = useTheme();
  if (!delta) return null;
  const color = delta.tone === 'positive' ? theme.success : delta.tone === 'negative' ? theme.destructive : theme.textTertiary;
  return (
    <ThemedText type="small" style={[styles.deltaLabel, { color }]}>
      {delta.label}
    </ThemedText>
  );
}

// One page of the Expense/Income breakdown pager below — the ring chart plus
// its legend, parameterized by `type` so both sides can be mounted at once
// (needed for the swipe gesture to actually reveal the other page rather
// than just re-rendering the same one). Selection is lifted to the caller
// (selectedKey/onSelectKey) so each page keeps its own tapped-segment state
// independently — switching pages doesn't clear the other one's selection.
function BreakdownPanel({
  type,
  breakdown,
  breakdownTotal,
  ringSegments,
  selectedKey,
  onSelectKey,
}: {
  type: TransactionType;
  breakdown: BreakdownEntry[];
  breakdownTotal: number;
  ringSegments: ReturnType<typeof groupRingSegments>;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
}) {
  const theme = useTheme();
  const selectedOther = selectedKey === RING_OTHER_KEY ? ringSegments.find((s) => s.key === RING_OTHER_KEY) : undefined;
  const selectedCategory =
    selectedKey && selectedKey !== RING_OTHER_KEY ? breakdown.find((e) => e.categoryId === selectedKey) : undefined;
  // The legend's mini bars are normalized against the top category's own
  // share of the total, not against 1 — see the legend render below.
  const topShare = breakdown[0] ? breakdown[0].amount / breakdownTotal : 1;

  return (
    <View style={styles.breakdownPage}>
      <CategoryRingChart
        segments={ringSegments}
        trackColor={theme.backgroundElement}
        outlineColor={theme.card}
        selectedKey={selectedKey}
        // Tapping the already-selected segment again clears it, back to the
        // default total view.
        onSelectSegment={(key) => onSelectKey(selectedKey === key ? null : key)}>
        {selectedOther ? (
          <>
            <View style={[styles.otherBadge, { backgroundColor: theme.textTertiary + '26' }]}>
              <MaterialIcons name="more-horiz" size={22} color={theme.textTertiary} />
            </View>
            <ThemedText
              type="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={styles.ringAmount}>
              ${formatAmount(selectedOther.amount)}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              ellipsizeMode="tail"
              style={styles.ringLabel}>
              OTHER
            </ThemedText>
          </>
        ) : selectedCategory ? (
          <>
            <CategoryBadge category={selectedCategory.category!} size={40} />
            <ThemedText
              type="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={styles.ringAmount}>
              ${formatAmount(selectedCategory.amount)}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              ellipsizeMode="tail"
              style={styles.ringLabel}>
              {selectedCategory.category!.name.toUpperCase()}
            </ThemedText>
          </>
        ) : breakdownTotal > 0 ? (
          // Default (nothing selected) view: the period's total for this
          // page's side, not any one category — tap a segment to drill in.
          <>
            <View
              style={[
                styles.otherBadge,
                { backgroundColor: (type === 'expense' ? theme.destructive : theme.success) + '26' },
              ]}>
              <MaterialIcons
                name={type === 'expense' ? 'receipt-long' : 'payments'}
                size={22}
                color={type === 'expense' ? theme.destructive : theme.success}
              />
            </View>
            <ThemedText
              type="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={styles.ringAmount}>
              ${formatAmount(breakdownTotal)}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              ellipsizeMode="tail"
              style={styles.ringLabel}>
              {type === 'expense' ? 'TOTAL EXPENSES' : 'TOTAL INCOME'}
            </ThemedText>
          </>
        ) : (
          <>
            <MaterialIcons name="pie-chart-outline" size={32} color={theme.textTertiary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.ringLabel}>
              {type === 'expense' ? 'No expenses yet' : 'No income yet'}
            </ThemedText>
          </>
        )}
      </CategoryRingChart>

      {breakdown.length > 0 && (
        <View style={styles.legend}>
          {breakdown.slice(0, 6).map((e) => {
            const share = e.amount / breakdownTotal;
            const barShare = share / topShare;
            const isSelected = selectedKey === e.categoryId;
            return (
              <Pressable
                key={e.categoryId}
                onPress={() => onSelectKey(selectedKey === e.categoryId ? null : e.categoryId)}
                style={[styles.legendRow, isSelected && { backgroundColor: theme.accent + '14' }]}>
                <View style={[styles.legendDot, { backgroundColor: e.category!.color }]} />
                <ThemedText type="small" numberOfLines={1} style={styles.legendName}>
                  {e.category!.name}
                </ThemedText>
                <View style={[styles.legendBarTrack, { backgroundColor: theme.backgroundElement }]}>
                  <View
                    style={[
                      styles.legendBarFill,
                      { width: `${Math.max(barShare * 100, 4)}%`, backgroundColor: e.category!.color },
                    ]}
                  />
                </View>
                <ThemedText type="smallBold" style={styles.legendPercent}>
                  {Math.round(share * 100)}%
                </ThemedText>
              </Pressable>
            );
          })}
          {breakdown.length > 6 && (
            <ThemedText type="small" themeColor="textTertiary" style={styles.legendMore}>
              +{breakdown.length - 6} more
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // No 'custom' or 'week' option here (unlike Transactions'/Trends' own
  // range navs) — both removed per feedback; Home's range nav is Month/Year
  // only.
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  // Which page of the Expense/Income breakdown pager is active — drives the
  // segmented toggle, the page dots, and where goToBreakdown scrolls to; the
  // pager itself always keeps both pages mounted (see BreakdownPanel above)
  // so swiping between them actually works.
  const [breakdownType, setBreakdownType] = useState<TransactionType>('expense');
  const [breakdownPanelWidth, setBreakdownPanelWidth] = useState(0);
  // A horizontal ScrollView doesn't size itself to its tallest child the way
  // a vertical one does — each page reports its own measured height via
  // onLayout below, and the pager is given the taller of the two so neither
  // page's content clips.
  const [expensePanelHeight, setExpensePanelHeight] = useState(0);
  const [incomePanelHeight, setIncomePanelHeight] = useState(0);
  const breakdownPagerRef = useRef<ScrollView>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  // Kept separate per side (rather than one shared selection) so switching
  // pages doesn't clear whatever was tapped on the other one.
  const [selectedExpenseKey, setSelectedExpenseKey] = useState<string | null>(null);
  const [selectedIncomeKey, setSelectedIncomeKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getTransactions(), getBudgets(), getCategories(), getRecurring()]).then(([t, b, c, r]) => {
        if (!cancelled) {
          setTransactions(t);
          setBudgets(b);
          setCategories(c);
          setRecurring(r);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const { start, end, label } = rangeBounds(rangeType, anchor, null);
  // The set of tappable categories changes whenever the navigated
  // range/period does — clear both pages' selections rather than let one
  // point at a category with nothing to show now. Adjusted during render
  // (comparing against a tracked previous key) rather than in a
  // useEffect — the recommended React pattern for "reset state when a
  // computed value changes" (avoids an extra render pass, and SDK 57's
  // stricter lint now flags setState-in-effect for this exact shape).
  const rangeKey = `${start}|${end}`;
  const [prevRangeKey, setPrevRangeKey] = useState(rangeKey);
  if (prevRangeKey !== rangeKey) {
    setPrevRangeKey(rangeKey);
    setSelectedExpenseKey(null);
    setSelectedIncomeKey(null);
  }

  function goToBreakdown(next: TransactionType) {
    setBreakdownType(next);
    // animated: true silently no-ops on react-native-web here (same
    // scroll-snap-type/smooth-scroll quirk as Transactions'/Budgets' own
    // pagers) — an instant jump still reads fine for a tab-style toggle.
    breakdownPagerRef.current?.scrollTo({ x: next === 'expense' ? 0 : breakdownPanelWidth, animated: false });
  }

  function onBreakdownPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!breakdownPanelWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / breakdownPanelWidth);
    setBreakdownType(index === 0 ? 'expense' : 'income');
  }

  const totals = rangeTotals(transactions, start, end);
  // .slice() before .sort() — transactionsInRange already returns a fresh
  // array (Array.filter), but sorting it in place still chains a mutating
  // call directly onto that return value. An explicit copy removes any
  // ambiguity about whether this could reach back into the original
  // `transactions` array, for both a static analyzer and a human reader.
  const rangeTransactions = transactionsInRange(transactions, start, end)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = rangeTransactions.slice(0, 8);
  // Budgets are an inherently monthly concept (a flat per-category limit —
  // see lib/budgets.ts), so month mode reads a single month's
  // getBudgetProgress exactly as before; year mode instead sums each
  // budget's effectiveLimit across the navigated year's 12 months (and
  // pulls actuals from that same Jan-Dec range) via budgetProgressForRange
  // above, rather than guessing which single month a whole year should map
  // to. Shows every budgeted category, not just a capped preview — there's
  // no "see all" link elsewhere to reach the rest, so cutting the list short
  // just hid data with no way to get to it.
  const budgetProgress =
    rangeType === 'year'
      ? budgetProgressForRange(budgets, transactions, categories, start, end)
      : getBudgetProgress(budgets, transactions, toMonthStr(anchor), categories);
  // Split into Expense Budgets / Income Goals, same two-group split as the
  // Budgets tab itself (just stacked here instead of paged, since this is
  // one card in Home's existing vertical scroll, not a full screen) — an
  // over-100% expense budget and an at/over-100% income goal mean opposite
  // things (see ProgressBar's own type-flipped semantics), so they're
  // called out with separate pills rather than one combined count.
  const expenseBudgetProgress = budgetProgress.filter((bp) => bp.type === 'expense');
  const incomeBudgetProgress = budgetProgress.filter((bp) => bp.type === 'income');
  const overBudgetCount = expenseBudgetProgress.filter((bp) => bp.percent >= 1).length;
  const goalsReachedCount = incomeBudgetProgress.filter((bp) => bp.percent >= 1).length;
  const netPositive = totals.net >= 0;
  const savingsRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null;
  const rangeNoun = rangeType === 'year' ? 'year' : 'month';

  // Same range-type/length, one period back — shiftAnchor(-1) plus the same
  // rangeBounds resolution the nav itself uses, so a month compares to the
  // previous calendar month, a year to the previous calendar year.
  const previous = rangeBounds(rangeType, shiftAnchor(rangeType, anchor, -1), null);
  const previousTotals = rangeTotals(transactions, previous.start, previous.end);
  const incomeDelta = computeDelta(totals.income, previousTotals.income, 'up');
  const expenseDelta = computeDelta(totals.expense, previousTotals.expense, 'down');
  const netDelta = computeDelta(totals.net, previousTotals.net, 'up');

  // Expense and income are totaled/broken-down independently (a transaction
  // is one or the other, never both) — both sides are computed unconditionally
  // now rather than just whichever the toggle is on, since the pager below
  // keeps both pages mounted for the swipe gesture. No manual useMemo here —
  // React Compiler is enabled project-wide (app.json's experiments.reactCompiler)
  // and auto-memoizes plain expressions like this; a hand-written useMemo
  // wrapper actually fights the compiler's own analysis (it couldn't prove
  // the hand-written deps array stayed in sync with what it infers, so it
  // skipped optimizing the component at all rather than risk it — see
  // react-hooks/preserve-manual-memoization). Removing the wrapper lets the
  // compiler memoize this itself instead of trying to preserve ours.
  const expenseBreakdown = categoryBreakdown(transactions, categories, start, end, 'expense');
  const incomeBreakdown = categoryBreakdown(transactions, categories, start, end, 'income');

  // Small categories collapse into one grey "Other" wedge in the ring
  // itself (groupRingSegments, see category-ring-chart.tsx) — computed here
  // rather than inside the chart so this screen knows exactly what landed
  // in "Other" and can build a matching center callout when it's tapped.
  // No manual useMemo here either — same reasoning as expenseBreakdown/
  // incomeBreakdown above, and these depend on those, so a hand-written memo
  // boundary here couldn't be preserved regardless once that one was removed.
  const expenseRingSegments = groupRingSegments(
    expenseBreakdown.map((e) => ({ key: e.categoryId, amount: e.amount, color: e.category!.color })),
    { otherColor: theme.textTertiary }
  );
  const incomeRingSegments = groupRingSegments(
    incomeBreakdown.map((e) => ({ key: e.categoryId, amount: e.amount, color: e.category!.color })),
    { otherColor: theme.textTertiary }
  );
  const breakdownPanelHeight = Math.max(expensePanelHeight, incomePanelHeight) || undefined;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Pinned above the ScrollView (not inside it) so the title and month
          nav stay visible while scrolling the dashboard/budgets/recent list
          below — same treatment as Transactions' own header. Its own
          `paddingBottom` (2026-09-18) is load-bearing, not decorative: the
          ScrollView's matching `paddingTop` only creates a gap for the very
          first scroll position, since that padding scrolls away with the
          rest of the content — without a gap baked into this pinned block
          itself, scrolling even slightly left the dashboard card butted
          right up against the toggle with no space at all. */}
      <View style={{ paddingTop: insets.top + Spacing.three, paddingBottom: Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Home" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable
              hitSlop={12}
              onPress={() => setAnchor((a) => shiftAnchor(rangeType, a, -1))}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {label}
              </ThemedText>
            </Pressable>
            <Pressable
              hitSlop={12}
              onPress={() => setAnchor((a) => shiftAnchor(rangeType, a, 1))}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
            </Pressable>
          </View>

          <SegmentedControl
            options={[
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
            value={rangeType}
            onChange={setRangeType}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
        ]}>
        <View style={[styles.dashboardCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Governs the ring + legend below it only — the income/expense/net
              row further down always shows both sides regardless of this.
              Fills destructive-red/success-green on selection (same
              convention as add-transaction.tsx's own type toggle) rather
              than a flat accent color, so the panel's color — not just its
              label — says which side is showing. */}
          <SegmentedControl
            options={[
              { value: 'expense', label: 'Expenses', color: theme.destructive },
              { value: 'income', label: 'Income', color: theme.success },
            ]}
            value={breakdownType}
            onChange={goToBreakdown}
            style={styles.breakdownToggle}
          />

          {/* Page dots — same 6px/16px-active shape as Budgets'/Transactions'
              own swipe-page indicators, tinted to match each page's segment
              color. */}
          <View style={styles.pageDots}>
            <View
              style={[
                styles.pageDot,
                { backgroundColor: theme.border },
                breakdownType === 'expense' && [styles.pageDotActive, { backgroundColor: theme.destructive }],
              ]}
            />
            <View
              style={[
                styles.pageDot,
                { backgroundColor: theme.border },
                breakdownType === 'income' && [styles.pageDotActive, { backgroundColor: theme.success }],
              ]}
            />
          </View>

          {/* The ring+legend panel is a horizontal pagingEnabled pager, same
              swipe-or-tap-the-toggle pattern as Budgets' Expense/Income
              pages and Transactions' List/Calendar — except this one is
              nested inside a padded, max-width-capped card rather than
              filling the screen, so its page width comes from measuring
              this wrapper's own layout instead of useWindowDimensions. */}
          <View
            style={styles.breakdownPanelWrap}
            onLayout={(e) => setBreakdownPanelWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={breakdownPagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onBreakdownPagerScrollEnd}
              style={{ height: breakdownPanelHeight }}>
              <View
                style={{ width: breakdownPanelWidth }}
                onLayout={(e) => setExpensePanelHeight(e.nativeEvent.layout.height)}>
                <BreakdownPanel
                  type="expense"
                  breakdown={expenseBreakdown}
                  breakdownTotal={totals.expense}
                  ringSegments={expenseRingSegments}
                  selectedKey={selectedExpenseKey}
                  onSelectKey={setSelectedExpenseKey}
                />
              </View>
              <View
                style={{ width: breakdownPanelWidth }}
                onLayout={(e) => setIncomePanelHeight(e.nativeEvent.layout.height)}>
                <BreakdownPanel
                  type="income"
                  breakdown={incomeBreakdown}
                  breakdownTotal={totals.income}
                  ringSegments={incomeRingSegments}
                  selectedKey={selectedIncomeKey}
                  onSelectKey={setSelectedIncomeKey}
                />
              </View>
            </ScrollView>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <View style={styles.summaryLabelRow}>
                <MaterialIcons name="arrow-upward" size={12} color={theme.success} />
                <ThemedText type="small" themeColor="textSecondary">
                  Income
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="success">
                ${formatAmount(totals.income)}
              </ThemedText>
              <DeltaLabel delta={incomeDelta} />
            </View>
            <View style={styles.summaryColumn}>
              <View style={styles.summaryLabelRow}>
                <MaterialIcons name="arrow-downward" size={12} color={theme.destructive} />
                <ThemedText type="small" themeColor="textSecondary">
                  Expenses
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="destructive">
                ${formatAmount(totals.expense)}
              </ThemedText>
              <DeltaLabel delta={expenseDelta} />
            </View>
            <View style={styles.summaryColumn}>
              <ThemedText type="small" themeColor="textSecondary">
                Net
              </ThemedText>
              <ThemedText type="smallBold" themeColor={netPositive ? 'success' : 'destructive'}>
                ${formatAmount(totals.net)}
              </ThemedText>
              <DeltaLabel delta={netDelta} />
            </View>
          </View>

          {savingsRate !== null && (
            <View style={[styles.savingsRow, { backgroundColor: theme.backgroundElement }]}>
              <MaterialIcons name="savings" size={14} color={savingsRate >= 0 ? theme.success : theme.destructive} />
              <ThemedText type="small" themeColor="textSecondary">
                {savingsRate >= 0
                  ? `You saved ${savingsRate}% of your income`
                  : `You spent ${Math.abs(savingsRate)}% more than you earned`}
              </ThemedText>
            </View>
          )}
        </View>

        {expenseBudgetProgress.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                EXPENSE BUDGETS
              </ThemedText>
              {overBudgetCount > 0 && (
                <View style={[styles.overBudgetPill, { backgroundColor: theme.destructive + '1a' }]}>
                  <MaterialIcons name="error-outline" size={12} color={theme.destructive} />
                  <ThemedText type="small" themeColor="destructive" style={styles.overBudgetPillText}>
                    {overBudgetCount} over budget
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {expenseBudgetProgress.map((bp, i) => {
                const category = getCategory(categories, bp.categoryId);
                if (!category) return null;
                return (
                  <View key={bp.categoryId}>
                    <View style={styles.budgetRow}>
                      <View style={styles.budgetHeader}>
                        <ThemedText type="small">{category.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          ${formatAmount(bp.spent)} / ${formatAmount(bp.limit)}
                        </ThemedText>
                      </View>
                      <ProgressBar percent={bp.percent} color={category.color} type={bp.type} />
                    </View>
                    {i < expenseBudgetProgress.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {incomeBudgetProgress.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                INCOME GOALS
              </ThemedText>
              {goalsReachedCount > 0 && (
                <View style={[styles.overBudgetPill, { backgroundColor: theme.success + '1a' }]}>
                  <MaterialIcons name="check-circle-outline" size={12} color={theme.success} />
                  <ThemedText type="small" themeColor="success" style={styles.overBudgetPillText}>
                    {goalsReachedCount} {goalsReachedCount === 1 ? 'goal' : 'goals'} reached
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {incomeBudgetProgress.map((bp, i) => {
                const category = getCategory(categories, bp.categoryId);
                if (!category) return null;
                return (
                  <View key={bp.categoryId}>
                    <View style={styles.budgetRow}>
                      <View style={styles.budgetHeader}>
                        <ThemedText type="small">{category.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          ${formatAmount(bp.spent)} / ${formatAmount(bp.limit)}
                        </ThemedText>
                      </View>
                      <ProgressBar percent={bp.percent} color={category.color} type={bp.type} />
                    </View>
                    {i < incomeBudgetProgress.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
            RECENT TRANSACTIONS
          </ThemedText>
          {recent.length === 0 ? (
            <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MaterialIcons name="receipt-long" size={28} color={theme.textTertiary} />
              <ThemedText type="small" themeColor="textSecondary">
                No transactions yet this {rangeNoun}.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {recent.map((t, i) => (
                <View key={t.id}>
                  <TransactionRow
                    transaction={t}
                    category={getCategory(categories, t.categoryId)}
                    isRecurring={isActiveRecurring(t.recurringId, recurring)}
                    onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                    showDate
                  />
                  {i < recent.length - 1 && (
                    <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/add-transaction')}
        style={[
          styles.fab,
          { backgroundColor: theme.accent, bottom: insets.bottom + BottomTabInset + Spacing.three },
        ]}>
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* customRange is always null and onSelectCustomDay is a no-op here —
          rangeType never reaches 'custom' on this screen (see the rangeType
          state above), so the modal's custom-day-picker branch never
          renders; both props are still required since the modal is shared
          with Transactions'/Trends' own custom-capable range navs. */}
      <RangePickerModal
        visible={pickerVisible}
        rangeType={rangeType}
        anchor={anchor}
        customRange={null}
        onSelect={(date) => {
          setAnchor(date);
          setPickerVisible(false);
        }}
        onSelectCustomDay={() => {}}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  monthLabel: {
    minWidth: 132,
    textAlign: 'center',
  },
  // Narrower than the month/year toggle above the fold — just the
  // Expenses/Income pair, so the full 280 maxWidth reads as oversized.
  breakdownToggle: {
    maxWidth: 200,
  },
  // Same shape as Budgets'/Transactions' own swipe-page dots.
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pageDotActive: {
    width: 16,
  },
  // Stretches to the dashboard card's full content width so onLayout below
  // measures the actual page width — dashboardCard's alignItems: 'center'
  // would otherwise shrink-wrap this to its content instead.
  breakdownPanelWrap: {
    width: '100%',
  },
  // Direct child of a width-constrained page View (see breakdownPanelWrap's
  // pager above) rather than of dashboardCard now, so it supplies its own
  // gap/centering that dashboardCard's own gap used to give the ring chart
  // and legend when they were its direct children.
  breakdownPage: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dashboardCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  // maxWidth bounds this the same way ringLabel below is bounded — without
  // it, a large total (e.g. a full year's income, "$101,062.96") had
  // nothing to shrink against and could overflow past the ring's own safe
  // interior instead of shrinking to fit inside it (paired with
  // numberOfLines/adjustsFontSizeToFit on the Text itself, added alongside).
  ringAmount: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 8,
    maxWidth: 132,
  },
  // maxWidth bounds the center label so numberOfLines/adjustsFontSizeToFit
  // above have something to shrink or ellipsize against — a long category
  // name shrinks its font first (down to minimumFontScale) and only
  // truncates with "…" past that, rather than overflowing the ring.
  ringLabel: {
    letterSpacing: 0.6,
    fontSize: 11,
    maxWidth: 132,
    textAlign: 'center',
  },
  // Same tinted-circle look as CategoryBadge, sized to match its size={40}
  // — used for the "Other" and "total expenses" callouts, neither of which
  // has a real Category to badge.
  otherBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    width: '100%',
    gap: 2,
  },
  // A single-column list rather than the old 2-column wrap — each row gets a
  // proportional mini bar (see legendBarTrack/Fill below) so relative spend
  // reads at a glance instead of purely off the numbers, and is tappable to
  // drive the same selection as tapping the ring segment itself.
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: 7,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
  },
  legendBarTrack: {
    width: 56,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  legendBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  legendPercent: {
    width: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  legendMore: {
    paddingHorizontal: Spacing.two,
    paddingTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    width: '100%',
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deltaLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  // Cancels sectionTitle's own paddingHorizontal — the row above already
  // supplies it, and applying both would double it up on the left edge.
  sectionTitleInRow: {
    paddingHorizontal: 0,
  },
  overBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.four,
  },
  overBudgetPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  group: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyGroup: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  rowDividerInset: {
    marginLeft: 42 + Spacing.three * 2,
    marginHorizontal: 0,
  },
  budgetRow: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    gap: 6,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0,
    shadowRadius: 4,
    elevation: 4,
  },
});
