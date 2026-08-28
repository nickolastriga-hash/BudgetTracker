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

// Shared with groupRingSegments below so its margin math always matches
// whatever CategoryRingChart itself would actually render with — exported
// so a caller that doesn't override size/strokeWidth doesn't have to repeat
// the same literals to call the grouping helper correctly.
export const RING_DEFAULT_SIZE = 176;
export const RING_DEFAULT_STROKE_WIDTH = 20;
export const RING_OTHER_KEY = '__other__';

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
  const radius = (size - strokeWidth) / 2;
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
  highlightColor,
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
  // The selected segment's outline swaps to this color instead of
  // `outlineColor`, so it reads as highlighted rather than just another
  // card-colored cutout border. Required whenever onSelectSegment is passed.
  highlightColor?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
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
              // a pill with its two round caps butted together.
              const dash = laidOut.length > 1 ? Math.max(0, s.rawDash - margin * 2) : circumference;
              const offset = laidOut.length > 1 ? -(s.start + margin) : 0;
              const dashArray = `${dash} ${circumference - dash}`;
              const isSelected = s.key === selectedKey;
              return [
                <Circle
                  key={`${s.key}-outline`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={isSelected ? highlightColor : outlineColor}
                  strokeWidth={isSelected ? outlineStrokeWidth + 3 : outlineStrokeWidth}
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
                  strokeWidth={strokeWidth}
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
