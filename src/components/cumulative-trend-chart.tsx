import { useRef, useState } from 'react';
import type { GestureResponderEvent, View as ViewType } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface TrendPoint {
  date: string; // "YYYY-MM-DD"
  actual: number; // running cumulative total as of this date
}

const PADDING_X = 4;
const PADDING_Y = 10;
const CALLOUT_WIDTH = 130;

// A cumulative-actual line against a flat grey dotted budget-total reference
// line, with press-and-hold scrubbing for a per-day value callout — not a
// general-purpose chart, just what Trends' Expense/Income/Net pages need
// (added 2026-08-30, scrubbing added same day per follow-up feedback).
// Bucketed by day regardless of the caller's range type (Month/Year/Custom
// all resolve to a plain day list via lib/date-range's daysBetween before
// reaching here, already capped to today by the caller — see trends.tsx),
// so there's one rendering path instead of three. `budgetTotal` of null
// means no budgets are set for this type/period — Trends only totals
// categories that actually have a limit/goal set, so "none set" is a real,
// distinct case from "set to $0" — and no reference line is drawn, though
// the actual line still renders and can still be scrubbed on its own.
export function CumulativeTrendChart({
  points,
  budgetTotal,
  width,
  height,
  lineColor,
  formatValue,
  formatDate,
}: {
  points: TrendPoint[];
  budgetTotal: number | null;
  width: number;
  height: number;
  lineColor: string;
  formatValue: (amount: number) => string;
  formatDate: (dateStr: string) => string;
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

  if (!width || points.length === 0) return <View style={{ width, height }} />;

  const values = points.map((p) => p.actual);
  const maxValue = Math.max(...values, budgetTotal ?? -Infinity, 0);
  const minValue = Math.min(...values, budgetTotal ?? Infinity, 0);
  const range = maxValue - minValue || 1;

  const plotWidth = width - PADDING_X * 2;
  const plotHeight = height - PADDING_Y * 2;

  function yFor(v: number) {
    return PADDING_Y + (1 - (v - minValue) / range) * plotHeight;
  }
  function xFor(i: number) {
    return PADDING_X + (points.length <= 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  }
  function indexForLocalX(localX: number) {
    if (points.length <= 1) return 0;
    const ratio = (localX - PADDING_X) / plotWidth;
    return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
  }
  function updateFromPageX(pageX: number) {
    setActiveIndex(indexForLocalX(pageX - containerLeftRef.current));
  }

  function handleGrant(e: GestureResponderEvent) {
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
  }

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.actual)}`).join(' ');
  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;
  const calloutLeft =
    activeIndex !== null ? Math.min(Math.max(xFor(activeIndex) - CALLOUT_WIDTH / 2, 0), width - CALLOUT_WIDTH) : 0;

  return (
    <View ref={containerRef} style={{ width, height }}>
      <Svg width={width} height={height}>
        {/* Zero baseline — only meaningful (and only drawn) when the line
            actually crosses it, i.e. Net can go negative but Income/Expense
            never do. */}
        {minValue < 0 && maxValue > 0 && (
          <Line x1={PADDING_X} x2={width - PADDING_X} y1={yFor(0)} y2={yFor(0)} stroke={theme.border} strokeWidth={1} />
        )}
        {budgetTotal !== null && (
          <Line
            x1={PADDING_X}
            x2={width - PADDING_X}
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
          delay) so a press-and-drag reads as scrubbing from the first touch
          — the trade-off is that a swipe starting from inside the chart
          itself won't also page the outer pager; the segmented toggle and
          page dots above are the way to switch pages from there instead. */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
      />

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
              Budget {formatValue(budgetTotal)}
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
});
