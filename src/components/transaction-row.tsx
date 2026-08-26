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
// container (see the `group`/`divider` styles in index.tsx/transactions.tsx).
// Redesigned 2026-08-26 (dropped the old left accent bar + arrow glyph for a
// flatter, more modern look — just a bigger icon badge and a bold colored
// amount carrying the expense/income cue) per explicit feedback that the
// previous version looked dated.
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
  // Standardized: expenses are always destructive (red), income is always
  // success (green) here — a transaction has one unambiguous type, so the
  // badge itself carries that color rather than the category's own.
  const typeColor = isExpense ? theme.destructive : theme.success;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      {category && <CategoryBadge category={category} color={typeColor} size={42} />}
      <View style={styles.middle}>
        <ThemedText type="default" style={styles.categoryName} numberOfLines={1}>
          {category?.name ?? 'Other'}
        </ThemedText>
        {transaction.note ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {transaction.note}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="default" style={[styles.amount, { color: typeColor }]}>
        {isExpense ? '-' : '+'}${formatAmount(transaction.amount)}
      </ThemedText>
      <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
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
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    fontWeight: '600',
  },
  amount: {
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    fontWeight: '700',
  },
});
