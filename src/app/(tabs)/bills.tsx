import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategory, getCategories, type Category } from '@/lib/categories';
import { generateDueTransactions, getRecurring, nextDueDate, type RecurringTransaction } from '@/lib/recurring';

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dueLabel(dateStr: string, today: Date) {
  const todayStr = toDateStr(today);
  const diffDays = Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000
  );
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays > 1) return `Due in ${diffDays} days`;
  if (diffDays === -1) return 'Overdue by 1 day';
  return `Overdue by ${-diffDays} days`;
}

export default function BillsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(() => {
    // Idempotent — only materializes months not yet generated, so it's safe
    // to call again here even though the root layout already ran it once.
    generateDueTransactions().then(() => {
      Promise.all([getRecurring(), getCategories()]).then(([r, c]) => {
        setRecurring(r);
        setCategories(c);
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = new Date();
  const rows = recurring
    .map((item) => ({ item, due: nextDueDate(item, today) }))
    .sort((a, b) => a.due.localeCompare(b.due));

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
              Bills
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Recurring bills and income, sorted by when they&apos;re next due.
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/bill-editor')}
            hitSlop={8}
            style={[styles.addButton, { backgroundColor: theme.accent }]}>
            <MaterialIcons name="add" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {rows.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialIcons name="event-repeat" size={28} color={theme.textTertiary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              No recurring bills yet. Add rent, subscriptions, or a paycheck to track them here.
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {rows.map(({ item, due }, i) => {
              const category = getCategory(categories, item.categoryId);
              const typeColor = item.type === 'expense' ? theme.destructive : theme.success;
              const isOverdue = due < toDateStr(today);
              return (
                <View key={item.id}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
                    ]}
                    onPress={() => router.push(`/bill-editor?id=${item.id}`)}>
                    {category && <CategoryBadge category={category} size={32} color={typeColor} />}
                    <View style={styles.rowTextGroup}>
                      <ThemedText type="small">{category?.name ?? 'Uncategorized'}</ThemedText>
                      <ThemedText type="small" themeColor={isOverdue ? 'destructive' : 'textSecondary'}>
                        {dueLabel(due, today)}
                        {item.note ? ` · ${item.note}` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" themeColor={item.type === 'expense' ? 'destructive' : 'success'}>
                      {item.type === 'expense' ? '-' : '+'}${formatAmount(item.amount)}
                    </ThemedText>
                    <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                  </Pressable>
                  {i < rows.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                </View>
              );
            })}
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32 + Spacing.three * 2,
  },
  empty: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
  },
});
