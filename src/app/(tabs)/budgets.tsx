import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, getBudgets, removeBudget, setBudget, type Budget } from '@/lib/budgets';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { getTransactions, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState('');

  const load = useCallback(() => {
    Promise.all([getBudgets(), getTransactions()]).then(([b, t]) => {
      setBudgets(b);
      setTransactions(t);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const monthStr = toMonthStr(new Date());
  const progressByCategory = new Map(getBudgetProgress(budgets, transactions, monthStr).map((p) => [p.categoryId, p]));

  function startEditing(categoryId: string) {
    const existing = budgets.find((b) => b.categoryId === categoryId);
    setDraftLimit(existing ? String(existing.monthlyLimit) : '');
    setEditingCategoryId(categoryId);
  }

  async function saveDraft(categoryId: string) {
    const amount = parseFloat(draftLimit);
    if (!Number.isNaN(amount) && amount > 0) {
      await setBudget(categoryId, amount);
      load();
    }
    setEditingCategoryId(null);
  }

  async function clearBudget(categoryId: string) {
    await removeBudget(categoryId);
    setEditingCategoryId(null);
    load();
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
      ]}>
      <ThemedText type="subtitle" style={styles.title}>
        Budgets
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Monthly spending limits per category, tracked against {new Date().toLocaleDateString(undefined, { month: 'long' })}.
      </ThemedText>

      <View style={styles.rowList}>
        {EXPENSE_CATEGORIES.map((category) => {
          const progress = progressByCategory.get(category.id);
          const isEditing = editingCategoryId === category.id;

          return (
            <ThemedView
              key={category.id}
              type="card"
              style={[styles.row, CardShadow, { borderColor: theme.border }]}>
              <Pressable
                style={styles.rowHeader}
                onPress={() => (isEditing ? setEditingCategoryId(null) : startEditing(category.id))}>
                <CategoryBadge category={category} size={32} />
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
                </View>
                <MaterialIcons
                  name={isEditing ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={theme.textTertiary}
                />
              </Pressable>

              {progress && !isEditing && (
                <View style={styles.progressWrap}>
                  <ProgressBar percent={progress.percent} color={category.color} />
                </View>
              )}

              {isEditing && (
                <View style={styles.editRow}>
                  <TextInput
                    value={draftLimit}
                    onChangeText={setDraftLimit}
                    placeholder="Monthly limit"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="decimal-pad"
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  />
                  <Pressable
                    onPress={() => saveDraft(category.id)}
                    style={[styles.saveButton, { backgroundColor: theme.accent }]}>
                    <ThemedText type="smallBold" style={styles.saveButtonText}>
                      Save
                    </ThemedText>
                  </Pressable>
                  {progress && (
                    <Pressable onPress={() => clearBudget(category.id)} hitSlop={8}>
                      <MaterialIcons name="delete-outline" size={22} color={theme.destructive} />
                    </Pressable>
                  )}
                </View>
              )}
            </ThemedView>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  title: {
    marginBottom: -Spacing.one,
  },
  rowList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  row: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
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
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: 32 + Spacing.three,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  saveButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: Spacing.two,
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
