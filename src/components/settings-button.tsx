import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Same 34px soft-accent-circle shape as HabitTracker's ProfileButton, top
// right of every tab's ScreenHeader — a gear glyph instead of a profile
// avatar, since this app has no accounts to show a profile for.
const SIZE = 34;

export function SettingsButton() {
  const theme = useTheme();

  return (
    <Pressable
      hitSlop={10}
      onPress={() => router.push('/settings')}
      style={[styles.button, { backgroundColor: theme.accent + '26' }]}>
      <MaterialIcons name="settings" size={18} color={theme.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
