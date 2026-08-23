import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import type { Category } from '@/lib/categories';

export function CategoryBadge({
  category,
  size = 36,
  color,
}: {
  category: Category;
  size?: number;
  // Overrides the category's own color — used everywhere the standardized
  // expense=red/income=green treatment applies, so most callers pass this.
  color?: string;
}) {
  const tint = color ?? category.color;

  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint + '26' }]}>
      <MaterialIcons name={category.icon} size={size * 0.52} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
