import { useRef } from 'react';
import type { GestureResponderEvent, View as ViewType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface RingSegment {
  key: string;
  amount: number;
  color: string;
}

// A stacked-Circle donut, not <Path> arc math — each segment is the full ring
// drawn with strokeDasharray/strokeDashoffset so only its own slice shows.
// Center content (icon/amount/label) is a plain View overlaid on top rather
// than SVG text, so it can reuse ThemedText/CategoryBadge like the rest of
// the app instead of duplicating font handling in SVG.
const OUTLINE_WIDTH = 2;
// How much wider a selected segment's own stroke (and its outline) gets
// drawn, beyond the normal width — the ring's own radius has to leave room
// for this even when nothing is selected, since the path radius is shared
// by every segment and can't change just because the selection did (that
// would make the whole ring resize/jump on tap).
const SELECTED_STROKE_EXTRA = 3;
// How much the *other* segments fade once one is selected — the emphasis
// comes from everything else receding, not from recoloring the selected
// segment's own border (2026-08-28: replaced an accent-colored outline swap,
// which read as an unrelated blue ring slapped onto whatever color the
// segment already was — fading the rest keeps every segment in its own
// color and still makes the selection unambiguous).
const DIMMED_OPACITY = 0.32;

// Shared with groupRingSegments below so its margin math always matches
// whatever CategoryRingChart itself would actually render with — exported
// so a caller that doesn't override size/strokeWidth doesn't have to repeat
// the same literals to call the grouping helper correctly.
export const RING_DEFAULT_SIZE = 200;
export const RING_DEFAULT_STROKE_WIDTH = 20;
export const RING_OTHER_KEY = '__other__';

// The widest a stroke on the ring's path ever gets (a selected segment's
// outline circle) — the path radius is sized to keep even this within the
// SVG's bounds, so nothing bleeds past the canvas edge and gets clipped top
// or bottom regardless of what's selected.
function maxStrokeWidth(strokeWidth: number) {
  return strokeWidth + OUTLINE_WIDTH * 2 + SELECTED_STROKE_EXTRA;
}

function ringMargin(strokeWidth: number) {
  const outlineStrokeWidth = strokeWidth + OUTLINE_WIDTH * 2;
  // A round line cap bleeds outward from the dash's mathematical endpoint by
  // half the stroke's own width, on both circles — using the wider outline
  // circle's stroke width here (not the plain color one) is what actually
  // matters, since it's the widest of the two stacked circles and would be
  // the first to bleed into a neighboring segment otherwise. Trimming each
  // side of the dash by half of that (plus half the desired visible gap)
  // guarantees adjacent segments' rounded ends stay clear of each other
  // regardless of segment count — no longer just shrinking a flat gap value
  // for "many segments", which is what let wide outlines overlap before.
  const desiredGap = OUTLINE_WIDTH * 1.5;
  return desiredGap / 2 + outlineStrokeWidth / 2;
}

// Folds any segment too small to draw a real sliver (its dash would land
// under MIN_VISIBLE_DASH once the margin above is trimmed off both ends)
// into one merged "Other" entry — a long tail of tiny categories was both
// pointless to draw and made neighboring gaps look proportionally cramped.
// Exported as a standalone helper (rather than done inside the component
// itself) so the caller — which has the actual Category data — knows
// exactly what landed in "Other" and can build a matching center callout
// when that wedge gets tapped, instead of the chart silently absorbing
// small categories with no way for the caller to find out.
export function groupRingSegments(
  segments: RingSegment[],
  { size = RING_DEFAULT_SIZE, strokeWidth = RING_DEFAULT_STROKE_WIDTH, otherColor }: { size?: number; strokeWidth?: number; otherColor: string }
): RingSegment[] {
  const radius = (size - maxStrokeWidth(strokeWidth)) / 2;
  const circumference = 2 * Math.PI * radius;
  const margin = ringMargin(strokeWidth);
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  if (total <= 0) return segments;

  const MIN_VISIBLE_DASH = 4;
  const minShare = (margin * 2 + MIN_VISIBLE_DASH) / circumference;
  const bigEnough = segments.filter((s) => s.amount / total >= minShare);
  const otherAmount = total - bigEnough.reduce((sum, s) => sum + s.amount, 0);
  return otherAmount > 0 ? [...bigEnough, { key: RING_OTHER_KEY, amount: otherAmount, color: otherColor }] : bigEnough;
}

export function CategoryRingChart({
  segments,
  size = RING_DEFAULT_SIZE,
  strokeWidth = RING_DEFAULT_STROKE_WIDTH,
  trackColor,
  outlineColor,
  selectedKey,
  onSelectSegment,
  children,
}: {
  // Pass through groupRingSegments first if small segments should collapse
  // into one "Other" wedge — this component just draws whatever it's given.
  segments: RingSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  // Drawn as a wider copy of each segment behind its own color, so every
  // segment reads as its own outlined pill cut out of the surrounding
  // surface — pass the card's own background here (not a literal white) so
  // it still looks right in dark mode.
  outlineColor: string;
  // Which segment (by key) reads as tapped/selected — controlled by the
  // caller, not internal state, since the caller is the one that has to
  // change the center `children` to match (this component has no idea what
  // a "category" is, only keys/amounts/colors).
  selectedKey?: string | null;
  onSelectSegment?: (key: string) => void;
  children?: React.ReactNode;
}) {
  const radius = (size - maxStrokeWidth(strokeWidth)) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  const outlineStrokeWidth = strokeWidth + OUTLINE_WIDTH * 2;
  const margin = ringMargin(strokeWidth);
  const containerRef = useRef<ViewType>(null);

  // Each segment's full proportional slice along the path (0 at the 3
  // o'clock start, before the -90deg display rotation), used both to
  // position the trimmed/gapped dash for drawing and, more generously
  // (the untrimmed rawDash/start), to hit-test taps below.
  let cursor = 0;
  const laidOut = segments.map((s) => {
    const rawDash = total > 0 ? (s.amount / total) * circumference : 0;
    const start = cursor;
    cursor += rawDash;
    return { ...s, rawDash, start };
  });

  // How many segments will actually paint a visible sliver once trimmed —
  // a segment whose rawDash doesn't clear margin*2 renders with dash: 0
  // regardless (see the per-segment dash formula below), so it shouldn't
  // count toward "is this really more than one segment on screen". Fixes a
  // real bug: `groupRingSegments` can hand back an "Other" bucket whose
  // share is itself too small to clear that floor (e.g. one category at
  // 99% of the total, "Other" left with the remaining ~1%) — `laidOut`
  // still has 2 entries then, so the single-segment full-circle case below
  // never triggered, and the dominant segment got its normal margin trim
  // on both ends even though nothing sits on the other side of that gap to
  // justify it, leaving a stray notch. `bigEnoughCount` catches that case
  // so the one segment that actually renders still closes into a full,
  // seamless circle.
  const bigEnoughCount = laidOut.filter((s) => s.rawDash > margin * 2).length;

  // A dedicated transparent overlay handles taps — as a sibling of the SVG,
  // not a Pressable wrapping it, since react-native-svg's own shapes carry
  // their own (legacy) touch-responder wiring regardless of whether they're
  // given an onPress, and a Pressable ancestor of an <Svg> conflicts with
  // that on web (spurious "Unknown event handler property" console errors).
  // `locationX`/`locationY` on the event aren't reliably relative to this
  // view on every platform, so the tap is instead measured by hand:
  // `measureInWindow` (called on the plain outer View, not the Pressable
  // itself — ref'ing Pressable directly triggers the same legacy-responder
  // console errors above) for this view's on-screen origin, subtracted from
  // the touch's absolute `pageX`/`pageY`.
  function handlePress(e: GestureResponderEvent) {
    if (!onSelectSegment || total <= 0 || !containerRef.current) return;
    const { pageX, pageY } = e.nativeEvent;
    containerRef.current.measureInWindow((originX, originY) => {
      const screenDx = pageX - originX - size / 2;
      const screenDy = pageY - originY - size / 2;
      const distance = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
      const band = strokeWidth / 2 + 12;
      if (distance < radius - band || distance > radius + band) return;
      // Undo the -90deg display rotation to recover the path's own angle:
      // screen = R(-90°) * path, so path = R(+90°) * screen, i.e.
      // path_x = -screen_y, path_y = screen_x (verified against the ring's
      // own 3-o'clock-start/clockwise convention below).
      const pathDx = -screenDy;
      const pathDy = screenDx;
      let angle = Math.atan2(pathDy, pathDx);
      if (angle < 0) angle += Math.PI * 2;
      const pathPosition = (angle / (Math.PI * 2)) * circumference;
      const hit = laidOut.find((s) => pathPosition >= s.start && pathPosition < s.start + s.rawDash);
      if (hit) onSelectSegment(hit.key);
    });
  }

  return (
    <View ref={containerRef} style={{ width: size, height: size }}>
      {/* Rotate the whole ring -90deg (12 o'clock start) via the wrapping
          View's transform rather than each Circle's rotation/origin props —
          the latter renders as an invalid `transform-origin` DOM attribute
          on web. */}
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size}>
          {total <= 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          ) : (
            laidOut.map((s) => {
              // Single-segment special case (see comment above): no
              // trimming, no offset shift — one unbroken circle rather than
              // a pill with its two round caps butted together. Applies
              // whenever there's truly only one real segment (`laidOut.length
              // === 1`) *or* only one segment is big enough to render at all
              // (`bigEnoughCount <= 1`, see its own comment above) — the
              // other, invisible segments still fall through to the normal
              // trimmed formula, which already computes `dash: 0` for them,
              // so this only changes anything for the one segment that's
              // actually on screen.
              const solo = laidOut.length === 1 || (bigEnoughCount <= 1 && s.rawDash > margin * 2);
              const dash = solo ? circumference : Math.max(0, s.rawDash - margin * 2);
              // A `dash: 0` segment isn't actually invisible — `strokeDasharray="0 X"`
              // combined with `strokeLinecap="round"` still paints a round dot at
              // the dash's position (a zero-length "on" still gets its round cap
              // drawn), rather than rendering nothing the way a `butt` cap would.
              // Verified live: a grouped "Other" wedge too small to clear the
              // margin (e.g. one category at 99%+ of the total, "Other" left with
              // the rest) rendered as a stray dot at its offset even though its
              // own math said dash: 0. Skipping the segment's circles entirely
              // once it has nothing to draw sidesteps the round-cap-dot quirk.
              if (!solo && dash <= 0) return null;
              const offset = solo ? 0 : -(s.start + margin);
              const dashArray = `${dash} ${circumference - dash}`;
              const isSelected = s.key === selectedKey;
              // Emphasis is relative: nothing dims until something is
              // selected, and then only the segments that aren't it do.
              const dimmed = selectedKey != null && !isSelected;
              const extra = isSelected ? SELECTED_STROKE_EXTRA : 0;
              return [
                <Circle
                  key={`${s.key}-outline`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={outlineColor}
                  strokeWidth={outlineStrokeWidth + extra}
                  strokeOpacity={dimmed ? DIMMED_OPACITY : 1}
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  strokeDashoffset={offset}
                  fill="none"
                />,
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={s.color}
                  strokeWidth={strokeWidth + extra}
                  strokeOpacity={dimmed ? DIMMED_OPACITY : 1}
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  strokeDashoffset={offset}
                  fill="none"
                />,
              ];
            })
          )}
        </Svg>
      </View>
      <Pressable onPress={handlePress} disabled={!onSelectSegment} style={StyleSheet.absoluteFill} />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none">
        {children}
      </View>
    </View>
  );
}
