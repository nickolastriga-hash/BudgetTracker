import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { SegmentedControl } from '@/components/segmented-control';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, getCategory, type Category } from '@/lib/categories';
import {
  rangeBounds,
  shiftAnchor,
  shiftCustomRange,
  shortDateLabel,
  type CustomRange,
  type RangeType,
} from '@/lib/date-range';
import { deleteRecurring, getRecurring, nextDueDate, type RecurringTransaction } from '@/lib/recurring';
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

// Generic over anything with a type + categoryId (a Transaction or a
// RecurringTransaction) so the one filter narrows the Recurring page too.
function applyTransactionFilter<T extends { type: TransactionType; categoryId: string }>(
  transactions: T[],
  filter: TransactionFilter
): T[] {
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

// Type + category filter, reached via the funnel button in the header.
// Applies to both List and Recurring (the caller filters before handing
// data to either page, so neither page has to know about filtering itself). Live-applies as you tap rather than needing an
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

          <SegmentedControl
            options={[
              { value: 'all', label: 'All' },
              { value: 'expense', label: 'Expenses', color: theme.destructive },
              { value: 'income', label: 'Income', color: theme.success },
            ]}
            value={filter.type}
            onChange={setType}
          />

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

// "YYYY-MM-DD" parsed via local y/m/d getters, not `new Date(dateStr)` — the
// latter parses as UTC midnight, which shortDateLabel's local-timezone
// formatting can then roll back a day (same reasoning as transaction-row.tsx).
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
  // Two-tap confirm kept local to the row rather than lifted to the screen —
  // avoids tracking "which row is confirming" in parent state.
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
      <View style={styles.recurringRow}>
        {category && <CategoryBadge category={category} color={typeColor} size={42} />}
        <View style={styles.recurringRowMiddle}>
          <ThemedText type="default" numberOfLines={1}>
            {category?.name ?? 'Other'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {frequencyLabel(item)} — next {shortDateLabel(localDateFromStr(nextDueDate(item)))}
          </ThemedText>
        </View>
        <View style={styles.recurringRowEnd}>
          <ThemedText type="default" style={[styles.recurringAmount, { color: typeColor }]}>
            {isExpense ? '-' : '+'}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </ThemedText>
          <Pressable onPress={handleStopPress} hitSlop={8}>
            <ThemedText type="small" themeColor={confirming ? 'destructive' : 'accent'}>
              {confirming ? 'Tap again' : 'Stop'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      {!isLast && <View style={[styles.divider, styles.rowDividerInset, { backgroundColor: theme.border }]} />}
    </View>
  );
}

// Normalizes a series' per-occurrence amount to a monthly figure so
// differently-paced series (weekly/biweekly/monthly) can be summed into one
// meaningful total — 52/12 and 26/12 weeks-per-month, not a flat ×4, so a
// weekly series doesn't quietly undercount the months that have a 5th week.
function monthlyEquivalent(item: RecurringTransaction): number {
  const occurrencesPerMonth = item.frequency === 'weekly' ? 52 / 12 : item.frequency === 'biweekly' ? 26 / 12 : 1;
  return item.amount * occurrencesPerMonth;
}

// Fills the space the range nav leaves behind while the Recurring page is
// showing (2026-09-10, see the rangeNav/rangeNavHidden styles below) with
// something that's actually about this page: how many series there are and
// what they add up to per month. Absolutely positioned over that same,
// still-reserved space rather than replacing it in the layout flow — keeps
// this to exactly the nav's own footprint with no separate height to keep in
// sync.
function RecurringSummary({ items }: { items: RecurringTransaction[] }) {
  const theme = useTheme();
  let expenseMonthly = 0;
  let incomeMonthly = 0;
  for (const item of items) {
    if (item.type === 'expense') expenseMonthly += monthlyEquivalent(item);
    else incomeMonthly += monthlyEquivalent(item);
  }
  const count = items.length;

  return (
    <View style={styles.recurringSummary} pointerEvents="none">
      <View style={styles.recurringSummaryCount}>
        <MaterialIcons name="event-repeat" size={16} color={theme.textSecondary} />
        <ThemedText type="smallBold" themeColor="textSecondary">
          {count} recurring {count === 1 ? 'transaction' : 'transactions'}
        </ThemedText>
      </View>
      {count > 0 && (expenseMonthly > 0 || incomeMonthly > 0) && (
        <View style={styles.recurringSummaryTotals}>
          {expenseMonthly > 0 && (
            <ThemedText type="smallBold" themeColor="destructive">
              -${expenseMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
            </ThemedText>
          )}
          {expenseMonthly > 0 && incomeMonthly > 0 && (
            <ThemedText type="small" themeColor="textTertiary">
              ·
            </ThemedText>
          )}
          {incomeMonthly > 0 && (
            <ThemedText type="smallBold" themeColor="success">
              +${incomeMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

// The pager's Recurring page (2026-09-10) — every active RecurringTransaction
// series, soonest-due-first, with a two-tap Stop per row. Not period-scoped
// (a series just is or isn't active, whatever range the nav is on), which is
// why the screen hides the range nav while this page is showing. Stopping
// only removes the series going forward; transactions it already generated
// stay put. View/add/stop only — editing a series after creation isn't
// built (TODO.md).
function RecurringView({
  items,
  categories,
  hasFilter,
  bottomPadding,
  onStop,
}: {
  items: RecurringTransaction[];
  categories: Category[];
  hasFilter: boolean;
  bottomPadding: number;
  onStop: (id: string) => void;
}) {
  const theme = useTheme();
  const sorted = [...items].sort((a, b) => (nextDueDate(a) < nextDueDate(b) ? -1 : 1));

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
      {sorted.length === 0 ? (
        <View style={[styles.group, styles.emptyGroup, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialIcons name="event-repeat" size={28} color={theme.textTertiary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            {hasFilter ? 'No matching recurring transactions.' : 'No recurring transactions yet. Tap + to set one up.'}
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
              onStop={() => onStop(item.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// Calendar was the middle page of this pager until 2026-09-10, when it became
// its own tab (see calendar.tsx).
const PAGES = ['list', 'recurring'] as const;
type PagerView = (typeof PAGES)[number];

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<PagerView>('list');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const pageWidth = useWindowDimensions().width;
  const pagerRef = useRef<ScrollView>(null);
  const pages = PAGES;

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

  async function handleStopRecurring(id: string) {
    await deleteRecurring(id);
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  }

  const { start, end, label } = rangeBounds(rangeType, anchor, customRange);

  // Closes the picker the instant a custom range is completed (its second
  // tap sets `end`) — value-keyed no-op the rest of the time (adjusted
  // during render, same reasoning throughout this pass — see index.tsx's
  // own rangeKey comment), so reopening the modal to edit an already-complete
  // range doesn't re-fire this and immediately close it again.
  const customRangeKey = customRange ? `${customRange.start}|${customRange.end ?? ''}` : '';
  const [prevCustomRangeKey, setPrevCustomRangeKey] = useState(customRangeKey);
  if (prevCustomRangeKey !== customRangeKey) {
    setPrevCustomRangeKey(customRangeKey);
    if (customRange?.end) setPickerVisible(false);
  }

  const filteredTransactions = useMemo(() => applyTransactionFilter(transactions, filter), [transactions, filter]);
  const filteredRecurring = useMemo(() => applyTransactionFilter(recurring, filter), [recurring, filter]);
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

  function goToView(next: PagerView) {
    setView(next);
    // animated: true silently no-ops on react-native-web here (scrollLeft
    // never moves, likely a scroll-snap-type/smooth-scroll interaction) —
    // an instant jump still reads fine for a tab-style toggle.
    pagerRef.current?.scrollTo({ x: pages.indexOf(next) * pageWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setView(pages[index] ?? 'list');
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

  // The pager's List page, for every rangeType.
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

          {/* The range nav doesn't apply to the Recurring page (a series
              isn't period-scoped) — hidden there, but still laid out
              (opacity 0, not unmounted) so the view toggle below stays put
              instead of jumping up as the pager settles on that page.
              RecurringSummary (2026-09-10) fills the space it leaves behind
              instead of leaving it blank — see that component's own
              comment for why it's an absolute overlay rather than a second
              element in the flow. */}
          <View style={styles.rangeNavContainer}>
            <View
              style={[styles.rangeNav, view === 'recurring' && styles.rangeNavHidden]}
              pointerEvents={view === 'recurring' ? 'none' : 'auto'}>
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

              <SegmentedControl
                options={[
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' },
                  { value: 'custom', label: 'Custom' },
                ]}
                value={rangeType}
                onChange={(rt) => {
                  setRangeType(rt);
                  if (rt === 'custom' && !customRange) setPickerVisible(true);
                }}
                style={styles.rangeToggle}
              />
            </View>

            {view === 'recurring' && <RecurringSummary items={filteredRecurring} />}
          </View>

          <SegmentedControl
            options={pages.map((v) => ({
              value: v,
              label: v === 'list' ? 'List' : 'Recurring',
              icon: v === 'list' ? 'view-list' : 'event-repeat',
            }))}
            value={view}
            onChange={goToView}
          />

          {/* Page dots — same shape as HabitTracker's own swipe-page
              indicator (6px dot, active one widens to 16 and turns
              accent) — a passive readout of which page the pager is on,
              alongside the segmented control above which still does the
              actual tapping. */}
          <View style={styles.pageDots}>
            {pages.map((v) => (
              <View
                key={v}
                style={[styles.pageDot, { backgroundColor: theme.border }, view === v && [styles.pageDotActive, { backgroundColor: theme.accent }]]}
              />
            ))}
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
          {pages.map((p) => (
            <View key={p} style={{ width: pageWidth, flex: 1 }}>
              {p === 'list' ? (
                transactionList
              ) : (
                <RecurringView
                  items={filteredRecurring}
                  categories={categories}
                  hasFilter={hasFilter}
                  bottomPadding={bottomPadding}
                  onStop={handleStopRecurring}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* On the Recurring page the FAB opens the same modal with its Repeat
          box pre-checked (see add-transaction.tsx's `repeat` param). */}
      <Pressable
        onPress={() => router.push(view === 'recurring' ? '/add-transaction?repeat=1' : '/add-transaction')}
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
  // Wraps the month nav + range toggle so both can be hidden together on the
  // Recurring page; carries the same gap headerContent gives its own children.
  // Relatively positioned so RecurringSummary (an absolute overlay, see its
  // own comment) sizes itself off rangeNav's own footprint rather than
  // needing a height to keep in sync by hand.
  rangeNavContainer: {
    position: 'relative',
  },
  rangeNav: {
    gap: Spacing.three,
  },
  rangeNavHidden: {
    opacity: 0,
  },
  recurringSummary: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recurringSummaryCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recurringSummaryTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Wider than SegmentedControl's default cap — this toggle has a 4th
  // ("Custom") option the view and filter-type toggles don't.
  rangeToggle: {
    maxWidth: 400,
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
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  recurringRowMiddle: {
    flex: 1,
    gap: 2,
  },
  recurringRowEnd: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recurringAmount: {
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  rowDividerInset: {
    marginLeft: 42 + Spacing.three * 2,
    marginHorizontal: 0,
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
