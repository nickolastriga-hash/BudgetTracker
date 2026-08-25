import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/lib/categories';
import type { Transaction } from '@/lib/transactions';

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A plain row, not its own card — meant to sit inside a screen's grouped-list
// container (see the `group`/`divider` styles in index.tsx/transactions.tsx),
// iOS Settings-style, rather than being individually shadowed.
export function TransactionRow({
  transaction,
  category,
  onPress,
}: {
  transaction: Transaction;
  category: Category | undefined;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const isExpense = transaction.type === 'expense';
  // Standardized across the app: expenses are always destructive (red),
  // income is always success (green) — never just per-category color.
  const typeColor = isExpense ? theme.destructive : theme.success;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      <View style={[styles.accentBar, { backgroundColor: typeColor }]} />
      {category && <CategoryBadge category={category} color={typeColor} />}
      <View style={styles.middle}>
        <ThemedText type="default" numberOfLines={1}>
          {category?.name ?? 'Other'}
        </ThemedText>
        {transaction.note ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {transaction.note}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.amountGroup}>
        <MaterialIcons name={isExpense ? 'arrow-downward' : 'arrow-upward'} size={13} color={typeColor} />
        <ThemedText type="default" style={[styles.amount, { color: typeColor }]}>
          {isExpense ? '-' : '+'}${formatAmount(transaction.amount)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  middle: {
    flex: 1,
    gap: 2,
    marginLeft: Spacing.one,
  },
  amountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
