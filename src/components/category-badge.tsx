import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import type { Category } from '@/lib/categories';

export function CategoryBadge({ category, size = 36 }: { category: Category; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: category.color + '26' },
      ]}>
      <MaterialIcons name={category.icon} size={size * 0.52} color={category.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
