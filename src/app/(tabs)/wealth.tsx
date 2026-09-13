import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { CategoryBadge } from '@/components/category-badge';
import { DebtPayoffChart } from '@/components/debt-payoff-chart';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDateStr } from '@/lib/date-range';
import {
  DEFAULT_PLAN_SETTINGS,
  getDebts,
  getPlanSettings,
  savePlanSettings,
  simulateMinimumsOnly,
  simulatePayoff,
  type Debt,
  type DebtPlanSettings,
  type PayoffStrategy,
} from '@/lib/debts';
import { getGoals, goalProgress, type SavingsGoal } from '@/lib/goals';
import {
  getAccounts,
  getNetWorthHistory,
  recordNetWorthSnapshot,
  type Account,
  type NetWorthSnapshot,
} from '@/lib/net-worth';

type WealthView = 'goals' | 'debts' | 'networth';
const VIEWS: WealthView[] = ['goals', 'debts', 'networth'];

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Net worth can go negative — same sign-before-the-dollar treatment as
// TrendsCard's own formatSigned.
function formatSigned(amount: number) {
  return `${amount < 0 ? '-' : ''}$${formatAmount(Math.abs(amount))}`;
}

function monthStrLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function shortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A minimal net-worth-over-time line: one point per recorded snapshot,
// x positioned by date (snapshots are irregular — only days something
// changed), no scrubbing. Deliberately not CumulativeTrendChart — that one
// is built around a fixed daily domain with a target line, neither of
// which applies here.
function NetWorthChart({ history, width, height, color }: { history: NetWorthSnapshot[]; width: number; height: number; color: string }) {
  const theme = useTheme();
  if (!width || history.length < 2) return null;
  const values = history.map((s) => s.assets - s.liabilities);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const firstDay = new Date(`${history[0].date}T00:00:00`).getTime();
  const lastDay = new Date(`${history[history.length - 1].date}T00:00:00`).getTime();
  const span = lastDay - firstDay || 1;
  const padY = 8;
  const plotHeight = height - padY * 2;
  const points = history.map((s, i) => {
    const x = ((new Date(`${s.date}T00:00:00`).getTime() - firstDay) / span) * width;
    const y = padY + (1 - (values[i] - min) / range) * plotHeight;
    return `${x},${y}`;
  });
  const zeroY = padY + (1 - (0 - min) / range) * plotHeight;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="networth-area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={`0,${zeroY} ${points.join(' ')} ${width},${zeroY}`} fill="url(#networth-area)" />
      <Polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {min < 0 && <Polyline points={`0,${zeroY} ${width},${zeroY}`} stroke={theme.border} strokeWidth={1} strokeDasharray="4 4" />}
    </Svg>
  );
}

export default function WealthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pageWidth = useWindowDimensions().width;
  const pagerRef = useRef<ScrollView>(null);
  const [view, setView] = useState<WealthView>('goals');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [plan, setPlan] = useState<DebtPlanSettings>(DEFAULT_PLAN_SETTINGS);
  const [extraDraft, setExtraDraft] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [chartWidth, setChartWidth] = useState(0);
  const [payoffChartWidth, setPayoffChartWidth] = useState(0);
  // Scrubbing the payoff chart disables both the horizontal pager and the
  // Debts page's own vertical scroll for the drag's duration — see
  // CumulativeTrendChart for why claiming the responder alone isn't enough.
  const [isScrubbing, setIsScrubbing] = useState(false);

  const load = useCallback(() => {
    Promise.all([getGoals(), getDebts(), getPlanSettings(), getAccounts(), getNetWorthHistory()]).then(
      async ([g, d, p, a, h]) => {
        setGoals(g);
        setDebts(d);
        setPlan(p);
        setExtraDraft(p.extraMonthly > 0 ? String(p.extraMonthly) : '');
        setAccounts(a);
        // Snapshot today's totals into the history lazily on every load — no
        // scheduler, and the balance writers (editors) don't know about
        // history (see lib/net-worth.ts). Nothing to record until at least
        // one line item exists.
        if (a.length + d.length > 0) {
          const assets = a.filter((x) => x.kind === 'asset').reduce((s, x) => s + x.balance, 0);
          const liabilities =
            a.filter((x) => x.kind === 'liability').reduce((s, x) => s + x.balance, 0) + d.reduce((s, x) => s + x.balance, 0);
          setHistory(await recordNetWorthSnapshot({ date: toDateStr(new Date()), assets, liabilities }));
        } else {
          setHistory(h);
        }
      }
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function goToView(next: WealthView) {
    setView(next);
    // animated: true silently no-ops on react-native-web (same quirk as
    // every other pager in the app) — an instant jump reads fine.
    pagerRef.current?.scrollTo({ x: VIEWS.indexOf(next) * pageWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setView(VIEWS[index] ?? 'goals');
  }

  async function updatePlan(next: Partial<DebtPlanSettings>) {
    const merged = { ...plan, ...next };
    setPlan(merged);
    await savePlanSettings(merged);
  }

  function commitExtra() {
    const n = parseFloat(extraDraft);
    updatePlan({ extraMonthly: Number.isNaN(n) || n < 0 ? 0 : n });
  }

  // Goals
  const goalProgressById = new Map(goals.map((g) => [g.id, goalProgress(g)]));
  const totalGoalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalGoalSaved = goals.reduce((s, g) => s + (goalProgressById.get(g.id)?.saved ?? 0), 0);
  const goalsReached = goals.filter((g) => (goalProgressById.get(g.id)?.percent ?? 0) >= 1).length;

  // Debts
  const payoff = simulatePayoff(debts, plan);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin = debts.reduce((s, d) => s + d.minPayment, 0);
  const activeDebts = debts.filter((d) => d.balance > 0);
  // "Minimums only" comparison for the chart's dashed line and the caption
  // under the plan result. Only worth showing when it's actually slower
  // than the plan — with one debt and no extra, the two are identical.
  const minimumsOnly = simulateMinimumsOnly(debts, plan.strategy);
  const showBaseline =
    !payoff.unreachable && activeDebts.length > 0 && (minimumsOnly.unreachable || minimumsOnly.months > payoff.months);

  // Net worth — manual liabilities plus every tracked debt's balance, so a
  // credit card on the Debts page doesn't need entering twice.
  const assetAccounts = accounts.filter((a) => a.kind === 'asset');
  const liabilityAccounts = accounts.filter((a) => a.kind === 'liability');
  const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0) + totalDebt;
  const netWorth = totalAssets - totalLiabilities;
  const hasNetWorthItems = accounts.length + debts.length > 0;

  const sectionMeta: Record<WealthView, { label: string; addHref: string; addLabel: string }> = {
    goals: { label: 'SAVINGS GOALS', addHref: '/goal-editor', addLabel: 'Add savings goal' },
    debts: { label: 'DEBTS', addHref: '/debt-editor', addLabel: 'Add debt' },
    networth: { label: 'NET WORTH', addHref: '/account-editor', addLabel: 'Add asset or liability' },
  };
  const bottomPadding = insets.bottom + BottomTabInset + Spacing.six;
  const cardStyle = [styles.card, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }];
  const groupStyle = [styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Pinned header — same shape as Budgets': title, a segmented toggle,
          page dots, and one section label + "+" that swaps per page. */}
      <View style={{ paddingTop: insets.top + Spacing.three, paddingBottom: Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Wealth" right={<SettingsButton />} />

          <SegmentedControl
            options={[
              { value: 'goals', label: 'Goals', icon: 'savings' },
              { value: 'debts', label: 'Debts', icon: 'credit-card' },
              { value: 'networth', label: 'Net Worth', icon: 'account-balance' },
            ]}
            value={view}
            onChange={goToView}
          />

          <View style={styles.pageDots}>
            {VIEWS.map((v) => (
              <View
                key={v}
                style={[styles.pageDot, { backgroundColor: theme.border }, view === v && [styles.pageDotActive, { backgroundColor: theme.accent }]]}
              />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              {sectionMeta[view].label}
            </ThemedText>
            <Pressable
              onPress={() => router.push(sectionMeta[view].addHref as never)}
              hitSlop={8}
              accessibilityLabel={sectionMeta[view].addLabel}
              style={[styles.addButton, { backgroundColor: theme.accent }]}>
              <MaterialIcons name="add" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        scrollEnabled={!isScrubbing}
        style={{ flex: 1 }}>
        {/* ---- Goals ---- */}
        <View style={{ width: pageWidth, flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: bottomPadding }]}>
            {goals.length > 0 && (
              <View style={cardStyle}>
                <View style={styles.summaryHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Total saved
                  </ThemedText>
                  <ThemedText type="smallBold">
                    ${formatAmount(totalGoalSaved)} / ${formatAmount(totalGoalTarget)}
                  </ThemedText>
                </View>
                <ProgressBar percent={totalGoalTarget > 0 ? totalGoalSaved / totalGoalTarget : 0} color={theme.success} type="income" />
                {goalsReached > 0 && (
                  <View style={[styles.pill, { backgroundColor: theme.success + '1a' }]}>
                    <MaterialIcons name="check-circle-outline" size={12} color={theme.success} />
                    <ThemedText type="small" themeColor="success" style={styles.pillText}>
                      {goalsReached} {goalsReached === 1 ? 'goal' : 'goals'} reached
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {goals.length === 0 ? (
              <View style={[...groupStyle, styles.emptyGroup]}>
                <MaterialIcons name="savings" size={28} color={theme.textTertiary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No savings goals yet. Tap + to set one: an emergency fund, a trip, a big purchase.
                </ThemedText>
              </View>
            ) : (
              <View style={groupStyle}>
                {goals.map((goal, i) => {
                  const p = goalProgressById.get(goal.id)!;
                  const reached = p.percent >= 1;
                  return (
                    <View key={goal.id}>
                      <Pressable
                        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}
                        onPress={() => router.push(`/goal-editor?id=${goal.id}` as never)}>
                        <View style={styles.rowHeader}>
                          <CategoryBadge category={goal} size={32} />
                          <View style={styles.rowTextGroup}>
                            <ThemedText type="small">{goal.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              ${formatAmount(p.saved)} / ${formatAmount(goal.targetAmount)}
                            </ThemedText>
                            {reached ? (
                              <ThemedText type="small" themeColor="success">
                                Goal reached
                              </ThemedText>
                            ) : goal.targetMonth && p.neededPerMonth !== null ? (
                              <ThemedText type="small" themeColor={p.monthsLeft === 0 ? 'destructive' : 'accent'}>
                                {p.monthsLeft === 0
                                  ? `Deadline passed (${monthStrLabel(goal.targetMonth)})`
                                  : `by ${monthStrLabel(goal.targetMonth)} · $${formatAmount(p.neededPerMonth)}/mo`}
                              </ThemedText>
                            ) : null}
                          </View>
                          <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                        </View>
                        <View style={styles.progressWrap}>
                          <ProgressBar percent={p.percent} color={goal.color} type="income" />
                        </View>
                      </Pressable>
                      {i < goals.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

        {/* ---- Debts ---- */}
        <View style={{ width: pageWidth, flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: bottomPadding }]}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isScrubbing}>
            {debts.length > 0 && (
              <View style={cardStyle}>
                <View style={styles.summaryHeader}>
                  <View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Total owed
                    </ThemedText>
                    <ThemedText style={[styles.heroAmount, { color: theme.destructive }]}>${formatAmount(totalDebt)}</ThemedText>
                  </View>
                  <View style={styles.summaryRight}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Minimums
                    </ThemedText>
                    <ThemedText type="smallBold">${formatAmount(totalMin)}/mo</ThemedText>
                  </View>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                <SegmentedControl
                  options={[
                    { value: 'snowball', label: 'Snowball', icon: 'ac-unit' },
                    { value: 'avalanche', label: 'Avalanche', icon: 'landslide' },
                  ]}
                  value={plan.strategy}
                  onChange={(strategy: PayoffStrategy) => updatePlan({ strategy })}
                  style={styles.strategyToggle}
                />
                <ThemedText type="small" themeColor="textTertiary" style={styles.strategyCaption}>
                  {plan.strategy === 'snowball'
                    ? 'Smallest balance first, for quick wins that keep you going.'
                    : 'Highest APR first, for the least total interest.'}
                </ThemedText>

                <View style={styles.extraRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.extraLabel}>
                    Extra per month
                  </ThemedText>
                  <View style={[styles.extraInputWrap, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      $
                    </ThemedText>
                    <TextInput
                      value={extraDraft}
                      onChangeText={setExtraDraft}
                      onBlur={commitExtra}
                      onSubmitEditing={commitExtra}
                      placeholder="0"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      style={[styles.extraInput, { color: theme.text }]}
                    />
                  </View>
                </View>

                {activeDebts.length > 0 && (
                  <View style={[styles.planResult, { backgroundColor: (payoff.unreachable ? theme.destructive : theme.success) + '14' }]}>
                    <MaterialIcons
                      name={payoff.unreachable ? 'error-outline' : 'flag'}
                      size={16}
                      color={payoff.unreachable ? theme.destructive : theme.success}
                    />
                    <View style={styles.planResultText}>
                      {payoff.unreachable || !payoff.debtFreeMonth ? (
                        <ThemedText type="small" themeColor="destructive">
                          Payments don’t outrun the interest. Raise the extra amount or a minimum.
                        </ThemedText>
                      ) : (
                        <>
                          <ThemedText type="smallBold" themeColor="success">
                            Debt-free {monthStrLabel(payoff.debtFreeMonth)}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {payoff.months} {payoff.months === 1 ? 'month' : 'months'} · ${formatAmount(payoff.totalInterest)} in interest
                          </ThemedText>
                          {showBaseline && (
                            <ThemedText type="small" themeColor="textTertiary">
                              {minimumsOnly.unreachable
                                ? 'Minimums only: never paid off'
                                : `Minimums only: ${minimumsOnly.months} months, $${formatAmount(minimumsOnly.totalInterest)} in interest`}
                            </ThemedText>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                )}

                {activeDebts.length > 0 && !payoff.unreachable && payoff.schedule.length >= 2 && (
                  <View style={styles.payoffChartWrap} onLayout={(e) => setPayoffChartWidth(e.nativeEvent.layout.width)}>
                    <DebtPayoffChart
                      schedule={payoff.schedule}
                      baseline={showBaseline ? minimumsOnly.schedule : null}
                      order={payoff.order}
                      width={payoffChartWidth}
                      height={200}
                      formatMonth={monthStrLabel}
                      formatValue={(v) => `$${formatAmount(v)}`}
                      onScrubStart={() => setIsScrubbing(true)}
                      onScrubEnd={() => setIsScrubbing(false)}
                    />
                    <View style={styles.legend}>
                      {payoff.order.map((d) => (
                        <View key={d.id} style={styles.legendItem}>
                          <View style={[styles.legendSwatch, { backgroundColor: d.color }]} />
                          <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                            {d.name}
                          </ThemedText>
                        </View>
                      ))}
                      {showBaseline && (
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDash, { borderColor: theme.textTertiary }]} />
                          <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                            Minimums only
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textTertiary" style={styles.chartHint}>
                      Press and drag to read any month
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {debts.length === 0 ? (
              <View style={[...groupStyle, styles.emptyGroup]}>
                <MaterialIcons name="credit-card" size={28} color={theme.textTertiary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No debts tracked. Tap + to add a card or loan and see a payoff plan.
                </ThemedText>
              </View>
            ) : (
              <View style={groupStyle}>
                {debts.map((debt, i) => {
                  const paidDown = debt.originalBalance > 0 ? 1 - debt.balance / debt.originalBalance : 0;
                  const payoffMonth = payoff.perDebt[debt.id]?.payoffMonth ?? null;
                  return (
                    <View key={debt.id}>
                      <Pressable
                        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}
                        onPress={() => router.push(`/debt-editor?id=${debt.id}` as never)}>
                        <View style={styles.rowHeader}>
                          <CategoryBadge category={debt} size={32} />
                          <View style={styles.rowTextGroup}>
                            <ThemedText type="small">{debt.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {debt.apr}% APR · ${formatAmount(debt.minPayment)}/mo min
                            </ThemedText>
                            {debt.balance <= 0 ? (
                              <ThemedText type="small" themeColor="success">
                                Paid off
                              </ThemedText>
                            ) : payoffMonth ? (
                              <ThemedText type="small" themeColor="accent">
                                Paid off {monthStrLabel(payoffMonth)}
                              </ThemedText>
                            ) : null}
                          </View>
                          <ThemedText type="smallBold" themeColor={debt.balance > 0 ? 'destructive' : 'success'} style={styles.rowAmount}>
                            ${formatAmount(debt.balance)}
                          </ThemedText>
                          <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                        </View>
                        <View style={styles.progressWrap}>
                          <ProgressBar percent={paidDown} color={debt.color} type="income" />
                        </View>
                      </Pressable>
                      {i < debts.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

        {/* ---- Net worth ---- */}
        <View style={{ width: pageWidth, flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: bottomPadding }]}>
            <View style={cardStyle}>
              <ThemedText type="small" themeColor="textSecondary">
                Net worth
              </ThemedText>
              <ThemedText style={[styles.heroAmount, styles.heroAmountLarge, { color: netWorth >= 0 ? theme.accent : theme.destructive }]}>
                {formatSigned(netWorth)}
              </ThemedText>
              <View style={styles.netWorthSplit}>
                <View style={styles.netWorthSplitItem}>
                  <MaterialIcons name="arrow-upward" size={12} color={theme.success} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Assets
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="success">
                    ${formatAmount(totalAssets)}
                  </ThemedText>
                </View>
                <View style={styles.netWorthSplitItem}>
                  <MaterialIcons name="arrow-downward" size={12} color={theme.destructive} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Liabilities
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="destructive">
                    ${formatAmount(totalLiabilities)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.chartWrap} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                {history.length >= 2 ? (
                  <>
                    <NetWorthChart history={history} width={chartWidth} height={120} color={netWorth >= 0 ? theme.accent : theme.destructive} />
                    <View style={styles.axisRow}>
                      <ThemedText type="small" themeColor="textTertiary">
                        {shortDate(history[0].date)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textTertiary">
                        {shortDate(history[history.length - 1].date)}
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textTertiary" style={styles.chartPlaceholder}>
                    {hasNetWorthItems
                      ? 'A trend line appears once balances change on a later day.'
                      : 'Add assets and liabilities to start tracking.'}
                  </ThemedText>
                )}
              </View>
            </View>

            {!hasNetWorthItems ? (
              <View style={[...groupStyle, styles.emptyGroup]}>
                <MaterialIcons name="account-balance" size={28} color={theme.textTertiary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Nothing here yet. Tap + to add what you own (accounts, car, home) and what you owe.
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <View style={styles.subSectionHeader}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
                      ASSETS
                    </ThemedText>
                    <Pressable hitSlop={8} onPress={() => router.push('/account-editor?kind=asset' as never)}>
                      <ThemedText type="small" themeColor="accent">
                        Add
                      </ThemedText>
                    </Pressable>
                  </View>
                  {assetAccounts.length === 0 ? (
                    <View style={[...groupStyle, styles.emptyGroupCompact]}>
                      <ThemedText type="small" themeColor="textTertiary">
                        No assets yet
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={groupStyle}>
                      {assetAccounts.map((account, i) => (
                        <View key={account.id}>
                          <Pressable
                            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}
                            onPress={() => router.push(`/account-editor?id=${account.id}` as never)}>
                            <View style={styles.rowHeader}>
                              <CategoryBadge category={account} size={32} />
                              <ThemedText type="small" style={styles.rowTextGroup}>
                                {account.name}
                              </ThemedText>
                              <ThemedText type="smallBold" style={styles.rowAmount}>
                                ${formatAmount(account.balance)}
                              </ThemedText>
                              <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                            </View>
                          </Pressable>
                          {i < assetAccounts.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <View style={styles.subSectionHeader}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
                      LIABILITIES
                    </ThemedText>
                    <Pressable hitSlop={8} onPress={() => router.push('/account-editor?kind=liability' as never)}>
                      <ThemedText type="small" themeColor="accent">
                        Add
                      </ThemedText>
                    </Pressable>
                  </View>
                  {liabilityAccounts.length + debts.length === 0 ? (
                    <View style={[...groupStyle, styles.emptyGroupCompact]}>
                      <ThemedText type="small" themeColor="textTertiary">
                        No liabilities. Nice.
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={groupStyle}>
                      {[
                        ...liabilityAccounts.map((a) => ({ key: `a-${a.id}`, item: a, href: `/account-editor?id=${a.id}`, fromDebts: false })),
                        ...debts.map((d) => ({ key: `d-${d.id}`, item: d, href: `/debt-editor?id=${d.id}`, fromDebts: true })),
                      ].map((entry, i, all) => (
                        <View key={entry.key}>
                          <Pressable
                            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}
                            onPress={() => router.push(entry.href as never)}>
                            <View style={styles.rowHeader}>
                              <CategoryBadge category={entry.item} size={32} />
                              <View style={styles.rowTextGroup}>
                                <ThemedText type="small">{entry.item.name}</ThemedText>
                                {entry.fromDebts && (
                                  <ThemedText type="small" themeColor="textTertiary">
                                    From Debts
                                  </ThemedText>
                                )}
                              </View>
                              <ThemedText type="smallBold" themeColor="destructive" style={styles.rowAmount}>
                                ${formatAmount(entry.item.balance)}
                              </ThemedText>
                              <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                            </View>
                          </Pressable>
                          {i < all.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </ScrollView>
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
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  section: {
    gap: Spacing.two,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two + 4,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  heroAmount: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroAmountLarge: {
    fontSize: 34,
    lineHeight: 40,
  },
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.four,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  strategyToggle: {
    maxWidth: 260,
  },
  strategyCaption: {
    textAlign: 'center',
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  extraLabel: {
    flex: 1,
  },
  extraInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
    minWidth: 110,
  },
  extraInput: {
    flex: 1,
    paddingVertical: Spacing.two,
    fontSize: 15,
    textAlign: 'right',
  },
  planResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two + 2,
    borderRadius: Spacing.two,
  },
  planResultText: {
    flex: 1,
  },
  payoffChartWrap: {
    width: '100%',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    columnGap: Spacing.three,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendDash: {
    width: 14,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 12,
  },
  chartHint: {
    fontSize: 11,
    textAlign: 'center',
  },
  netWorthSplit: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  netWorthSplitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chartWrap: {
    width: '100%',
    marginTop: Spacing.one,
  },
  chartPlaceholder: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  group: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyGroup: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyGroupCompact: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  row: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  rowAmount: {
    fontVariant: ['tabular-nums'],
  },
  progressWrap: {
    paddingLeft: 32 + Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32 + Spacing.three * 2,
  },
});
