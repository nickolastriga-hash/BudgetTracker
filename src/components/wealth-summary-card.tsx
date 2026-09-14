import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, CardShadow, Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { simulatePayoff, type Debt, type DebtPlanSettings } from '@/lib/debts';
import { goalProgress, type SavingsGoal } from '@/lib/goals';
import type { Account } from '@/lib/net-worth';

function monthStrLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// Home's one-glance Wealth card (2026-09-14, the TODO.md follow-up): net
// worth headline plus a goals tile and a debts tile, all computed the same
// way the Wealth tab does (debts count as liabilities automatically). Tapping
// anywhere opens the tab. Hidden until at least one goal/debt/account exists
// — an empty "Net worth $0.00" card would just be noise for someone using
// only the ledger.
export function WealthSummaryCard({
  goals,
  debts,
  plan,
  accounts,
}: {
  goals: SavingsGoal[];
  debts: Debt[];
  plan: DebtPlanSettings;
  accounts: Account[];
}) {
  const theme = useTheme();
  const { format } = useCurrency();

  if (goals.length + debts.length + accounts.length === 0) return null;

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalAssets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + a.balance, 0) + totalDebt;
  const netWorth = totalAssets - totalLiabilities;
  const hasNetWorth = accounts.length + debts.length > 0;

  const progress = goals.map((g) => goalProgress(g));
  const goalsReached = progress.filter((p) => p.percent >= 1).length;
  const totalSaved = progress.reduce((s, p) => s + p.saved, 0);

  const activeDebts = debts.filter((d) => d.balance > 0);
  const payoff = activeDebts.length > 0 ? simulatePayoff(debts, plan) : null;
  const debtLine =
    activeDebts.length === 0
      ? debts.length > 0
        ? 'All paid off'
        : 'No debts tracked'
      : payoff && !payoff.unreachable && payoff.debtFreeMonth
        ? `Debt-free ${monthStrLabel(payoff.debtFreeMonth)}`
        : 'Payments below interest';

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
        WEALTH
      </ThemedText>
      <Pressable
        onPress={() => router.push('/wealth')}
        accessibilityLabel="Open Wealth"
        style={({ pressed }) => [
          styles.card,
          CardShadow,
          { backgroundColor: pressed ? theme.backgroundElement : theme.card, borderColor: theme.border },
        ]}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <ThemedText type="small" themeColor="textSecondary">
              Net worth
            </ThemedText>
            <ThemedText
              type="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.heroAmount, { color: hasNetWorth ? (netWorth < 0 ? theme.destructive : theme.success) : theme.textTertiary }]}>
              {hasNetWorth ? format(netWorth) : '-'}
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
        </View>

        <View style={[styles.tiles, { borderTopColor: theme.border }]}>
          <View style={styles.tile}>
            <View style={styles.tileHeader}>
              <MaterialIcons name="savings" size={14} color={theme.success} />
              <ThemedText type="small" themeColor="textSecondary">
                Goals
              </ThemedText>
            </View>
            <ThemedText type="default" numberOfLines={1} style={styles.tileValue}>
              {goals.length === 0 ? 'None yet' : `${goalsReached} of ${goals.length} reached`}
            </ThemedText>
            {goals.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {format(totalSaved)} saved
              </ThemedText>
            )}
          </View>
          <View style={[styles.tileDivider, { backgroundColor: theme.border }]} />
          <View style={styles.tile}>
            <View style={styles.tileHeader}>
              <MaterialIcons name="credit-card" size={14} color={theme.destructive} />
              <ThemedText type="small" themeColor="textSecondary">
                Debts
              </ThemedText>
            </View>
            <ThemedText type="default" numberOfLines={1} style={styles.tileValue}>
              {debtLine}
            </ThemedText>
            {totalDebt > 0 && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {format(totalDebt)} owed
              </ThemedText>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroAmount: {
    fontSize: 28,
    lineHeight: 34,
  },
  tiles: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    flex: 1,
    padding: Spacing.three,
    gap: 2,
  },
  tileValue: {
    fontWeight: '600',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileDivider: {
    width: StyleSheet.hairlineWidth,
  },
});
