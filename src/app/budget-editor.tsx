import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  applyLimit,
  effectiveLimit,
  getBudgetProgress,
  getBudgets,
  removeBudget,
  resetToDefault,
  type Budget,
} from '@/lib/budgets';
import { getCategories, type Category } from '@/lib/categories';
import { getTransactions } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function monthShort(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function monthsInYear(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(amount: number) {
  return `$${Math.round(amount).toLocaleString()}`;
}

const thisMonth = toMonthStr(new Date());

export default function BudgetEditorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [budget, setBudget] = useState<Budget | undefined>(undefined);
  const [spent, setSpent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [draftLimit, setDraftLimit] = useState('');
  const [draftStartMonth, setDraftStartMonth] = useState(thisMonth);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    Promise.all([getCategories(), getBudgets(), getTransactions()]).then(([categories, budgets, transactions]) => {
      setCategory(categories.find((c) => c.id === id) ?? null);
      const existing = budgets.find((b) => b.categoryId === id);
      setBudget(existing);
      setDraftLimit(existing ? String(effectiveLimit(existing, thisMonth)) : '');
      const progress = getBudgetProgress(budgets, transactions, thisMonth, categories).find((p) => p.categoryId === id);
      setSpent(progress?.spent ?? 0);
      setLoaded(true);
    });
  }, [id]);

  if (!loaded || !category || !id) return null;

  const isIncome = category.type === 'income';

  const hasActiveOverride =
    !!budget && (budget.overrides?.[thisMonth] != null || (!!budget.scheduledChange && budget.scheduledChange.startMonth <= thisMonth));
  const upcoming = budget?.scheduledChange && budget.scheduledChange.startMonth > thisMonth ? budget.scheduledChange : null;
  const startLabel = draftStartMonth === thisMonth ? 'This month' : monthLabel(draftStartMonth);
  const calendarMonths = monthsInYear(calendarYear);
  const calendarRows = [calendarMonths.slice(0, 4), calendarMonths.slice(4, 8), calendarMonths.slice(8, 12)];

  async function save(scope: 'once' | 'onward') {
    const amount = parseFloat(draftLimit);
    if (!Number.isNaN(amount) && amount > 0 && id) {
      await applyLimit(id, draftStartMonth, amount, scope);
    }
    router.back();
  }

  async function handleReset() {
    if (id) await resetToDefault(id, thisMonth);
    router.back();
  }

  async function handleDelete() {
    if (id) await removeBudget(id);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
        <View style={styles.headerTitleGroup}>
          <CategoryBadge category={category} size={30} color={isIncome ? theme.success : theme.destructive} />
          <ThemedText type="default" style={styles.headerTitle}>
            {category.name}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
          <MaterialIcons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            ${formatAmount(spent)} {isIncome ? 'earned' : 'spent'} of $
            {formatAmount(budget ? effectiveLimit(budget, thisMonth) : 0)} {isIncome ? 'goal ' : ''}this month
          </ThemedText>
          {upcoming && (
            <ThemedText type="small" themeColor="accent">
              Changing to {formatCompact(upcoming.limit)} in {monthLabel(upcoming.startMonth)}
            </ThemedText>
          )}
        </View>

        <View style={styles.editRow}>
          <TextInput
            value={draftLimit}
            onChangeText={setDraftLimit}
            placeholder={isIncome ? 'Monthly goal' : 'Monthly limit'}
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
          {budget && (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={22} color={theme.destructive} />
            </Pressable>
          )}
        </View>

        <View>
          <View style={styles.yearNav}>
            <Pressable hitSlop={10} onPress={() => setCalendarYear((y) => y - 1)}>
              <MaterialIcons name="chevron-left" size={22} color={theme.text} />
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Tap a month to set its starting point — {calendarYear}
            </ThemedText>
            <Pressable hitSlop={10} onPress={() => setCalendarYear((y) => y + 1)}>
              <MaterialIcons name="chevron-right" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.monthGrid}>
            {calendarRows.map((row) => (
              <View key={row[0]} style={styles.monthGridRow}>
                {row.map((monthStr) => {
                  const limit = budget ? effectiveLimit(budget, monthStr) : null;
                  const isToday = monthStr === thisMonth;
                  const isSelected = monthStr === draftStartMonth;
                  return (
                    <Pressable
                      key={monthStr}
                      onPress={() => setDraftStartMonth(monthStr)}
                      style={[
                        styles.monthCell,
                        {
                          backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                          borderColor: isToday ? theme.accent : theme.border,
                        },
                      ]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {monthShort(monthStr)}
                      </ThemedText>
                      <ThemedText type="smallBold">{limit != null && limit > 0 ? formatCompact(limit) : '—'}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.editRow}>
          <Pressable onPress={() => save('onward')} style={[styles.saveButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {startLabel} onward
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => save('once')}
            style={[
              styles.saveButton,
              { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <ThemedText type="smallBold">{startLabel} only</ThemedText>
          </Pressable>
        </View>

        {hasActiveOverride && (
          <Pressable onPress={handleReset} hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Reset {monthLabel(thisMonth)} to the recurring default
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  monthGrid: {
    gap: Spacing.two,
  },
  monthGridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  monthCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Spacing.two,
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
