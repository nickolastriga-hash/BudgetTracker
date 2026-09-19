import { useId, useRef, useState } from 'react';
import type { GestureResponderEvent, View as ViewType } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import type { Debt, PayoffMonth } from '@/lib/debts';

const PADDING_TOP = 20;
const PADDING_BOTTOM = 4;
const PADDING_X = 2;
const AXIS_HEIGHT = 24;
const CALLOUT_WIDTH = 176;
// Minimum horizontal space a single x-axis tick label needs (text plus
// breathing room) — used to size how many ticks actually fit, rather than
// picking an interval off the point count alone. A fixed px budget per tick
// generalizes to any chart width and any plan length, where the old
// point-count brackets didn't: a 25-year plan on a narrow phone screen could
// still end up with more ticks than the width could legibly hold.
const MIN_TICK_PX = 64;
// A tick label is TICK_LABEL_WIDTH wide, centered on its tick, and the fixed
// "Today"/end-date labels at the axis's edges are up to ~52px wide ("Oct
// 2027" at 10px) — so a tick's *center* has to sit at least half a tick label
// plus a whole edge label plus a small gap from either end, or the two
// overlap. (This used to be 28, which let a tick's label land right on top
// of "Today" or the end date.)
const TICK_LABEL_WIDTH = 48;
const EDGE_LABEL_WIDTH = 52;
const EDGE_GAP_PX = TICK_LABEL_WIDTH / 2 + EDGE_LABEL_WIDTH + 6;
// Rounded corners on the plot body, so the bands read as one soft shape
// instead of a hard-edged wedge.
const PLOT_RADIUS = 14;
// "Nice" calendar intervals, in months, from quarterly up to every 50 years —
// the smallest one that still fits within the available tick budget wins.
const TICK_INTERVALS_MONTHS = [3, 6, 12, 24, 36, 60, 120, 180, 300, 600];

type Point = { x: number; y: number };

// Catmull-Rom-to-cubic-Bezier conversion — turns the (potentially hundreds
// of) straight monthly segments a payoff schedule naturally produces into
// one flowing curve, the single change that most moves this chart from
// "spreadsheet line chart" toward how a modern finance app draws a balance
// over time. Returns just the "C x1,y1 x2,y2 x,y ..." commands (no leading
// M), so callers can prefix whichever starting point (and fill/stroke
// treatment) they need. A stray payoff-month kink in the underlying data
// (a debt clearing frees up budget, visibly changing the payoff rate) reads
// as a soft bend rather than a sharp corner — a deliberate, common
// stylization for this kind of chart, not a loss of accuracy: the
// underlying monthly values themselves are untouched, and the scrub/callout
// below always snaps to a real data point regardless of how the curve
// between two points is drawn.
function curveCommands(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return ` L${points[1].x},${points[1].y}`;
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function curvePath(points: Point[]): string {
  return `M${points[0].x},${points[0].y}${curveCommands(points)}`;
}

// Balance-over-time for a payoff plan: one stacked, smoothly-curved band per
// debt (in the plan's attack order, current target on top, so the top edge
// is the total owed and each band visibly melts to nothing at its payoff
// month) plus a dashed "minimums only" line over the same months for
// comparison. Press and drag to read any month. Same touch-layer /
// measureInWindow / pager-disabling approach as CumulativeTrendChart — see
// that file for the full reasoning behind each of those choices; none of it
// is repeated here.
//
// Long horizons are the norm here (a 25-year plan is 300 points), so the
// chart carries its own dollar gridlines and year ticks — without them a
// long plan read as one featureless wedge with nothing to anchor a value
// or a date to.
export function DebtPayoffChart({
  schedule,
  baseline,
  order,
  width,
  height,
  formatMonth,
  formatValue,
  onScrubStart,
  onScrubEnd,
}: {
  schedule: PayoffMonth[];
  baseline: PayoffMonth[] | null;
  order: Debt[];
  width: number;
  height: number;
  formatMonth: (monthStr: string) => string;
  formatValue: (amount: number) => string;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}) {
  const theme = useTheme();
  const { compact } = useCurrency();
  const containerRef = useRef<ViewType>(null);
  const containerLeftRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Gradient ids are document-global on web (react-native-svg renders a
  // real <svg>), so they're namespaced per instance like CumulativeTrendChart.
  const idBase = `payoff-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  if (!width || schedule.length < 2) return <View style={{ width, height }} />;

  const n = schedule.length;
  const baselineInDomain = baseline ? schedule.map((_, i) => baseline[Math.min(i, baseline.length - 1)]?.total ?? 0) : null;
  const rawMax = Math.max(schedule[0].total, ...(baselineInDomain ?? []), 1);
  // Round the top of the axis up to a tidy gridline step so the labels read
  // as "$5k, $10k, $15k" rather than "$4.3k, $8.6k".
  const gridStep = niceStep(rawMax / 3);
  const maxValue = Math.ceil(rawMax / gridStep) * gridStep;
  const gridValues = Array.from({ length: Math.floor(maxValue / gridStep) }, (_, i) => (i + 1) * gridStep);

  const plotTop = PADDING_TOP;
  const plotBottom = height - AXIS_HEIGHT - PADDING_BOTTOM;
  const plotHeight = plotBottom - plotTop;
  const plotWidth = width - PADDING_X * 2;

  function xFor(i: number) {
    return PADDING_X + (i / (n - 1)) * plotWidth;
  }
  function yFor(v: number) {
    return plotTop + (1 - v / maxValue) * plotHeight;
  }
  function indexForLocalX(localX: number) {
    const ratio = (localX - PADDING_X) / plotWidth;
    return Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
  }
  function updateFromPageX(pageX: number) {
    setActiveIndex(indexForLocalX(pageX - containerLeftRef.current));
  }
  function handleGrant(e: GestureResponderEvent) {
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

  // Bands stack bottom-up in *reverse* attack order, so the first debt to
  // be paid off sits on top: the total (top edge) shrinks smoothly and each
  // band disappears from the top down rather than layers above it dropping
  // when one below vanishes.
  const stack = order.slice().reverse();
  const cumulative: number[][] = []; // cumulative[k][i] = top of band k at month i
  for (let k = 0; k < stack.length; k++) {
    const below = cumulative[k - 1];
    cumulative.push(schedule.map((entry, i) => (below ? below[i] : 0) + (entry.balances[stack[k].id] ?? 0)));
  }
  const bands = stack.map((debt, k) => {
    const top: Point[] = schedule.map((_, i) => ({ x: xFor(i), y: yFor(cumulative[k][i]) }));
    const below = cumulative[k - 1];
    const bottom: Point[] = schedule.map((_, i) => ({ x: xFor(n - 1 - i), y: yFor(below ? below[n - 1 - i] : 0) }));
    // Fill: the smoothed top curve forward, a straight drop to the bottom
    // curve's own level, then the smoothed bottom curve backward, closed.
    const fillPath = `${curvePath(top)} L${bottom[0].x},${bottom[0].y}${curveCommands(bottom)} Z`;
    return { debt, fillPath };
  });

  // X ticks: the smallest "nice" calendar interval whose resulting tick
  // count still fits the chart's actual pixel width, so a long horizon on a
  // narrow phone screen thins itself out instead of packing labels past the
  // point of legibility (a fixed point-count bracket, what this used to be,
  // doesn't account for how wide the chart actually rendered).
  const maxTicks = Math.max(1, Math.floor((plotWidth - EDGE_GAP_PX * 2) / MIN_TICK_PX));
  const tickEvery =
    TICK_INTERVALS_MONTHS.find((interval) => Math.floor((n - 1) / interval) <= maxTicks) ??
    TICK_INTERVALS_MONTHS[TICK_INTERVALS_MONTHS.length - 1];
  const ticks: { i: number; label: string }[] = [];
  for (let i = tickEvery; i < n - 1; i += tickEvery) {
    const x = xFor(i);
    if (width - x < EDGE_GAP_PX) break; // too close to the fixed end label
    if (x < EDGE_GAP_PX) continue; // too close to the fixed "Today" label
    const [y, m] = schedule[i].month.split('-');
    ticks.push({ i, label: tickEvery >= 12 ? y : `${shortMonth(Number(m))} ’${y.slice(2)}` });
  }

  const active = activeIndex !== null ? schedule[activeIndex] : null;
  const activeBaseline = activeIndex !== null && baselineInDomain ? baselineInDomain[activeIndex] : null;
  const calloutLeft =
    activeIndex !== null ? Math.min(Math.max(xFor(activeIndex) - CALLOUT_WIDTH / 2, 0), width - CALLOUT_WIDTH) : 0;

  return (
    <View ref={containerRef} style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          {bands.map((b) => (
            <LinearGradient key={b.debt.id} id={`${idBase}-${b.debt.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={b.debt.color} stopOpacity={1} />
              <Stop offset="1" stopColor={b.debt.color} stopOpacity={0.72} />
            </LinearGradient>
          ))}
          <ClipPath id={`${idBase}-clip`}>
            <Rect x={PADDING_X} y={0} width={plotWidth} height={plotBottom} rx={PLOT_RADIUS} ry={PLOT_RADIUS} />
          </ClipPath>
        </Defs>

        {gridValues.map((v) => (
          <Line
            key={v}
            x1={PADDING_X}
            x2={width - PADDING_X}
            y1={yFor(v)}
            y2={yFor(v)}
            stroke={theme.border}
            strokeWidth={1}
            strokeDasharray="1,5"
            strokeLinecap="round"
            strokeOpacity={0.7}
          />
        ))}

        <G clipPath={`url(#${idBase}-clip)`}>
          {/* Each band is outlined in the card color, drawn bottom-up, so a
              band's outline overpaints the one below it and reads as a soft
              white gap between rounded shapes (same "cut-out" idea as
              CategoryRingChart's segments). */}
          {bands.map((b) => (
            <Path
              key={b.debt.id}
              d={b.fillPath}
              fill={`url(#${idBase}-${b.debt.id})`}
              stroke={theme.card}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </G>

        {baselineInDomain && (
          <Path
            d={curvePath(baselineInDomain.map((v, i) => ({ x: xFor(i), y: yFor(v) })))}
            fill="none"
            stroke={theme.textSecondary}
            strokeWidth={1.5}
            strokeDasharray="1,7"
            strokeLinecap="round"
          />
        )}

        {/* No hard baseline or tick strokes: small round dots mark each
            label's position instead, which reads softer than a ruled axis. */}
        {ticks.map((t) => (
          <Circle key={t.i} cx={xFor(t.i)} cy={plotBottom + 5} r={1.75} fill={theme.textTertiary} />
        ))}

        {activeIndex !== null && active && (
          <>
            <Line
              x1={xFor(activeIndex)}
              x2={xFor(activeIndex)}
              y1={plotTop}
              y2={plotBottom}
              stroke={theme.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="1,5"
              strokeLinecap="round"
            />
            {/* A soft halo behind the solid dot — the two-circle "hovered
                point" treatment most modern chart libraries use, standing
                in for the single flat dot this used to be. */}
            <Circle cx={xFor(activeIndex)} cy={yFor(active.total)} r={9} fill={theme.text} fillOpacity={0.16} />
            <Circle cx={xFor(activeIndex)} cy={yFor(active.total)} r={4.5} fill={theme.text} stroke={theme.card} strokeWidth={1.5} />
          </>
        )}
      </Svg>

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

      {/* Labels are ThemedText, not SVG text — same split as every other
          chart in the app. Gridline labels sit just above their line, on
          the left, each on a small `theme.card` pill — a plain label here
          would otherwise sit directly on top of whichever debt's colored
          band happens to pass under that gridline, reading as low-contrast
          or outright illegible once a band fill and a grey label overlap.
          Tick labels are centered under their tick. */}
      {gridValues.map((v) => (
        <View key={v} pointerEvents="none" style={[styles.gridLabelWrap, { top: yFor(v) - 9 }]}>
          <View style={[styles.gridLabelPill, { backgroundColor: theme.card }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.miniLabel}>
              {compact(v)}
            </ThemedText>
          </View>
        </View>
      ))}
      <View pointerEvents="none" style={[styles.axisLabel, { left: 0, top: plotBottom + 8 }]}>
        <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
          Today
        </ThemedText>
      </View>
      {ticks.map((t) => (
        <View key={t.i} pointerEvents="none" style={[styles.tickLabel, { left: xFor(t.i) - TICK_LABEL_WIDTH / 2, top: plotBottom + 8 }]}>
          <ThemedText type="small" themeColor="textTertiary" style={[styles.miniLabel, styles.centered]}>
            {t.label}
          </ThemedText>
        </View>
      ))}
      <View pointerEvents="none" style={[styles.axisLabel, { right: 0, top: plotBottom + 8 }]}>
        <ThemedText type="small" themeColor="textTertiary" style={styles.miniLabel}>
          {formatMonth(schedule[n - 1].month)}
        </ThemedText>
      </View>

      {active && (
        <View pointerEvents="none" style={[styles.callout, { left: calloutLeft, backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.calloutSmall}>
            {formatMonth(active.month)}
          </ThemedText>
          <ThemedText type="smallBold">{active.total > 0 ? `${formatValue(active.total)} left` : 'Debt-free'}</ThemedText>
          {order.map((d) => {
            const bal = active.balances[d.id] ?? 0;
            if (bal <= 0) return null;
            return (
              <View key={d.id} style={styles.calloutRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={[styles.calloutSmall, styles.calloutName]}>
                  {d.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.calloutSmall}>
                  {formatValue(bal)}
                </ThemedText>
              </View>
            );
          })}
          {activeBaseline !== null && activeBaseline > active.total && (
            <ThemedText type="small" themeColor="textTertiary" style={styles.calloutSmall}>
              Minimums only: {formatValue(activeBaseline)}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

// 1/2/5 × 10^k, the usual "nice" axis step.
function niceStep(rough: number) {
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const scaled = rough / power;
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return factor * power;
}

function shortMonth(m: number) {
  return new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

const styles = StyleSheet.create({
  miniLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  centered: {
    textAlign: 'center',
  },
  gridLabelWrap: {
    position: 'absolute',
    left: PADDING_X,
  },
  gridLabelPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  axisLabel: {
    position: 'absolute',
  },
  tickLabel: {
    position: 'absolute',
    width: TICK_LABEL_WIDTH,
  },
  callout: {
    position: 'absolute',
    top: 4,
    width: CALLOUT_WIDTH,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutSmall: {
    fontSize: 11,
    lineHeight: 15,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calloutName: {
    flex: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
