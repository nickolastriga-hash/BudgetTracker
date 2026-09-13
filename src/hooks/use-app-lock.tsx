import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { disableAppLock, getAppLockConfig, setUseBiometrics as persistUseBiometrics, verifyPin } from '@/lib/app-lock';

// Re-lock after this long in the background. Short enough that handing the
// phone over locks it, long enough that a quick app-switch (copying a number
// out of a banking app) doesn't demand a PIN every time.
const RELOCK_AFTER_MS = 30_000;

interface AppLockContextValue {
  // Whether a PIN has been set up at all — the Settings toggle's state.
  enabled: boolean;
  locked: boolean;
  biometricsAvailable: boolean;
  biometricLabel: string; // "Face ID" / "Touch ID" / "Fingerprint" / "Face unlock" / "Biometrics"
  useBiometrics: boolean;
  refresh: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  setUseBiometrics: (value: boolean) => Promise<void>;
  disable: () => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

function labelFor(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }
  return 'Biometrics';
}

// Owns the locked/unlocked state for the whole app (mounted from
// src/app/_layout.tsx, above the Stack, so the LockScreen overlay it drives
// covers every route including modals). Locks on cold start when a PIN is
// set, and again on returning from the background after RELOCK_AFTER_MS.
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [useBiometrics, setUseBiometricsState] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const backgroundedAt = useRef<number | null>(null);

  async function refresh() {
    const config = await getAppLockConfig();
    setEnabled(!!config?.enabled);
    setUseBiometricsState(config?.useBiometrics ?? true);
  }

  useEffect(() => {
    getAppLockConfig().then((config) => {
      setEnabled(!!config?.enabled);
      setUseBiometricsState(config?.useBiometrics ?? true);
      // Cold start with a PIN set: locked until proven otherwise.
      if (config?.enabled) setLocked(true);
    });
    // The web shim resolves hasHardwareAsync to false, so this degrades to
    // PIN-only there without a platform branch.
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]).then(([hasHardware, enrolled, types]) => {
      setBiometricsAvailable(hasHardware && enrolled);
      setBiometricLabel(labelFor(types));
    });
  }, []);

  useEffect(() => {
    // Only 'background' starts the re-lock clock, not 'inactive' — iOS goes
    // inactive for the system biometric prompt itself (and for Control
    // Center, notification pull-downs, etc.), and re-locking on those would
    // trap the user in a loop of unlock prompts.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away !== null && Date.now() - away >= RELOCK_AFTER_MS) {
          getAppLockConfig().then((config) => {
            if (config?.enabled) setLocked(true);
          });
        }
      }
    });
    return () => sub.remove();
  }, []);

  async function unlockWithPin(pin: string) {
    const ok = await verifyPin(pin);
    if (ok) setLocked(false);
    return ok;
  }

  async function unlockWithBiometrics() {
    if (!biometricsAvailable) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock BudgetTracker',
      cancelLabel: 'Use PIN',
      // The app has its own PIN fallback — the OS passcode sheet on top of
      // that would be a third way in, and one this app never verified.
      disableDeviceFallback: true,
    });
    if (result.success) setLocked(false);
    return result.success;
  }

  async function setUseBiometrics(value: boolean) {
    setUseBiometricsState(value);
    await persistUseBiometrics(value);
  }

  async function disable() {
    await disableAppLock();
    setEnabled(false);
    setLocked(false);
  }

  return (
    <AppLockContext.Provider
      value={{
        enabled,
        locked,
        biometricsAvailable,
        biometricLabel,
        useBiometrics,
        refresh,
        unlockWithPin,
        unlockWithBiometrics,
        setUseBiometrics,
        disable,
      }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
