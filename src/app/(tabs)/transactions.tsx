import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { getTransactions, transactionsForMonth, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dateHeaderLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
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

  const monthStr = toMonthStr(month);

  const groups = useMemo(() => {
    const inMonth = transactionsForMonth(transactions, monthStr).sort((a, b) => (a.date < b.date ? 1 : -1));
    const byDate = new Map<string, Transaction[]>();
    for (const t of inMonth) {
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }
    return Array.from(byDate.entries());
  }, [transactions, monthStr]);

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

        {groups.length === 0 ? (
          <ThemedView type="card" style={[styles.card, CardShadow, styles.emptyCard, { borderColor: theme.border }]}>
            <MaterialIcons name="receipt-long" size={28} color={theme.textTertiary} />
            <ThemedText type="small" themeColor="textSecondary">
              No transactions this month.
            </ThemedText>
          </ThemedView>
        ) : (
          groups.map(([date, items]) => (
            <View key={date} style={styles.group}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
                {dateHeaderLabel(date)}
              </ThemedText>
              <View style={styles.rowList}>
                {items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={getCategory(categories, t.categoryId)}
                    onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
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
  group: {
    gap: Spacing.two,
  },
  dateHeader: {
    paddingHorizontal: 2,
  },
  rowList: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  emptyCard: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
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
