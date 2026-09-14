import { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

import { CumulativeTrendChart, type TrendPoint } from '@/components/cumulative-trend-chart';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { effectiveLimit, type Budget } from '@/lib/budgets';
import { getCategory, type Category } from '@/lib/categories';
import { daysBetween, monthsBetween, toDateStr } from '@/lib/date-range';
import { transactionsInRange, type Transaction, type TransactionType } from '@/lib/transactions';


// Net's actual/budget totals can go negative (unlike Expense/Income, which
// never do) — plain `${format(amount)}` would render a negative as
// "$-2,838.91" (toLocaleString puts the minus after the digits start), so
// the sign needs to move in front of the dollar sign instead.

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
  lineColor,
  positiveIsGood,
  width,
  onLayout,
  onScrubStart,
  onScrubEnd,
}: {
  label: string;
  points: TrendPoint[];
  totalDays: number;
  rangeStart: string;
  rangeEnd: string;
  budgetTotal: number | null;
  lineColor: string;
  positiveIsGood: boolean;
  width: number;
  onLayout: (height: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
}) {
  const theme = useTheme();
  const { format } = useCurrency();
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
          <ThemedText style={[styles.panelTotal, { color: lineColor }]}>{format(actualTotal)}</ThemedText>
        </View>
        {budgetTotal !== null && (
          <View style={styles.panelBudgetColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Budgeted
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {format(budgetTotal)}
            </ThemedText>
            {diff !== null && diff !== 0 && (
              <View style={[styles.diffPill, { backgroundColor: (diffIsGood ? theme.success : theme.destructive) + '1a' }]}>
                <ThemedText type="small" themeColor={diffIsGood ? 'success' : 'destructive'} style={styles.diffPillText}>
                  {diff >= 0 ? '+' : '−'}{format(Math.abs(diff))}
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
        positiveIsGood={positiveIsGood}
        width={width}
        height={180}
        lineColor={lineColor}
        formatValue={format}
        formatDate={shortDateLabel}
        onScrubStart={onScrubStart}
        onScrubEnd={onScrubEnd}
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

// The cumulative actual-vs-budget card that was the whole Trends tab until
// 2026-09-13, when that tab slot went to Wealth (NativeTabs caps Android at
// 5 tabs and iOS overflows a 6th into "More") — now one card on Home,
// driven by Home's own Month/Year range instead of its own nav. Everything
// below the old tab's range nav moved here as-is: the Expense/Income/Net
// toggle + dots, the three-page pager, and TrendPanel. `onScrubbingChange`
// lets Home disable its outer vertical ScrollView for the drag, the same
// way this card disables its own horizontal pager (see CumulativeTrendChart
// for why claiming the JS responder alone isn't enough).
export function TrendsCard({
  transactions,
  budgets,
  categories,
  start,
  end,
  onScrubbingChange,
}: {
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  start: string;
  end: string;
  onScrubbingChange: (scrubbing: boolean) => void;
}) {
  const theme = useTheme();
  const [viewType, setViewType] = useState<ViewType>('expense');
  const [panelWidth, setPanelWidth] = useState(0);
  const [expenseHeight, setExpenseHeight] = useState(0);
  const [incomeHeight, setIncomeHeight] = useState(0);
  const [netHeight, setNetHeight] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const pagerRef = useRef<ScrollView>(null);

  // The cumulative *actual* line only ever has real data through today —
  // for the navigated period's current/future days there's nothing to plot
  // yet, so the line stops at today rather than running out flat to the
  // period's real end. The budget/goal reference line is unaffected — it's
  // still totaled against the period's full nominal range, which is the
  // point: actual-to-date against the whole period's target. A period
  // entirely in the future yields an empty points array (daysBetween with
  // start past end returns []), which CumulativeTrendChart renders blank.
  const todayStr = toDateStr(new Date());
  const actualEnd = end > todayStr ? todayStr : end;
  const totalDays = daysBetween(start, end).length;

  const expensePoints = cumulativePoints(transactions, 'expense', start, actualEnd);
  const incomePoints = cumulativePoints(transactions, 'income', start, actualEnd);
  // Net is derived from the other two rather than its own transaction scan —
  // both arrays share the same day list so they line up index-for-index.
  const netPoints = expensePoints.map((p, i) => ({ date: p.date, actual: (incomePoints[i]?.actual ?? 0) - p.actual }));

  const expenseBudgetTotal = budgetTotalForRange(budgets, categories, 'expense', start, end);
  const incomeBudgetTotal = budgetTotalForRange(budgets, categories, 'income', start, end);
  // A "target net" only makes sense once at least one side has a budget/goal
  // set — with neither set there's nothing to compare net against.
  const hasAnyBudget = expenseBudgetTotal > 0 || incomeBudgetTotal > 0;
  const netBudgetTotal = hasAnyBudget ? incomeBudgetTotal - expenseBudgetTotal : null;

  function setScrubbing(next: boolean) {
    setIsScrubbing(next);
    onScrubbingChange(next);
  }

  function goToView(next: ViewType) {
    setViewType(next);
    const index = next === 'expense' ? 0 : next === 'income' ? 1 : 2;
    // animated: true silently no-ops on react-native-web here (same
    // scroll-snap-type/smooth-scroll quirk as every other pager in the app).
    pagerRef.current?.scrollTo({ x: index * panelWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!panelWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / panelWidth);
    setViewType(index === 0 ? 'expense' : index === 1 ? 'income' : 'net');
  }

  const panelHeight = Math.max(expenseHeight, incomeHeight, netHeight) || undefined;

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <SegmentedControl
        options={[
          { value: 'expense', label: 'Expenses', color: theme.destructive },
          { value: 'income', label: 'Income', color: theme.success },
          { value: 'net', label: 'Net' },
        ]}
        value={viewType}
        onChange={goToView}
      />

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

      <View style={styles.pagerWrap} onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScrollEnd}
          scrollEnabled={!isScrubbing}
          style={{ height: panelHeight }}>
          <View style={{ width: panelWidth }}>
            <TrendPanel
              label="Expenses"
              points={expensePoints}
              totalDays={totalDays}
              rangeStart={start}
              rangeEnd={end}
              budgetTotal={expenseBudgetTotal > 0 ? expenseBudgetTotal : null}
              lineColor={theme.destructive}
              positiveIsGood={false}
              width={panelWidth}
              onLayout={setExpenseHeight}
              onScrubStart={() => setScrubbing(true)}
              onScrubEnd={() => setScrubbing(false)}
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
              lineColor={theme.success}
              positiveIsGood={true}
              width={panelWidth}
              onLayout={setIncomeHeight}
              onScrubStart={() => setScrubbing(true)}
              onScrubEnd={() => setScrubbing(false)}
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
              lineColor={theme.accent}
              positiveIsGood={true}
              width={panelWidth}
              onLayout={setNetHeight}
              onScrubStart={() => setScrubbing(true)}
              onScrubEnd={() => setScrubbing(false)}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
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
  // Stretches to the card's full content width so onLayout measures the
  // real page width — the card's alignItems: 'center' would otherwise
  // shrink-wrap this to its content.
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
