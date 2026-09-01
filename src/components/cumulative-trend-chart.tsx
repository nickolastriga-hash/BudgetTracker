import { useId, useRef, useState } from 'react';
import type { GestureResponderEvent, View as ViewType } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface TrendPoint {
  date: string; // "YYYY-MM-DD"
  actual: number; // running cumulative total as of this date
}

const PADDING_X = 4;
const PADDING_Y = 10;
const CALLOUT_WIDTH = 140;

// A cumulative-actual line against a flat, dotted budget/goal reference line.
// A diagonal day-by-day "pace" line (plus an ahead/behind status band off of
// it) briefly replaced this for Expenses on 2026-08-31, then got reverted the
// same day per feedback — back to one flat "Target" line for all three of
// Expense/Income/Net, same as Income/Net already had. `budgetTotal` of null
// means no budgets are set for this type/period — Trends only totals
// categories that actually have a limit/goal set, so "none set" is a real,
// distinct case from "set to $0" — and no reference line is drawn, though the
// actual line still renders, still fills with its own soft gradient, and can
// still be scrubbed on its own. Bucketed by day regardless of the caller's
// range type (Month/Year/Custom all resolve to a plain day list via
// lib/date-range's daysBetween before reaching here), so there's one
// rendering path instead of three. `points` is capped at today by the caller
// (see trends.tsx) so the actual line stops there, but `totalDays` is the
// *full* nominal period's day count — the x-axis domain — so a still-in-
// progress period correctly shows the actual line occupying only its elapsed
// fraction of the chart width, with the flat reference line still spanning
// the full width out to the period's real end.
//
// A "Today" marker separates the actual period-to-date from the rest of the
// period when it isn't over yet, and, while scrubbing, a callout shows the
// flat target value at that point plus a colored delta against it (green
// when `positiveIsGood` says this side of target is the good side, red
// otherwise) — same visibility-pass additions from 2026-08-31, just no
// longer tied to a "paced" mode since there isn't one anymore.
export function CumulativeTrendChart({
  points,
  totalDays,
  budgetTotal,
  positiveIsGood,
  width,
  height,
  lineColor,
  formatValue,
  formatDate,
  onScrubStart,
  onScrubEnd,
}: {
  points: TrendPoint[];
  totalDays: number;
  budgetTotal: number | null;
  positiveIsGood: boolean;
  width: number;
  height: number;
  lineColor: string;
  formatValue: (amount: number) => string;
  formatDate: (dateStr: string) => string;
  // Fired on touch-down/touch-up so the caller can disable the outer
  // Expense/Income/Net pager's own scrollEnabled for the duration — see the
  // handleGrant/handleRelease comment below for why claiming the responder
  // here isn't enough on its own.
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}) {
  const theme = useTheme();
  const containerRef = useRef<ViewType>(null);
  // Cached on each touch-down (measureInWindow is async) rather than
  // re-measured on every move — same "measure once, then just do arithmetic
  // on pageX" approach CategoryRingChart's own tap handling uses, and for
  // the same reason: relying on the touch event's own locationX proved
  // unreliable on web there, so this mirrors what was already proven to
  // work instead of risking the same class of bug again.
  const containerLeftRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Three of these charts (Expense/Income/Net) are mounted at once on
  // Trends — react-native-svg renders a real <svg> on web, where element
  // ids are document-global, so a hardcoded gradient id would have the
  // second and third panel silently reuse the first panel's gradient.
  const gradientId = `trend-area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  if (!width || points.length === 0) return <View style={{ width, height }} />;

  const values = points.map((p) => p.actual);
  const maxValue = Math.max(...values, budgetTotal ?? -Infinity, 0);
  const minValue = Math.min(...values, budgetTotal ?? Infinity, 0);
  const range = maxValue - minValue || 1;

  const plotWidth = width - PADDING_X * 2;
  const plotHeight = height - PADDING_Y * 2;

  // The x-axis spans the full nominal period (totalDays), not just how many
  // actual points there are — so a period still in progress plots its actual
  // line only across its elapsed fraction of the width, leaving room for the
  // flat reference line to keep running out to the period's real end.
  const domainLength = Math.max(totalDays, points.length, 1);

  function yFor(v: number) {
    return PADDING_Y + (1 - (v - minValue) / range) * plotHeight;
  }
  function xFor(i: number) {
    return PADDING_X + (domainLength <= 1 ? plotWidth / 2 : (i / (domainLength - 1)) * plotWidth);
  }
  function indexForLocalX(localX: number) {
    if (domainLength <= 1) return 0;
    const ratio = (localX - PADDING_X) / plotWidth;
    const index = Math.round(ratio * (domainLength - 1));
    return Math.max(0, Math.min(points.length - 1, index));
  }
  function updateFromPageX(pageX: number) {
    setActiveIndex(indexForLocalX(pageX - containerLeftRef.current));
  }

  function handleGrant(e: GestureResponderEvent) {
    // Claiming this View as the JS responder (onStartShouldSetResponder
    // below) does NOT stop the outer pager ScrollView's own native pan
    // gesture recognizer from also picking up the same drag on iOS/Android —
    // that recognizer lives outside the JS responder system entirely, so a
    // horizontal drag on the chart still paged the Expense/Income/Net pager
    // underneath the scrub, even though this view was "handling" the touch.
    // Telling the caller to flip the pager's own `scrollEnabled` off for the
    // duration is what actually blocks it, regardless of platform.
    onScrubStart?.();
    const pageX = e.nativeEvent.pageX;
    containerRef.current?.measureInWindow((x) => {
      containerLeftRef.current = x;
      updateFromPageX(pageX);
    });
  }
  function handleMove(e: GestureResponderEvent) {
    updateFromPageX(e.nativeEvent.pageX);
  }
  function handleRelease() {
    setActiveIndex(null);
    onScrubEnd?.();
  }

  // "Today" marks where the actual line stops short of the full period —
  // only meaningful (and only drawn) while the period is still in progress.
  const todayX = points.length < domainLength ? xFor(points.length - 1) : null;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.actual)}`).join(' ');
  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;
  const calloutLeft =
    activeIndex !== null ? Math.min(Math.max(xFor(activeIndex) - CALLOUT_WIDTH / 2, 0), width - CALLOUT_WIDTH) : 0;
  const activeDiff = active && budgetTotal !== null ? active.actual - budgetTotal : null;
  const activeDiffGood = activeDiff !== null && (positiveIsGood ? activeDiff >= 0 : activeDiff <= 0);

  return (
    <View ref={containerRef} style={{ width, height }}>
      <Svg width={width} height={height}>
        {points.length >= 2 && (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity={0.22} />
              <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
        )}
        {/* Zero baseline — only meaningful (and only drawn) when the line
            actually crosses it, i.e. Net can go negative but Income/Expense
            never do. */}
        {minValue < 0 && maxValue > 0 && (
          <Line x1={PADDING_X} x2={width - PADDING_X} y1={yFor(0)} y2={yFor(0)} stroke={theme.border} strokeWidth={1} />
        )}
        {/* Soft gradient fill under the actual line — background layer the
            lines sit on top of, so it never obscures the data it's
            annotating. */}
        {points.length >= 2 && (
          <Polygon
            points={`${xFor(0)},${height - PADDING_Y} ${linePoints} ${xFor(points.length - 1)},${height - PADDING_Y}`}
            fill={`url(#${gradientId})`}
          />
        )}
        {todayX !== null && (
          <Line x1={todayX} x2={todayX} y1={PADDING_Y} y2={height - PADDING_Y} stroke={theme.border} strokeWidth={1} strokeDasharray="1,4" />
        )}
        {budgetTotal !== null && (
          <Line
            x1={xFor(0)}
            x2={xFor(domainLength - 1)}
            y1={yFor(budgetTotal)}
            y2={yFor(budgetTotal)}
            stroke={theme.textTertiary}
            strokeWidth={2}
            strokeDasharray="0.5,6"
            strokeLinecap="round"
          />
        )}
        <Polyline
          points={linePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active && activeIndex !== null ? (
          <>
            <Line
              x1={xFor(activeIndex)}
              x2={xFor(activeIndex)}
              y1={PADDING_Y}
              y2={height - PADDING_Y}
              stroke={theme.textTertiary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Circle cx={xFor(activeIndex)} cy={yFor(active.actual)} r={5} fill={lineColor} stroke={theme.card} strokeWidth={1.5} />
          </>
        ) : (
          <Circle cx={xFor(points.length - 1)} cy={yFor(last.actual)} r={4} fill={lineColor} />
        )}
      </Svg>

      {/* Transparent touch layer — a sibling of the Svg (not a wrapper),
          same reasoning as CategoryRingChart's own overlay: an ancestor
          Pressable/responder around an <Svg> triggers spurious "Unknown
          event handler property" console errors on web, since
          react-native-svg's shapes carry their own legacy touch-responder
          wiring. Claims the responder on press-down (not after a hold
          delay) — both the start and move variants, and both the capture
          and bubble phase, so this view wins the negotiation as early and as
          reliably as the JS responder system allows — so a press-and-drag
          reads as scrubbing from the first touch. The outer Expense/Income/
          Net pager's own *native* pan gesture recognizer isn't part of that
          negotiation at all, which is why onScrubStart/onScrubEnd above
          additionally disable the pager directly instead of relying on this
          alone. */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponder={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
      />

      {/* Non-SVG annotation labels — same "SVG draws shapes, the screen
          draws text" split as the callout below and as CategoryRingChart's
          own center content. */}
      {budgetTotal !== null && (
        <View
          pointerEvents="none"
          style={[styles.targetLabel, { top: Math.min(Math.max(yFor(budgetTotal) - 15, 0), height - 15) }]}>
          <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
            Target
          </ThemedText>
        </View>
      )}
      {todayX !== null &&
        (todayX < width / 2 ? (
          <View pointerEvents="none" style={[styles.todayLabel, { left: todayX + 4 }]}>
            <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
              Today
            </ThemedText>
          </View>
        ) : (
          <View pointerEvents="none" style={[styles.todayLabel, { right: width - todayX + 4 }]}>
            <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
              Today
            </ThemedText>
          </View>
        ))}

      {active && (
        <View pointerEvents="none" style={[styles.callout, { left: calloutLeft, backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.calloutDate}>
            {formatDate(active.date)}
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: lineColor }}>
            {formatValue(active.actual)}
          </ThemedText>
          {budgetTotal !== null && (
            <ThemedText type="small" themeColor="textTertiary">
              Target {formatValue(budgetTotal)}
            </ThemedText>
          )}
          {activeDiff !== null && activeDiff !== 0 && (
            <ThemedText
              type="small"
              themeColor={activeDiffGood ? 'success' : 'destructive'}
              style={styles.calloutDate}>
              {activeDiff >= 0 ? '+' : '−'}
              {formatValue(Math.abs(activeDiff))} vs target
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    position: 'absolute',
    top: 4,
    width: CALLOUT_WIDTH,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutDate: {
    fontSize: 11,
  },
  miniLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  targetLabel: {
    position: 'absolute',
    right: PADDING_X + 1,
  },
  todayLabel: {
    // Anchored to the bottom rather than the top: cumulative sums trend
    // upward, so the actual line's most recent (i.e. "today") point is
    // usually near the *top* of the chart already — a top-anchored label
    // would collide with that dot far more often than a bottom one does.
    position: 'absolute',
    bottom: 2,
  },
});
