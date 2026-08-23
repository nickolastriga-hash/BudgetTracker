import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, type Budget, getBudgets } from '@/lib/budgets';
import { getCategory } from '@/lib/categories';
import { getTransactions, monthTotals, transactionsForMonth, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getTransactions(), getBudgets()]).then(([t, b]) => {
        if (!cancelled) {
          setTransactions(t);
          setBudgets(b);
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
  const budgetProgress = getBudgetProgress(budgets, transactions, monthStr).slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
        ]}>
        <View style={styles.monthNav}>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <MaterialIcons name="chevron-left" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{monthLabel(month)}</ThemedText>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
          </Pressable>
        </View>

        <ThemedView type="card" style={[styles.summaryCard, { borderColor: theme.border }]}>
          <View style={styles.summaryColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Income
            </ThemedText>
            <ThemedText type="subtitle" themeColor="success" style={styles.summaryAmount}>
              ${formatAmount(totals.income)}
            </ThemedText>
          </View>
          <View style={styles.summaryColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Expenses
            </ThemedText>
            <ThemedText type="subtitle" themeColor="destructive" style={styles.summaryAmount}>
              ${formatAmount(totals.expense)}
            </ThemedText>
          </View>
          <View style={styles.summaryColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Net
            </ThemedText>
            <ThemedText
              type="subtitle"
              themeColor={totals.net >= 0 ? 'text' : 'destructive'}
              style={styles.summaryAmount}>
              ${formatAmount(totals.net)}
            </ThemedText>
          </View>
        </ThemedView>

        {budgetProgress.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Budgets
            </ThemedText>
            <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
              {budgetProgress.map((bp) => {
                const category = getCategory(bp.categoryId);
                if (!category) return null;
                return (
                  <View key={bp.categoryId} style={styles.budgetRow}>
                    <View style={styles.budgetHeader}>
                      <ThemedText type="small">{category.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        ${formatAmount(bp.spent)} / ${formatAmount(bp.limit)}
                      </ThemedText>
                    </View>
                    <ProgressBar percent={bp.percent} color={category.color} />
                  </View>
                );
              })}
            </ThemedView>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Recent Transactions
          </ThemedText>
          {recent.length === 0 ? (
            <ThemedView type="card" style={[styles.card, styles.emptyCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                No transactions yet this month.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
              {recent.map((t) => (
                <TransactionRow key={t.id} transaction={t} onPress={() => router.push(`/add-transaction?id=${t.id}`)} />
              ))}
            </ThemedView>
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
  summaryCard: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryAmount: {
    fontSize: 20,
    lineHeight: 26,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  emptyCard: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  budgetRow: {
    paddingVertical: Spacing.two,
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
