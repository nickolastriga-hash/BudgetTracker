import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Same size/weight as HabitTracker's own per-tab header title (28/bold), and
// the same row shape (title left, one small round button right) — this app's
// right slot is a settings gear instead of a profile avatar, since there's
// no accounts system (see CLAUDE.md), but the layout matches.
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
});
