import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PIN_LENGTH, PinPad } from '@/components/pin-pad';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppLock } from '@/hooks/use-app-lock';
import { useTheme } from '@/hooks/use-theme';

// Full-screen overlay rendered by the root layout whenever useAppLock says
// locked — sits above the Stack (not a route), so there's no navigation
// state to reach around it and nothing underneath re-renders on unlock.
export function LockScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { locked, biometricsAvailable, biometricLabel, useBiometrics, unlockWithPin, unlockWithBiometrics } = useAppLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const promptedRef = useRef(false);

  const canUseBiometrics = biometricsAvailable && useBiometrics;

  // Prompt biometrics once per lock, as soon as the overlay appears — the
  // ref (reset when `locked` flips off) keeps a re-render from re-prompting
  // mid-PIN-entry.
  useEffect(() => {
    if (!locked) {
      promptedRef.current = false;
      return;
    }
    if (canUseBiometrics && !promptedRef.current) {
      promptedRef.current = true;
      unlockWithBiometrics();
    }
    // unlockWithBiometrics is a fresh closure every render (it isn't
    // memoized in the provider); listing it would re-run this on each
    // render, which the ref guard handles but only after a wasted call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, canUseBiometrics]);

  if (!locked) return null;

  async function handleDigit(digit: string) {
    if (checking || pin.length >= PIN_LENGTH) return;
    setError(false);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setChecking(true);
      const ok = await unlockWithPin(next);
      setChecking(false);
      setPin('');
      if (!ok) setError(true);
    }
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hero}>
        <View style={[styles.lockBadge, { backgroundColor: theme.accent + '1A' }]}>
          <MaterialIcons name="lock" size={30} color={theme.accent} />
        </View>
        <ThemedText style={styles.title}>BudgetTracker</ThemedText>
        <ThemedText type="small" themeColor={error ? 'destructive' : 'textSecondary'}>
          {error ? 'Incorrect PIN, try again' : 'Enter your PIN'}
        </ThemedText>
      </View>

      <PinPad
        value={pin}
        error={error}
        onDigit={handleDigit}
        onDelete={() => setPin((p) => p.slice(0, -1))}
        bottomLeft={
          canUseBiometrics ? (
            <Pressable
              onPress={unlockWithBiometrics}
              hitSlop={8}
              accessibilityLabel={`Unlock with ${biometricLabel}`}
              style={({ pressed }) => [styles.biometricKey, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name={biometricLabel.startsWith('Face') ? 'face' : 'fingerprint'} size={30} color={theme.accent} />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.six,
    // Above every route and modal the Stack renders.
    zIndex: 1000,
    elevation: 1000,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  biometricKey: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
