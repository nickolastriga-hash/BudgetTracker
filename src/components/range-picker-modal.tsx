import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  daysInMonth,
  endOfWeek,
  monthLabel,
  startOfWeek,
  toDateStr,
  type CustomRange,
  type RangeType,
} from '@/lib/date-range';

const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' })
);
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Years grouped 12-per-page purely so the year grid reuses the exact same
// 4-column/3-row pickerGrid/pickerCell shape as the month grid below — not
// tied to any calendar meaning the way a decade would be.
const YEARS_PER_PAGE = 12;

// Same trigger (tap the nav label) opens this for every rangeType a caller
// offers, but what it shows differs — a year-pager + 12-month grid for month
// mode (the original, single-purpose picker this grew out of), a paged
// 12-years grid for year mode, a month-pager + day-of-month grid for week
// mode (picking any day selects the week it falls in), and the same day grid
// for custom mode (two taps: start, then end). One component rather than
// four, since all four share the same modal chrome and are only ever mounted
// one at a time off the same `rangeType` — extracted to a shared component
// 2026-08-30 when Trends became a 3rd near-identical copy of this (Home's and
// Transactions' were each explicitly left un-shared until then, per the
// project's own "not yet 3" convention). A caller that only ever passes
// month/year/custom (Trends has no Week pill) simply never exercises the
// week branch below — it doesn't need to be told which rangeTypes are "allowed".
export function RangePickerModal({
  visible,
  rangeType,
  anchor,
  customRange,
  onSelect,
  onSelectCustomDay,
  onClose,
}: {
  visible: boolean;
  rangeType: RangeType;
  anchor: Date;
  customRange: CustomRange | null;
  onSelect: (date: Date) => void;
  onSelectCustomDay: (dateStr: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  // The picker's own navigation cursor — a year for month/year mode, a
  // month for week/custom mode (it needs a specific month in view to show
  // that month's day grid). Reset to the current anchor (or, in custom
  // mode, the already-picked start date) each time it opens rather than
  // wherever it was left after a previous open.
  const [cursor, setCursor] = useState(anchor);

  useEffect(() => {
    if (!visible) return;
    setCursor(rangeType === 'custom' && customRange ? new Date(`${customRange.start}T00:00:00`) : anchor);
  }, [visible, anchor, rangeType, customRange]);

  let header: ReactNode;
  let body: ReactNode;

  if (rangeType === 'year') {
    const pageStart = Math.floor(cursor.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE;
    const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i);
    header = (
      <>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear() - YEARS_PER_PAGE, 0, 1))}>
          <MaterialIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <ThemedText type="smallBold">
          {years[0]}–{years[years.length - 1]}
        </ThemedText>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear() + YEARS_PER_PAGE, 0, 1))}>
          <MaterialIcons name="chevron-right" size={24} color={theme.accent} />
        </Pressable>
      </>
    );
    body = (
      <View style={styles.pickerGrid}>
        {years.map((y) => {
          const isSelected = y === anchor.getFullYear();
          return (
            <Pressable
              key={y}
              onPress={() => onSelect(new Date(y, 0, 1))}
              style={[styles.pickerCell, isSelected && { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={isSelected && styles.pickerCellTextSelected}>
                {y}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  } else if (rangeType === 'week') {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const total = daysInMonth(year, monthIndex);
    const cells: (number | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    const selectedStart = toDateStr(startOfWeek(anchor));
    const selectedEnd = toDateStr(endOfWeek(anchor));
    header = (
      <>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
          <MaterialIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <ThemedText type="smallBold">{monthLabel(cursor)}</ThemedText>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
          <MaterialIcons name="chevron-right" size={24} color={theme.accent} />
        </Pressable>
      </>
    );
    body = (
      <>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((w, i) => (
            <ThemedText key={i} type="small" themeColor="textTertiary" style={styles.weekdayLabel}>
              {w}
            </ThemedText>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const inSelectedWeek = dateStr >= selectedStart && dateStr <= selectedEnd;
            return (
              <Pressable key={dateStr} onPress={() => onSelect(new Date(year, monthIndex, day))} style={styles.dayCell}>
                <View style={[styles.dayCellInner, inSelectedWeek && { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" style={inSelectedWeek && styles.pickerCellTextSelected}>
                    {day}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else if (rangeType === 'custom') {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const total = daysInMonth(year, monthIndex);
    const cells: (number | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    const pendingStart = customRange?.start ?? null;
    const pendingEnd = customRange?.end ?? null;
    header = (
      <>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
          <MaterialIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <ThemedText type="smallBold">{monthLabel(cursor)}</ThemedText>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
          <MaterialIcons name="chevron-right" size={24} color={theme.accent} />
        </Pressable>
      </>
    );
    body = (
      <>
        <ThemedText type="small" themeColor="textSecondary" style={styles.customHint}>
          {pendingStart && !pendingEnd ? 'Tap an end date' : 'Tap a start date'}
        </ThemedText>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((w, i) => (
            <ThemedText key={i} type="small" themeColor="textTertiary" style={styles.weekdayLabel}>
              {w}
            </ThemedText>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`empty-${i}`} style={styles.dayCell} />;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isEndpoint = dateStr === pendingStart || dateStr === pendingEnd;
            const inRange = !!(pendingStart && pendingEnd && dateStr > pendingStart && dateStr < pendingEnd);
            return (
              <Pressable key={dateStr} onPress={() => onSelectCustomDay(dateStr)} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCellInner,
                    inRange && { backgroundColor: theme.accent + '33' },
                    isEndpoint && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText type="small" style={isEndpoint && styles.pickerCellTextSelected}>
                    {day}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else {
    const year = cursor.getFullYear();
    header = (
      <>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear() - 1, c.getMonth(), 1))}>
          <MaterialIcons name="chevron-left" size={24} color={theme.accent} />
        </Pressable>
        <ThemedText type="smallBold">{year}</ThemedText>
        <Pressable hitSlop={10} onPress={() => setCursor((c) => new Date(c.getFullYear() + 1, c.getMonth(), 1))}>
          <MaterialIcons name="chevron-right" size={24} color={theme.accent} />
        </Pressable>
      </>
    );
    body = (
      <View style={styles.pickerGrid}>
        {MONTH_NAMES.map((name, m) => {
          const isSelected = year === anchor.getFullYear() && m === anchor.getMonth();
          return (
            <Pressable
              key={name}
              onPress={() => onSelect(new Date(year, m, 1))}
              style={[styles.pickerCell, isSelected && { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={isSelected && styles.pickerCellTextSelected}>
                {name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.pickerCard, CardShadow, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => {}}>
          <View style={styles.pickerHeader}>{header}</View>
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  // The custom-range day grid's own instruction line, above its weekday row.
  customHint: {
    textAlign: 'center',
  },
  // Week/custom mode's day-of-month grid inside the same pickerCard — same
  // 7-column shape as Transactions' own Calendar view day grid.
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
    aspectRatio: 1,
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
  },
});
