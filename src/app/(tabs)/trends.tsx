import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CumulativeTrendChart, type TrendPoint } from '@/components/cumulative-trend-chart';
import { RangePickerModal } from '@/components/range-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { effectiveLimit, getBudgets, type Budget } from '@/lib/budgets';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import {
  daysBetween,
  monthsBetween,
  rangeBounds,
  shiftAnchor,
  shiftCustomRange,
  toDateStr,
  type CustomRange,
  type RangeType,
} from '@/lib/date-range';
import { getTransactions, transactionsInRange, type Transaction, type TransactionType } from '@/lib/transactions';

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Net's actual/budget totals can go negative (unlike Expense/Income, which
// never do) — plain `$${formatAmount(amount)}` would render a negative as
// "$-2,838.91" (toLocaleString puts the minus after the digits start), so
// the sign needs to move in front of the dollar sign instead.
function formatSigned(amount: number) {
  return `${amount < 0 ? '-' : ''}$${formatAmount(Math.abs(amount))}`;
}

function shortDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type ViewType = 'expense' | 'income' | 'net';

// Sums each budget/goal category's effectiveLimit across every month the
// range touches (lib/date-range's monthsBetween — a month a custom range
// only partly overlaps still counts in full, not prorated; a v1
// simplification, documented in CLAUDE.md). Only categories with a
// budget/goal actually set contribute — an unset category's actual
// spend/income still shows in the cumulative line, it just doesn't move
// this total, per the "only budgeted categories count" scoping decision.
function budgetTotalForRange(
  budgets: Budget[],
  categories: Category[],
  type: TransactionType,
  start: string,
  end: string
): number {
  const relevant = budgets.filter((b) => (getCategory(categories, b.categoryId)?.type ?? 'expense') === type);
  if (relevant.length === 0) return 0;
  let total = 0;
  for (const month of monthsBetween(start, end)) {
    for (const b of relevant) total += effectiveLimit(b, month);
  }
  return total;
}

// A running daily total of `type`'s transactions across [start, end] — every
// day in the range gets a point (a day with no transactions just carries the
// previous running total forward) so the line is continuous regardless of
// how sparse the data is.
function cumulativePoints(transactions: Transaction[], type: TransactionType, start: string, end: string): TrendPoint[] {
  const inRange = transactionsInRange(transactions, start, end).filter((t) => t.type === type);
  const byDay = new Map<string, number>();
  for (const t of inRange) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  let running = 0;
  return daysBetween(start, end).map((date) => {
    running += byDay.get(date) ?? 0;
    return { date, actual: running };
  });
}

// One page of the Expense/Income/Net pager below — the chart plus its own
// actual-vs-budget summary row above it. All three are mounted at once (same
// "pager needs every page already in the DOM for a swipe to reveal it"
// reasoning as Home's own BreakdownPanel), each reporting its own measured
// height via onLayout so the pager can take the tallest of the three.
function TrendPanel({
  label,
  points,
  totalDays,
  rangeStart,
  rangeEnd,
  budgetTotal,
  paced,
  lineColor,
  positiveIsGood,
  width,
  onLayout,
}: {
  label: string;
  points: TrendPoint[];
  totalDays: number;
  rangeStart: string;
  rangeEnd: string;
  budgetTotal: number | null;
  paced: boolean;
  lineColor: string;
  positiveIsGood: boolean;
  width: number;
  onLayout: (height: number) => void;
}) {
  const theme = useTheme();
  const actualTotal = points[points.length - 1]?.actual ?? 0;
  const diff = budgetTotal !== null ? actualTotal - budgetTotal : null;
  // For expenses, under budget (diff < 0) is the good outcome; for income
  // and net, at/over the target (diff >= 0) is — positiveIsGood flips which
  // sign of diff reads as success vs destructive.
  const diffIsGood = diff !== null && (positiveIsGood ? diff >= 0 : diff <= 0);

  return (
    <View style={styles.panel} onLayout={(e) => onLayout(e.nativeEvent.layout.height)}>
      <View style={styles.panelSummaryRow}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            {label} actual
          </ThemedText>
          <ThemedText style={[styles.panelTotal, { color: lineColor }]}>{formatSigned(actualTotal)}</ThemedText>
        </View>
        {budgetTotal !== null && (
          <View style={styles.panelBudgetColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Budgeted
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {formatSigned(budgetTotal)}
            </ThemedText>
            {diff !== null && diff !== 0 && (
              <View style={[styles.diffPill, { backgroundColor: (diffIsGood ? theme.success : theme.destructive) + '1a' }]}>
                <ThemedText type="small" themeColor={diffIsGood ? 'success' : 'destructive'} style={styles.diffPillText}>
                  {diff >= 0 ? '+' : '−'}${formatAmount(Math.abs(diff))}
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </View>

      <CumulativeTrendChart
        points={points}
        totalDays={totalDays}
        budgetTotal={budgetTotal}
        paced={paced}
        positiveIsGood={positiveIsGood}
        width={width}
        height={180}
        lineColor={lineColor}
        formatValue={formatSigned}
        formatDate={shortDateLabel}
      />
      {totalDays > 0 && (
        <View style={styles.axisLabelRow}>
          <ThemedText type="small" themeColor="textTertiary">
            {shortDateLabel(rangeStart)}
          </ThemedText>
          <ThemedText type="small" themeColor="textTertiary">
            {shortDateLabel(rangeEnd)}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

export default function TrendsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // No Week option here — a 7-day cumulative budget-vs-actual chart is less
  // meaningful than a month or year one, so Trends only offers Month/Year/
  // Custom (the shared RangePickerModal itself supports all four; this
  // screen's own segmented control just never renders a Week pill).
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('expense');
  const [panelWidth, setPanelWidth] = useState(0);
  // A horizontal ScrollView doesn't size itself to its tallest child — each
  // page reports its own measured height and the pager takes the max of the
  // three, same pattern as Home's breakdownPanelHeight.
  const [expenseHeight, setExpenseHeight] = useState(0);
  const [incomeHeight, setIncomeHeight] = useState(0);
  const [netHeight, setNetHeight] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

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
  // The cumulative *actual* line only ever has real data through today —
  // for the navigated period's current/future days (e.g. viewing this
  // month, or a year still in progress) there's nothing to plot yet, so the
  // line stops at today rather than running out flat to the period's real
  // end. The budget/goal reference line is unaffected — it's still totaled
  // against the period's full nominal range (see budgetTotalForRange calls
  // below), which is the point: actual-to-date against the whole period's
  // target, so pacing ahead or behind is visible. A period entirely in the
  // future (start > today) naturally yields an empty points array here
  // (daysBetween(start, end) with start past end just returns []), which
  // CumulativeTrendChart already renders as a blank chart.
  const todayStr = toDateStr(new Date());
  const actualEnd = end > todayStr ? todayStr : end;
  // The full nominal period's day count — shared x-axis domain for both the
  // actual line (which stops at actualEnd) and the diagonal budget-pace
  // line (which always runs the whole way to `end`), so a still-in-progress
  // period visibly shows the actual line covering only its elapsed fraction
  // of the chart width. See CumulativeTrendChart's own comment.
  const totalDays = useMemo(() => daysBetween(start, end).length, [start, end]);

  // Closes the picker the instant a custom range is completed (its second
  // tap sets `end`) — reference-equal no-op the rest of the time, so
  // reopening the modal to edit an already-complete range doesn't re-fire
  // this and immediately close it again. Same pattern as Home/Transactions.
  useEffect(() => {
    if (customRange?.end) setPickerVisible(false);
  }, [customRange]);

  const expensePoints = useMemo(
    () => cumulativePoints(transactions, 'expense', start, actualEnd),
    [transactions, start, actualEnd]
  );
  const incomePoints = useMemo(
    () => cumulativePoints(transactions, 'income', start, actualEnd),
    [transactions, start, actualEnd]
  );
  // Net is derived from the other two rather than its own transaction scan —
  // both arrays share the same day list (daysBetween(start, end)) so they
  // line up index-for-index.
  const netPoints = useMemo(
    () => expensePoints.map((p, i) => ({ date: p.date, actual: (incomePoints[i]?.actual ?? 0) - p.actual })),
    [expensePoints, incomePoints]
  );

  const expenseBudgetTotal = useMemo(
    () => budgetTotalForRange(budgets, categories, 'expense', start, end),
    [budgets, categories, start, end]
  );
  const incomeBudgetTotal = useMemo(
    () => budgetTotalForRange(budgets, categories, 'income', start, end),
    [budgets, categories, start, end]
  );
  // A "target net" only makes sense once at least one side has a budget/goal
  // set — with neither set there's nothing to compare net against.
  const hasAnyBudget = expenseBudgetTotal > 0 || incomeBudgetTotal > 0;
  const netBudgetTotal = hasAnyBudget ? incomeBudgetTotal - expenseBudgetTotal : null;

  function goToView(next: ViewType) {
    setViewType(next);
    const index = next === 'expense' ? 0 : next === 'income' ? 1 : 2;
    // animated: true silently no-ops on react-native-web here (same
    // scroll-snap-type/smooth-scroll quirk as Home's/Budgets'/Transactions'
    // own pagers) — an instant jump still reads fine for a tab-style toggle.
    pagerRef.current?.scrollTo({ x: index * panelWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!panelWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / panelWidth);
    setViewType(index === 0 ? 'expense' : index === 1 ? 'income' : 'net');
  }

  const panelHeight = Math.max(expenseHeight, incomeHeight, netHeight) || undefined;
  const bottomPadding = insets.bottom + BottomTabInset + Spacing.six;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingTop: insets.top + Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Trends" right={<SettingsButton />} />

          <View style={styles.rangeNav}>
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
              <ThemedText type="smallBold" style={styles.rangeLabel}>
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

          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['month', 'year', 'custom'] as const).map((rt) => {
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
                    {rt === 'month' ? 'Month' : rt === 'year' ? 'Year' : 'Custom'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['expense', 'income', 'net'] as const).map((vt) => {
              const isSelected = viewType === vt;
              const activeColor = vt === 'expense' ? theme.destructive : vt === 'income' ? theme.success : theme.accent;
              return (
                <Pressable
                  key={vt}
                  onPress={() => goToView(vt)}
                  style={[styles.segment, isSelected && { backgroundColor: activeColor }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {vt === 'expense' ? 'Expenses' : vt === 'income' ? 'Income' : 'Net'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Page dots — same 6px/16px-active shape as every other tab's own
              swipe-page indicator, tinted to match each page's segment
              color. */}
          <View style={styles.pageDots}>
            {(['expense', 'income', 'net'] as const).map((vt) => {
              const activeColor = vt === 'expense' ? theme.destructive : vt === 'income' ? theme.success : theme.accent;
              return (
                <View
                  key={vt}
                  style={[
                    styles.pageDot,
                    { backgroundColor: theme.border },
                    viewType === vt && [styles.pageDotActive, { backgroundColor: activeColor }],
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: bottomPadding }]}>
        <View style={[styles.card, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.pagerWrap} onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPagerScrollEnd}
              style={{ height: panelHeight }}>
              <View style={{ width: panelWidth }}>
                <TrendPanel
                  label="Expenses"
                  points={expensePoints}
                  totalDays={totalDays}
                  rangeStart={start}
                  rangeEnd={end}
                  budgetTotal={expenseBudgetTotal > 0 ? expenseBudgetTotal : null}
                  paced
                  lineColor={theme.destructive}
                  positiveIsGood={false}
                  width={panelWidth}
                  onLayout={setExpenseHeight}
                />
              </View>
              <View style={{ width: panelWidth }}>
                <TrendPanel
                  label="Income"
                  points={incomePoints}
                  totalDays={totalDays}
                  rangeStart={start}
                  rangeEnd={end}
                  budgetTotal={incomeBudgetTotal > 0 ? incomeBudgetTotal : null}
                  paced={false}
                  lineColor={theme.success}
                  positiveIsGood={true}
                  width={panelWidth}
                  onLayout={setIncomeHeight}
                />
              </View>
              <View style={{ width: panelWidth }}>
                <TrendPanel
                  label="Net"
                  points={netPoints}
                  totalDays={totalDays}
                  rangeStart={start}
                  rangeEnd={end}
                  budgetTotal={netBudgetTotal}
                  paced={false}
                  lineColor={theme.accent}
                  positiveIsGood={true}
                  width={panelWidth}
                  onLayout={setNetHeight}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </ScrollView>

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
  rangeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  rangeLabel: {
    minWidth: 132,
    textAlign: 'center',
  },
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
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
  },
  pagerWrap: {
    width: '100%',
  },
  panel: {
    width: '100%',
    gap: Spacing.three,
  },
  panelSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  panelTotal: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  panelBudgetColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  diffPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.four,
    marginTop: 2,
  },
  diffPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  axisLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
});
