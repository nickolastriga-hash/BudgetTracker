import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  CURRENCY_STORAGE_KEY,
  currencyOption,
  DEFAULT_CURRENCY_SETTINGS,
  formatMoney,
  formatMoneyCompact,
  type CurrencySettings,
} from '@/lib/currency';

const CurrencyContext = createContext<{
  settings: CurrencySettings;
  setSettings: (next: Partial<CurrencySettings>) => void;
} | null>(null);

// App-wide currency symbol + number locale (2026-09-14), same
// AsyncStorage-backed provider shape as ThemePreferenceProvider. Mounted
// from the root layout so a change in Settings re-renders every amount at
// once. Device-level, so lib/backup.ts excludes its key like the theme's.
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CurrencySettings>(DEFAULT_CURRENCY_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(CURRENCY_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as Partial<CurrencySettings>;
        setSettingsState({ ...DEFAULT_CURRENCY_SETTINGS, ...parsed });
      } catch {
        // A corrupt value just keeps the default.
      }
    });
  }, []);

  function setSettings(next: Partial<CurrencySettings>) {
    setSettingsState((prev) => {
      const merged = { ...prev, ...next };
      AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }

  return <CurrencyContext.Provider value={{ settings, setSettings }}>{children}</CurrencyContext.Provider>;
}

// `format(1234.5)` → "$1,234.50"; `format(-5)` → "-$5.00" (sign in front of
// the symbol); `compact(1234)` → "$1.2k". `symbol` is for the bare sign next
// to amount inputs.
export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  const { settings, setSettings } = ctx;
  return {
    settings,
    setSettings,
    symbol: currencyOption(settings.currency).symbol,
    format: (amount: number, opts?: { decimals?: number }) => formatMoney(amount, settings, opts),
    compact: (amount: number) => formatMoneyCompact(amount, settings),
  };
}
