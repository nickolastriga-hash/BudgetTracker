import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesForType, getCategories, type Category, type CategoryType } from '@/lib/categories';
import {
  addRecurring,
  deleteRecurring,
  generateDueTransactions,
  getRecurring,
  nextDueDate,
  transactionCountForRecurring,
  updateRecurring,
} from '@/lib/recurring';

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function DayOfMonthPicker({ selected, onSelect }: { selected: number; onSelect: (day: number) => void }) {
  const theme = useTheme();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <View style={styles.dayGrid}>
      {days.map((day) => {
        const isSelected = day === selected;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            style={[
              styles.dayCell,
              { borderColor: isSelected ? theme.accent : theme.border },
              isSelected && { backgroundColor: theme.accent },
            ]}>
            <ThemedText type="small" themeColor={isSelected ? 'text' : 'textSecondary'} style={isSelected && styles.dayCellTextSelected}>
              {day}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BillEditorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [type, setType] = useState<CategoryType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState(() => new Date().getDate());
  const [note, setNote] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [dueLabel, setDueLabel] = useState<string | null>(null);
  const [txCount, setTxCount] = useState(0);

  useEffect(() => {
    getCategories().then(setAllCategories);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([getRecurring(), transactionCountForRecurring(id)]).then(([items, count]) => {
      const existing = items.find((r) => r.id === id);
      if (existing) {
        setType(existing.type);
        setAmount(String(existing.amount));
        setCategoryId(existing.categoryId);
        setDayOfMonth(existing.dayOfMonth);
        setNote(existing.note ?? '');
        setDueLabel(nextDueDate(existing));
      }
      setTxCount(count);
      setLoaded(true);
    });
  }, [id]);

  const categories = categoriesForType(allCategories, type);
  const parsedAmount = parseFloat(amount);
  const canSave = !Number.isNaN(parsedAmount) && parsedAmount > 0 && !!categoryId;
  const typeColor = type === 'expense' ? theme.destructive : theme.success;

  async function handleSave() {
    if (!canSave || !categoryId) return;
    if (isEditing && id) {
      await updateRecurring(id, { type, amount: parsedAmount, categoryId, dayOfMonth, note: note.trim() || undefined });
    } else {
      await addRecurring({
        type,
        amount: parsedAmount,
        categoryId,
        dayOfMonth,
        note: note.trim() || undefined,
        startDate: toDateStr(new Date()),
      });
    }
    await generateDueTransactions();
    router.back();
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (id) await deleteRecurring(id);
    router.back();
  }

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
        <ThemedText type="default" style={styles.headerTitle}>
          {isEditing ? 'Edit Bill' : 'New Bill'}
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
          <MaterialIcons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        {dueLabel && (
          <ThemedText type="small" themeColor="textSecondary">
            Next due {new Date(`${dueLabel}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            {txCount > 0 ? ` · ${txCount} logged so far` : ''}
          </ThemedText>
        )}

        <View style={[styles.segmented, { borderColor: theme.border }]}>
          {(['expense', 'income'] as const).map((t) => {
            const segmentColor = t === 'expense' ? theme.destructive : theme.success;
            const isSelected = type === t;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setType(t);
                  if (!categoriesForType(allCategories, t).some((c) => c.id === categoryId)) {
                    setCategoryId(null);
                  }
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
            Due every month on the...
          </ThemedText>
          <DayOfMonthPicker selected={dayOfMonth} onSelect={setDayOfMonth} />
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

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, { backgroundColor: canSave ? typeColor : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            Save
          </ThemedText>
        </Pressable>

        {isEditing && (
          <View style={styles.deleteGroup}>
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <MaterialIcons name="delete-outline" size={18} color={theme.destructive} />
              <ThemedText type="small" themeColor="destructive">
                {confirmingDelete ? 'Tap again to delete' : 'Cancel this bill'}
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textTertiary" style={styles.deleteHint}>
              Stops future occurrences — past transactions stay.
            </ThemedText>
          </View>
        )}
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
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellTextSelected: {
    color: '#ffffff',
  },
  noteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  deleteGroup: {
    alignItems: 'center',
    gap: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
  },
  deleteHint: {
    textAlign: 'center',
  },
});
