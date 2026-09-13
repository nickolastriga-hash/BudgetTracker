import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, type Category } from '@/lib/categories';
import { MONTH_NAMES, shortDateLabel } from '@/lib/date-range';
import {
  deleteRecurring,
  getRecurring,
  nextDueDate,
  updateRecurring,
  type RecurringFrequency,
  type RecurringFrequencySpec,
  type RecurringTransaction,
} from '@/lib/recurring';

function localDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Same suffix rule as add-transaction.tsx/transactions.tsx's own ordinal — a
// 3rd occurrence, but still small enough that sharing it isn't worth a new
// util module over the no-premature-abstraction rule's own bar.
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

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
  everyNMonths: 'Every few months',
  semimonthly: 'Twice a month',
  yearly: 'Every year',
};

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'semimonthly', label: 'Twice Monthly' },
  { value: 'everyNMonths', label: 'Every N Months' },
  { value: 'yearly', label: 'Yearly' },
];

// Same builder as add-transaction.tsx's own frequencySpec — duplicated
// rather than shared (2nd occurrence, not yet the 3rd the
// no-premature-abstraction rule waits for).
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

// A standalone editor for one recurring series' own definition — amount,
// category, and frequency (plus whichever day/month/interval fields that
// frequency needs) — reached from both places a series can be found:
// Transactions' Recurring page (its Edit pencil routes straight here with
// the series' id) and add-transaction.tsx's own Repeats card (same route,
// same id, when you're already looking at one of that series' transactions).
// Added 2026-09-17, replacing an inline sub-panel that used to live inside
// add-transaction.tsx itself — that panel worked, but reaching it from the
// Recurring page meant first hunting down *some* transaction that series had
// generated and opening *that* transaction's own edit screen, which put two
// separate amount/category pickers (one for the single transaction, one for
// the whole series) on one screen at once. A dedicated screen means the
// Recurring page can link to a series directly, with nothing else on screen
// that isn't about the series.
export default function EditRecurringScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [recurring, setRecurring] = useState<RecurringTransaction | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfMonth2, setDayOfMonth2] = useState(15);
  const [month, setMonth] = useState(1);
  const [intervalMonths, setIntervalMonths] = useState(3);
  const [confirmingStop, setConfirmingStop] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getRecurring(), getCategories()]).then(([items, categories]) => {
      const item = items.find((r) => r.id === id) ?? null;
      setAllCategories(categories);
      setRecurring(item);
      setNotFound(!item);
      if (item) {
        setAmount(String(item.amount));
        setCategoryId(item.categoryId);
        setFrequency(item.frequency);
        switch (item.frequency) {
          case 'monthly':
          case 'everyNMonths':
            setDayOfMonth(item.dayOfMonth);
            if (item.frequency === 'everyNMonths') setIntervalMonths(item.intervalMonths);
            break;
          case 'yearly':
            setDayOfMonth(item.dayOfMonth);
            setMonth(item.month);
            break;
          case 'semimonthly':
            setDayOfMonth(item.dayOfMonth1);
            setDayOfMonth2(item.dayOfMonth2);
            break;
          case 'weekly':
          case 'biweekly':
            break;
        }
      }
      setLoaded(true);
    });
  }, [id]);

  const parsedAmount = parseFloat(amount);
  const canSave = !Number.isNaN(parsedAmount) && parsedAmount > 0 && !!categoryId;

  async function handleSave() {
    if (!recurring || !canSave || !categoryId) return;
    await updateRecurring(recurring.id, {
      amount: parsedAmount,
      categoryId,
      note: recurring.note,
      ...frequencySpec(frequency, dayOfMonth, month, intervalMonths, dayOfMonth2),
    });
    router.back();
  }

  async function handleStop() {
    if (!recurring) return;
    if (!confirmingStop) {
      setConfirmingStop(true);
      return;
    }
    await deleteRecurring(recurring.id);
    router.back();
  }

  if (!loaded) return null;

  if (notFound || !recurring) {
    return (
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText type="default" style={styles.headerTitle}>
          This series no longer exists
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
          <MaterialIcons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>
    );
  }

  const categories = categoriesForType(allCategories, recurring.type);
  const typeColor = recurring.type === 'expense' ? theme.destructive : theme.success;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
        <ThemedText type="default" style={styles.headerTitle}>
          Edit Series
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
          <MaterialIcons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          Next on {shortDateLabel(localDate(nextDueDate(recurring)))} · since {shortDateLabel(localDate(recurring.startDate))}
        </ThemedText>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Frequency
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {FREQUENCY_OPTIONS.map((option) => {
              const isSelected = option.value === frequency;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFrequency(option.value)}
                  style={[styles.chip, { borderColor: isSelected ? theme.accent : theme.border }, isSelected && { backgroundColor: theme.accent + '1A' }]}>
                  <ThemedText type="small" themeColor={isSelected ? 'accent' : 'text'}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Amount
          </ThemedText>
          <View style={styles.amountRow}>
            <ThemedText type="default" style={[styles.currencySign, { color: theme.textSecondary }]}>
              $
            </ThemedText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
            />
          </View>
        </View>

        {frequency !== 'weekly' && frequency !== 'biweekly' && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              {frequency === 'semimonthly' ? 'First day' : 'Day of month'}
            </ThemedText>
            <View style={styles.dayStepper}>
              <Pressable hitSlop={8} onPress={() => setDayOfMonth((d) => Math.max(1, d - 1))}>
                <MaterialIcons name="remove-circle-outline" size={22} color={theme.accent} />
              </Pressable>
              <ThemedText type="default" style={styles.dayStepperValue}>
                {ordinal(dayOfMonth)}
              </ThemedText>
              <Pressable hitSlop={8} onPress={() => setDayOfMonth((d) => Math.min(31, d + 1))}>
                <MaterialIcons name="add-circle-outline" size={22} color={theme.accent} />
              </Pressable>
            </View>
          </View>
        )}

        {frequency === 'semimonthly' && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Second day
            </ThemedText>
            <View style={styles.dayStepper}>
              <Pressable hitSlop={8} onPress={() => setDayOfMonth2((d) => Math.max(1, d - 1))}>
                <MaterialIcons name="remove-circle-outline" size={22} color={theme.accent} />
              </Pressable>
              <ThemedText type="default" style={styles.dayStepperValue}>
                {ordinal(dayOfMonth2)}
              </ThemedText>
              <Pressable hitSlop={8} onPress={() => setDayOfMonth2((d) => Math.min(31, d + 1))}>
                <MaterialIcons name="add-circle-outline" size={22} color={theme.accent} />
              </Pressable>
            </View>
          </View>
        )}

        {frequency === 'everyNMonths' && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Every N months
            </ThemedText>
            <View style={styles.dayStepper}>
              <Pressable hitSlop={8} onPress={() => setIntervalMonths((n) => Math.max(2, n - 1))}>
                <MaterialIcons name="remove-circle-outline" size={22} color={theme.accent} />
              </Pressable>
              <ThemedText type="default" style={styles.dayStepperValue}>
                {intervalMonths}
              </ThemedText>
              <Pressable hitSlop={8} onPress={() => setIntervalMonths((n) => Math.min(11, n + 1))}>
                <MaterialIcons name="add-circle-outline" size={22} color={theme.accent} />
              </Pressable>
            </View>
          </View>
        )}

        {frequency === 'yearly' && (
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Month
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {MONTH_NAMES.map((name, i) => {
                const monthNum = i + 1;
                const isSelected = monthNum === month;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setMonth(monthNum)}
                    style={[styles.chip, { borderColor: isSelected ? theme.accent : theme.border }, isSelected && { backgroundColor: theme.accent + '1A' }]}>
                    <ThemedText type="small" themeColor={isSelected ? 'accent' : 'text'}>
                      {name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

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
                  style={[styles.categoryChip, { borderColor: isSelected ? typeColor : theme.border }, isSelected && { backgroundColor: typeColor + '1A' }]}>
                  <CategoryBadge category={category} size={26} type={recurring.type} />
                  <ThemedText type="small">{category.name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable onPress={handleSave} disabled={!canSave} style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            Save changes
          </ThemedText>
        </Pressable>

        <Pressable onPress={handleStop} style={styles.stopButton}>
          <MaterialIcons name="event-busy" size={18} color={theme.destructive} />
          <ThemedText type="small" themeColor="destructive">
            {confirmingStop ? 'Tap again to stop repeating' : `Stop ${FREQUENCY_LABEL[recurring.frequency].toLowerCase()}`}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  field: {
    gap: Spacing.two,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginRight: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  currencySign: {
    fontSize: 18,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dayStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    alignSelf: 'flex-start',
  },
  dayStepperValue: {
    minWidth: 44,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
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
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
  },
});
