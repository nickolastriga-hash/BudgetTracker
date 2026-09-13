import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The own-header shape every `headerShown: false` editor modal uses: an
// optional badge + title on the left, a circular X that calls router.back()
// on the right. Started life inline in budget-editor.tsx, copied verbatim
// into edit-recurring.tsx, and extracted (2026-09-13) once the goal/debt/
// account editors would've made copies 3-5.
export function EditorHeader({ title, badge }: { title: string; badge?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
      <View style={styles.titleGroup}>
        {badge}
        <ThemedText type="default" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
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
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
