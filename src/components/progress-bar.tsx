import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { CategoryType } from '@/lib/categories';

export function ProgressBar({
  percent,
  color,
  height = 8,
  type = 'expense',
}: {
  percent: number;
  color: string;
  height?: number;
  // 'expense' (default) turns destructive past 100% (over budget, bad).
  // 'income' turns success at/past 100% instead (goal reached, good).
  type?: CategoryType;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(percent, 1));
  const fillColor = type === 'income' ? (percent >= 1 ? theme.success : color) : percent > 1 ? theme.destructive : color;

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
