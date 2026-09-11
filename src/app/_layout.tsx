// DarkTheme/DefaultTheme/ThemeProvider come from 'expo-router' itself, not
// '@react-navigation/native' directly — SDK 56+ stopped supporting that as a
// direct dependency (a hard Metro build error), which is exactly why this
// project was pinned to SDK 54 until now (see CLAUDE.md's "Why SDK 54, not
// 57" — resolved by the 2026-09-04 SDK 57 upgrade). expo-router re-exports
// the same theme objects/component from its own vendored fork, so this is a
// straight import-source swap, no behavior change.
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { generateDueTransactions } from '@/lib/recurring';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors[colorScheme === 'dark' ? 'dark' : 'light'].background },
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
        <Stack.Screen name="settings" options={{ headerShown: true, presentation: 'modal', title: 'Settings' }} />
      </Stack>
    </ThemeProvider>
  );
}
