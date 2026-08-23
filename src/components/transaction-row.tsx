import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategory } from '@/lib/categories';
import type { Transaction } from '@/lib/transactions';

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TransactionRow({ transaction, onPress }: { transaction: Transaction; onPress?: () => void }) {
  const theme = useTheme();
  const category = getCategory(transaction.categoryId);
  const isExpense = transaction.type === 'expense';
  // Standardized across the app: expenses are always destructive (red),
  // income is always success (green) — never just per-category color.
  const typeColor = isExpense ? theme.destructive : theme.success;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        CardShadow,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}>
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
    padding: Spacing.three,
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
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
