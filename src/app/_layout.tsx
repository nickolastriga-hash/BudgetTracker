import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
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
