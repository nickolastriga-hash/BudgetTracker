import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Category, CategoryType } from '@/lib/categories';

export function CategoryBadge({
  category,
  size = 36,
  color,
  type,
}: {
  category: Category;
  size?: number;
  // Overrides the category's own color — for contexts where the type
  // (expense/income) should read as the standardized red/green rather than
  // the category's custom color, e.g. TransactionRow's list rows.
  color?: string;
  // A small red/green dot overlay signaling expense vs. income, without
  // overriding the badge's own color. Ignored if `color` is set (the whole
  // badge is already the type color at that point, so a dot would be
  // redundant). Omit where the type is already obvious some other way (e.g.
  // an amount already colored red/green right next to it).
  type?: CategoryType;
}) {
  const theme = useTheme();
  const tint = color ?? category.color;
  const dotSize = Math.max(10, Math.round(size * 0.32));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint + '26' }]}>
        <MaterialIcons name={category.icon} size={size * 0.52} color={tint} />
      </View>
      {type && !color && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: type === 'expense' ? theme.destructive : theme.success,
              borderColor: theme.card,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderWidth: 1.5,
  },
});
