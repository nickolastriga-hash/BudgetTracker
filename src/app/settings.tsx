import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { useAppLock } from '@/hooks/use-app-lock';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { clearAllData, exportBackup, getLastBackupDate, importBackup } from '@/lib/backup';
import { CURRENCIES, currencyOption, formatMoney, LOCALES } from '@/lib/currency';
import { exportTransactionsCsv } from '@/lib/csv-export';
import { generateDemoData } from '@/lib/demo-data';

const BACKUP_STALE_MS = 30 * 24 * 60 * 60 * 1000;

function SettingsRow({
  icon,
  label,
  subtitle,
  subtitleColor,
  disabled,
  onPress,
  right,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  subtitle?: string;
  // Colors the subtitle accent instead of textSecondary — used for Account's
  // "Sign In" row so it reads as an affordance, not a neutral status label.
  subtitleColor?: ThemeColor;
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
          <ThemedText type="small" themeColor={subtitleColor ?? 'textSecondary'}>
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
  const { user } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const appLock = useAppLock();
  const currency = useCurrency();
  const [picker, setPicker] = useState<'currency' | 'locale' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupStale, setBackupStale] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
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
    const { transactions, budgets, goals, debts, accounts } = await generateDemoData();
    setGenerating(false);
    setResult(
      `Added ${transactions} transactions, set ${budgets} budgets/goals, and added ${goals} savings goals, ${debts} debts, and ${accounts} accounts.`
    );
  }

  async function refreshLastBackup() {
    const iso = await getLastBackupDate();
    setLastBackup(iso);
    setBackupStale(iso !== null && Date.now() - new Date(iso).getTime() > BACKUP_STALE_MS);
  }

  // Also covers returning from Account after a cloud backup.
  useFocusEffect(
    useCallback(() => {
      getLastBackupDate().then((iso) => {
        setLastBackup(iso);
        setBackupStale(iso !== null && Date.now() - new Date(iso).getTime() > BACKUP_STALE_MS);
      });
    }, [])
  );

  async function handleBackup() {
    setBusy(true);
    setDataResult(null);
    try {
      const outcome = await exportBackup();
      await refreshLastBackup();
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

  async function handleExportCsv() {
    setBusy(true);
    setDataResult(null);
    try {
      const outcome = await exportTransactionsCsv();
      setDataResult(
        outcome === 'unavailable'
          ? { text: 'Sharing isn’t available on this device.', ok: false }
          : { text: outcome === 'downloaded' ? 'CSV downloaded.' : 'CSV ready to save or send.', ok: true }
      );
    } catch (e) {
      setDataResult({ text: e instanceof Error ? e.message : 'Export failed.', ok: false });
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

  async function handleClear() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    setBusy(true);
    setDataResult(null);
    try {
      await clearAllData();
      setDataResult({ text: 'All data deleted.', ok: true });
    } catch (e) {
      setDataResult({ text: e instanceof Error ? e.message : 'Delete failed.', ok: false });
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
          ACCOUNT
        </ThemedText>
        <View style={sectionStyle}>
          <SettingsRow
            icon="account-circle"
            label="Account"
            subtitle={user ? (user.email ?? 'Signed in') : 'Sign In'}
            subtitleColor={user ? undefined : 'accent'}
            onPress={() => router.push('/account')}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          HELP
        </ThemedText>
        <View style={sectionStyle}>
          <SettingsRow
            icon="school"
            label="How BudgetTracker works"
            subtitle="A quick tour of each tab. Shown once on the first launch, and here whenever you want it again."
            onPress={() => router.push('/tutorial')}
          />
        </View>

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
          CURRENCY
        </ThemedText>
        <View style={sectionStyle}>
          <SettingsRow
            icon="attach-money"
            label="Currency"
            subtitle={`${currencyOption(currency.settings.currency).name} (${currency.symbol})`}
            onPress={() => setPicker('currency')}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsRow
            icon="pin"
            label="Number format"
            subtitle={`${LOCALES.find((l) => l.tag === currency.settings.locale)?.name ?? 'Device default'} · ${currency.format(1234.5)}`}
            onPress={() => setPicker('locale')}
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
            icon="table-chart"
            label={busy ? 'Working…' : 'Export as CSV'}
            subtitle="Every transaction as a spreadsheet-ready CSV file, for reporting or your own analysis."
            disabled={busy}
            onPress={handleExportCsv}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsRow
            icon="restore"
            label={confirmingRestore ? 'Tap again to restore' : 'Restore from file'}
            subtitle="Replaces all current data with a backup file’s contents. This can’t be undone, so back up first if unsure."
            disabled={busy}
            onPress={handleRestore}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsRow
            icon="delete-forever"
            label={confirmingClear ? 'Tap again to delete everything' : 'Delete all data'}
            subtitle="Removes every transaction, budget, recurring series, goal, debt, and account, and resets categories to the defaults. Also clears demo data. This can’t be undone."
            disabled={busy}
            onPress={handleClear}
          />
        </View>
        <ThemedText
          type="small"
          themeColor={backupStale ? 'warning' : 'textSecondary'}
          style={styles.resultText}>
          {lastBackup
            ? `Last backed up ${new Date(lastBackup).toLocaleDateString()}${backupStale ? '. It has been over a month, so consider backing up again.' : '.'}`
            : 'No backup made from this device yet.'}
        </ThemedText>
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
            subtitle="Adds random expense/income transactions for this year to date plus all of last year, sets a handful of expense budgets and income goals, and adds a few sample savings goals, debts, and net-worth accounts. Doesn't touch or remove anything already there, so it's safe to run more than once, but repeats will pile up."
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

      <OptionPickerModal
        visible={picker === 'currency'}
        title="Currency"
        options={CURRENCIES.map((c) => ({
          value: c.code,
          label: `${c.name} (${c.code})`,
          detail: formatMoney(1234.5, { currency: c.code, locale: currency.settings.locale }),
        }))}
        value={currency.settings.currency}
        onSelect={(code) => {
          currency.setSettings({ currency: code });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'locale'}
        title="Number format"
        options={LOCALES.map((l) => ({
          value: l.tag,
          label: l.name,
          detail: formatMoney(1234567.89, { currency: currency.settings.currency, locale: l.tag }),
        }))}
        value={currency.settings.locale}
        onSelect={(tag) => {
          currency.setSettings({ locale: tag });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

// A scrollable single-select list in a centered card — same modal shell as
// Transactions' FilterModal (animationType "none", see that file for why).
// Each row shows a live sample amount so the effect of a choice is visible
// before it's made.
function OptionPickerModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string; detail: string }[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.pickerCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close">
              <MaterialIcons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <View key={o.value}>
                  <Pressable
                    onPress={() => onSelect(o.value)}
                    style={({ pressed }) => [styles.pickerRow, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
                    <View style={styles.rowLabelGroup}>
                      <ThemedText type="default">{o.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {o.detail}
                      </ThemedText>
                    </View>
                    {selected && <MaterialIcons name="check" size={20} color={theme.accent} />}
                  </Pressable>
                  {i < options.length - 1 && <View style={[styles.divider, styles.pickerDivider, { backgroundColor: theme.border }]} />}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  pickerDivider: {
    marginLeft: Spacing.three,
  },
});
