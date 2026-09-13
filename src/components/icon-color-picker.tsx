import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_COLORS, type CategoryIcon } from '@/lib/categories';
import { CATEGORY_ICONS, suggestCategoryIcon } from '@/lib/category-icons';

// The color-swatch row and AI-suggested-plus-manual-grid icon picker that
// category-editor.tsx introduced, extracted (2026-09-13) once the goal/debt/
// account editors became the 2nd-4th screens needing the identical pair —
// well past the no-premature-abstraction rule's 3-occurrence line.

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <View style={styles.colorRow}>
      {CATEGORY_COLORS.map((c) => {
        const isSelected = value === c;
        return (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.colorSwatchOuter, isSelected && { borderColor: c }]}>
            <View style={[styles.colorSwatch, { backgroundColor: c }]}>
              {isSelected && <MaterialIcons name="check" size={18} color="#fff" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// The icon set is large, so the picker is a 4-row grid that scrolls
// horizontally instead of a wrap grid that would push the form down —
// same layout HabitTracker's add-habit screen uses for the same reason.
const ICON_GRID_ROWS = 4;
const ICON_ROWS: (typeof CATEGORY_ICONS)[number][][] = Array.from({ length: ICON_GRID_ROWS }, (_, r) =>
  CATEGORY_ICONS.filter((_, i) => i % ICON_GRID_ROWS === r)
);

// `value: null` means "auto" — the icon live-follows `name` via
// suggestCategoryIcon (the "AI" tile), instead of being written to state on
// every keystroke. Callers resolve the icon to actually save with
// `resolveIcon(value, name)`.
export function resolveIcon(value: CategoryIcon | null, name: string): CategoryIcon {
  return value ?? suggestCategoryIcon(name);
}

export function IconPicker({
  value,
  name,
  color,
  onChange,
}: {
  value: CategoryIcon | null;
  name: string;
  color: string;
  onChange: (icon: CategoryIcon | null) => void;
}) {
  const theme = useTheme();
  const displayIcon = resolveIcon(value, name);
  const isAuto = value === null;

  return (
    <View style={styles.field}>
      <View style={styles.iconPickerRow}>
        <Pressable
          onPress={() => onChange(null)}
          style={[styles.aiTile, { borderColor: theme.border }, isAuto && { borderColor: color, backgroundColor: color + '1a' }]}>
          <MaterialIcons name="auto-awesome" size={20} color={isAuto ? color : theme.textSecondary} />
          <ThemedText type="small" style={[styles.aiTileText, isAuto && { color }]}>
            AI
          </ThemedText>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.iconGridColumn}>
            {ICON_ROWS.map((row, ri) => (
              <View key={ri} style={styles.iconGridRow}>
                {row.map((iconName) => {
                  const isSelected = displayIcon === iconName;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => onChange(iconName)}
                      style={[
                        styles.iconSwatch,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                        isSelected && { borderColor: color, backgroundColor: color + '1a' },
                      ]}>
                      <MaterialIcons name={iconName} size={22} color={isSelected ? color : theme.textSecondary} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      {isAuto && (
        <ThemedText type="small" themeColor="textTertiary">
          Suggested from the name. Tap an icon to pick your own.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatchOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  aiTile: {
    width: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.5,
  },
  aiTileText: {
    fontSize: 10,
    fontWeight: '700',
  },
  iconGridColumn: {
    gap: 10,
  },
  iconGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
