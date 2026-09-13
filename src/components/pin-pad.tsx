import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const PIN_LENGTH = 4;

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

// The 4-dot readout plus a 3×4 keypad, shared by the lock screen and the
// set-pin flow (built shared from the start rather than duplicated — the
// two would be character-for-character identical). `error` tints the dots
// destructive for a wrong/mismatched entry; `bottomLeft` is the slot the
// lock screen fills with its biometric button.
export function PinPad({
  value,
  error,
  onDigit,
  onDelete,
  bottomLeft,
}: {
  value: string;
  error?: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  bottomLeft?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: error ? theme.destructive : theme.accent },
                filled && { backgroundColor: error ? theme.destructive : theme.accent },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.keys}>
        {KEYS.map((row) => (
          <View key={row[0]} style={styles.keyRow}>
            {row.map((digit) => (
              <Key key={digit} onPress={() => onDigit(digit)}>
                <ThemedText style={styles.keyText}>{digit}</ThemedText>
              </Key>
            ))}
          </View>
        ))}
        <View style={styles.keyRow}>
          <View style={styles.key}>{bottomLeft}</View>
          <Key onPress={() => onDigit('0')}>
            <ThemedText style={styles.keyText}>0</ThemedText>
          </Key>
          <Key onPress={onDelete}>
            <MaterialIcons name="backspace" size={24} color={theme.text} />
          </Key>
        </View>
      </View>
    </View>
  );
}

function Key({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
      {children}
    </Pressable>
  );
}

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.five,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  keys: {
    gap: Spacing.two + 4,
  },
  keyRow: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '500',
  },
});
