import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, type Category, type CategoryType } from '@/lib/categories';
import { shortDateLabel } from '@/lib/date-range';
import { addRecurring, deleteRecurring, getRecurring, nextDueDate, type RecurringFrequency, type RecurringTransaction } from '@/lib/recurring';
import { addTransaction, deleteTransaction, getTransactions, updateTransaction } from '@/lib/transactions';

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function localDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
};

// The occurrence after `dateStr` for a not-yet-created series — previews
// "Next on …" in the Repeat card. Mirrors lib/recurring's own cursor math
// (monthly clamps to the next month's real length) without needing a
// RecurringTransaction record to exist yet.
function nextOccurrence(dateStr: string, frequency: RecurringFrequency): Date {
  const date = localDate(dateStr);
  if (frequency === 'monthly') {
    const day = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
    return next;
  }
  date.setDate(date.getDate() + (frequency === 'weekly' ? 7 : 14));
  return date;
}

function CalendarPicker({
  selected,
  onSelect,
  maxDateStr,
}: {
  selected: string;
  onSelect: (dateStr: string) => void;
  maxDateStr: string;
}) {
  const theme = useTheme();
  const selectedDate = new Date(`${selected}T00:00:00`);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const total = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <View style={[styles.calendar, CardShadow, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.calendarHeader}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            const d = new Date(viewYear, viewMonth - 1, 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }}>
          <MaterialIcons name="chevron-left" size={22} color={theme.accent} />
        </Pressable>
        <ThemedText type="small">
          {new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </ThemedText>
        <Pressable
          hitSlop={8}
          onPress={() => {
            const d = new Date(viewYear, viewMonth + 1, 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }}>
          <MaterialIcons name="chevron-right" size={22} color={theme.accent} />
        </Pressable>
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={styles.calendarCell} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === selected;
          const isDisabled = dateStr > maxDateStr;
          return (
            <Pressable
              key={dateStr}
              disabled={isDisabled}
              onPress={() => onSelect(dateStr)}
              style={[
                styles.calendarCell,
                styles.calendarDay,
                isSelected && { backgroundColor: theme.accent },
              ]}>
              <ThemedText
                type="small"
                themeColor={isSelected ? 'text' : isDisabled ? 'textTertiary' : 'text'}
                style={isSelected && { color: '#ffffff' }}>
                {day}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AddTransactionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id, repeat: repeatParam } = useLocalSearchParams<{ id?: string; repeat?: string }>();
  const isEditing = !!id;

  const [type, setType] = useState<CategoryType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [note, setNote] = useState('');
  // Transactions' FAB links here with ?repeat=1 from its Recurring page so
  // the checkbox starts pre-checked — previously the only way to reach this
  // flow at all was to notice the checkbox while adding an otherwise one-off
  // transaction.
  const [repeat, setRepeat] = useState(() => repeatParam === '1');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStopRepeat, setConfirmingStopRepeat] = useState(false);
  // Keeps the Repeat card visible in a "stopped" state after stopping, so
  // the row doesn't just vanish with no acknowledgement of what happened.
  const [stoppedRecurring, setStoppedRecurring] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  // Set only when this transaction was generated by (or seeded alongside) a
  // recurring series that's still active — resolved by cross-referencing the
  // transaction's own recurringId against getRecurring() rather than trusting
  // recurringId alone, since a series can be stopped after the fact while its
  // past transactions keep carrying the id (a harmless historical marker at
  // that point, not something to offer "Stop repeating" for again). Holds the
  // whole record, not just its id, so the "Stop repeating" row can say which
  // frequency it's actually stopping.
  const [activeRecurring, setActiveRecurring] = useState<RecurringTransaction | null>(null);

  useEffect(() => {
    getCategories().then(setAllCategories);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([getTransactions(), getRecurring()]).then(([transactions, recurring]) => {
      const existing = transactions.find((t) => t.id === id);
      if (existing) {
        setType(existing.type);
        setAmount(String(existing.amount));
        setCategoryId(existing.categoryId);
        setDate(existing.date);
        setNote(existing.note ?? '');
        const series = existing.recurringId ? recurring.find((r) => r.id === existing.recurringId) : undefined;
        if (series) setActiveRecurring(series);
      }
      setLoaded(true);
    });
  }, [id]);

  const categories = categoriesForType(allCategories, type);
  const parsedAmount = parseFloat(amount);
  const canSave = !Number.isNaN(parsedAmount) && parsedAmount > 0 && !!categoryId;
  // Standardized across the app: expense = destructive (red), income = success (green).
  const typeColor = type === 'expense' ? theme.destructive : theme.success;

  async function handleSave() {
    if (!canSave || !categoryId) return;
    if (isEditing && id) {
      await updateTransaction(id, { type, amount: parsedAmount, categoryId, date, note: note.trim() || undefined });
    } else if (repeat) {
      // Create the series first so the seed transaction below can carry its
      // id, and mark this transaction's own occurrence as already generated
      // (lastGeneratedMonth for monthly, lastGeneratedDate for weekly/
      // biweekly) — otherwise the next session's generateDueTransactions
      // would find nothing generated yet, start its cursor back at this same
      // occurrence, and double-log it.
      const recurring = await addRecurring(
        frequency === 'monthly'
          ? {
              type,
              amount: parsedAmount,
              categoryId,
              note: note.trim() || undefined,
              frequency,
              dayOfMonth: new Date(`${date}T00:00:00`).getDate(),
              startDate: date,
              lastGeneratedMonth: date.slice(0, 7),
            }
          : {
              type,
              amount: parsedAmount,
              categoryId,
              note: note.trim() || undefined,
              frequency,
              startDate: date,
              lastGeneratedDate: date,
            }
      );
      await addTransaction({
        type,
        amount: parsedAmount,
        categoryId,
        date,
        note: note.trim() || undefined,
        recurringId: recurring.id,
      });
    } else {
      await addTransaction({ type, amount: parsedAmount, categoryId, date, note: note.trim() || undefined });
    }
    router.back();
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (id) await deleteTransaction(id);
    router.back();
  }

  // Stops future occurrences only — past transactions this series already
  // generated (including this one, if it's part of that history) keep their
  // recurringId as a harmless historical marker, same as canceling a
  // subscription doesn't erase what you already paid for it.
  async function handleStopRepeating() {
    if (!confirmingStopRepeat) {
      setConfirmingStopRepeat(true);
      return;
    }
    if (activeRecurring) await deleteRecurring(activeRecurring.id);
    setActiveRecurring(null);
    setConfirmingStopRepeat(false);
    setStoppedRecurring(true);
  }

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Transaction' : 'Add Transaction' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        <SegmentedControl
          options={[
            { value: 'expense', label: 'Expense', icon: 'arrow-downward', color: theme.destructive },
            { value: 'income', label: 'Income', icon: 'arrow-upward', color: theme.success },
          ]}
          value={type}
          onChange={(t) => {
            setType(t);
            setCategoryId(null);
          }}
          style={styles.fullWidthToggle}
        />

        <View style={styles.amountRow}>
          <ThemedText type="title" style={[styles.currencySign, { color: typeColor }]}>
            $
          </ThemedText>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: typeColor }]}
            autoFocus={!isEditing}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Category
          </ThemedText>
          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const isSelected = category.id === categoryId;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[
                    styles.categoryChip,
                    { borderColor: isSelected ? typeColor : theme.border },
                    isSelected && { backgroundColor: typeColor + '1A' },
                  ]}>
                  <CategoryBadge category={category} size={26} type={type} />
                  <ThemedText type="small">{category.name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Date
          </ThemedText>
          <Pressable
            onPress={() => setShowCalendar((v) => !v)}
            style={[styles.dateButton, { borderColor: theme.border }]}>
            <MaterialIcons name="event" size={18} color={theme.textSecondary} />
            <ThemedText type="small">
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </ThemedText>
          </Pressable>
          {showCalendar && (
            <CalendarPicker
              selected={date}
              maxDateStr={toDateStr(new Date())}
              onSelect={(d) => {
                setDate(d);
                setShowCalendar(false);
              }}
            />
          )}
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Note (optional)
          </ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note"
            placeholderTextColor={theme.textTertiary}
            style={[styles.noteInput, { borderColor: theme.border, color: theme.text }]}
          />
        </View>

        {/* Repeat card (redesigned 2026-09-10 from a bare checkbox row + a
            text-link "stop repeating" line, per feedback) — the same card
            shape in both modes: icon, a title, a subtitle that says what will
            actually happen, and the control on the right. New transactions
            get a Switch that reveals the frequency toggle plus a "Next on …"
            preview; an existing recurring transaction gets the series'
            details and a two-tap Stop, and the card stays put in a stopped
            state afterwards rather than disappearing. */}
        {!isEditing && (
          <View style={[styles.repeatCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable style={styles.repeatHeader} onPress={() => setRepeat((v) => !v)}>
              <View style={[styles.repeatIcon, { backgroundColor: (repeat ? theme.accent : theme.textTertiary) + '1A' }]}>
                <MaterialIcons name="event-repeat" size={20} color={repeat ? theme.accent : theme.textTertiary} />
              </View>
              <View style={styles.repeatText}>
                <ThemedText type="default" style={styles.repeatTitle}>
                  Repeat
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {repeat ? `${FREQUENCY_LABEL[frequency]} · next on ${shortDateLabel(nextOccurrence(date, frequency))}` : 'Off'}
                </ThemedText>
              </View>
              <Switch
                value={repeat}
                onValueChange={setRepeat}
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#ffffff"
              />
            </Pressable>
            {/* Frequency only appears once Repeat is on — meaningless
                otherwise. Defaults to Monthly, the pre-existing behavior from
                before weekly/biweekly existed. */}
            {repeat && (
              <View style={[styles.repeatBody, { borderTopColor: theme.border }]}>
                <SegmentedControl
                  options={[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Biweekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  value={frequency}
                  onChange={setFrequency}
                  style={styles.fullWidthToggle}
                />
              </View>
            )}
          </View>
        )}

        {isEditing && (activeRecurring || stoppedRecurring) && (
          <View style={[styles.repeatCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.repeatHeader}>
              <View style={[styles.repeatIcon, { backgroundColor: (activeRecurring ? theme.accent : theme.textTertiary) + '1A' }]}>
                <MaterialIcons
                  name="event-repeat"
                  size={20}
                  color={activeRecurring ? theme.accent : theme.textTertiary}
                />
              </View>
              <View style={styles.repeatText}>
                <ThemedText type="default" style={styles.repeatTitle}>
                  {activeRecurring ? `Repeats ${FREQUENCY_LABEL[activeRecurring.frequency].toLowerCase()}` : 'Repeating stopped'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {activeRecurring
                    ? `Next on ${shortDateLabel(localDate(nextDueDate(activeRecurring)))} · since ${shortDateLabel(localDate(activeRecurring.startDate))}`
                    : 'No more will be added. Past ones stay.'}
                </ThemedText>
              </View>
              {activeRecurring && (
                <Pressable
                  onPress={handleStopRepeating}
                  hitSlop={8}
                  style={[
                    styles.stopButton,
                    { backgroundColor: confirmingStopRepeat ? theme.destructive : theme.destructive + '1A' },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={confirmingStopRepeat ? undefined : 'destructive'}
                    style={confirmingStopRepeat && { color: '#ffffff' }}>
                    {confirmingStopRepeat ? 'Confirm' : 'Stop'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, { backgroundColor: canSave ? typeColor : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            Save
          </ThemedText>
        </Pressable>

        {isEditing && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={18} color={theme.destructive} />
            <ThemedText type="small" themeColor="destructive">
              {confirmingDelete ? 'Tap again to delete' : 'Delete transaction'}
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  // This form's toggles span the whole content width, unlike the tabs' own
  // 280-capped ones.
  fullWidthToggle: {
    maxWidth: '100%',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  currencySign: {
    fontSize: 32,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '600',
    minWidth: 120,
    textAlign: 'left',
  },
  field: {
    gap: Spacing.two,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  calendar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CardRadius,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    borderRadius: 999,
  },
  noteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  repeatCard: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  repeatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  repeatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatText: {
    flex: 1,
    gap: 2,
  },
  repeatTitle: {
    fontWeight: '600',
  },
  repeatBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  stopButton: {
    paddingVertical: Spacing.two - 1,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
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
    gap: 6,
    paddingVertical: Spacing.two,
  },
});
