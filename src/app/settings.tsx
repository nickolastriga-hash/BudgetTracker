import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { generateDemoData } from '@/lib/demo-data';

function SettingsRow({
  icon,
  label,
  subtitle,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  subtitle?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
      ]}
      onPress={onPress}
      disabled={disabled}>
      <View style={[styles.rowIconCircle, { backgroundColor: theme.accent + '1A' }]}>
        <MaterialIcons name={icon} size={20} color={theme.accent} />
      </View>
      <View style={styles.rowLabelGroup}>
        <ThemedText type="default">{label}</ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setGenerating(true);
    setResult(null);
    const { transactions, budgets } = await generateDemoData();
    setGenerating(false);
    setResult(`Added ${transactions} transactions and set ${budgets} budgets/goals.`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          DEMO DATA
        </ThemedText>
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <SettingsRow
            icon="auto-awesome"
            label={
              generating
                ? 'Generating…'
                : confirming
                  ? 'Tap again to generate'
                  : 'Generate demo data'
            }
            subtitle="Adds random expense/income transactions for this year to date plus all of last year, and sets a handful of expense budgets and income goals. Doesn't touch or remove anything already there — safe to run more than once, but repeats will pile up."
            disabled={generating}
            onPress={handleGenerate}
          />
        </View>
        {result && (
          <ThemedText type="small" themeColor="success" style={styles.resultText}>
            {result}
          </ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  section: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabelGroup: {
    flex: 1,
    gap: 2,
  },
  resultText: {
    paddingHorizontal: Spacing.two,
  },
});
