import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = '@budgettracker/theme-preference';

const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  scheme: ResolvedScheme;
} | null>(null);

// In-app Light/Dark/Auto override (added 2026-09-17, matching HabitTracker's
// own use-theme-preference.tsx) — previously useTheme() read the OS scheme
// directly with no way to pin it. 'system' (the default, and the only
// behavior that existed before this) tracks the OS; 'light'/'dark' pin it
// regardless of what the OS is set to.
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
    });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const scheme: ResolvedScheme = preference === 'system' ? systemScheme : preference;

  // Our own JS-rendered content already follows `scheme` via useTheme(), but
  // native chrome that isn't styled through an RN prop (NativeTabs' own tab
  // bar material, in particular) reads UIKit's own trait collection, which
  // otherwise only ever follows the OS-level appearance — overriding to
  // Light/Dark against a different OS setting would leave that native chrome
  // stuck on the OS's own scheme. Appearance.setColorScheme forces the
  // native side to match; 'unspecified' on 'system' hands control back to
  // the OS instead of pinning it (this RN version's ColorSchemeName has no
  // `null` option the way some docs/examples show — 'unspecified' is its
  // reset value). Same fix HabitTracker uses for the identical native-chrome
  // gap.
  useEffect(() => {
    // react-native-web's Appearance shim doesn't implement setColorScheme
    // (throws "is not a function") — this call exists only to sync native
    // chrome, which doesn't exist on web anyway, so it's skipped there
    // rather than guarded with a feature check per call.
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  return <ThemePreferenceContext.Provider value={{ preference, setPreference, scheme }}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return ctx;
}
