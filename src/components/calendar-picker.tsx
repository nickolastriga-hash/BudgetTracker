import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A self-contained month grid for picking one "YYYY-MM-DD" date, with a
// month pager above it and an optional `maxDateStr` ceiling (add-transaction
// caps at today; a goal contribution does too — you can't have set money
// aside in the future). Lived inline in add-transaction.tsx until 2026-09-19,
// extracted when goal-editor needed the same thing: a stateful ~70-line
// component is past the point where the "redefine small helpers per file"
// rule applies, and a second copy would have drifted from this one.
//
// Not to be confused with range-picker-modal.tsx's own day grid, which picks
// a two-tap *range* rather than a single date.
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function CalendarPicker({
  selected,
  onSelect,
  maxDateStr,
}: {
  selected: string;
  onSelect: (dateStr: string) => void;
  maxDateStr?: string;
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
          const isDisabled = maxDateStr !== undefined && dateStr > maxDateStr;
          return (
            <Pressable
              key={dateStr}
              disabled={isDisabled}
              onPress={() => onSelect(dateStr)}
              style={[styles.calendarCell, styles.calendarDay, isSelected && { backgroundColor: theme.accent }]}>
              <ThemedText
                type="small"
                themeColor={isSelected ? 'text' : isDisabled ? 'textTertiary' : 'text'}
                style={isSelected && styles.calendarDayTextSelected}>
                {day}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  calendarDayTextSelected: {
    color: '#ffffff',
  },
});
