import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, type CategoryType } from '@/lib/categories';
import { addRecurring } from '@/lib/recurring';
import { addTransaction, deleteTransaction, getTransactions, updateTransaction } from '@/lib/transactions';

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
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
          <MaterialIcons name="chevron-left" size={22} color={theme.text} />
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
          <MaterialIcons name="chevron-right" size={22} color={theme.text} />
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [type, setType] = useState<CategoryType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [note, setNote] = useState('');
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    if (!id) return;
    getTransactions().then((transactions) => {
      const existing = transactions.find((t) => t.id === id);
      if (existing) {
        setType(existing.type);
        setAmount(String(existing.amount));
        setCategoryId(existing.categoryId);
        setDate(existing.date);
        setNote(existing.note ?? '');
      }
      setLoaded(true);
    });
  }, [id]);

  const categories = categoriesForType(type);
  const parsedAmount = parseFloat(amount);
  const canSave = !Number.isNaN(parsedAmount) && parsedAmount > 0 && !!categoryId;
  // Standardized across the app: expense = destructive (red), income = success (green).
  const typeColor = type === 'expense' ? theme.destructive : theme.success;

  async function handleSave() {
    if (!canSave || !categoryId) return;
    if (isEditing && id) {
      await updateTransaction(id, { type, amount: parsedAmount, categoryId, date, note: note.trim() || undefined });
    } else {
      await addTransaction({ type, amount: parsedAmount, categoryId, date, note: note.trim() || undefined });
      if (repeatMonthly) {
        await addRecurring({
          type,
          amount: parsedAmount,
          categoryId,
          note: note.trim() || undefined,
          dayOfMonth: new Date(`${date}T00:00:00`).getDate(),
          startDate: date,
        });
      }
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

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Transaction' : 'Add Transaction' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.segmented, { borderColor: theme.border }]}>
          {(['expense', 'income'] as const).map((t) => {
            const segmentColor = t === 'expense' ? theme.destructive : theme.success;
            const isSelected = type === t;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setType(t);
                  setCategoryId(null);
                }}
                style={[styles.segment, isSelected && { backgroundColor: segmentColor }]}>
                <MaterialIcons
                  name={t === 'expense' ? 'arrow-downward' : 'arrow-upward'}
                  size={14}
                  color={isSelected ? '#ffffff' : theme.textSecondary}
                />
                <ThemedText
                  type="smallBold"
                  themeColor={isSelected ? 'text' : 'textSecondary'}
                  style={isSelected && { color: '#ffffff' }}>
                  {t === 'expense' ? 'Expense' : 'Income'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

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
                  <CategoryBadge category={category} size={26} color={typeColor} />
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

        {!isEditing && (
          <Pressable style={styles.repeatRow} onPress={() => setRepeatMonthly((v) => !v)}>
            <MaterialIcons
              name={repeatMonthly ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={repeatMonthly ? theme.accent : theme.textSecondary}
            />
            <ThemedText type="small">Repeat monthly</ThemedText>
          </Pressable>
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
  segmented: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 2,
    alignItems: 'center',
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
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
