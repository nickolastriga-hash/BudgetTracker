import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { getCategory, type Category } from '@/lib/categories';
import { nextDueDate, type RecurringTransaction } from '@/lib/recurring';

const WINDOW_DAYS = 7;

function localDateFromStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((localDateFromStr(dateStr).getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(dateStr: string, daysOut: number): string {
  if (daysOut <= 0) return 'Today';
  if (daysOut === 1) return 'Tomorrow';
  return localDateFromStr(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Home's "next 7 days" strip of recurring series (2026-09-14) — the same
// nextDueDate the Transactions tab's Recurring page sorts by, just windowed
// to the coming week so bills are visible without switching tabs. Renders
// nothing at all when no series exist (nothing to forecast), and a quiet
// empty state when some exist but none land this week. Tapping a row opens
// that series' editor, same as the Recurring page's pencil.
export function UpcomingBillsCard({ recurring, categories }: { recurring: RecurringTransaction[]; categories: Category[] }) {
  const theme = useTheme();
  const { format } = useCurrency();

  if (recurring.length === 0) return null;

  const due = recurring
    .map((item) => {
      const date = nextDueDate(item);
      return { item, date, daysOut: daysUntil(date) };
    })
    .filter((d) => d.daysOut <= WINDOW_DAYS)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const expenseDue = due.filter((d) => d.item.type === 'expense').reduce((s, d) => s + d.item.amount, 0);
  const incomeDue = due.filter((d) => d.item.type === 'income').reduce((s, d) => s + d.item.amount, 0);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
          UPCOMING BILLS
        </ThemedText>
        {expenseDue > 0 && (
          <View style={[styles.pill, { backgroundColor: theme.destructive + '1a' }]}>
            <MaterialIcons name="event" size={12} color={theme.destructive} />
            <ThemedText type="small" themeColor="destructive" style={styles.pillText}>
              {format(expenseDue)} due this week
            </ThemedText>
          </View>
        )}
      </View>

      {due.length === 0 ? (
        <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialIcons name="event-available" size={28} color={theme.textTertiary} />
          <ThemedText type="small" themeColor="textSecondary">
            Nothing due in the next {WINDOW_DAYS} days.
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {due.map(({ item, date, daysOut }, i) => {
            const category = getCategory(categories, item.categoryId);
            const isExpense = item.type === 'expense';
            const amountColor = isExpense ? theme.destructive : theme.success;
            return (
              <View key={item.id}>
                <Pressable
                  onPress={() => router.push(`/edit-recurring?id=${item.id}`)}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
                  {category && <CategoryBadge category={category} size={42} />}
                  <View style={styles.rowMiddle}>
                    <ThemedText type="default" numberOfLines={1}>
                      {item.note || category?.name || 'Other'}
                    </ThemedText>
                    <View style={styles.subtitleRow}>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {dueLabel(date, daysOut)}
                      </ThemedText>
                      {daysOut > 1 && (
                        <View style={[styles.duePill, { backgroundColor: theme.accent + '26' }]}>
                          <ThemedText type="small" themeColor="accent" style={styles.duePillText}>
                            in {daysOut}d
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                  <ThemedText type="default" style={[styles.amount, { color: amountColor }]}>
                    {(isExpense ? '-' : '+') + format(item.amount)}
                  </ThemedText>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
                </Pressable>
                {i < due.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
              </View>
            );
          })}
          {incomeDue > 0 && expenseDue > 0 && (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {format(incomeDue)} expected in, {format(expenseDue)} going out
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  titleRow: {
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.four,
  },
  pillText: {
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
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  duePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  duePillText: {
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 42 + Spacing.three * 2,
  },
  amount: {
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
});
