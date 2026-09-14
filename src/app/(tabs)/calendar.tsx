import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RangePickerModal } from '@/components/range-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { getCategories, getCategory, type Category } from '@/lib/categories';
import {
  daysInMonth,
  formatRangeLabel,
  monthLabel,
  MONTH_NAMES,
  rangeBounds,
  shiftAnchor,
  startOfWeek,
  toDateStr,
  toMonthStr,
  type RangeType,
} from '@/lib/date-range';
import { getRecurring, isActiveRecurring, type RecurringTransaction } from '@/lib/recurring';
import { getTransactions, type Transaction } from '@/lib/transactions';

// Week/Month/Year only — Custom has no single-grid shape for an arbitrary
// range, which is also why this tab's range nav never offers it.
type CalendarRange = Extract<RangeType, 'week' | 'month' | 'year'>;

function dateHeaderLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A cell in a day grid (CalendarView's and WeekCalendarView's own) — either
// a real day (dateStr + display number) or `null` for a leading/trailing
// blank.
type DayGridCell = { dateStr: string; day: number };

// Month mode — a day-of-month grid (leading blanks + every day of the
// navigated month) showing each day's total spend/income, plus a
// tap-to-expand transaction list below it.
function CalendarView({
  month,
  transactions,
  categories,
  recurring,
  bottomPadding,
}: {
  month: Date;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringTransaction[];
  bottomPadding: number;
}) {
  const theme = useTheme();
  const { compact } = useCurrency();
  const monthStr = toMonthStr(month);
  const todayStr = toDateStr(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Adjusted during render against a tracked previous month rather than in a
  // useEffect (see index.tsx's own rangeKey comment) — the visible month
  // changed, so whatever day was selected no longer applies.
  const [prevMonthStr, setPrevMonthStr] = useState(monthStr);
  if (prevMonthStr !== monthStr) {
    setPrevMonthStr(monthStr);
    setSelectedDay(null);
  }

  // Both sides of each day — expense in red, income in green, same color
  // convention as everywhere else a transaction's type shows.
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
    // One ScrollView, grid included (2026-09-01, replacing an earlier
    // "freeze panes" split — the grid pinned above a separate inner
    // ScrollView for just the day-detail list) per feedback that scrolling
    // should be able to carry the grid away too, not just the list below it.
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
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
                      {'-' + compact(expense)}
                    </ThemedText>
                  )}
                  {income > 0 && (
                    <ThemedText
                      type="small"
                      themeColor={isSelected ? 'text' : 'success'}
                      style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                      numberOfLines={1}>
                      {'+' + compact(income)}
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
                    isRecurring={isActiveRecurring(t.recurringId, recurring)}
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
  );
}

// Week mode (2026-09-01, replacing an earlier "just the selected week's 7
// days" compact row per follow-up feedback that the whole month should stay
// visible) — the same day-of-month grid as CalendarView above, but the
// selectable/highlightable unit is a whole calendar week (one grid row), not
// a single day: each week is wrapped in its own bounding rectangle instead of
// each day getting its own bordered cell, the real current week's rectangle
// is outlined blue by default (the same "isToday" idea CalendarView's day
// cells use, just for a week instead of a day), and tapping any week's
// rectangle selects it — fills it blue and expands that whole week's
// transactions below, same "tap to expand" feel as a day in CalendarView.
// Not built as a mode of CalendarView since the selection unit itself
// differs (a week vs. a day), which would have meant threading an extra
// "granularity" flag through nearly every branch of that component instead
// of just writing a second one.
function WeekCalendarView({
  month,
  transactions,
  categories,
  recurring,
  bottomPadding,
}: {
  month: Date;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringTransaction[];
  bottomPadding: number;
}) {
  const theme = useTheme();
  const { compact } = useCurrency();
  const monthStr = toMonthStr(month);
  const todayStr = toDateStr(new Date());
  const todayWeekStart = toDateStr(startOfWeek(new Date()));
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);

  // Same render-time adjustment as CalendarView's own selectedDay above.
  const [prevMonthStr, setPrevMonthStr] = useState(monthStr);
  if (prevMonthStr !== monthStr) {
    setPrevMonthStr(monthStr);
    setSelectedWeekStart(null);
  }

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
    // One ScrollView, grid included — same 2026-09-01 change as CalendarView
    // above (see its own comment).
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
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
                            {'-' + compact(expense)}
                          </ThemedText>
                        )}
                        {income > 0 && (
                          <ThemedText
                            type="small"
                            themeColor={isSelected ? 'text' : 'success'}
                            style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                            numberOfLines={1}>
                            {'+' + compact(income)}
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
                    isRecurring={isActiveRecurring(t.recurringId, recurring)}
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
  );
}

// Year mode — a 12-month grid showing each month's expense/income totals.
// Tapping a month selects it (shows that month's transactions below, the
// same "tap to expand" feel as a day in CalendarView above) rather than
// drilling into a further day grid: a day-of-month grid for an entire year
// would be 12 grids at once, more navigation than a quick "what happened
// around when" glance calls for.
function YearCalendarView({
  year,
  transactions,
  categories,
  recurring,
  bottomPadding,
}: {
  year: number;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringTransaction[];
  bottomPadding: number;
}) {
  const theme = useTheme();
  const { compact } = useCurrency();
  const thisMonthStr = toMonthStr(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Same render-time adjustment as CalendarView's own selectedDay above.
  const [prevYear, setPrevYear] = useState(year);
  if (prevYear !== year) {
    setPrevYear(year);
    setSelectedMonth(null);
  }

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
    // One ScrollView, grid included — same 2026-09-01 change as CalendarView
    // above (see its own comment).
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
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
                          {'-' + compact(expense)}
                        </ThemedText>
                      )}
                      {income > 0 && (
                        <ThemedText
                          type="small"
                          themeColor={isSelected ? 'text' : 'success'}
                          style={[styles.daySpend, isSelected && styles.daySpendSelected]}
                          numberOfLines={1}>
                          {'+' + compact(income)}
                        </ThemedText>
                      )}
                      {expense === 0 && income === 0 && (
                        <ThemedText type="small" themeColor={isSelected ? 'text' : 'textTertiary'}>
                          -
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
                    isRecurring={isActiveRecurring(t.recurringId, recurring)}
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
  );
}

// Calendar (its own tab as of 2026-09-10 — was the Calendar page of
// Transactions' List/Calendar pager since 2026-08-26, split out per
// feedback; the three grid views above moved here verbatim). Week/Month/
// Year range nav, same chevrons/label/picker shape as Transactions' own,
// then whichever grid fits the range. No type/category filter here, unlike
// Transactions — the grids are a "what happened when" glance, not a search.
export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rangeType, setRangeType] = useState<CalendarRange>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getTransactions(), getCategories(), getRecurring()]).then(([t, c, r]) => {
        if (!cancelled) {
          setTransactions(t);
          setCategories(c);
          setRecurring(r);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const { label } = rangeBounds(rangeType, anchor, null);
  const bottomPadding = insets.bottom + BottomTabInset + Spacing.six;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* `paddingBottom` (2026-09-18) is load-bearing — see Home's own
          identical pinned-header comment for why: the ScrollView's own
          `paddingTop` only creates a gap for the very first scroll position,
          since it scrolls away with the grid/list below it. */}
      <View style={{ paddingTop: insets.top + Spacing.three, paddingBottom: Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Calendar" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(rangeType, a, -1))}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {label}
              </ThemedText>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(rangeType, a, 1))}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
            </Pressable>
          </View>

          <SegmentedControl
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
            value={rangeType}
            onChange={setRangeType}
          />
        </View>
      </View>

      {rangeType === 'week' ? (
        <WeekCalendarView
          month={anchor}
          transactions={transactions}
          categories={categories}
          recurring={recurring}
          bottomPadding={bottomPadding}
        />
      ) : rangeType === 'year' ? (
        <YearCalendarView
          year={anchor.getFullYear()}
          transactions={transactions}
          categories={categories}
          recurring={recurring}
          bottomPadding={bottomPadding}
        />
      ) : (
        <CalendarView
          month={anchor}
          transactions={transactions}
          categories={categories}
          recurring={recurring}
          bottomPadding={bottomPadding}
        />
      )}

      <Pressable
        onPress={() => router.push('/add-transaction')}
        style={[
          styles.fab,
          { backgroundColor: theme.accent, bottom: insets.bottom + BottomTabInset + Spacing.three },
        ]}>
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* customRange is always null / onSelectCustomDay a no-op — rangeType
          never reaches 'custom' here (see CalendarRange), same as Home. */}
      <RangePickerModal
        visible={pickerVisible}
        rangeType={rangeType}
        anchor={anchor}
        customRange={null}
        onSelect={(date) => {
          setAnchor(date);
          setPickerVisible(false);
        }}
        onSelectCustomDay={() => {}}
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
    // square (aspectRatio: 1) read as taller than it needed to be. 1.3 (same
    // day, follow-up feedback) overcorrected into looking squished; 1.15 is
    // a milder condense.
    aspectRatio: 1.15,
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
  // Tight lineHeight (not just fontSize) since a cell can show up to three
  // lines — day number, expense, income — in a small square.
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
    // weekDayCell above).
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
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
