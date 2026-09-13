import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// The PIN is stored as a salted SHA-256 rather than plaintext. A 4-digit PIN
// is brute-forceable offline in milliseconds regardless, so this isn't
// pretending to be real secret storage — the threat model is "someone picks
// up the unlocked phone", not "someone extracts AsyncStorage"; hashing just
// keeps the digits from sitting in a readable string. Biometrics are the
// device's own (expo-local-authentication) — nothing biometric is stored.
export interface AppLockConfig {
  enabled: boolean;
  salt: string;
  pinHash: string;
  useBiometrics: boolean;
}

// Exported so lib/backup.ts can leave this key out of exports and restores —
// a backup file shouldn't carry the PIN off-device, nor should restoring one
// silently switch the lock off (or on, with someone else's PIN).
export const APP_LOCK_STORAGE_KEY = '@budgettracker/app-lock';

export async function getAppLockConfig(): Promise<AppLockConfig | null> {
  const raw = await AsyncStorage.getItem(APP_LOCK_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AppLockConfig) : null;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function setPin(pin: string): Promise<void> {
  const existing = await getAppLockConfig();
  const salt = Crypto.randomUUID();
  const config: AppLockConfig = {
    enabled: true,
    salt,
    pinHash: await hashPin(pin, salt),
    useBiometrics: existing?.useBiometrics ?? true,
  };
  await AsyncStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await getAppLockConfig();
  if (!config?.enabled) return true;
  return (await hashPin(pin, config.salt)) === config.pinHash;
}

export async function setUseBiometrics(useBiometrics: boolean): Promise<void> {
  const config = await getAppLockConfig();
  if (!config) return;
  await AsyncStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify({ ...config, useBiometrics }));
}

export async function disableAppLock(): Promise<void> {
  await AsyncStorage.removeItem(APP_LOCK_STORAGE_KEY);
}
