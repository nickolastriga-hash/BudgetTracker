import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { CategoryRingChart, groupRingSegments, RING_OTHER_KEY } from '@/components/category-ring-chart';
import { ProgressBar } from '@/components/progress-bar';
import { RangePickerModal } from '@/components/range-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, type Budget, getBudgets } from '@/lib/budgets';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import {
  rangeBounds,
  shiftAnchor,
  shiftCustomRange,
  toMonthStr,
  type CustomRange,
  type RangeType,
} from '@/lib/date-range';
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
// (previous week/month/year, per whatever shiftAnchor(-1) resolves to).
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
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
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
  const [pickerVisible, setPickerVisible] = useState(false);
  // Kept separate per side (rather than one shared selection) so switching
  // pages doesn't clear whatever was tapped on the other one.
  const [selectedExpenseKey, setSelectedExpenseKey] = useState<string | null>(null);
  const [selectedIncomeKey, setSelectedIncomeKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getTransactions(), getBudgets(), getCategories()]).then(([t, b, c]) => {
        if (!cancelled) {
          setTransactions(t);
          setBudgets(b);
          setCategories(c);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const { start, end, label } = rangeBounds(rangeType, anchor, customRange);
  // The set of tappable categories changes whenever the navigated
  // range/period does — clear both pages' selections rather than let one
  // point at a category with nothing to show now.
  useEffect(() => {
    setSelectedExpenseKey(null);
    setSelectedIncomeKey(null);
  }, [start, end]);

  // Closes the picker the instant a custom range is completed (its second
  // tap sets `end`) — reference-equal no-op the rest of the time, so
  // reopening the modal to edit an already-complete range doesn't re-fire
  // this and immediately close it again.
  useEffect(() => {
    if (customRange?.end) setPickerVisible(false);
  }, [customRange]);

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
  const rangeTransactions = transactionsInRange(transactions, start, end).sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = rangeTransactions.slice(0, 8);
  // Budgets are an inherently monthly concept (a flat per-category limit —
  // see lib/budgets.ts), so the preview below doesn't follow the week/year
  // range selector the way the rest of this card does: in month mode it
  // still follows the navigated month exactly as before, and in week/year
  // mode it falls back to the real current month rather than guessing which
  // month a whole year (or a week straddling two months) should map to.
  const budgetProgressMonth = rangeType === 'month' ? toMonthStr(anchor) : toMonthStr(new Date());
  // Computed unsliced so the "over budget" count below can see every budget,
  // not just the 3 shown in the preview list further down.
  const allBudgetProgress = getBudgetProgress(budgets, transactions, budgetProgressMonth, categories);
  const budgetProgress = allBudgetProgress.slice(0, 3);
  // Only expense budgets count as "at risk" — an income budget at/over its
  // goal is the goal being reached, not a problem (see ProgressBar's own
  // type-flipped semantics).
  const overBudgetCount = allBudgetProgress.filter((bp) => bp.type === 'expense' && bp.percent >= 1).length;
  const netPositive = totals.net >= 0;
  const savingsRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null;
  const rangeNoun =
    rangeType === 'week' ? 'week' : rangeType === 'year' ? 'year' : rangeType === 'custom' ? 'range' : 'month';

  // Same range-type/length, one period back — shiftAnchor(-1) plus the same
  // rangeBounds resolution the nav itself uses, so a week compares to the
  // previous 7 days, a month to the previous calendar month, a year to the
  // previous calendar year. Custom mode needs a complete range before there's
  // anything to shift, so `previous` is null (no comparison shown) until one
  // is picked, then shiftCustomRange steps back by the range's own length.
  const previous =
    rangeType === 'custom'
      ? customRange?.end
        ? rangeBounds('custom', anchor, shiftCustomRange(customRange, -1))
        : null
      : rangeBounds(rangeType, shiftAnchor(rangeType, anchor, -1), null);
  const previousTotals = previous ? rangeTotals(transactions, previous.start, previous.end) : { income: 0, expense: 0, net: 0 };
  const incomeDelta = previous ? computeDelta(totals.income, previousTotals.income, 'up') : null;
  const expenseDelta = previous ? computeDelta(totals.expense, previousTotals.expense, 'down') : null;
  const netDelta = previous ? computeDelta(totals.net, previousTotals.net, 'up') : null;

  // Expense and income are totaled/broken-down independently (a transaction
  // is one or the other, never both) — both sides are computed unconditionally
  // now rather than just whichever the toggle is on, since the pager below
  // keeps both pages mounted for the swipe gesture.
  const expenseBreakdown = useMemo(
    () => categoryBreakdown(transactions, categories, start, end, 'expense'),
    [transactions, categories, start, end]
  );
  const incomeBreakdown = useMemo(
    () => categoryBreakdown(transactions, categories, start, end, 'income'),
    [transactions, categories, start, end]
  );

  // Small categories collapse into one grey "Other" wedge in the ring
  // itself (groupRingSegments, see category-ring-chart.tsx) — computed here
  // rather than inside the chart so this screen knows exactly what landed
  // in "Other" and can build a matching center callout when it's tapped.
  const expenseRingSegments = useMemo(
    () =>
      groupRingSegments(
        expenseBreakdown.map((e) => ({ key: e.categoryId, amount: e.amount, color: e.category!.color })),
        { otherColor: theme.textTertiary }
      ),
    [expenseBreakdown, theme.textTertiary]
  );
  const incomeRingSegments = useMemo(
    () =>
      groupRingSegments(
        incomeBreakdown.map((e) => ({ key: e.categoryId, amount: e.amount, color: e.category!.color })),
        { otherColor: theme.textTertiary }
      ),
    [incomeBreakdown, theme.textTertiary]
  );
  const breakdownPanelHeight = Math.max(expensePanelHeight, incomePanelHeight) || undefined;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Pinned above the ScrollView (not inside it) so the title and month
          nav stay visible while scrolling the dashboard/budgets/recent list
          below — same treatment as Transactions' own header. */}
      <View style={{ paddingTop: insets.top + Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Home" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable
              hitSlop={12}
              onPress={() => {
                if (rangeType === 'custom') {
                  setCustomRange((r) => (r && r.end ? shiftCustomRange(r, -1) : r));
                } else {
                  setAnchor((a) => shiftAnchor(rangeType, a, -1));
                }
              }}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {label}
              </ThemedText>
            </Pressable>
            <Pressable
              hitSlop={12}
              onPress={() => {
                if (rangeType === 'custom') {
                  setCustomRange((r) => (r && r.end ? shiftCustomRange(r, 1) : r));
                } else {
                  setAnchor((a) => shiftAnchor(rangeType, a, 1));
                }
              }}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
            </Pressable>
          </View>

          <View style={[styles.segmented, styles.rangeToggle, { borderColor: theme.border }]}>
            {(['week', 'month', 'year', 'custom'] as const).map((rt) => {
              const isSelected = rangeType === rt;
              return (
                <Pressable
                  key={rt}
                  onPress={() => {
                    setRangeType(rt);
                    if (rt === 'custom' && !customRange) setPickerVisible(true);
                  }}
                  style={[styles.segment, isSelected && { backgroundColor: theme.accent }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {rt === 'week' ? 'Week' : rt === 'month' ? 'Month' : rt === 'year' ? 'Year' : 'Custom'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
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
          <View style={[styles.segmented, styles.breakdownToggle, { borderColor: theme.border }]}>
            {(['expense', 'income'] as const).map((bt) => {
              const isSelected = breakdownType === bt;
              const activeColor = bt === 'expense' ? theme.destructive : theme.success;
              return (
                <Pressable
                  key={bt}
                  onPress={() => goToBreakdown(bt)}
                  style={[styles.segment, isSelected && { backgroundColor: activeColor }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {bt === 'expense' ? 'Expenses' : 'Income'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

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

        {budgetProgress.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                BUDGETS
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
              {budgetProgress.map((bp, i) => {
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
                    {i < budgetProgress.length - 1 && (
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
                    onPress={() => router.push(`/add-transaction?id=${t.id}`)}
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

      <RangePickerModal
        visible={pickerVisible}
        rangeType={rangeType}
        anchor={anchor}
        customRange={customRange}
        onSelect={(date) => {
          setAnchor(date);
          setPickerVisible(false);
        }}
        onSelectCustomDay={(dateStr) => {
          setCustomRange((r) => {
            if (!r || r.end !== null) return { start: dateStr, end: null };
            return dateStr >= r.start ? { start: r.start, end: dateStr } : { start: dateStr, end: r.start };
          });
        }}
        onClose={() => {
          setPickerVisible(false);
          // Abandoning a pending pick (start tapped, no end yet) clears it
          // rather than leaving the range stuck showing "Select end date".
          setCustomRange((r) => (r && r.end === null ? null : r));
        }}
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
  // Wider than the plain segmented cap below — this toggle has a 4th
  // ("Custom") option the Expense/Income toggle further down doesn't.
  rangeToggle: {
    maxWidth: 320,
  },
  // Same shape as Transactions' own List/Calendar toggle.
  segmented: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
    width: '100%',
    maxWidth: 280,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.two - 2,
    borderRadius: Spacing.two - 2,
    alignItems: 'center',
  },
  // Narrower than the 3-way week/month/year toggle above the fold — just
  // the two options, so the full 280 maxWidth reads as oversized.
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
