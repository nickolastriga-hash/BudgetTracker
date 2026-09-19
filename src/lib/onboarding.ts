import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether the tutorial has been shown (and dismissed) on this device. A
// device-level UX flag, not data — lib/backup.ts excludes it alongside the
// theme/currency/app-lock keys, so restoring someone else's backup doesn't
// decide whether you've seen the tutorial.
export const ONBOARDING_STORAGE_KEY = '@budgettracker/onboarding-seen';

export async function hasSeenTutorial(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)) === 'true';
}

export async function markTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
}
