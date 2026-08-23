import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      {category && <CategoryBadge category={category} />}
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
      <ThemedText type="default" themeColor={isExpense ? 'destructive' : 'success'} style={styles.amount}>
        {isExpense ? '-' : '+'}${formatAmount(transaction.amount)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
});
