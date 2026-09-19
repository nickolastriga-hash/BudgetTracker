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

import { CategoryRingChart } from '@/components/category-ring-chart';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { markTutorialSeen } from '@/lib/onboarding';

// One row of a slide's mock preview: the same icon-badge + label + amount
// shape the real screens use, with made-up data.
type MockRow = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  label: string;
  sub?: string;
  amount?: string;
  amountTone?: 'expense' | 'income' | 'plain';
  percent?: number;
  barType?: 'expense' | 'income';
};

type Slide = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  body: string;
  points?: string[];
  // A miniature, non-interactive imitation of the tab being described.
  // `legend` swaps the icon-badge rows for Home's own colour-dot + share
  // legend, so the Home slide reads as that screen rather than a list.
  mock?: { caption?: string; ring?: boolean; legend?: boolean; rows: MockRow[] };
};

// Sampled from CATEGORY_COLORS so the mocks match the palette a real
// category would land on.
const C = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  blue: '#007AFF',
  purple: '#AF52DE',
};

// One slide per tab, plus a welcome and a wrap-up. Each carries a small
// mock-up of the screen it describes, built from this app's own components
// with dummy data (groceries, a credit card, a rent bill) rather than
// bundled screenshots: a real screenshot would go stale every time a screen
// is restyled, and would need a separate light and dark copy.
const SLIDES: Slide[] = [
  {
    icon: 'waving-hand',
    title: 'Welcome',
    body: 'Take charge of your money in a few taps a day. Everything lives right here on your device, ready the moment you open the app.',
    points: ['See where your money goes', 'Set a limit for any category', 'Grow savings and clear debt'],
  },
  {
    icon: 'home',
    title: 'Home',
    body: 'Your whole month at a glance. The ring shows where your spending went, with trends, upcoming bills and your budgets just below.',
    points: ['Tap a ring segment to focus a category', 'Use the arrows to look at another month', 'Tap + to log a transaction'],
    mock: {
      caption: 'September 2026',
      ring: true,
      legend: true,
      // Largest share first, the order Home's own legend uses.
      rows: [
        { icon: 'home', color: C.purple, label: 'Housing', amount: '63%', percent: 0.63 },
        { icon: 'restaurant', color: C.orange, label: 'Food & Dining', amount: '25%', percent: 0.25 },
        { icon: 'directions-car', color: C.blue, label: 'Transport', amount: '11%', percent: 0.11 },
      ],
    },
  },
  {
    icon: 'receipt-long',
    title: 'Transactions',
    body: 'Every transaction, neatly grouped by date. View a week, a month, a year, or pick any range you like.',
    points: ['Search by note or category', 'Filter to just what you need', 'Swipe across for repeating items'],
    mock: {
      caption: 'Fri, Sep 18',
      rows: [
        { icon: 'local-grocery-store', color: C.orange, label: 'Groceries', sub: 'Weekly shop', amount: '-$82.40', amountTone: 'expense' },
        { icon: 'local-cafe', color: C.yellow, label: 'Coffee', amount: '-$4.75', amountTone: 'expense' },
        { icon: 'payments', color: C.green, label: 'Salary', sub: 'Payday', amount: '+$3,000.00', amountTone: 'income' },
      ],
    },
  },
  {
    icon: 'event-repeat',
    title: 'Recurring',
    body: 'Rent, subscriptions and anything else on repeat. Set it up once and every occurrence is logged for you automatically.',
    points: ['Weekly through yearly, or your own interval', 'Adjust or end a series whenever you like', 'Home flags what is due in the next 7 days'],
    mock: {
      caption: 'Due this week',
      rows: [
        { icon: 'home', color: C.blue, label: 'Rent', sub: 'Monthly · next Oct 1', amount: '-$1,200.00', amountTone: 'expense' },
        { icon: 'subscriptions', color: C.red, label: 'Netflix', sub: 'Monthly · next Sep 25', amount: '-$15.99', amountTone: 'expense' },
        { icon: 'fitness-center', color: C.purple, label: 'Gym', sub: 'Monthly · next Sep 28', amount: '-$39.00', amountTone: 'expense' },
      ],
    },
  },
  {
    icon: 'pie-chart',
    title: 'Budgets',
    body: 'Give a category a monthly limit and watch the bar fill as you spend. Income categories work the same way, as targets to reach.',
    points: ['Turns amber at 80%, red once you pass it', 'Adjust a limit for one month or for good', 'Swipe between spending and income'],
    mock: {
      caption: 'Expense budgets',
      rows: [
        { icon: 'restaurant', color: C.orange, label: 'Food', sub: '$340 of $400', percent: 0.85, barType: 'expense' },
        { icon: 'directions-car', color: C.purple, label: 'Transport', sub: '$210 of $200', percent: 1.05, barType: 'expense' },
        { icon: 'movie', color: C.blue, label: 'Fun', sub: '$45 of $150', percent: 0.3, barType: 'expense' },
      ],
    },
  },
  {
    icon: 'savings',
    title: 'Wealth',
    body: 'Savings goals, a debt payoff plan and your net worth, all in one place. You keep the numbers up to date, so they always reflect the full picture.',
    points: ['Watch each savings goal fill up', 'Get a snowball plan and a payoff date', 'See your net worth at a glance'],
    mock: {
      caption: 'Goals and debts',
      rows: [
        { icon: 'savings', color: C.green, label: 'Emergency Fund', sub: '$2,400 of $5,000', percent: 0.48, barType: 'income' },
        { icon: 'credit-card', color: C.red, label: 'Credit Card', sub: '36% paid · 22.99% APR', percent: 0.36, barType: 'income' },
        { icon: 'account-balance', color: C.blue, label: 'Net worth', amount: '$18,240.00', amountTone: 'plain' },
      ],
    },
  },
  {
    icon: 'settings',
    title: 'Make it yours',
    body: 'Settings is where you make the app yours. Pick your currency, go light or dark, add a PIN, and keep your data safely backed up.',
    points: ['Back up to a file or the cloud', 'Export your transactions as a spreadsheet', 'Try it out first with demo data'],
    mock: {
      caption: 'Settings',
      rows: [
        { icon: 'attach-money', color: C.green, label: 'Currency', sub: 'US Dollar ($)' },
        { icon: 'dark-mode', color: C.purple, label: 'Appearance', sub: 'Light, Dark or Auto' },
        { icon: 'lock-outline', color: C.blue, label: 'App lock', sub: 'PIN or Face ID' },
      ],
    },
  },
];

// A miniature, non-interactive imitation of the screen a slide describes.
// Uses the app's real ProgressBar and ring chart so it keeps matching the
// app's look (and its light/dark theming) without any bundled image.
function MockPreview({ mock }: { mock: NonNullable<Slide['mock']> }) {
  const theme = useTheme();
  // Sized off each row's own share, so a wedge always matches its legend row.
  const ringSegments = mock.rows.map((r, i) => ({ key: String(i), amount: r.percent ?? 1, color: r.color }));

  return (
    <View style={[styles.mockCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {mock.caption && (
        <ThemedText type="small" themeColor="textTertiary" style={styles.mockCaption}>
          {mock.caption}
        </ThemedText>
      )}
      {mock.ring && ringSegments.length > 0 && (
        <View style={styles.mockRing}>
          {/* Same center stack as Home's own default (unselected) ring:
              a tinted receipt badge, the period total, then the label. */}
          <CategoryRingChart
            segments={ringSegments}
            size={150}
            strokeWidth={15}
            trackColor={theme.backgroundElement}
            outlineColor={theme.card}>
            <View style={[styles.mockRingBadge, { backgroundColor: theme.destructive + '26' }]}>
              <MaterialIcons name="receipt-long" size={18} color={theme.destructive} />
            </View>
            <ThemedText numberOfLines={1} style={styles.mockRingAmount}>
              $1,892.55
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.mockRingLabel}>
              TOTAL EXPENSES
            </ThemedText>
          </CategoryRingChart>
        </View>
      )}
      {mock.legend
        ? mock.rows.map((row) => (
            <View key={row.label} style={styles.mockLegendRow}>
              <View style={[styles.mockLegendDot, { backgroundColor: row.color }]} />
              <ThemedText type="small" numberOfLines={1} style={styles.mockLegendName}>
                {row.label}
              </ThemedText>
              {/* A plain track + fill, like Home's own legend — not
                  ProgressBar, whose expense semantics would repaint the
                  largest share amber at 100% of the top category. */}
              <View style={[styles.mockLegendBar, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.mockLegendBarFill,
                    {
                      width: `${Math.max(((row.percent ?? 0) / (mock.rows[0].percent ?? 1)) * 100, 4)}%`,
                      backgroundColor: row.color,
                    },
                  ]}
                />
              </View>
              <ThemedText type="smallBold" style={styles.mockLegendShare}>
                {row.amount}
              </ThemedText>
            </View>
          ))
        : mock.rows.map((row) => (
        <View key={row.label} style={styles.mockRow}>
          <View style={styles.mockRowTop}>
            <View style={[styles.mockBadge, { backgroundColor: row.color + '26' }]}>
              <MaterialIcons name={row.icon} size={14} color={row.color} />
            </View>
            <View style={styles.mockRowText}>
              <ThemedText type="small" numberOfLines={1} style={styles.mockLabel}>
                {row.label}
              </ThemedText>
              {row.sub && (
                <ThemedText type="small" themeColor="textTertiary" numberOfLines={1} style={styles.mockSub}>
                  {row.sub}
                </ThemedText>
              )}
            </View>
            {row.amount && (
              <ThemedText
                type="smallBold"
                themeColor={row.amountTone === 'expense' ? 'destructive' : row.amountTone === 'income' ? 'success' : undefined}
                style={styles.mockAmount}>
                {row.amount}
              </ThemedText>
            )}
          </View>
          {row.percent !== undefined && (
            <View style={styles.mockBar}>
              <ProgressBar percent={row.percent} color={row.color} height={5} type={row.barType ?? 'expense'} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

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
            {/* Each slide scrolls on its own: the tallest ones (a mock card
                plus a three-point checklist) overflow a short screen, and
                flexGrow keeps them vertically centred when they don't. */}
            <ScrollView contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
              <View style={[styles.iconCircle, { backgroundColor: theme.accent + '1A' }]}>
                <MaterialIcons name={slide.icon} size={44} color={theme.accent} />
              </View>
              <ThemedText style={styles.slideTitle}>{slide.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.slideBody}>
                {slide.body}
              </ThemedText>
              {slide.mock && <MockPreview mock={slide.mock} />}
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
            </ScrollView>
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
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
  mockCard: {
    alignSelf: 'stretch',
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  mockCaption: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mockRing: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  mockRingBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockRingAmount: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 5,
    maxWidth: 104,
  },
  mockRingLabel: {
    letterSpacing: 0.6,
    fontSize: 9,
    maxWidth: 104,
    textAlign: 'center',
  },
  mockRow: {
    gap: 4,
  },
  mockRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mockBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockRowText: {
    flex: 1,
  },
  mockLabel: {
    fontSize: 13,
  },
  mockSub: {
    fontSize: 11,
  },
  mockAmount: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  mockBar: {
    paddingLeft: 26 + Spacing.two,
  },
  mockLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mockLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockLegendName: {
    flex: 1,
    fontSize: 13,
  },
  mockLegendBar: {
    width: 56,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  mockLegendBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  mockLegendShare: {
    fontSize: 13,
    minWidth: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
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
