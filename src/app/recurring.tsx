import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { shortDateLabel } from '@/lib/date-range';
import { deleteRecurring, getRecurring, nextDueDate, type RecurringTransaction } from '@/lib/recurring';

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function frequencyLabel(item: RecurringTransaction): string {
  if (item.frequency === 'monthly') return `Monthly · ${ordinal(item.dayOfMonth)}`;
  return item.frequency === 'weekly' ? 'Weekly' : 'Every 2 weeks';
}

// "YYYY-MM-DD" parsed via local y/m/d getters, not `new Date(dateStr)` —
// the latter parses as UTC midnight, which shortDateLabel's local-timezone
// formatting can then roll back a day (same reasoning as elsewhere in this
// app, see transaction-row.tsx).
function localDateFromStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function RecurringRow({
  item,
  category,
  isLast,
  onStop,
}: {
  item: RecurringTransaction;
  category: Category | undefined;
  isLast: boolean;
  onStop: () => void;
}) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const isExpense = item.type === 'expense';
  const typeColor = isExpense ? theme.destructive : theme.success;

  function handleStopPress() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onStop();
  }

  return (
    <View>
      <View style={styles.row}>
        {category && <CategoryBadge category={category} color={typeColor} size={40} />}
        <View style={styles.rowMiddle}>
          <ThemedText type="default" numberOfLines={1}>
            {category?.name ?? 'Other'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {frequencyLabel(item)} — next {shortDateLabel(localDateFromStr(nextDueDate(item)))}
          </ThemedText>
        </View>
        <View style={styles.rowEnd}>
          <ThemedText type="default" style={[styles.amount, { color: typeColor }]}>
            {isExpense ? '-' : '+'}${formatAmount(item.amount)}
          </ThemedText>
          <Pressable onPress={handleStopPress} hitSlop={8}>
            <ThemedText type="small" themeColor={confirming ? 'destructive' : 'accent'}>
              {confirming ? 'Tap again' : 'Stop'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
    </View>
  );
}

export default function RecurringScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.all([getRecurring(), getCategories()]).then(([recurring, cats]) => {
      setItems(recurring);
      setCategories(cats);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleStop(id: string) {
    await deleteRecurring(id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  // Soonest-due first — the whole point of "see everything at a glance" is
  // knowing what's coming up next, not whatever order they happen to sit in
  // storage.
  const sorted = [...items].sort((a, b) => (nextDueDate(a) < nextDueDate(b) ? -1 : 1));

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        {sorted.length === 0 ? (
          <View style={[styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialIcons name="event-repeat" size={28} color={theme.textTertiary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {'No recurring transactions yet. Check "Repeat" when adding a transaction to set one up.'}
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {sorted.map((item, i) => (
              <RecurringRow
                key={item.id}
                item={item}
                category={getCategory(categories, item.categoryId)}
                isLast={i === sorted.length - 1}
                onStop={() => handleStop(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  group: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowMiddle: {
    flex: 1,
    gap: 2,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40 + Spacing.three * 2,
  },
  emptyGroup: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
  },
});
