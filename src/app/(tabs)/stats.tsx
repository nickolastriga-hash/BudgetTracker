import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { CategoryBadge } from '@/components/category-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { byCategoryTotals, getTransactions, monthTotals, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const CHART_HEIGHT = 140;
const CHART_WIDTH = 300;

function TrendChart({ months, totals }: { months: string[]; totals: Record<string, { income: number; expense: number }> }) {
  const theme = useTheme();
  const max = Math.max(1, ...months.flatMap((m) => [totals[m].income, totals[m].expense]));
  const groupWidth = CHART_WIDTH / months.length;
  const barWidth = groupWidth * 0.28;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
      {months.map((m, i) => {
        const groupX = i * groupWidth;
        const incomeHeight = (totals[m].income / max) * CHART_HEIGHT;
        const expenseHeight = (totals[m].expense / max) * CHART_HEIGHT;
        return (
          <React.Fragment key={m}>
            <Rect
              x={groupX + groupWidth / 2 - barWidth - 2}
              y={CHART_HEIGHT - incomeHeight}
              width={barWidth}
              height={Math.max(incomeHeight, 1)}
              rx={3}
              fill={theme.success}
            />
            <Rect
              x={groupX + groupWidth / 2 + 2}
              y={CHART_HEIGHT - expenseHeight}
              width={barWidth}
              height={Math.max(expenseHeight, 1)}
              rx={3}
              fill={theme.destructive}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function StatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getTransactions(), getCategories()]).then(([t, c]) => {
        if (!cancelled) {
          setTransactions(t);
          setCategories(c);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const currentMonthStr = toMonthStr(new Date());
  const breakdown = useMemo(() => {
    const totals = byCategoryTotals(transactions, currentMonthStr, 'expense');
    const entries = Object.entries(totals)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount);
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    return { entries, total };
  }, [transactions, currentMonthStr]);

  const months = useMemo(() => lastNMonths(6), []);
  const monthlyTotals = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const m of months) {
      const t = monthTotals(transactions, m);
      map[m] = { income: t.income, expense: t.expense };
    }
    return map;
  }, [transactions, months]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
      ]}>
      <ThemedText type="subtitle" style={styles.title}>
        Stats
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          6-Month Trend
        </ThemedText>
        <ThemedView type="card" style={[styles.card, CardShadow, styles.trendCard, { borderColor: theme.border }]}>
          <TrendChart months={months} totals={monthlyTotals} />
          <View style={styles.trendLabels}>
            {months.map((m) => (
              <ThemedText key={m} type="small" themeColor="textSecondary" style={styles.trendLabel}>
                {shortMonthLabel(m)}
              </ThemedText>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
              <ThemedText type="small" themeColor="textSecondary">
                Income
              </ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.destructive }]} />
              <ThemedText type="small" themeColor="textSecondary">
                Expenses
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Spending by Category — {new Date().toLocaleDateString(undefined, { month: 'long' })}
        </ThemedText>
        {breakdown.entries.length === 0 ? (
          <ThemedView type="card" style={[styles.card, CardShadow, styles.emptyCard, { borderColor: theme.border }]}>
            <MaterialIcons name="pie-chart-outline" size={28} color={theme.textTertiary} />
            <ThemedText type="small" themeColor="textSecondary">
              No expenses logged this month.
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView type="card" style={[styles.card, CardShadow, { borderColor: theme.border }]}>
            {breakdown.entries.map(({ categoryId, amount }) => {
              const category = getCategory(categories, categoryId);
              if (!category) return null;
              return (
                <View key={categoryId} style={styles.breakdownRow}>
                  <CategoryBadge category={category} size={30} color={theme.destructive} />
                  <View style={styles.breakdownMiddle}>
                    <View style={styles.breakdownHeader}>
                      <ThemedText type="small">{category.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        ${formatAmount(amount)} ({Math.round((amount / breakdown.total) * 100)}%)
                      </ThemedText>
                    </View>
                    <ProgressBar percent={amount / breakdown.total} color={category.color} />
                  </View>
                </View>
              );
            })}
          </ThemedView>
        )}
      </View>
    </ScrollView>
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
  title: {
    marginBottom: -Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  trendCard: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  trendLabels: {
    flexDirection: 'row',
    width: CHART_WIDTH,
    justifyContent: 'space-around',
  },
  trendLabel: {
    fontSize: 11,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyCard: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  breakdownMiddle: {
    flex: 1,
    gap: 6,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
