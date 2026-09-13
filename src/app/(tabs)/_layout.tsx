import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

// SDK 57 moved Icon/Label/VectorIcon from top-level exports to dot-notation
// compound components (NativeTabs.Trigger.Icon/.Label/.VectorIcon), and
// dropped the old `androidSrc` prop in favor of `src` (paired with `sf`,
// same "sf wins on iOS, src wins on Android" priority as before) — see
// CLAUDE.md's own SDK-54-vs-56+ note, now resolved by the 2026-09-04 SDK 57
// upgrade.
export default function TabLayout() {
  const theme = useTheme();

  return (
    <NativeTabs tintColor={theme.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf="house.fill"
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon
          sf="list.bullet.rectangle.fill"
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="receipt-long" />}
        />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Icon
          sf="calendar"
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="calendar-month" />}
        />
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Icon
          sf="chart.pie.fill"
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="pie-chart" />}
        />
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="wealth">
        <NativeTabs.Trigger.Icon
          sf="dollarsign.circle.fill"
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="account-balance-wallet" />}
        />
        <NativeTabs.Trigger.Label>Wealth</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
