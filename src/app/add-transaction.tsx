import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarPicker } from '@/components/calendar-picker';
import { CategoryBadge } from '@/components/category-badge';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, type Category, type CategoryType } from '@/lib/categories';
import { shortDateLabel } from '@/lib/date-range';
import {
  addRecurring,
  deleteRecurring,
  getRecurring,
  nextDueDate,
  nextOccurrenceAfter,
  type RecurringFrequency,
  type RecurringFrequencySpec,
  type RecurringTransaction,
} from '@/lib/recurring';
import { addTransaction, deleteTransaction, getTransactions, updateTransaction } from '@/lib/transactions';

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function localDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
  everyNMonths: 'Every few months',
  semimonthly: 'Twice a month',
  yearly: 'Every year',
};

// Options for the frequency chip row (below) — 6 no longer fit
// SegmentedControl, which is sized for the app's compact 2-4-option toggles
// elsewhere, so this one picker uses a horizontally-scrolling chip row
// instead (same chip visual the series editor's category row already uses).
const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'semimonthly', label: 'Twice Monthly' },
  { value: 'everyNMonths', label: 'Every N Months' },
  { value: 'yearly', label: 'Yearly' },
];

// Same suffix rule as transactions.tsx's own ordinal — 2 occurrences, not yet
// a 3rd, per the no-premature-abstraction rule.
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

// Builds the frequency-specific fields (day/month/interval) from explicit
// values — shared by the new-transaction Repeat card (its "Next on …"
// preview and handleSave's addRecurring payload, where dayOfMonth/month come
// straight off the transaction's own date, same as monthly always has) and
// the series editor (its own day/month stepper state, for editing an
// existing series' frequency), so there's one place building each
// frequency's fields, not two.
function frequencySpec(frequency: RecurringFrequency, dayOfMonth: number, month: number, intervalMonths: number, dayOfMonth2: number): RecurringFrequencySpec {
  switch (frequency) {
    case 'weekly':
      return { frequency: 'weekly' };
    case 'biweekly':
      return { frequency: 'biweekly' };
    case 'monthly':
      return { frequency: 'monthly', dayOfMonth };
    case 'everyNMonths':
      return { frequency: 'everyNMonths', intervalMonths, dayOfMonth };
    case 'yearly':
      return { frequency: 'yearly', month, dayOfMonth };
    case 'semimonthly':
      return { frequency: 'semimonthly', dayOfMonth1: dayOfMonth, dayOfMonth2 };
  }
}

export default function AddTransactionScreen() {
  const theme = useTheme();
  const { symbol } = useCurrency();
  const insets = useSafeAreaInsets();
  const { id, repeat: repeatParam } = useLocalSearchParams<{ id?: string; repeat?: string }>();
  const isEditing = !!id;

  const [type, setType] = useState<CategoryType>('expense');
  const [amount, setAmount] = useState('');
  const amountInputRef = useRef<TextInput>(null);
  // Drives the checkmark button next to the amount — the keypad no longer
  // opens on its own (see amountInput's own comment below), so this is the
  // one visible way to confirm the amount is done and put the keyboard away
  // (the decimal-pad keyboard has no "Done" key of its own on Android to
  // rely on instead).
  const [amountFocused, setAmountFocused] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [note, setNote] = useState('');
  // Transactions' FAB links here with ?repeat=1 from its Recurring page so
  // the checkbox starts pre-checked — previously the only way to reach this
  // flow at all was to notice the checkbox while adding an otherwise one-off
  // transaction.
  const [repeat, setRepeat] = useState(() => repeatParam === '1');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  // Only read when frequency is 'everyNMonths'/'semimonthly' respectively —
  // monthly/yearly/weekly/biweekly derive everything they need from `date`
  // itself, same as monthly always has.
  const [intervalMonths, setIntervalMonths] = useState(3);
  const [dayOfMonth2, setDayOfMonth2] = useState(() => {
    const day = localDate(date).getDate();
    return ((day - 1 + 15) % 31) + 1;
  });
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

  // Refreshes just the series' own current state on every focus — not the
  // transaction fields above, which the effect above already owns and which
  // this shouldn't clobber with in-progress edits. Needed now that editing a
  // series happens on a separate screen (edit-recurring.tsx): without this,
  // coming back from there would leave this Repeats card showing whatever
  // frequency/amount/next-due-date the series had *before* that edit, until
  // this whole modal was closed and reopened. If the series existed a moment
  // ago and doesn't anymore, that's this screen's own Stop having run
  // elsewhere — reflected the same way handleStopRepeating already does,
  // via `stoppedRecurring`, so the card settles into its "stopped" state
  // instead of just vanishing.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      (async () => {
        const transactions = await getTransactions();
        const existing = transactions.find((t) => t.id === id);
        const recurringId = existing?.recurringId;
        const series = recurringId ? ((await getRecurring()).find((r) => r.id === recurringId) ?? null) : null;
        if (cancelled) return;
        if (activeRecurring && !series) setStoppedRecurring(true);
        setActiveRecurring(series);
      })();
      return () => {
        cancelled = true;
      };
    }, [id, activeRecurring])
  );

  const categories = categoriesForType(allCategories, type);
  const parsedAmount = parseFloat(amount);
  const canSave = !Number.isNaN(parsedAmount) && parsedAmount > 0 && !!categoryId;
  // Standardized across the app: expense = destructive (red), income = success (green).
  const typeColor = type === 'expense' ? theme.destructive : theme.success;
  // day/month a not-yet-created series' monthly/yearly/everyNMonths fields
  // come from, straight off the transaction's own date field.
  const dateDay = localDate(date).getDate();
  const dateMonth = localDate(date).getMonth() + 1;

  async function handleSave() {
    if (!canSave || !categoryId) return;
    if (isEditing && id) {
      await updateTransaction(id, { type, amount: parsedAmount, categoryId, date, note: note.trim() || undefined });
    } else if (repeat) {
      // Create the series first so the seed transaction below can carry its
      // id, and mark this transaction's own occurrence as already generated
      // (lastGeneratedDate = date) — otherwise the next session's
      // generateDueTransactions would find nothing generated yet, start its
      // cursor back at this same occurrence, and double-log it.
      const recurring = await addRecurring({
        type,
        amount: parsedAmount,
        categoryId,
        note: note.trim() || undefined,
        startDate: date,
        lastGeneratedDate: date,
        ...frequencySpec(frequency, dateDay, dateMonth, intervalMonths, dayOfMonth2),
      });
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

        {/* Doesn't autofocus (dropped 2026-09-18 per feedback) — the numeric
            keypad used to pop up the instant this screen opened, before the
            amount area was even tapped. Wrapping the row in a Pressable
            makes the $ sign itself part of the tap target, not just the
            input box next to it. */}
        <Pressable onPress={() => amountInputRef.current?.focus()} style={styles.amountRow}>
          <ThemedText type="title" style={[styles.currencySign, { color: typeColor }]}>
            {symbol}
          </ThemedText>
          <TextInput
            ref={amountInputRef}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: typeColor }]}
            onFocus={() => setAmountFocused(true)}
            onBlur={() => setAmountFocused(false)}
          />
          {/* Shown only while the keypad is up — a decimal-pad keyboard has
              no "Done" key on Android to dismiss it with otherwise. */}
          {amountFocused && (
            <Pressable
              onPress={() => {
                amountInputRef.current?.blur();
                Keyboard.dismiss();
              }}
              hitSlop={8}
              style={[styles.amountDoneButton, { backgroundColor: typeColor }]}>
              <MaterialIcons name="check" size={20} color="#ffffff" />
            </Pressable>
          )}
        </Pressable>

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
                  {repeat
                    ? `${FREQUENCY_LABEL[frequency]} · next on ${shortDateLabel(localDate(nextOccurrenceAfter(frequencySpec(frequency, dateDay, dateMonth, intervalMonths, dayOfMonth2), date)))}`
                    : 'Off'}
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
                before weekly/biweekly existed. A scrolling chip row, not
                SegmentedControl — 6 options no longer fit its compact
                2-4-segment design. */}
            {repeat && (
              <View style={[styles.repeatBody, { borderTopColor: theme.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frequencyChipScroll}>
                  {FREQUENCY_OPTIONS.map((option) => {
                    const isSelected = option.value === frequency;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setFrequency(option.value)}
                        style={[
                          styles.frequencyChip,
                          { borderColor: isSelected ? theme.accent : theme.border },
                          isSelected && { backgroundColor: theme.accent + '1A' },
                        ]}>
                        <ThemedText type="small" themeColor={isSelected ? 'accent' : 'text'}>
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {/* Monthly/yearly need nothing extra — day and month are
                    read straight off the Date field above, same as monthly
                    always has. */}
                {frequency === 'everyNMonths' && (
                  <View style={styles.inlineStepperRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Every
                    </ThemedText>
                    <View style={styles.dayStepper}>
                      <Pressable hitSlop={8} onPress={() => setIntervalMonths((n) => Math.max(2, n - 1))}>
                        <MaterialIcons name="remove-circle-outline" size={20} color={theme.accent} />
                      </Pressable>
                      <ThemedText type="small" style={styles.dayStepperValue}>
                        {intervalMonths}
                      </ThemedText>
                      <Pressable hitSlop={8} onPress={() => setIntervalMonths((n) => Math.min(11, n + 1))}>
                        <MaterialIcons name="add-circle-outline" size={20} color={theme.accent} />
                      </Pressable>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      months
                    </ThemedText>
                  </View>
                )}
                {frequency === 'semimonthly' && (
                  <View style={styles.inlineStepperRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      And on the
                    </ThemedText>
                    <View style={styles.dayStepper}>
                      <Pressable hitSlop={8} onPress={() => setDayOfMonth2((d) => Math.max(1, d - 1))}>
                        <MaterialIcons name="remove-circle-outline" size={20} color={theme.accent} />
                      </Pressable>
                      <ThemedText type="small" style={styles.dayStepperValue}>
                        {ordinal(dayOfMonth2)}
                      </ThemedText>
                      <Pressable hitSlop={8} onPress={() => setDayOfMonth2((d) => Math.min(31, d + 1))}>
                        <MaterialIcons name="add-circle-outline" size={20} color={theme.accent} />
                      </Pressable>
                    </View>
                  </View>
                )}
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
                <View style={styles.repeatActions}>
                  {/* Routes to edit-recurring.tsx's own standalone editor
                      (2026-09-17) rather than an inline sub-panel here — see
                      that screen's own comment for why. */}
                  <Pressable onPress={() => router.push(`/edit-recurring?id=${activeRecurring.id}`)} hitSlop={8} style={styles.editSeriesButton}>
                    <MaterialIcons name="edit" size={18} color={theme.accent} />
                  </Pressable>
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
                </View>
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
  amountDoneButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.three,
  },
  frequencyChipScroll: {
    flexGrow: 0,
  },
  frequencyChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginRight: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  inlineStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  repeatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editSeriesButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    paddingVertical: Spacing.two - 1,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  dayStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayStepperValue: {
    minWidth: 34,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
