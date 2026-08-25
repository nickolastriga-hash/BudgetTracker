import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, getBudgets, type Budget } from '@/lib/budgets';
import { categoriesForType, getCategories, type Category } from '@/lib/categories';
import { getTransactions, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(() => {
    Promise.all([getBudgets(), getTransactions(), getCategories()]).then(([b, t, c]) => {
      setBudgets(b);
      setTransactions(t);
      setCategories(c);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const thisMonth = toMonthStr(new Date());
  const progressByCategory = new Map(getBudgetProgress(budgets, transactions, thisMonth).map((p) => [p.categoryId, p]));
  const expenseCategories = categoriesForType(categories, 'expense');

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundElement }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
        ]}>
        <View style={styles.titleRow}>
          <View style={styles.titleTextGroup}>
            <ThemedText type="subtitle" style={styles.title}>
              Budgets
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tracked against {monthLabel(thisMonth)}. Tap a category to set its limit, hold to
              edit its icon.
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/category-editor')}
            hitSlop={8}
            style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <MaterialIcons name="add" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {expenseCategories.map((category, i) => {
            const progress = progressByCategory.get(category.id);
            const scheduled = budgets.find((b) => b.categoryId === category.id)?.scheduledChange;
            const upcoming = scheduled && scheduled.startMonth > thisMonth ? scheduled : null;

            return (
              <View key={category.id}>
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
                  ]}
                  onPress={() => router.push(`/budget-editor?id=${category.id}`)}
                  onLongPress={() => router.push(`/category-editor?id=${category.id}`)}>
                  <View style={styles.rowHeader}>
                    <CategoryBadge category={category} size={32} color={theme.destructive} />
                    <View style={styles.rowTextGroup}>
                      <ThemedText type="small">{category.name}</ThemedText>
                      {progress ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          ${formatAmount(progress.spent)} / ${formatAmount(progress.limit)}
                        </ThemedText>
                      ) : (
                        <ThemedText type="small" themeColor="accent">
                          Set budget
                        </ThemedText>
                      )}
                      {upcoming && (
                        <ThemedText type="small" themeColor="accent">
                          Changing to ${formatAmount(upcoming.limit)} in {monthLabel(upcoming.startMonth)}
                        </ThemedText>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                  </View>

                  {progress && (
                    <View style={styles.progressWrap}>
                      <ProgressBar percent={progress.percent} color={category.color} />
                    </View>
                  )}
                </Pressable>
                {i < expenseCategories.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  titleTextGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    marginBottom: -Spacing.one,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
  progressWrap: {
    paddingLeft: 32 + Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32 + Spacing.three * 2,
  },
});
