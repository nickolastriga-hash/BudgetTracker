import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <NativeTabs tintColor={theme.accent}>
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" androidSrc={<VectorIcon family={MaterialIcons} name="home" />} />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <Icon
          sf="list.bullet.rectangle.fill"
          androidSrc={<VectorIcon family={MaterialIcons} name="receipt-long" />}
        />
        <Label>Transactions</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="budgets">
        <Icon sf="chart.pie.fill" androidSrc={<VectorIcon family={MaterialIcons} name="pie-chart" />} />
        <Label>Budgets</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trends">
        <Icon
          sf="chart.line.uptrend.xyaxis"
          androidSrc={<VectorIcon family={MaterialIcons} name="show-chart" />}
        />
        <Label>Trends</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
