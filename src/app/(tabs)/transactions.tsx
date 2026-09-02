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

import { CategoryBadge } from '@/components/category-badge';
import { RangePickerModal } from '@/components/range-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, getCategory, type Category } from '@/lib/categories';
import {
  daysInMonth,
  formatRangeLabel,
  monthLabel,
  MONTH_NAMES,
  rangeBounds,
  shiftAnchor,
  shiftCustomRange,
  startOfWeek,
  toDateStr,
  toMonthStr,
  type CustomRange,
  type RangeType,
} from '@/lib/date-range';
import { getTransactions, transactionsInRange, type Transaction, type TransactionType } from '@/lib/transactions';

// Which transactions to show — 'all' (no type filter) plus an optional set
// of category ids. An empty categoryIds list means "every category of
// whichever type is selected", not "none" — same "empty = unfiltered"
// convention as the type field's own 'all'.
type TransactionFilter = {
  type: 'all' | TransactionType;
  categoryIds: string[];
};

const EMPTY_FILTER: TransactionFilter = { type: 'all', categoryIds: [] };

function applyTransactionFilter(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  return transactions.filter((t) => {
    if (filter.type !== 'all' && t.type !== filter.type) return false;
    if (filter.categoryIds.length > 0 && !filter.categoryIds.includes(t.categoryId)) return false;
    return true;
  });
}

function dateHeaderLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Also used by Calendar's own day-of-month grid below.
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A cell in a day grid (CalendarView's and WeekCalendarView's own) — either
// a real day (dateStr + display number) or `null` for a leading/trailing
// blank.
type DayGridCell = { dateStr: string; day: number };

// Type + category filter, reached via the funnel button in the header.
// Applies to both List and Calendar (the caller filters `transactions`
// before handing them to either page, so neither page has to know about
// filtering itself). Live-applies as you tap rather than needing an
// Apply/Done step — same immediacy as the range/view toggles elsewhere on
// this screen.
function FilterModal({
  visible,
  categories,
  filter,
  onChange,
  onClose,
}: {
  visible: boolean;
  categories: Category[];
  filter: TransactionFilter;
  onChange: (next: TransactionFilter) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const visibleCategories = filter.type === 'all' ? categories : categoriesForType(categories, filter.type);
  const hasFilter = filter.type !== 'all' || filter.categoryIds.length > 0;

  function setType(type: TransactionFilter['type']) {
    // Switching type drops any already-selected category that no longer
    // matches it — an income category selected while filtering to
    // 'expense' would be a contradiction that could never match anything.
    const categoryIds =
      type === 'all' ? filter.categoryIds : filter.categoryIds.filter((id) => getCategory(categories, id)?.type === type);
    onChange({ type, categoryIds });
  }

  function toggleCategory(id: string) {
    onChange({
      ...filter,
      categoryIds: filter.categoryIds.includes(id)
        ? filter.categoryIds.filter((c) => c !== id)
        : [...filter.categoryIds, id],
    });
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.filterCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => {}}>
          <View style={styles.filterHeader}>
            <ThemedText type="smallBold">Filter</ThemedText>
            <Pressable hitSlop={10} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['all', 'expense', 'income'] as const).map((t) => {
              const isSelected = filter.type === t;
              const activeColor = t === 'expense' ? theme.destructive : t === 'income' ? theme.success : theme.accent;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.segment, isSelected && { backgroundColor: activeColor }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : 'Income'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={styles.filterCategoryScroll} contentContainerStyle={styles.categoryGrid}>
            {visibleCategories.map((category) => {
              const isSelected = filter.categoryIds.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  style={[
                    styles.categoryChip,
                    { borderColor: isSelected ? category.color : theme.border },
                    isSelected && { backgroundColor: category.color + '1A' },
                  ]}>
                  <CategoryBadge category={category} size={24} type={category.type} />
                  <ThemedText type="small">{category.name}</ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            disabled={!hasFilter}
            onPress={() => onChange(EMPTY_FILTER)}
            style={styles.clearFiltersButton}
            hitSlop={8}>
            <ThemedText type="small" themeColor={hasFilter ? 'destructive' : 'textTertiary'}>
              Clear filters
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Month mode's Calendar page — a day-of-month grid (leading blanks + every
// day of the navigated month) showing each day's total spend/income, plus a
// tap-to-expand transaction list below it.
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
  // shows. A type filter naturally zeroes out the unwanted side here since
  // `transactions` has already been filtered by the caller.
  const expenseByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.date.startsWith(monthStr)) continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);
  const incomeByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'income' || !t.date.startsWith(monthStr)) continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const total = daysInMonth(year, monthIndex);
  const cells: (DayGridCell | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      return { dateStr: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, day };
    }),
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
            {cells.map((cell, i) => {
              if (!cell) return <View key={`empty-${i}`} style={styles.dayCell} />;
              const { dateStr, day } = cell;
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

// Week mode's Calendar page (2026-09-01, replacing an earlier "just the
// selected week's 7 days" compact row per follow-up feedback that the whole
// month should stay visible) — the same day-of-month grid as CalendarView
// above, but the selectable/highlightable unit is a whole calendar week (one
// grid row), not a single day: each week is wrapped in its own bounding
// rectangle instead of each day getting its own bordered cell, the real
// current week's rectangle is outlined blue by default (the same "isToday"
// idea CalendarView's day cells use, just for a week instead of a day), and
// tapping any week's rectangle selects it — fills it blue and expands that
// whole week's transactions below, same "tap to expand" feel as a day in
// CalendarView. Not built as a mode of the generalized CalendarView above
// since the selection unit itself differs (a week vs. a day), which would
// have meant threading an extra "granularity" flag through nearly every
// branch of that component instead of just writing a second one.
function WeekCalendarView({
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
  const todayWeekStart = toDateStr(startOfWeek(new Date()));
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);

  useEffect(() => {
    setSelectedWeekStart(null);
  }, [monthStr]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = daysInMonth(year, monthIndex);

  // Every calendar-week row the month's grid needs, leading/trailing blanks
  // padded so each row is a real, full 7-day week (needed to draw one
  // bounding rectangle per row) — each row's own Sunday/Saturday bounds are
  // computed directly off its grid position (works even though a row's
  // leading cells can be null) rather than via startOfWeek on any one cell.
  const weeks = useMemo(() => {
    const flat: (DayGridCell | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => {
        const day = i + 1;
        return {
          dateStr: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          day,
        };
      }),
    ];
    while (flat.length % 7 !== 0) flat.push(null);
    const rows: { weekStart: string; weekEnd: string; cells: (DayGridCell | null)[] }[] = [];
    for (let i = 0; i < flat.length; i += 7) {
      const weekStartDate = new Date(year, monthIndex, 1 - firstWeekday + i);
      const weekEndDate = new Date(year, monthIndex, 1 - firstWeekday + i + 6);
      rows.push({ weekStart: toDateStr(weekStartDate), weekEnd: toDateStr(weekEndDate), cells: flat.slice(i, i + 7) });
    }
    return rows;
  }, [year, monthIndex, firstWeekday, totalDays]);

  const expenseByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.date.startsWith(monthStr)) continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);
  const incomeByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'income' || !t.date.startsWith(monthStr)) continue;
      totals.set(t.date, (totals.get(t.date) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, monthStr]);

  const selectedWeek = weeks.find((w) => w.weekStart === selectedWeekStart) ?? null;
  const selectedWeekTransactions = selectedWeek
    ? transactions
        .filter((t) => t.date >= selectedWeek.weekStart && t.date <= selectedWeek.weekEnd)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1))
    : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.content}>
        <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <ThemedText key={i} type="small" themeColor="textTertiary" style={styles.weekdayLabel}>
                {w}
              </ThemedText>
            ))}
          </View>
          <View style={styles.weekGrid}>
            {weeks.map((week) => {
              const isCurrentWeek = week.weekStart === todayWeekStart;
              const isSelected = week.weekStart === selectedWeekStart;
              return (
                <Pressable
                  key={week.weekStart}
                  onPress={() => setSelectedWeekStart((w) => (w === week.weekStart ? null : week.weekStart))}>
                  <View
                    style={[
                      styles.weekRow,
                      { borderColor: theme.border },
                      !isSelected && isCurrentWeek && { borderColor: theme.accent, borderWidth: 1.5 },
                      isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}>
                    {week.cells.map((cell, i) => {
                      if (!cell) return <View key={`empty-${i}`} style={styles.weekDayCell} />;
                      const { dateStr, day } = cell;
                      const expense = expenseByDay.get(dateStr) ?? 0;
                      const income = incomeByDay.get(dateStr) ?? 0;
                      const isRealToday = dateStr === todayStr;
                      return (
                        <View key={dateStr} style={styles.weekDayCell}>
                          <ThemedText
                            type="small"
                            style={[
                              styles.dayNumber,
                              isSelected && styles.dayNumberSelected,
                              isRealToday && !isSelected && { color: theme.accent, fontWeight: '700' },
                            ]}>
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
                      );
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.four, paddingBottom: bottomPadding }]}>
        {selectedWeek && (
          <View style={styles.dateGroup}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
              {formatRangeLabel(
                new Date(`${selectedWeek.weekStart}T00:00:00`),
                new Date(`${selectedWeek.weekEnd}T00:00:00`)
              ).toUpperCase()}
            </ThemedText>
            {selectedWeekTransactions.length === 0 ? (
              <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  No transactions this week.
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {selectedWeekTransactions.map((t, i) => (
                  <View key={t.id}>
                    <TransactionRow
                      transaction={t}
                      category={getCategory(categories, t.categoryId)}
                      onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                    />
                    {i < selectedWeekTransactions.length - 1 && (
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

// Year mode's Calendar page — a 12-month grid showing each month's expense/
// income totals. Tapping a month selects it (shows that month's transactions
// below, the same "tap to expand" feel as a day in CalendarView above)
// rather than drilling into a further day grid: a day-of-month grid for an
// entire year would be 12 grids at once, more navigation than a quick
// "what happened around when" glance calls for.
function YearCalendarView({
  year,
  transactions,
  categories,
  bottomPadding,
}: {
  year: number;
  transactions: Transaction[];
  categories: Category[];
  bottomPadding: number;
}) {
  const theme = useTheme();
  const thisMonthStr = toMonthStr(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMonth(null);
  }, [year]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
    [year]
  );

  const expenseByMonth = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.date.startsWith(String(year))) continue;
      const m = t.date.slice(0, 7);
      totals.set(m, (totals.get(m) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, year]);
  const incomeByMonth = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'income' || !t.date.startsWith(String(year))) continue;
      const m = t.date.slice(0, 7);
      totals.set(m, (totals.get(m) ?? 0) + t.amount);
    }
    return totals;
  }, [transactions, year]);

  const monthRows = [months.slice(0, 4), months.slice(4, 8), months.slice(8, 12)];
  const selectedMonthTransactions = selectedMonth
    ? transactions.filter((t) => t.date.startsWith(selectedMonth)).sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.content}>
        <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.yearMonthGrid}>
            {monthRows.map((row) => (
              <View key={row[0]} style={styles.yearMonthRow}>
                {row.map((monthStr) => {
                  const monthIndex = Number(monthStr.slice(5, 7)) - 1;
                  const expense = expenseByMonth.get(monthStr) ?? 0;
                  const income = incomeByMonth.get(monthStr) ?? 0;
                  const isToday = monthStr === thisMonthStr;
                  const isSelected = monthStr === selectedMonth;
                  return (
                    <Pressable
                      key={monthStr}
                      onPress={() => setSelectedMonth((m) => (m === monthStr ? null : monthStr))}
                      style={styles.yearMonthCell}>
                      <View
                        style={[
                          styles.yearMonthCellInner,
                          { borderColor: theme.border },
                          !isSelected && isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                          isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}>
                        <ThemedText
                          type="small"
                          themeColor={isSelected ? undefined : 'textSecondary'}
                          style={isSelected && styles.dayNumberSelected}>
                          {MONTH_NAMES[monthIndex]}
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
                        {expense === 0 && income === 0 && (
                          <ThemedText type="small" themeColor={isSelected ? 'text' : 'textTertiary'}>
                            —
                          </ThemedText>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Spacing.four, paddingBottom: bottomPadding }]}>
        {selectedMonth && (
          <View style={styles.dateGroup}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateHeader}>
              {monthLabel(new Date(`${selectedMonth}-01T00:00:00`)).toUpperCase()}
            </ThemedText>
            {selectedMonthTransactions.length === 0 ? (
              <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  No transactions this month.
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {selectedMonthTransactions.map((t, i) => (
                  <View key={t.id}>
                    <TransactionRow
                      transaction={t}
                      category={getCategory(categories, t.categoryId)}
                      onPress={() => router.push(`/add-transaction?id=${t.id}`)}
                    />
                    {i < selectedMonthTransactions.length - 1 && (
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
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
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

  const { start, end, label } = rangeBounds(rangeType, anchor, customRange);

  // Closes the picker the instant a custom range is completed (its second
  // tap sets `end`) — reference-equal no-op the rest of the time, so
  // reopening the modal to edit an already-complete range doesn't re-fire
  // this and immediately close it again.
  useEffect(() => {
    if (customRange?.end) setPickerVisible(false);
  }, [customRange]);

  // Calendar has a real page for Month, Week, and Year now (see
  // CalendarView/YearCalendarView above) — only Custom has no sensible
  // single-grid shape for an arbitrary range, so switching to Custom is the
  // only case that drops back to List. Read via the functional setState
  // form rather than depending on `view` directly, so this only ever fires
  // off a `rangeType` change.
  useEffect(() => {
    if (rangeType !== 'custom') return;
    setView((v) => {
      if (v !== 'calendar') return v;
      pagerRef.current?.scrollTo({ x: 0, animated: false });
      return 'list';
    });
  }, [rangeType]);

  const filteredTransactions = useMemo(() => applyTransactionFilter(transactions, filter), [transactions, filter]);
  const hasFilter = filter.type !== 'all' || filter.categoryIds.length > 0;

  const groups = useMemo(() => {
    const inRange = transactionsInRange(filteredTransactions, start, end).sort((a, b) => (a.date < b.date ? 1 : -1));
    const byDate = new Map<string, Transaction[]>();
    for (const t of inRange) {
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }
    return Array.from(byDate.entries());
  }, [filteredTransactions, start, end]);

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
  const rangeNoun =
    rangeType === 'week' ? 'week' : rangeType === 'year' ? 'year' : rangeType === 'custom' ? 'range' : 'month';
  const emptyMessage = hasFilter ? `No matching transactions this ${rangeNoun}.` : `No transactions this ${rangeNoun}.`;

  // Same SectionList either way — month/week/year mode nests it as the List
  // page of the List/Calendar pager below, custom mode renders it directly
  // full-bleed (there's no Calendar page to pair it with, see the rangeType
  // effect above) — kept as one shared element rather than several copies of
  // this JSX so they can't drift out of sync.
  const transactionList = (
    <SectionList
      sections={sections}
      keyExtractor={(_, index) => sections[index]?.date ?? String(index)}
      stickySectionHeadersEnabled
      contentContainerStyle={[styles.content, { gap: 0, paddingBottom: bottomPadding }]}
      ListEmptyComponent={
        <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialIcons name="receipt-long" size={28} color={theme.textTertiary} />
          <ThemedText type="small" themeColor="textSecondary">
            {emptyMessage}
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
              {i < item.length - 1 && <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />}
            </View>
          ))}
        </View>
      )}
    />
  );

  // The pager's second page — its shape depends on rangeType. Custom never
  // reaches this (it renders transactionList full-bleed instead, see the
  // render below).
  const calendarPage =
    rangeType === 'week' ? (
      <WeekCalendarView
        month={anchor}
        transactions={filteredTransactions}
        categories={categories}
        bottomPadding={bottomPadding}
      />
    ) : rangeType === 'year' ? (
      <YearCalendarView
        year={anchor.getFullYear()}
        transactions={filteredTransactions}
        categories={categories}
        bottomPadding={bottomPadding}
      />
    ) : (
      <CalendarView month={anchor} transactions={filteredTransactions} categories={categories} bottomPadding={bottomPadding} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingTop: insets.top + Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader
            title="Transactions"
            right={
              <View style={styles.headerButtons}>
                <Pressable
                  hitSlop={10}
                  onPress={() => setFilterVisible(true)}
                  style={[
                    styles.filterButton,
                    hasFilter ? { backgroundColor: theme.accent } : { backgroundColor: theme.accent + '26' },
                  ]}>
                  <MaterialIcons name="filter-list" size={18} color={hasFilter ? '#ffffff' : theme.accent} />
                  {hasFilter && <View style={[styles.filterDot, { backgroundColor: theme.destructive, borderColor: theme.background }]} />}
                </Pressable>
                <SettingsButton />
              </View>
            }
          />

          <View style={styles.monthNav}>
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (rangeType === 'custom') {
                  setCustomRange((r) => (r && r.end ? shiftCustomRange(r, -1) : r));
                } else {
                  setAnchor((a) => shiftAnchor(rangeType, a, -1));
                }
              }}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {label}
              </ThemedText>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (rangeType === 'custom') {
                  setCustomRange((r) => (r && r.end ? shiftCustomRange(r, 1) : r));
                } else {
                  setAnchor((a) => shiftAnchor(rangeType, a, 1));
                }
              }}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
            </Pressable>
          </View>

          <View style={[styles.segmented, styles.rangeToggle, { borderColor: theme.border }]}>
            {(['week', 'month', 'year', 'custom'] as const).map((rt) => {
              const isSelected = rangeType === rt;
              return (
                <Pressable
                  key={rt}
                  onPress={() => {
                    setRangeType(rt);
                    if (rt === 'custom' && !customRange) setPickerVisible(true);
                  }}
                  style={[styles.segment, isSelected && { backgroundColor: theme.accent }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {rt === 'week' ? 'Week' : rt === 'month' ? 'Month' : rt === 'year' ? 'Year' : 'Custom'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* List/Calendar toggle + page dots — shown for every rangeType
              except Custom, which has no single-grid Calendar shape for an
              arbitrary range (see the rangeType effect above). */}
          {rangeType !== 'custom' && (
            <>
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
                  indicator (6px dot, active one widens to 16 and turns
                  accent) — a passive readout of which page the pager is on,
                  alongside the segmented control above which still does the
                  actual tapping. */}
              <View style={styles.pageDots}>
                <View style={[styles.pageDot, { backgroundColor: theme.border }, view === 'list' && [styles.pageDotActive, { backgroundColor: theme.accent }]]} />
                <View style={[styles.pageDot, { backgroundColor: theme.border }, view === 'calendar' && [styles.pageDotActive, { backgroundColor: theme.accent }]]} />
              </View>
            </>
          )}
        </View>
      </View>

      {rangeType !== 'custom' ? (
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPagerScrollEnd}
            style={{ flex: 1 }}>
            <View style={{ width: pageWidth, flex: 1 }}>{transactionList}</View>

            <View style={{ width: pageWidth, flex: 1 }}>{calendarPage}</View>
          </ScrollView>
        </View>
      ) : (
        transactionList
      )}

      <Pressable
        onPress={() => router.push('/add-transaction')}
        style={[
          styles.fab,
          { backgroundColor: theme.accent, bottom: insets.bottom + BottomTabInset + Spacing.three },
        ]}>
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      <RangePickerModal
        visible={pickerVisible}
        rangeType={rangeType}
        anchor={anchor}
        customRange={customRange}
        onSelect={(date) => {
          setAnchor(date);
          setPickerVisible(false);
        }}
        onSelectCustomDay={(dateStr) => {
          setCustomRange((r) => {
            if (!r || r.end !== null) return { start: dateStr, end: null };
            return dateStr >= r.start ? { start: r.start, end: dateStr } : { start: dateStr, end: r.start };
          });
        }}
        onClose={() => {
          setPickerVisible(false);
          // Abandoning a pending pick (start tapped, no end yet) clears it
          // rather than leaving the range stuck showing "Select end date".
          setCustomRange((r) => (r && r.end === null ? null : r));
        }}
      />

      <FilterModal
        visible={filterVisible}
        categories={categories}
        filter={filter}
        onChange={setFilter}
        onClose={() => setFilterVisible(false)}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
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
  // Wider than the plain segmented cap below — this toggle has a 4th
  // ("Custom") option the List/Calendar and filter-type toggles don't.
  rangeToggle: {
    maxWidth: 320,
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
    // Slightly condensed vertically (2026-09-01, per feedback) — a plain
    // square (aspectRatio: 1) read as taller than it needed to be once every
    // row is a full 7-day week; > 1 keeps cells wider than tall.
    aspectRatio: 1.3,
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
  // Week mode's month grid with week-level selection (WeekCalendarView) —
  // each week is one bounding rectangle (weekRow) around 7 plain day cells
  // (weekDayCell, no individual border/background of their own, unlike
  // CalendarView's dayCell/dayCellInner) rather than each day getting its
  // own bordered cell.
  weekGrid: {
    gap: Spacing.two,
  },
  weekRow: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
  weekDayCell: {
    flexBasis: '14.2857%',
    // Fixed, not content-driven (2026-09-01, per feedback) — a plain
    // content-sized cell made a row with a 2-line (expense + income) day
    // taller than a row where every day shows at most one line or none,
    // since a flex row's cross-axis default is to stretch every cell to the
    // row's tallest one. Height covers dayNumber + two daySpend lines at
    // their own line-heights (14 + 1 + 11 + 1 + 11) with a little slack, so
    // every week row is the same height regardless of how much data it has.
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  // Year mode's 12-month grid (YearCalendarView) — same 3-row/4-column shape
  // as budget-editor.tsx's own year grid, sized for this screen's card.
  yearMonthGrid: {
    gap: Spacing.two,
  },
  yearMonthRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  yearMonthCell: {
    flex: 1,
  },
  yearMonthCellInner: {
    // Fixed, not content-driven (2026-09-01, per feedback, same fix as
    // weekDayCell below) — a plain content-sized cell made a row with a
    // 2-line (expense + income) month taller than a row where every month
    // shows at most one line or the "—" placeholder, since a flex row's
    // cross-axis default is to stretch every cell to the row's tallest one.
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
    gap: Spacing.three,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterCategoryScroll: {
    flexGrow: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  clearFiltersButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
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
