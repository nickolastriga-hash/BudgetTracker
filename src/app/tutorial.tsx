import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { markTutorialSeen } from '@/lib/onboarding';

type Slide = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  body: string;
  points?: string[];
};

// One slide per tab, plus a welcome and a wrap-up. Kept to plain text and a
// glyph rather than screenshots: screenshots would go stale every time a
// screen is restyled (and this app restyles often), and they'd need light
// and dark copies.
const SLIDES: Slide[] = [
  {
    icon: 'waving-hand',
    title: 'Welcome',
    body: 'BudgetTracker keeps your money on your phone. Nothing is uploaded unless you back it up yourself, and there is no bank sync to set up.',
    points: ['Log what you spend and earn', 'Set limits per category', 'Track savings, debts and net worth'],
  },
  {
    icon: 'home',
    title: 'Home',
    body: 'Your month at a glance. The ring breaks your spending down by category, and the cards below it cover trends, upcoming bills, budgets and wealth.',
    points: ['Tap a ring segment to focus a category', 'Use the arrows to look at another month', 'Tap + to log a transaction'],
  },
  {
    icon: 'receipt-long',
    title: 'Transactions',
    body: 'Every transaction, grouped by date. Switch between a week, month, year or a custom range.',
    points: ['Search by note or category', 'Filter by type or category', 'Swipe to the Recurring page for repeating items'],
  },
  {
    icon: 'event-repeat',
    title: 'Recurring',
    body: 'Rent, subscriptions and anything else that repeats. Set it once and each occurrence is added for you the next time you open the app.',
    points: ['Weekly through yearly, or a custom interval', 'Edit or stop a series any time', 'Home shows what is due in the next 7 days'],
  },
  {
    icon: 'pie-chart',
    title: 'Budgets',
    body: 'Give a category a monthly limit and watch the bar fill. Income categories work the same way as goals to reach.',
    points: ['Amber at 80%, red once over', 'Change a limit for one month or from now on', 'Swipe between expenses and income'],
  },
  {
    icon: 'savings',
    title: 'Wealth',
    body: 'Savings goals, a debt payoff plan and your net worth. These are entered by hand, since there is no bank connection.',
    points: ['Goals track what you have set aside', 'Debts get a snowball payoff plan and chart', 'Net worth adds up accounts minus debts'],
  },
  {
    icon: 'settings',
    title: 'Make it yours',
    body: 'Settings has the rest: currency, light or dark, a PIN lock, backups, and demo data if you want to try things out first.',
    points: ['Back up to a file or the cloud', 'Export transactions as CSV', 'Open this tutorial again any time'],
  },
];

export default function TutorialScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pageWidth = useWindowDimensions().width;
  const pagerRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function goTo(next: number) {
    setIndex(next);
    // animated: true silently no-ops on react-native-web, same as every
    // other pager in this app.
    pagerRef.current?.scrollTo({ x: next * pageWidth, animated: false });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    setIndex(Math.min(SLIDES.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / pageWidth))));
  }

  async function finish() {
    await markTutorialSeen();
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable onPress={finish} hitSlop={10} accessibilityLabel="Close tutorial">
          <ThemedText type="small" themeColor="textSecondary">
            {isLast ? '' : 'Skip'}
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}>
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width: pageWidth, flex: 1 }}>
            <View style={styles.slide}>
              <View style={[styles.iconCircle, { backgroundColor: theme.accent + '1A' }]}>
                <MaterialIcons name={slide.icon} size={44} color={theme.accent} />
              </View>
              <ThemedText style={styles.slideTitle}>{slide.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.slideBody}>
                {slide.body}
              </ThemedText>
              {slide.points && (
                <View style={[styles.pointsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {slide.points.map((point) => (
                    <View key={point} style={styles.pointRow}>
                      <MaterialIcons name="check-circle" size={16} color={theme.success} />
                      <ThemedText type="small" style={styles.pointText}>
                        {point}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.title}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                i === index && [styles.dotActive, { backgroundColor: theme.accent }],
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => (isLast ? finish() : goTo(index + 1))}
          style={[styles.nextButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={styles.nextButtonText}>
            {isLast ? 'Get started' : 'Next'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    minHeight: 40,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  slideBody: {
    textAlign: 'center',
    lineHeight: 21,
  },
  pointsCard: {
    alignSelf: 'stretch',
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pointText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
  },
  nextButton: {
    paddingVertical: Spacing.three,
    borderRadius: CardRadius,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
  },
});
