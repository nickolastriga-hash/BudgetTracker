// DarkTheme/DefaultTheme/ThemeProvider come from 'expo-router' itself, not
// '@react-navigation/native' directly — SDK 56+ stopped supporting that as a
// direct dependency (a hard Metro build error), which is exactly why this
// project was pinned to SDK 54 until now (see CLAUDE.md's "Why SDK 54, not
// 57" — resolved by the 2026-09-04 SDK 57 upgrade). expo-router re-exports
// the same theme objects/component from its own vendored fork, so this is a
// straight import-source swap, no behavior change.
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LockScreen } from '@/components/lock-screen';
import { Colors } from '@/constants/theme';
import { AppLockProvider } from '@/hooks/use-app-lock';
import { CurrencyProvider } from '@/hooks/use-currency';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { generateDueTransactions } from '@/lib/recurring';

SplashScreen.preventAutoHideAsync();

// Split out from the default export (2026-09-17, alongside the Light/Dark/
// Auto appearance setting) so this can call useThemePreference() — a hook
// needs to render underneath ThemePreferenceProvider, not beside it.
function RootLayoutInner() {
  const { scheme } = useThemePreference();

  useEffect(() => {
    // Materialize any due recurring transactions once per session, then reveal the UI.
    // hideAsync() rejects (unhandled) if the splash is already gone — e.g. a Fast
    // Refresh reload, or React dev-mode double-invoking this effect — so swallow it;
    // there's nothing to recover from and it isn't worth surfacing as an error.
    generateDueTransactions().finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, []);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors[scheme].background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-transaction"
          options={{ headerShown: true, presentation: 'modal', title: 'Add Transaction' }}
        />
        <Stack.Screen
          name="category-editor"
          options={{ headerShown: true, presentation: 'modal', title: 'New Category' }}
        />
        <Stack.Screen name="budget-editor" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="edit-recurring" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, presentation: 'modal', title: 'Settings' }} />
        <Stack.Screen name="goal-editor" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="debt-editor" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="account-editor" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="set-pin" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      {/* A sibling above the Stack (not a route) so it covers whatever
          screen or modal is open when the app locks, and unlocking doesn't
          disturb navigation state underneath. Renders null while unlocked. */}
      <LockScreen />
      {/* expo-status-bar's default behavior otherwise follows the OS's own
          appearance, not this app's resolved scheme — now that Settings can
          pin the two apart (a Dark override on a Light OS, say), leaving it
          on the default would risk status bar icons the same color as the
          background behind them. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <CurrencyProvider>
        <AppLockProvider>
          <RootLayoutInner />
        </AppLockProvider>
      </CurrencyProvider>
    </ThemePreferenceProvider>
  );
}
