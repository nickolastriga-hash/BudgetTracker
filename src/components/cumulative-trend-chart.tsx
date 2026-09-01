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

// A cumulative-actual line against a budget/goal reference line, either
// diagonal-and-paced or flat-and-just-a-target depending on the caller's
// `paced` flag (added 2026-08-31, same day as the diagonal itself, per
// follow-up feedback that a day-by-day pace reads as misleading for Income
// and Net): a straight "spend evenly across the month" diagonal only makes
// sense for money going *out* on a roughly steady drip — Expenses. Income
// arrives in lumps (paychecks, not a daily trickle), so a diagonal pace line
// there made the ahead/behind band flip red between paydays and green right
// after one, which isn't a real signal of anything. Net inherits that same
// lumpiness from its income half. So only Expenses passes `paced: true`
// (diagonal $0-to-`budgetTotal` line, "Pace" labeling, ahead/behind status
// band, per-day pace value in the scrub callout); Income and Net pass
// `paced: false` and get a flat "Target" line at `budgetTotal`'s height
// instead — no band (a flat target has no meaningful "ahead of schedule"
// reading days into the month, so shading against it would just repeat the
// "haven't hit the goal yet" non-signal every day until the end), but still
// a scrub callout showing the constant target and how far actual is from
// it. Bucketed by day regardless of the caller's range type (Month/Year/
// Custom all resolve to a plain day list via lib/date-range's daysBetween
// before reaching here), so there's one rendering path instead of three.
// `points` is capped at today by the caller (see trends.tsx) so the actual
// line stops there, but `totalDays` is the *full* nominal period's day
// count — the x-axis domain both the actual line and the diagonal share —
// so a still-in-progress period correctly shows the actual line occupying
// only its elapsed fraction of the chart width, with a paced reference line
// still running the full width out to the period's real end. `budgetTotal`
// of null means no budgets are set for this type/period — Trends only
// totals categories that actually have a limit/goal set, so "none set" is a
// real, distinct case from "set to $0" — and no reference line (or shading)
// is drawn, though the actual line still renders, still fills with a soft
// gradient of its own, and can still be scrubbed on its own.
//
// Visibility pass (2026-08-31): the flat/diagonal pair used to be the only
// signal — reading "ahead or behind" meant mentally comparing two lines'
// heights. Added, in rendering order (each is a background layer the lines
// sit on top of, so none of them can obscure the data they're annotating):
// an ahead/behind status band filled between the actual and pace lines when
// `paced` (green when `positiveIsGood` says this side of pace is the good
// side, red otherwise, split into one Polygon per contiguous same-verdict
// run rather than interpolating the exact crossing point — a pixel or two
// of slop right at a sign flip isn't worth the extra math); a "Today"
// marker separating the actual period-to-date from the rest of the period
// when it isn't over yet (independent of `paced` — useful either way); and,
// while scrubbing, the reference value at that point (proportional if
// paced, constant if not) plus a colored delta against it. When there's no
// band to draw (no budget set, or `paced: false`), the actual line gets its
// own soft gradient fill instead — never both at once, so the two never
// visually compete.
export function CumulativeTrendChart({
  points,
  totalDays,
  budgetTotal,
  paced,
  positiveIsGood,
  width,
  height,
  lineColor,
  formatValue,
  formatDate,
}: {
  points: TrendPoint[];
  totalDays: number;
  budgetTotal: number | null;
  paced: boolean;
  positiveIsGood: boolean;
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
  // pace line to keep running out to the period's real end.
  const domainLength = Math.max(totalDays, points.length, 1);

  function yFor(v: number) {
    return PADDING_Y + (1 - (v - minValue) / range) * plotHeight;
  }
  function xFor(i: number) {
    return PADDING_X + (domainLength <= 1 ? plotWidth / 2 : (i / (domainLength - 1)) * plotWidth);
  }
  // The reference value at day `i` — proportional to elapsed days when
  // `paced` (the diagonal), otherwise just the constant target itself (the
  // flat line has the same height on every day).
  function referenceAt(i: number, budget: number) {
    if (!paced) return budget;
    return domainLength <= 1 ? budget : (budget * i) / (domainLength - 1);
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

  // One Polygon per contiguous run of days on the same side of pace ("good"
  // per `positiveIsGood`, e.g. under-budget for Expenses, at/over-goal for
  // Income/Net) — each run's boundary index is shared with its neighbor
  // (pushed onto both runs) so adjacent polygons meet with no gap or
  // overlap sliver at the sign flip.
  function buildBandSegments(budget: number) {
    const segments: { key: number; path: string; good: boolean }[] = [];
    const isGood = (i: number) => {
      const diff = points[i].actual - referenceAt(i, budget);
      return positiveIsGood ? diff >= 0 : diff <= 0;
    };
    const toSegment = (idxs: number[], good: boolean): { key: number; path: string; good: boolean } => {
      const top = idxs.map((i) => `${xFor(i)},${yFor(points[i].actual)}`);
      const bottom = idxs
        .slice()
        .reverse()
        .map((i) => `${xFor(i)},${yFor(referenceAt(i, budget))}`);
      return { key: idxs[0], path: [...top, ...bottom].join(' '), good };
    };
    let runIdx = [0];
    let runGood = isGood(0);
    for (let i = 1; i < points.length; i++) {
      const good = isGood(i);
      if (good !== runGood) {
        runIdx.push(i);
        segments.push(toSegment(runIdx, runGood));
        runIdx = [i];
        runGood = good;
      } else {
        runIdx.push(i);
      }
    }
    segments.push(toSegment(runIdx, runGood));
    return segments;
  }

  const bandSegments = paced && budgetTotal !== null && points.length >= 2 ? buildBandSegments(budgetTotal) : [];
  // "Today" marks where the actual line stops short of the full period —
  // only meaningful (and only drawn) while the period is still in progress.
  const todayX = points.length < domainLength ? xFor(points.length - 1) : null;

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.actual)}`).join(' ');
  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;
  const calloutLeft =
    activeIndex !== null ? Math.min(Math.max(xFor(activeIndex) - CALLOUT_WIDTH / 2, 0), width - CALLOUT_WIDTH) : 0;
  const activePace =
    active && budgetTotal !== null && activeIndex !== null ? referenceAt(activeIndex, budgetTotal) : null;
  const activeDiff = active && activePace !== null ? active.actual - activePace : null;
  const activeDiffGood = activeDiff !== null && (positiveIsGood ? activeDiff >= 0 : activeDiff <= 0);

  return (
    <View ref={containerRef} style={{ width, height }}>
      <Svg width={width} height={height}>
        {bandSegments.length === 0 && points.length >= 2 && (
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
        {/* Ahead/behind status band — background layer the lines sit on top
            of. Falls back to a plain gradient fill under the actual line
            when there's no budget to compare against, so the chart never
            looks bare just because this type/period has nothing set. */}
        {bandSegments.length > 0
          ? bandSegments.map((seg) => (
              <Polygon key={seg.key} points={seg.path} fill={(seg.good ? theme.success : theme.destructive) + '20'} />
            ))
          : points.length >= 2 && (
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
            y1={paced ? yFor(0) : yFor(budgetTotal)}
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

      {/* Non-SVG annotation labels — same "SVG draws shapes, the screen
          draws text" split as the callout below and as CategoryRingChart's
          own center content. */}
      {budgetTotal !== null && (
        <View
          pointerEvents="none"
          style={[styles.paceLabel, { top: Math.min(Math.max(yFor(budgetTotal) - 15, 0), height - 15) }]}>
          <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
            {paced ? 'Pace' : 'Target'}
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
          {budgetTotal !== null && activePace !== null && (
            <ThemedText type="small" themeColor="textTertiary">
              {paced ? 'Pace' : 'Target'} {formatValue(activePace)}
            </ThemedText>
          )}
          {activeDiff !== null && activeDiff !== 0 && (
            <ThemedText
              type="small"
              themeColor={activeDiffGood ? 'success' : 'destructive'}
              style={styles.calloutDate}>
              {activeDiff >= 0 ? '+' : '−'}
              {formatValue(Math.abs(activeDiff))} vs {paced ? 'pace' : 'target'}
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
  paceLabel: {
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
