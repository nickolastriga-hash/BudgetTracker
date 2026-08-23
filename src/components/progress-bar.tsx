import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({ percent, color, height = 8 }: { percent: number; color: string; height?: number }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(percent, 1));
  const fillColor = percent > 1 ? theme.destructive : color;

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 0,
  },
});
