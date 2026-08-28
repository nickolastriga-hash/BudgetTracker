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
  SectionList,
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
            <ThemedText type="smallBold">{pickerYear}</ThemedText>
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
  bottomPadding,
}: {
  month: Date;
  transactions: Transaction[];
  categories: Category[];
  bottomPadding: number;
}) {
  const theme = useTheme();
  const monthStr = toMonthStr(month);
  const todayStr = toDateStr(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [monthStr]);

  // Both sides of each day now, not just spend — expense in red, income in
  // green, same color convention as everywhere else a transaction's type
  // shows.
  const expenseByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactionsForMonth(transactions, monthStr)) {
      if (t.type !== 'expense') continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);
  const incomeByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactionsForMonth(transactions, monthStr)) {
      if (t.type !== 'income') continue;
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
    <View style={{ flex: 1 }}>
      {/* Pinned above the ScrollView below (not inside it) so the day grid —
          this page's own date selector — stays visible while scrolling a
          long day-detail list, matching Home/Transactions' header treatment
          and HabitTracker's own calendar page. */}
      <View style={styles.content}>
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
              const expense = expenseByDay.get(dateStr) ?? 0;
              const income = incomeByDay.get(dateStr) ?? 0;
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
                    <ThemedText type="small" style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                      {day}
                    </ThemedText>
                    {expense > 0 && (
                      <ThemedText
                        type="small"
                        themeColor={isSelected ? 'text' : 'destructive'}
                        style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                        numberOfLines={1}>
                        -${expense >= 1000 ? `${Math.round(expense / 100) / 10}k` : Math.round(expense)}
                      </ThemedText>
                    )}
                    {income > 0 && (
                      <ThemedText
                        type="small"
                        themeColor={isSelected ? 'text' : 'success'}
                        style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                        numberOfLines={1}>
                        +${income >= 1000 ? `${Math.round(income / 100) / 10}k` : Math.round(income)}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.four, paddingBottom: bottomPadding }]}>
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
      </ScrollView>
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

  const bottomPadding = insets.bottom + BottomTabInset + Spacing.six;
  // Section-per-date, one data item per section (the whole day's
  // transaction array) — SectionList's own sticky-header machinery then
  // pins each date header at the top while its card of rows scrolls
  // underneath, the "freeze panes on rows" treatment. keyExtractor keys off
  // that date since there's exactly one item per section (index lines up).
  const sections = groups.map(([date, items]) => ({ date, data: [items] }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingTop: insets.top + Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Transactions" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable hitSlop={10} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {monthLabel(month)}
              </ThemedText>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
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

          {/* Page dots — same shape as HabitTracker's own swipe-page
              indicator (6px dot, active one widens to 16 and turns accent) —
              a passive readout of which page the pager is on, alongside the
              segmented control above which still does the actual tapping. */}
          <View style={styles.pageDots}>
            <View style={[styles.pageDot, { backgroundColor: theme.border }, view === 'list' && [styles.pageDotActive, { backgroundColor: theme.accent }]]} />
            <View style={[styles.pageDot, { backgroundColor: theme.border }, view === 'calendar' && [styles.pageDotActive, { backgroundColor: theme.accent }]]} />
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScrollEnd}
          style={{ flex: 1 }}>
          <View style={{ width: pageWidth, flex: 1 }}>
            <SectionList
              sections={sections}
              keyExtractor={(_, index) => sections[index]?.date ?? String(index)}
              stickySectionHeadersEnabled
              contentContainerStyle={[styles.content, { gap: 0, paddingBottom: bottomPadding }]}
              ListEmptyComponent={
                <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <MaterialIcons name="receipt-long" size={28} color={theme.textTertiary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    No transactions this month.
                  </ThemedText>
                </View>
              }
              renderSectionHeader={({ section }) => (
                <View style={[styles.stickyDateHeader, { backgroundColor: theme.background }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
                    {dateHeaderLabel(section.date).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              renderItem={({ item }) => (
                <View style={[styles.group, styles.dateGroupCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {item.map((t, i) => (
                    <View key={t.id}>
                      <TransactionRow
                        transaction={t}
                        category={getCategory(categories, t.categoryId)}
                        onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                      />
                      {i < item.length - 1 && (
                        <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                </View>
              )}
            />
          </View>

          <View style={{ width: pageWidth, flex: 1 }}>
            <CalendarView month={month} transactions={transactions} categories={categories} bottomPadding={bottomPadding} />
          </View>
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
  // Same shape as HabitTracker's own swipe-page dots.
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pageDotActive: {
    width: 16,
  },
  dateGroup: {
    gap: Spacing.two,
  },
  // The SectionList's own header, sticky via stickySectionHeadersEnabled —
  // needs its own top spacing and a solid background (the sticky container
  // sits above cards scrolling underneath it) since contentContainerStyle's
  // gap is zeroed out for this list, unlike every other screen's ScrollView.
  stickyDateHeader: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  dateGroupCard: {
    marginBottom: Spacing.four,
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
  dayNumber: {
    fontSize: 12,
    lineHeight: 14,
  },
  dayNumberSelected: {
    color: '#ffffff',
  },
  // Tight lineHeight (not just fontSize) since a cell can now show up to
  // three lines — day number, expense, income — in a small square.
  daySpend: {
    fontSize: 9,
    lineHeight: 11,
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
