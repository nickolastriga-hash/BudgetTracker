import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { EditorHeader } from '@/components/editor-header';
import { ColorPicker, IconPicker, resolveIcon } from '@/components/icon-color-picker';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import {
  CATEGORY_COLORS,
  FALLBACK_CATEGORY_ID,
  categoriesForType,
  getCategories,
  type Category,
  type CategoryIcon,
} from '@/lib/categories';
import { MONTH_NAMES, toDateStr, toMonthStr } from '@/lib/date-range';
import {
  addContribution,
  addGoal,
  deleteGoal,
  getGoals,
  goalProgress,
  removeContribution,
  updateGoal,
  type SavingsGoal,
} from '@/lib/goals';


function monthStrLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function shortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Six months out — a reasonable first guess for a deadline, adjusted from
// the month grid below.
function defaultTargetMonth() {
  const d = new Date();
  return toMonthStr(new Date(d.getFullYear(), d.getMonth() + 6, 1));
}

export default function GoalEditorScreen() {
  const theme = useTheme();
  const { format, symbol } = useCurrency();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [targetMonth, setTargetMonth] = useState(defaultTargetMonth);
  const [calendarYear, setCalendarYear] = useState(() => Number(defaultTargetMonth().split('-')[0]));
  const [color, setColor] = useState<string>(CATEGORY_COLORS[3]);
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [logContributions, setLogContributions] = useState(false);
  const [contributionCategoryId, setContributionCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-reads just the goal record after a contribution change — the form
  // fields above it are left alone so unsaved edits aren't clobbered.
  async function reloadGoal(goalId: string) {
    setGoal((await getGoals()).find((g) => g.id === goalId) ?? null);
  }

  useEffect(() => {
    Promise.all([getGoals(), getCategories()]).then(([goals, loadedCategories]) => {
      setCategories(loadedCategories);
      if (!id) {
        // Next unused palette slot (starting from green) so each new goal
        // gets its own color by default, same idea as debt-editor.
        setColor(CATEGORY_COLORS[(3 + goals.length) % CATEGORY_COLORS.length]);
        return;
      }
      const existing = goals.find((g) => g.id === id) ?? null;
      setGoal(existing);
      if (existing) {
        setName(existing.name);
        setTargetAmount(String(existing.targetAmount));
        setHasDeadline(!!existing.targetMonth);
        if (existing.targetMonth) {
          setTargetMonth(existing.targetMonth);
          setCalendarYear(Number(existing.targetMonth.split('-')[0]));
        }
        setColor(existing.color);
        setIcon(existing.icon);
        setLogContributions(!!existing.logContributions);
        setContributionCategoryId(existing.contributionCategoryId ?? null);
      }
      setLoaded(true);
    });
  }, [id]);

  const expenseCategories = categoriesForType(categories, 'expense');

  const parsedTarget = parseFloat(targetAmount);
  const canSave = name.trim().length > 0 && !Number.isNaN(parsedTarget) && parsedTarget > 0;
  const displayIcon = resolveIcon(icon, name);
  const progress = goal ? goalProgress(goal) : null;
  const parsedContribution = parseFloat(contributionAmount);
  const canContribute = !Number.isNaN(parsedContribution) && parsedContribution > 0;

  async function handleSave() {
    if (!canSave) return;
    const fields = {
      name: name.trim(),
      icon: displayIcon,
      color,
      targetAmount: parsedTarget,
      targetMonth: hasDeadline ? targetMonth : undefined,
    };
    if (isEditing && id) await updateGoal(id, fields);
    else await addGoal(fields);
    router.back();
  }

  async function handleContribute(sign: 1 | -1) {
    if (!id || !canContribute) return;
    await addContribution(id, sign * parsedContribution, toDateStr(new Date()));
    setContributionAmount('');
    await reloadGoal(id);
  }

  // Saved as soon as it's changed, not on Save — money can be added without
  // ever tapping Save, and addContribution reads the choice off the record.
  async function handleToggleLogContributions(value: boolean) {
    if (!id) return;
    const fallback = expenseCategories.some((c) => c.id === FALLBACK_CATEGORY_ID.expense)
      ? FALLBACK_CATEGORY_ID.expense
      : (expenseCategories[0]?.id ?? null);
    const categoryId = contributionCategoryId ?? fallback;
    setLogContributions(value);
    setContributionCategoryId(categoryId);
    await updateGoal(id, { logContributions: value, contributionCategoryId: categoryId ?? undefined });
  }

  async function handlePickContributionCategory(categoryId: string) {
    if (!id) return;
    setContributionCategoryId(categoryId);
    await updateGoal(id, { contributionCategoryId: categoryId });
  }

  async function handleRemoveContribution(contributionId: string) {
    if (!id) return;
    await removeContribution(id, contributionId);
    await reloadGoal(id);
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (id) await deleteGoal(id);
    router.back();
  }

  if (!loaded) return null;

  const calendarMonths = Array.from({ length: 12 }, (_, i) => `${calendarYear}-${String(i + 1).padStart(2, '0')}`);
  const calendarRows = [calendarMonths.slice(0, 4), calendarMonths.slice(4, 8), calendarMonths.slice(8, 12)];
  const contributions = goal ? goal.contributions.slice().reverse() : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <EditorHeader
        title={isEditing ? name || 'Edit Goal' : 'New Savings Goal'}
        badge={<CategoryBadge category={{ icon: displayIcon, color }} size={30} />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        {goal && progress && (
          <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.progressHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                Saved so far
              </ThemedText>
              <ThemedText type="smallBold">
                {format(progress.saved)} / {format(goal.targetAmount)}
              </ThemedText>
            </View>
            <ProgressBar percent={progress.percent} color={color} type="income" />
            <ThemedText type="small" themeColor={progress.percent >= 1 ? 'success' : 'textSecondary'}>
              {progress.percent >= 1
                ? 'Goal reached'
                : progress.neededPerMonth !== null && goal.targetMonth
                  ? progress.monthsLeft === 0
                    ? `Deadline passed, ${format(progress.remaining)} still to go`
                    : `${format(progress.neededPerMonth)}/mo to reach it by ${monthStrLabel(goal.targetMonth)}`
                  : `${format(progress.remaining)} to go`}
            </ThemedText>
          </View>
        )}

        {isEditing && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              ADD MONEY
            </ThemedText>
            <View style={styles.contributeRow}>
              <View style={[styles.amountInputWrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ThemedText type="default" themeColor="textSecondary">
                  {symbol}
                </ThemedText>
                <TextInput
                  value={contributionAmount}
                  onChangeText={setContributionAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: theme.text }]}
                />
              </View>
              <Pressable
                onPress={() => handleContribute(1)}
                disabled={!canContribute}
                accessibilityLabel="Add to goal"
                style={[styles.contributeButton, { backgroundColor: canContribute ? theme.success : theme.backgroundElement }]}>
                <MaterialIcons name="add" size={20} color={canContribute ? '#ffffff' : theme.textTertiary} />
              </Pressable>
              <Pressable
                onPress={() => handleContribute(-1)}
                disabled={!canContribute}
                accessibilityLabel="Withdraw from goal"
                style={[styles.contributeButton, { backgroundColor: canContribute ? theme.destructive : theme.backgroundElement }]}>
                <MaterialIcons name="remove" size={20} color={canContribute ? '#ffffff' : theme.textTertiary} />
              </Pressable>
            </View>
            <View style={styles.logRow}>
              <View style={styles.logRowText}>
                <ThemedText type="small">Also log as a transaction</ThemedText>
                <ThemedText type="small" themeColor="textTertiary">
                  {logContributions
                    ? 'Adding money logs an expense, withdrawing logs income. Removing one below removes its transaction.'
                    : 'Only the goal changes. Turn on to add a transaction too.'}
                </ThemedText>
              </View>
              <Switch
                value={logContributions}
                onValueChange={handleToggleLogContributions}
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#ffffff"
              />
            </View>
            {logContributions && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {expenseCategories.map((category) => {
                  const isSelected = category.id === contributionCategoryId;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => handlePickContributionCategory(category.id)}
                      style={[
                        styles.categoryChip,
                        { borderColor: isSelected ? theme.destructive : theme.border },
                        isSelected && { backgroundColor: theme.destructive + '1A' },
                      ]}>
                      <CategoryBadge category={category} size={26} type="expense" />
                      <ThemedText type="small">{category.name}</ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {contributions.length > 0 && (
              <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {contributions.map((c, i) => (
                  <View key={c.id}>
                    <View style={styles.contributionRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.contributionDate}>
                        {shortDate(c.date)}
                      </ThemedText>
                      <ThemedText type="smallBold" themeColor={c.amount >= 0 ? 'success' : 'destructive'}>
                        {c.amount >= 0 ? '+' : '-'}{format(Math.abs(c.amount))}
                      </ThemedText>
                      <Pressable hitSlop={8} onPress={() => handleRemoveContribution(c.id)}>
                        <MaterialIcons name="close" size={18} color={theme.textTertiary} />
                      </Pressable>
                    </View>
                    {i < contributions.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Name
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Emergency fund, Vacation, New laptop…"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Target amount
          </ThemedText>
          <TextInput
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="5000"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.deadlineRow}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Deadline
              </ThemedText>
              <ThemedText type="small">{hasDeadline ? monthStrLabel(targetMonth) : 'No deadline'}</ThemedText>
            </View>
            <Switch
              value={hasDeadline}
              onValueChange={setHasDeadline}
              trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
              thumbColor="#ffffff"
            />
          </View>
          {hasDeadline && (
            <View>
              <View style={styles.yearNav}>
                <Pressable hitSlop={10} onPress={() => setCalendarYear((y) => y - 1)}>
                  <MaterialIcons name="chevron-left" size={22} color={theme.accent} />
                </Pressable>
                <ThemedText type="smallBold">{calendarYear}</ThemedText>
                <Pressable hitSlop={10} onPress={() => setCalendarYear((y) => y + 1)}>
                  <MaterialIcons name="chevron-right" size={22} color={theme.accent} />
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {calendarRows.map((row) => (
                  <View key={row[0]} style={styles.monthGridRow}>
                    {row.map((monthStr, i) => {
                      const isSelected = monthStr === targetMonth;
                      return (
                        <Pressable
                          key={monthStr}
                          onPress={() => setTargetMonth(monthStr)}
                          style={[
                            styles.monthCell,
                            { backgroundColor: isSelected ? theme.accent : theme.backgroundElement },
                          ]}>
                          <ThemedText type="smallBold" style={isSelected && styles.monthCellTextSelected}>
                            {MONTH_NAMES[Number(monthStr.split('-')[1]) - 1] ?? MONTH_NAMES[i]}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Color
          </ThemedText>
          <ColorPicker value={color} onChange={setColor} />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Icon
          </ThemedText>
          <IconPicker value={icon} name={name} color={color} onChange={setIcon} />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            {isEditing ? 'Save changes' : 'Create goal'}
          </ThemedText>
        </Pressable>

        {isEditing && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={18} color={theme.destructive} />
            <ThemedText type="small" themeColor="destructive">
              {confirmingDelete ? 'Tap again to delete this goal' : 'Delete goal'}
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  field: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  progressCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  amountInput: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  contributeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  logRowText: {
    flex: 1,
    gap: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  group: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  contributionDate: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.two,
  },
  monthGrid: {
    gap: Spacing.two,
  },
  monthGridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  monthCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
  },
  monthCellTextSelected: {
    color: '#ffffff',
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
