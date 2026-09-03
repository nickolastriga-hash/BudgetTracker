import { useSyncExternalStore } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

// useSyncExternalStore instead of the old "setHasHydrated(true) in a
// mount-only useEffect" pattern (removed 2026-09-04, upgrading to Expo SDK
// 57 brought a stricter lint rule against setState-in-effect) — subscribing
// to Appearance directly is the canonical effect-free way to get a value
// that can differ between server and client render: getServerSnapshot
// always returns 'light' for the first static-render pass, then
// getSnapshot's real value takes over on the client without an extra effect
// round-trip or hydration flicker.
function subscribe(callback: () => void) {
  const sub = Appearance.addChangeListener(callback);
  return () => sub.remove();
}

function getSnapshot(): ColorSchemeName | null | undefined {
  return Appearance.getColorScheme();
}

function getServerSnapshot(): ColorSchemeName | null | undefined {
  return 'light';
}

export function useColorScheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
