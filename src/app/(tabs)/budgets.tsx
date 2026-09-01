import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, CardRadius, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBudgetProgress, getBudgets, type Budget } from '@/lib/budgets';
import { categoriesForType, getCategories, type Category } from '@/lib/categories';
import { MONTH_NAMES } from '@/lib/date-range';
import { getTransactions, type Transaction } from '@/lib/transactions';

function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Same shape as Home/Transactions' own MonthYearPickerModal — duplicated
// rather than shared per the no-premature-abstraction rule (this makes 3
// near-identical copies, but Home's grew into a 3-mode week/month/year
// picker that no longer matches this plain month+year shape, so it isn't
// really a matching 3rd occurrence of *this* one).
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

export default function BudgetsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Expense Budgets and Income Goals are now two pages of one horizontal
  // pager (same pattern as Transactions' List/Calendar) instead of stacked
  // sections in a single scroll — each type gets the full page height for
  // its own summary card and category list.
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const pageWidth = useWindowDimensions().width;
  const pagerRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    Promise.all([getBudgets(), getTransactions(), getCategories()]).then(([b, t, c]) => {
      setBudgets(b);
      setTransactions(t);
      setCategories(c);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const monthStr = toMonthStr(month);
  const allProgress = getBudgetProgress(budgets, transactions, monthStr, categories);
  const progressByCategory = new Map(allProgress.map((p) => [p.categoryId, p]));
  const expenseCategories = categoriesForType(categories, 'expense');
  const incomeCategories = categoriesForType(categories, 'income');

  // Aggregate totals for each page's summary card — only categories that
  // actually have a limit/goal set (limit > 0) count toward either side, so
  // an all-unset month doesn't render a misleading "$0 of $0".
  const expenseProgress = allProgress.filter((p) => p.type === 'expense' && p.limit > 0);
  const incomeProgress = allProgress.filter((p) => p.type === 'income' && p.limit > 0);
  const totalExpenseLimit = expenseProgress.reduce((sum, p) => sum + p.limit, 0);
  const totalExpenseSpent = expenseProgress.reduce((sum, p) => sum + p.spent, 0);
  const totalIncomeLimit = incomeProgress.reduce((sum, p) => sum + p.limit, 0);
  const totalIncomeEarned = incomeProgress.reduce((sum, p) => sum + p.spent, 0);
  const overBudgetCount = expenseProgress.filter((p) => p.percent >= 1).length;
  const goalsReachedCount = incomeProgress.filter((p) => p.percent >= 1).length;
  const hasExpenseSummary = expenseProgress.length > 0;
  const hasIncomeSummary = incomeProgress.length > 0;

  function goToView(next: 'expense' | 'income') {
    setView(next);
    // animated: true silently no-ops on react-native-web here (same
    // scroll-snap-type/smooth-scroll quirk as Transactions' own pager) — an
    // instant jump still reads fine for a tab-style toggle.
    pagerRef.current?.scrollTo({ x: next === 'expense' ? 0 : pageWidth, animated: false });
  }

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setView(index === 0 ? 'expense' : 'income');
  }

  const bottomPadding = insets.bottom + BottomTabInset + Spacing.six;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Pinned above the pager (not inside it) so the title, month nav, and
          toggle stay visible while swiping/scrolling between pages — same
          treatment as Home and Transactions' own headers. */}
      <View style={{ paddingTop: insets.top + Spacing.three, backgroundColor: theme.background }}>
        <View style={[styles.headerContent, { paddingHorizontal: Spacing.three }]}>
          <ScreenHeader title="Budgets" right={<SettingsButton />} />

          <View style={styles.monthNav}>
            <Pressable hitSlop={12} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <MaterialIcons name="chevron-left" size={26} color={theme.accent} />
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setPickerVisible(true)}>
              <ThemedText type="smallBold">{monthLabel(monthStr)}</ThemedText>
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <MaterialIcons name="chevron-right" size={26} color={theme.accent} />
            </Pressable>
          </View>

          {/* Expense/Income segmented toggle — same red/green fill-on-select
              convention as add-transaction.tsx's own type toggle, so the
              color itself (not just the label) says which page is active. */}
          <View style={[styles.segmented, { borderColor: theme.border }]}>
            {(['expense', 'income'] as const).map((v) => {
              const segmentColor = v === 'expense' ? theme.destructive : theme.success;
              const isSelected = view === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => goToView(v)}
                  style={[styles.segment, isSelected && { backgroundColor: segmentColor }]}>
                  <MaterialIcons
                    name={v === 'expense' ? 'arrow-downward' : 'arrow-upward'}
                    size={14}
                    color={isSelected ? '#ffffff' : theme.textSecondary}
                  />
                  <ThemedText
                    type="smallBold"
                    themeColor={isSelected ? 'text' : 'textSecondary'}
                    style={isSelected && { color: '#ffffff' }}>
                    {v === 'expense' ? 'Expense' : 'Income'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Page dots — same 6px/16px-active shape as Transactions' own
              swipe-page indicator, tinted to match each page's segment
              color rather than a flat accent. */}
          <View style={styles.pageDots}>
            <View
              style={[
                styles.pageDot,
                { backgroundColor: theme.border },
                view === 'expense' && [styles.pageDotActive, { backgroundColor: theme.destructive }],
              ]}
            />
            <View
              style={[
                styles.pageDot,
                { backgroundColor: theme.border },
                view === 'income' && [styles.pageDotActive, { backgroundColor: theme.success }],
              ]}
            />
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              {view === 'expense' ? 'EXPENSE BUDGETS' : 'INCOME GOALS'}
            </ThemedText>
            <Pressable
              onPress={() => router.push(`/category-editor?type=${view}`)}
              hitSlop={8}
              style={[styles.addButton, { backgroundColor: theme.accent }]}>
              <MaterialIcons name="add" size={20} color="#ffffff" />
            </Pressable>
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
            <ScrollView
              contentContainerStyle={[
                styles.content,
                { paddingTop: Spacing.three, paddingBottom: bottomPadding },
              ]}>
              {hasExpenseSummary && (
                <View
                  style={[styles.summaryCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.summaryBlockHeader}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Total Budgeted
                    </ThemedText>
                    <ThemedText type="smallBold">
                      ${formatAmount(totalExpenseSpent)} / ${formatAmount(totalExpenseLimit)}
                    </ThemedText>
                  </View>
                  <ProgressBar percent={totalExpenseSpent / totalExpenseLimit} color={theme.destructive} type="expense" />
                  {overBudgetCount > 0 && (
                    <View style={[styles.overBudgetPill, { backgroundColor: theme.destructive + '1a' }]}>
                      <MaterialIcons name="error-outline" size={12} color={theme.destructive} />
                      <ThemedText type="small" themeColor="destructive" style={styles.overBudgetPillText}>
                        {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {expenseCategories.map((category, i) => {
                  const progress = progressByCategory.get(category.id);
                  const scheduled = budgets.find((b) => b.categoryId === category.id)?.scheduledChange;
                  const upcoming = scheduled && scheduled.startMonth > monthStr ? scheduled : null;

                  return (
                    <View key={category.id}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
                        ]}
                        onPress={() => router.push(`/budget-editor?id=${category.id}&month=${monthStr}`)}
                        onLongPress={() => router.push(`/category-editor?id=${category.id}`)}>
                        <View style={styles.rowHeader}>
                          <CategoryBadge category={category} size={32} type="expense" />
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
                            {upcoming && (
                              <ThemedText type="small" themeColor="accent">
                                Changing to ${formatAmount(upcoming.limit)} in {monthLabel(upcoming.startMonth)}
                              </ThemedText>
                            )}
                          </View>
                          <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                        </View>

                        {progress && (
                          <View style={styles.progressWrap}>
                            <ProgressBar percent={progress.percent} color={category.color} type="expense" />
                          </View>
                        )}
                      </Pressable>
                      {i < expenseCategories.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={{ width: pageWidth, flex: 1 }}>
            <ScrollView
              contentContainerStyle={[
                styles.content,
                { paddingTop: Spacing.three, paddingBottom: bottomPadding },
              ]}>
              {hasIncomeSummary && (
                <View
                  style={[styles.summaryCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.summaryBlockHeader}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Income Goals
                    </ThemedText>
                    <ThemedText type="smallBold">
                      ${formatAmount(totalIncomeEarned)} / ${formatAmount(totalIncomeLimit)}
                    </ThemedText>
                  </View>
                  <ProgressBar percent={totalIncomeEarned / totalIncomeLimit} color={theme.success} type="income" />
                  {goalsReachedCount > 0 && (
                    <View style={[styles.overBudgetPill, { backgroundColor: theme.success + '1a' }]}>
                      <MaterialIcons name="check-circle-outline" size={12} color={theme.success} />
                      <ThemedText type="small" themeColor="success" style={styles.overBudgetPillText}>
                        {goalsReachedCount} {goalsReachedCount === 1 ? 'goal' : 'goals'} reached
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.group, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {incomeCategories.map((category, i) => {
                  const progress = progressByCategory.get(category.id);
                  const scheduled = budgets.find((b) => b.categoryId === category.id)?.scheduledChange;
                  const upcoming = scheduled && scheduled.startMonth > monthStr ? scheduled : null;

                  return (
                    <View key={category.id}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
                        ]}
                        onPress={() => router.push(`/budget-editor?id=${category.id}&month=${monthStr}`)}
                        onLongPress={() => router.push(`/category-editor?id=${category.id}`)}>
                        <View style={styles.rowHeader}>
                          <CategoryBadge category={category} size={32} type="income" />
                          <View style={styles.rowTextGroup}>
                            <ThemedText type="small">{category.name}</ThemedText>
                            {progress ? (
                              <ThemedText type="small" themeColor="textSecondary">
                                ${formatAmount(progress.spent)} / ${formatAmount(progress.limit)}
                              </ThemedText>
                            ) : (
                              <ThemedText type="small" themeColor="accent">
                                Set goal
                              </ThemedText>
                            )}
                            {upcoming && (
                              <ThemedText type="small" themeColor="accent">
                                Changing to ${formatAmount(upcoming.limit)} in {monthLabel(upcoming.startMonth)}
                              </ThemedText>
                            )}
                          </View>
                          <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                        </View>

                        {progress && (
                          <View style={styles.progressWrap}>
                            <ProgressBar percent={progress.percent} color={category.color} type="income" />
                          </View>
                        )}
                      </Pressable>
                      {i < incomeCategories.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

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
    gap: Spacing.three,
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
  // Same shape as Transactions' own swipe-page dots.
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
  summaryCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two + 4,
  },
  summaryBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overBudgetPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.four,
  },
  overBudgetPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
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
  },
  row: {
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32 + Spacing.three * 2,
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
});
