import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorPicker, IconPicker, resolveIcon } from '@/components/icon-color-picker';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addCategory, CATEGORY_COLORS, getCategories, updateCategory, type CategoryIcon } from '@/lib/categories';

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
  // null = auto: the icon live-follows the name via IconPicker's own
  // suggestion instead of being written to state on every keystroke — same
  // pattern as HabitTracker's add-habit icon picker.
  const [icon, setIcon] = useState<CategoryIcon | null>(null);

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
        setIcon(existing.icon);
      }
      setLoaded(true);
    });
  }, [id]);

  const displayIcon = resolveIcon(icon, name);
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
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
