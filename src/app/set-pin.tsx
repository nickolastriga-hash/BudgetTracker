import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorHeader } from '@/components/editor-header';
import { PIN_LENGTH, PinPad } from '@/components/pin-pad';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppLock } from '@/hooks/use-app-lock';
import { useTheme } from '@/hooks/use-theme';
import { setPin } from '@/lib/app-lock';

// Two-step PIN entry (choose, then confirm) reached from Settings' App Lock
// toggle (`mode` absent — turning the lock on) or its Change PIN row
// (`?mode=change`). Turning the lock *off* doesn't come through here: the
// session is already past the lock screen, so it's trusted — same model
// most apps use.
export default function SetPinScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { refresh } = useAppLock();
  const [first, setFirst] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const confirming = first !== null;

  async function handleDigit(digit: string) {
    if (entry.length >= PIN_LENGTH) return;
    setMismatch(false);
    const next = entry + digit;
    setEntry(next);
    if (next.length < PIN_LENGTH) return;
    if (!confirming) {
      setFirst(next);
      setEntry('');
      return;
    }
    if (next !== first) {
      // Start over from the first step rather than re-asking for the
      // confirmation alone — a typo could have been in either entry.
      setMismatch(true);
      setFirst(null);
      setEntry('');
      return;
    }
    await setPin(next);
    await refresh();
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <EditorHeader title={mode === 'change' ? 'Change PIN' : 'Set up App Lock'} />
      <View style={[styles.body, { paddingBottom: insets.bottom + Spacing.six }]}>
        <View style={styles.captions}>
          <ThemedText type="default" style={styles.prompt}>
            {confirming ? 'Confirm your PIN' : 'Choose a 4-digit PIN'}
          </ThemedText>
          <ThemedText type="small" themeColor={mismatch ? 'destructive' : 'textSecondary'}>
            {mismatch ? 'PINs didn’t match, start again' : confirming ? 'Enter the same PIN once more' : 'You’ll need it to open the app'}
          </ThemedText>
        </View>
        <PinPad value={entry} error={mismatch} onDigit={handleDigit} onDelete={() => setEntry((p) => p.slice(0, -1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  captions: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  prompt: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
});
