import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { CategoryBadge } from '@/components/category-badge';
import { CategoryRingChart } from '@/components/category-ring-chart';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, type Budget, getBudgets } from '@/lib/budgets';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { byCategoryTotals, getTransactions, monthTotals, transactionsForMonth, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function lastNMonths(n: number, from: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - (n - 1 - i), 1);
    return toMonthStr(d);
  });
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' })
);

// Same shape as Transactions' own MonthYearPickerModal — duplicated rather
// than shared per the no-premature-abstraction rule (2nd occurrence).
function MonthYearPickerModal({
  visible,
  year,
  month,
  onSelect,
  onClose,
}: {
  visible: boolean;
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.pickerCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Pressable hitSlop={10} onPress={() => setPickerYear((y) => y - 1)}>
              <MaterialIcons name="chevron-left" size={24} color={theme.accent} />
            </Pressable>
            <ThemedText type="smallBold" themeColor="accent">
              {pickerYear}
            </ThemedText>
            <Pressable hitSlop={10} onPress={() => setPickerYear((y) => y + 1)}>
              <MaterialIcons name="chevron-right" size={24} color={theme.accent} />
            </Pressable>
          </View>

          <View style={styles.pickerGrid}>
            {MONTH_NAMES.map((name, m) => {
              const isSelected = pickerYear === year && m === month;
              return (
                <Pressable
                  key={name}
                  onPress={() => onSelect(pickerYear, m)}
                  style={[styles.pickerCell, isSelected && { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={isSelected && styles.pickerCellTextSelected}>
                    {name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Compact companion to Stats' own TrendChart — same income/expense-bars-per-
// month idea, redrawn smaller for the dashboard card rather than shared,
// per the no-premature-abstraction rule (this is only the 2nd occurrence).
const MINI_CHART_WIDTH = 280;
const MINI_CHART_HEIGHT = 64;

function MiniTrendChart({
  months,
  totals,
  incomeColor,
  expenseColor,
}: {
  months: string[];
  totals: Record<string, { income: number; expense: number }>;
  incomeColor: string;
  expenseColor: string;
}) {
  const max = Math.max(1, ...months.flatMap((m) => [totals[m].income, totals[m].expense]));
  const groupWidth = MINI_CHART_WIDTH / months.length;
  const barWidth = groupWidth * 0.26;

  return (
    <Svg width={MINI_CHART_WIDTH} height={MINI_CHART_HEIGHT}>
      {months.map((m, i) => {
        const groupX = i * groupWidth;
        const incomeHeight = (totals[m].income / max) * MINI_CHART_HEIGHT;
        const expenseHeight = (totals[m].expense / max) * MINI_CHART_HEIGHT;
        return (
          <React.Fragment key={m}>
            <Rect
              x={groupX + groupWidth / 2 - barWidth - 2}
              y={MINI_CHART_HEIGHT - incomeHeight}
              width={barWidth}
              height={Math.max(incomeHeight, 1)}
              rx={2}
              fill={incomeColor}
            />
            <Rect
              x={groupX + groupWidth / 2 + 2}
              y={MINI_CHART_HEIGHT - expenseHeight}
              width={barWidth}
              height={Math.max(expenseHeight, 1)}
              rx={2}
              fill={expenseColor}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

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

  const monthStr = toMonthStr(month);
  const totals = monthTotals(transactions, monthStr);
  const monthTransactions = transactionsForMonth(transactions, monthStr).sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = monthTransactions.slice(0, 8);
  const budgetProgress = getBudgetProgress(budgets, transactions, monthStr, categories).slice(0, 3);
  const netPositive = totals.net >= 0;

  const expenseBreakdown = useMemo(() => {
    const byCategory = byCategoryTotals(transactions, monthStr, 'expense');
    return Object.entries(byCategory)
      .map(([categoryId, amount]) => ({ categoryId, amount, category: getCategory(categories, categoryId) }))
      .filter((e) => e.category)
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, monthStr]);
  const topExpense = expenseBreakdown[0];

  const trendMonths = useMemo(() => lastNMonths(6), []);
  const trendTotals = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const m of trendMonths) {
      const t = monthTotals(transactions, m);
      map[m] = { income: t.income, expense: t.expense };
    }
    return map;
  }, [transactions, trendMonths]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundElement }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
        ]}>
        <ScreenHeader title="Home" right={<SettingsButton />} />

        <View style={styles.monthNav}>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <MaterialIcons name="chevron-left" size={26} color={theme.text} />
          </Pressable>
          <Pressable hitSlop={12} onPress={() => setPickerVisible(true)}>
            <ThemedText type="smallBold" themeColor="accent">
              {monthLabel(month)}
            </ThemedText>
          </Pressable>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.dashboardCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <CategoryRingChart
            segments={expenseBreakdown.map((e) => ({ key: e.categoryId, amount: e.amount, color: e.category!.color }))}
            trackColor={theme.backgroundElement}
            outlineColor={theme.card}>
            {topExpense ? (
              <>
                <CategoryBadge category={topExpense.category!} size={40} />
                <ThemedText type="title" style={styles.ringAmount}>
                  ${formatAmount(topExpense.amount)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.ringLabel}>
                  {topExpense.category!.name.toUpperCase()}
                </ThemedText>
              </>
            ) : (
              <>
                <MaterialIcons name="pie-chart-outline" size={32} color={theme.textTertiary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.ringLabel}>
                  No expenses yet
                </ThemedText>
              </>
            )}
          </CategoryRingChart>

          {expenseBreakdown.length > 0 && (
            <View style={styles.legend}>
              {expenseBreakdown.slice(0, 6).map((e) => (
                <View key={e.categoryId} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: e.category!.color }]} />
                  <ThemedText type="small" numberOfLines={1} style={styles.legendName}>
                    {e.category!.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round((e.amount / totals.expense) * 100)}%
                  </ThemedText>
                </View>
              ))}
              {expenseBreakdown.length > 6 && (
                <ThemedText type="small" themeColor="textTertiary">
                  +{expenseBreakdown.length - 6} more
                </ThemedText>
              )}
            </View>
          )}

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
            </View>
            <View style={styles.summaryColumn}>
              <ThemedText type="small" themeColor="textSecondary">
                Net
              </ThemedText>
              <ThemedText type="smallBold" themeColor={netPositive ? 'success' : 'destructive'}>
                ${formatAmount(totals.net)}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.trendDivider, { backgroundColor: theme.border }]} />

          <MiniTrendChart months={trendMonths} totals={trendTotals} incomeColor={theme.success} expenseColor={theme.destructive} />
          <View style={styles.trendLabels}>
            {trendMonths.map((m) => (
              <ThemedText key={m} type="small" themeColor="textTertiary" style={styles.trendLabel}>
                {shortMonthLabel(m)}
              </ThemedText>
            ))}
          </View>
        </View>

        {budgetProgress.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              BUDGETS
            </ThemedText>
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
                No transactions yet this month.
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

      <MonthYearPickerModal
        visible={pickerVisible}
        year={month.getFullYear()}
        month={month.getMonth()}
        onSelect={(y, m) => {
          setMonth(new Date(y, m, 1));
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  dashboardCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  ringAmount: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 6,
  },
  ringLabel: {
    letterSpacing: 0.6,
    fontSize: 11,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    rowGap: Spacing.two,
    columnGap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '45%',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
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
  trendDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  trendLabels: {
    flexDirection: 'row',
    width: MINI_CHART_WIDTH,
    justifyContent: 'space-around',
  },
  trendLabel: {
    fontSize: 10,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    width: '85%',
    maxWidth: 360,
    gap: Spacing.three,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.one,
  },
  pickerCell: {
    width: '25%',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pickerCellTextSelected: {
    color: '#ffffff',
  },
});
