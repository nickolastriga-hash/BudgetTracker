import { View } from 'react-native';
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
const OUTLINE_WIDTH = 3;

export function CategoryRingChart({
  segments,
  size = 176,
  strokeWidth = 20,
  trackColor,
  outlineColor,
  children,
}: {
  segments: RingSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  // Drawn as a wider copy of each segment behind its own color, so every
  // segment reads as its own outlined pill cut out of the surrounding
  // surface — pass the card's own background here (not a literal white) so
  // it still looks right in dark mode.
  outlineColor: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  // A visible gap between segments plus rounded caps, so the ring reads as
  // separate pill-shaped slices instead of one solid connected loop — scaled
  // down when there are many segments so gaps don't eat too much of the
  // ring, but never smaller than the outline needs to clear the next
  // segment's own outline. No gap when there's only one segment (it's the
  // only category with any spending, i.e. 100% of the ring) — there's
  // nothing to separate it from, so it should read as one unbroken circle
  // rather than a pill with its two round caps butted together.
  const gap =
    total > 0 && segments.length > 1
      ? Math.max(OUTLINE_WIDTH * 4, Math.min(strokeWidth * 0.6, (circumference / segments.length) * 0.3))
      : 0;

  let cursor = 0;

  return (
    <View style={{ width: size, height: size }}>
      {/* Rotate the whole ring -90deg (12 o'clock start) via the wrapping
          View's transform rather than each Circle's rotation/origin props —
          the latter renders as an invalid `transform-origin` DOM attribute
          on web. */}
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size}>
          {total <= 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          ) : (
            segments.map((s) => {
              const rawDash = (s.amount / total) * circumference;
              const dash = Math.max(1, rawDash - gap);
              const offset = -cursor;
              cursor += rawDash;
              const dashArray = `${dash} ${circumference - dash}`;
              return [
                <Circle
                  key={`${s.key}-outline`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={outlineColor}
                  strokeWidth={strokeWidth + OUTLINE_WIDTH * 2}
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
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
      </View>
    </View>
  );
}
