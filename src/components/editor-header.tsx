import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The own-header shape every `headerShown: false` editor modal uses: an
// optional badge + title on the left, a circular X that calls router.back()
// on the right. Started life inline in budget-editor.tsx, copied verbatim
// into edit-recurring.tsx, and extracted (2026-09-13) once the goal/debt/
// account editors would've made copies 3-5.
export function EditorHeader({
  title,
  badge,
  onChangeTitle,
  titlePlaceholder,
}: {
  title: string;
  badge?: ReactNode;
  // Passing this makes the title itself the name field: a pencil beside it
  // swaps the text for an input, so the form below doesn't need its own
  // "Name" row (2026-09-19, goal-editor first).
  onChangeTitle?: (next: string) => void;
  titlePlaceholder?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
      <View style={styles.titleGroup}>
        {badge}
        {onChangeTitle && editingTitle ? (
          <TextInput
            value={title}
            onChangeText={onChangeTitle}
            placeholder={titlePlaceholder}
            placeholderTextColor={theme.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => setEditingTitle(false)}
            onBlur={() => setEditingTitle(false)}
            style={[styles.title, styles.titleInput, { color: theme.text, borderBottomColor: theme.accent }]}
          />
        ) : (
          <>
            <ThemedText
              type="default"
              themeColor={title ? undefined : 'textTertiary'}
              style={styles.title}
              numberOfLines={1}>
              {title || titlePlaceholder || ''}
            </ThemedText>
            {onChangeTitle && (
              <Pressable
                onPress={() => setEditingTitle(true)}
                hitSlop={10}
                accessibilityLabel="Edit name"
                style={styles.editButton}>
                <MaterialIcons name="edit" size={16} color={theme.accent} />
              </Pressable>
            )}
          </>
        )}
      </View>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityLabel="Close"
        style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
        <MaterialIcons name="close" size={20} color={theme.text} />
      </Pressable>
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
    gap: Spacing.two,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  titleInput: {
    flex: 1,
    paddingVertical: 2,
    borderBottomWidth: 1,
  },
  editButton: {
    padding: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
