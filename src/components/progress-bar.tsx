import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { CategoryType } from '@/lib/categories';

// Share of an expense budget at which its bar turns amber.
export const BUDGET_WARNING_THRESHOLD = 0.8;

export function ProgressBar({
  percent,
  color,
  height = 8,
  type = 'expense',
}: {
  percent: number;
  color: string;
  height?: number;
  // 'expense' (default) turns warning-amber from 80% (approaching the limit)
  // and destructive past 100% (over budget, bad). 'income' turns success
  // at/past 100% instead (goal reached, good) — no warning band, since
  // nearing an income goal isn't a problem.
  type?: CategoryType;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(percent, 1));
  const fillColor =
    type === 'income'
      ? percent >= 1
        ? theme.success
        : color
      : percent > 1
        ? theme.destructive
        : percent >= BUDGET_WARNING_THRESHOLD
          ? theme.warning
          : color;

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
