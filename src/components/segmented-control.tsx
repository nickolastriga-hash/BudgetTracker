import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  // Tints the selected option's text/icon — red/green for the app's
  // Expense/Income toggles (so the color, not just the label, says which
  // side is active), accent otherwise.
  color?: string;
}

const TRACK_PADDING = 3;

// The one segmented control (2026-09-10) — replaced nine per-file copies of
// an outlined rounded-rect with a solid accent-filled segment, per feedback
// that the outlined block looked dated. Now: a borderless pill track in
// backgroundElement, with one raised card-colored thumb (theme.segmentThumb
// — a dedicated token since plain `card` is darker than the track in dark
// mode and would read as recessed) that springs between options rather than
// each option painting its own background (per follow-up feedback that the
// first version snapped and felt stiff). Segments are equal-width, so the
// thumb's position is just index × segment width off the track's measured
// layout — no per-segment measuring.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  // The first position is set, not animated — otherwise the thumb would
  // visibly slide in from the left edge on every mount.
  const positioned = useRef(false);

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = index * segmentWidth;
    if (!positioned.current) {
      positioned.current = true;
      translateX.setValue(target);
      return;
    }
    Animated.spring(translateX, {
      toValue: target,
      // Quick and barely-overshooting — reads as the thumb gliding, not
      // bouncing.
      stiffness: 260,
      damping: 26,
      mass: 0.7,
      // RNW has no native animated module; passing true there just logs a
      // warning and falls back to JS anyway.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, segmentWidth, translateX]);

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth, backgroundColor: theme.segmentThumb, transform: [{ translateX }] },
          ]}
        />
      )}
      {options.map((option) => {
        const isSelected = option.value === value;
        const activeColor = option.color ?? theme.accent;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={styles.segment}>
            {option.icon && (
              <MaterialIcons name={option.icon} size={14} color={isSelected ? activeColor : theme.textSecondary} />
            )}
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              themeColor={isSelected ? undefined : 'textSecondary'}
              style={isSelected && { color: activeColor }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 999,
    padding: TRACK_PADDING,
    width: '100%',
    // Wider than the old 280 cap — three icon+label options ("Recurring",
    // "Calendar") were cramped at that width.
    maxWidth: 340,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
});
