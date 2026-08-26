import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import { getTransactions, transactionsForMonth, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dateHeaderLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' })
);

// Tap the month label to open this instead of hunting for a far-off month
// one arrow-tap at a time — a year pager plus a 12-month grid, same shape as
// HabitTracker's own month/year picker.
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
    // animationType="fade" depends on a CSS animationend event to actually
    // unmount on react-native-web — that event doesn't reliably fire in
    // every browser context, which can leave the modal visually stuck open
    // after visible flips to false. "none" sidesteps it entirely.
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

// Day-of-month grid showing that day's total spend, plus a tap-to-expand
// transaction list below it. Shares the outer month/year nav with the List
// page rather than owning its own — both pages of the swipe view are always
// looking at the same month.
function CalendarView({
  month,
  transactions,
  categories,
}: {
  month: Date;
  transactions: Transaction[];
  categories: Category[];
}) {
  const theme = useTheme();
  const monthStr = toMonthStr(month);
  const todayStr = toDateStr(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [monthStr]);

  const spendByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactionsForMonth(transactions, monthStr)) {
      if (t.type !== 'expense') continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const total = daysInMonth(year, monthIndex);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const selectedDayTransactions = selectedDay
    ? transactions.filter((t) => t.date === selectedDay).sort((a, b) => (a.id < b.id ? 1 : -1))
    : [];

  return (
    <View style={styles.calendarPage}>
      <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((w, i) => (
            <ThemedText key={i} type="small" themeColor="textTertiary" style={styles.weekdayLabel}>
              {w}
            </ThemedText>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const spend = spendByDay.get(dateStr) ?? 0;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            return (
              <Pressable
                key={dateStr}
                onPress={() => setSelectedDay((d) => (d === dateStr ? null : dateStr))}
                style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCellInner,
                    isSelected && { backgroundColor: theme.accent },
                    !isSelected && isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={isSelected ? 'text' : 'text'}
                    style={isSelected && styles.dayNumberSelected}>
                    {day}
                  </ThemedText>
                  {spend > 0 && (
                    <ThemedText
                      type="small"
                      themeColor={isSelected ? 'text' : 'destructive'}
                      style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                      numberOfLines={1}>
                      ${spend >= 1000 ? `${Math.round(spend / 100) / 10}k` : Math.round(spend)}
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedDay && (
        <View style={styles.dateGroup}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
            {dateHeaderLabel(selectedDay).toUpperCase()}
          </ThemedText>
          {selectedDayTransactions.length === 0 ? (
            <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                No transactions this day.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {selectedDayTransactions.map((t, i) => (
                <View key={t.id}>
                  <TransactionRow
                    transaction={t}
                    category={getCategory(categories, t.categoryId)}
                    onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                  />
                  {i < selectedDayTransactions.length - 1 && (
                    <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [pickerVisible, setPickerVisible] = useState(false);
  const pageWidth = useWindowDimensions().width;
  const pagerRef = useRef<ScrollView>(null);

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

  function goToView(next: 'list' | 'calendar') {
    setView(next);
    // animated: true silently no-ops on react-native-web here (scrollLeft
    // never moves, likely a scroll-snap-type/smooth-scroll interaction) —
    // an instant jump still reads fine for a tab-style toggle.
    pagerRef.current?.scrollTo({ x: next === 'list' ? 0 : pageWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setView(index === 0 ? 'list' : 'calendar');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundElement }}>
      <View style={{ paddingTop: insets.top + Spacing.three }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Transactions" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable hitSlop={10} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <MaterialIcons name="chevron-left" size={26} color={theme.text} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" themeColor="accent" style={styles.monthLabel}>
                {monthLabel(month)}
              </ThemedText>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <MaterialIcons name="chevron-right" size={26} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['list', 'calendar'] as const).map((v) => {
              const isSelected = view === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => goToView(v)}
                  style={[styles.segment, isSelected && { backgroundColor: theme.accent }]}>
                  <MaterialIcons
                    name={v === 'list' ? 'view-list' : 'calendar-month'}
                    size={15}
                    color={isSelected ? '#ffffff' : theme.textSecondary}
                  />
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {v === 'list' ? 'List' : 'Calendar'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScrollEnd}>
          <ScrollView
            style={{ width: pageWidth }}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
            ]}>
            {groups.length === 0 ? (
              <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <MaterialIcons name="receipt-long" size={28} color={theme.textTertiary} />
                <ThemedText type="small" themeColor="textSecondary">
                  No transactions this month.
                </ThemedText>
              </View>
            ) : (
              groups.map(([date, items]) => (
                <View key={date} style={styles.dateGroup}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
                    {dateHeaderLabel(date).toUpperCase()}
                  </ThemedText>
                  <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {items.map((t, i) => (
                      <View key={t.id}>
                        <TransactionRow
                          transaction={t}
                          category={getCategory(categories, t.categoryId)}
                          onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                        />
                        {i < items.length - 1 && (
                          <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <ScrollView
            style={{ width: pageWidth }}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + BottomTabInset + Spacing.six },
            ]}>
            <CalendarView month={month} transactions={transactions} categories={categories} />
          </ScrollView>
        </ScrollView>
      </View>

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
  headerContent: {
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  monthLabel: {
    minWidth: 132,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
    width: '100%',
    maxWidth: 280,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two - 2,
    borderRadius: Spacing.two - 2,
    alignItems: 'center',
  },
  dateGroup: {
    gap: Spacing.two,
  },
  dateHeader: {
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
  calendarPage: {
    gap: Spacing.four,
  },
  calendarCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flexBasis: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    flexBasis: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellInner: {
    flex: 1,
    width: '100%',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dayNumberSelected: {
    color: '#ffffff',
  },
  daySpend: {
    fontSize: 10,
  },
  daySpendSelected: {
    color: '#ffffff',
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
