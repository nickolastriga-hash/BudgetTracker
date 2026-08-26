import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addCategory, CATEGORY_COLORS, getCategories, updateCategory } from '@/lib/categories';
import { CATEGORY_ICONS, suggestCategoryIcon } from '@/lib/category-icons';

// The icon set is large, so the picker is a 4-row grid that scrolls
// horizontally instead of a wrap grid that would push the form down —
// same layout HabitTracker's add-habit screen uses for the same reason.
const ICON_GRID_ROWS = 4;
const ICON_ROWS: (typeof CATEGORY_ICONS)[number][][] = Array.from({ length: ICON_GRID_ROWS }, (_, r) =>
  CATEGORY_ICONS.filter((_, i) => i % ICON_GRID_ROWS === r)
);

export default function CategoryEditorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // `type` only matters when adding (`isEditing` false) — it's how the two
  // Budgets sections' separate "+" buttons pick which kind of category gets
  // created, since the type toggle itself still isn't user-editable (see
  // note on updateCategory below).
  const { id, type } = useLocalSearchParams<{ id?: string; type?: string }>();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>(type === 'income' ? 'income' : 'expense');
  const [loaded, setLoaded] = useState(!isEditing);

  // While the icon hasn't been manually overridden, it live-follows the name
  // (see suggestedIcon below) instead of being written to state on every
  // keystroke — same pattern as HabitTracker's add-habit icon picker.
  const [icon, setIcon] = useState<(typeof CATEGORY_ICONS)[number] | null>(null);
  const [iconManuallySet, setIconManuallySet] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCategories().then((categories) => {
      const existing = categories.find((c) => c.id === id);
      if (existing) {
        setName(existing.name);
        setColor(existing.color);
        setCategoryType(existing.type);
        // An existing category always has a concrete saved icon — treat it
        // as deliberately set rather than re-suggesting from the name.
        setIcon(existing.icon as (typeof CATEGORY_ICONS)[number]);
        setIconManuallySet(true);
      }
      setLoaded(true);
    });
  }, [id]);

  const suggestedIcon = suggestCategoryIcon(name);
  const displayIcon = iconManuallySet && icon ? icon : suggestedIcon;
  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    if (isEditing && id) {
      await updateCategory(id, { name: name.trim(), icon: displayIcon, color });
    } else {
      await addCategory({ name: name.trim(), icon: displayIcon, color, type: categoryType });
    }
    router.back();
  }

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Category' : 'New Category' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Name
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            autoFocus={!isEditing}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Color
          </ThemedText>
          <View style={styles.colorRow}>
            {CATEGORY_COLORS.map((c) => {
              const isSelected = color === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.colorSwatchOuter, isSelected && { borderColor: c }]}>
                  <View style={[styles.colorSwatch, { backgroundColor: c }]}>
                    {isSelected && <MaterialIcons name="check" size={18} color="#fff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Icon
          </ThemedText>
          <View style={styles.iconPickerRow}>
            <Pressable
              onPress={() => setIconManuallySet(false)}
              style={[styles.aiTile, { borderColor: theme.border }, !iconManuallySet && { borderColor: color, backgroundColor: color + '1a' }]}>
              <MaterialIcons name="auto-awesome" size={20} color={!iconManuallySet ? color : theme.textSecondary} />
              <ThemedText type="small" style={[styles.aiTileText, !iconManuallySet && { color }]}>
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
                          onPress={() => {
                            setIcon(iconName);
                            setIconManuallySet(true);
                          }}
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
          {!iconManuallySet && (
            <ThemedText type="small" themeColor="textTertiary" style={styles.iconCaption}>
              Suggested from the name — tap an icon below to pick your own.
            </ThemedText>
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor={canSave ? undefined : 'textTertiary'} style={canSave && styles.saveButtonText}>
            Save
          </ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
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
  iconCaption: {
    marginTop: -Spacing.one,
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
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
