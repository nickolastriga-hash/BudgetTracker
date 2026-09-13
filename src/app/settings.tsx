import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppLock } from '@/hooks/use-app-lock';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { exportBackup, importBackup } from '@/lib/backup';
import { generateDemoData } from '@/lib/demo-data';

function SettingsRow({
  icon,
  label,
  subtitle,
  disabled,
  onPress,
  right,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
  // Replaces the trailing chevron — a Switch, for the toggle rows.
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? theme.backgroundElement : 'transparent' },
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}>
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
      {right ?? <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useThemePreference();
  const appLock = useAppLock();
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dataResult, setDataResult] = useState<{ text: string; ok: boolean } | null>(null);

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

  async function handleBackup() {
    setBusy(true);
    setDataResult(null);
    try {
      const outcome = await exportBackup();
      setDataResult(
        outcome === 'unavailable'
          ? { text: 'Sharing isn’t available on this device.', ok: false }
          : { text: outcome === 'downloaded' ? 'Backup downloaded.' : 'Backup ready to save or send.', ok: true }
      );
    } catch (e) {
      setDataResult({ text: e instanceof Error ? e.message : 'Backup failed.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!confirmingRestore) {
      setConfirmingRestore(true);
      return;
    }
    setConfirmingRestore(false);
    setBusy(true);
    setDataResult(null);
    try {
      const restored = await importBackup();
      if (restored !== null) setDataResult({ text: `Restored ${restored} data sets from the backup.`, ok: true });
    } catch (e) {
      setDataResult({ text: e instanceof Error ? e.message : 'Restore failed.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  const sectionStyle = [styles.section, { backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          APPEARANCE
        </ThemedText>
        <View style={[...sectionStyle, styles.appearanceSection]}>
          <SegmentedControl
            options={[
              { value: 'light', label: 'Light', icon: 'light-mode' },
              { value: 'dark', label: 'Dark', icon: 'dark-mode' },
              { value: 'system', label: 'Auto', icon: 'brightness-auto' },
            ]}
            value={preference}
            onChange={setPreference}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          SECURITY
        </ThemedText>
        <View style={sectionStyle}>
          {/* Turning on routes through set-pin.tsx (the toggle only flips
              once a PIN is actually saved there); turning off is immediate —
              this session already got past the lock screen. */}
          <SettingsRow
            icon="lock-outline"
            label="App lock"
            subtitle={
              appLock.enabled
                ? 'Asks for your PIN when the app opens or comes back after 30 seconds away.'
                : 'Require a PIN to open the app.'
            }
            right={
              <Switch
                value={appLock.enabled}
                onValueChange={(on) => (on ? router.push('/set-pin') : appLock.disable())}
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#ffffff"
              />
            }
          />
          {appLock.enabled && appLock.biometricsAvailable && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <SettingsRow
                icon={appLock.biometricLabel.startsWith('Face') ? 'face' : 'fingerprint'}
                label={`Use ${appLock.biometricLabel}`}
                subtitle="Unlock without typing the PIN. The PIN still works as a fallback."
                right={
                  <Switch
                    value={appLock.useBiometrics}
                    onValueChange={appLock.setUseBiometrics}
                    trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                    thumbColor="#ffffff"
                  />
                }
              />
            </>
          )}
          {appLock.enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <SettingsRow icon="pin" label="Change PIN" onPress={() => router.push('/set-pin?mode=change')} />
            </>
          )}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          DATA
        </ThemedText>
        <View style={sectionStyle}>
          <SettingsRow
            icon="backup"
            label={busy ? 'Working…' : 'Back up to file'}
            subtitle="Saves everything (transactions, budgets, categories, recurring, goals, debts, net worth) as one JSON file you can keep anywhere."
            disabled={busy}
            onPress={handleBackup}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsRow
            icon="restore"
            label={confirmingRestore ? 'Tap again to restore' : 'Restore from file'}
            subtitle="Replaces all current data with a backup file’s contents. This can’t be undone, so back up first if unsure."
            disabled={busy}
            onPress={handleRestore}
          />
        </View>
        {dataResult && (
          <ThemedText type="small" themeColor={dataResult.ok ? 'success' : 'destructive'} style={styles.resultText}>
            {dataResult.text}
          </ThemedText>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          DEMO DATA
        </ThemedText>
        <View style={sectionStyle}>
          <SettingsRow
            icon="auto-awesome"
            label={
              generating
                ? 'Generating…'
                : confirming
                  ? 'Tap again to generate'
                  : 'Generate demo data'
            }
            subtitle="Adds random expense/income transactions for this year to date plus all of last year, and sets a handful of expense budgets and income goals. Doesn't touch or remove anything already there, so it's safe to run more than once, but repeats will pile up."
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
    marginTop: Spacing.two,
  },
  section: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // SettingsRow provides its own padding per row; the appearance toggle
  // isn't a row, so this section pads itself instead.
  appearanceSection: {
    padding: Spacing.two,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 34 + Spacing.three * 2,
  },
  resultText: {
    paddingHorizontal: Spacing.two,
  },
});
