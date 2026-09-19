import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// Imported from the scoped '@firebase/auth' package, not the friendlier
// 'firebase/auth' — the top-level `firebase` wrapper's own package.json has
// no "react-native" export condition on its "./auth" subpath at all, so it
// always resolves to the browser build (missing getReactNativePersistence)
// regardless of platform. '@firebase/auth' itself does define that
// condition, so Metro correctly picks its react-native dist at runtime on
// iOS/Android and its browser dist on web.
import { getAuth, initializeAuth, type Auth } from '@firebase/auth';
// @firebase/auth's own exports map lists a generic "types" key ahead of its
// "react-native" one, so TypeScript's type resolution (unlike Metro's actual
// module resolution above) always types against the generic, web-only
// declaration file, which doesn't declare this function even though it's
// real and used at runtime in the react-native build. Upstream package.json
// ordering quirk, not a genuinely missing export.
// @ts-expect-error
import { getReactNativePersistence } from '@firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Public client config, safe to commit — these identify the Firebase project,
// they are not secrets. Project: budgettracker-443b5 (separate from
// HabitTracker's, so the two apps' users/data stay isolated). Email/Password,
// Google, and Apple are all enabled under Authentication -> Sign-in method.
const firebaseConfig = {
  apiKey: 'AIzaSyBz29OiqNp09iQv9EyWiVJZoxbDzELW1bU',
  authDomain: 'budgettracker-443b5.firebaseapp.com',
  projectId: 'budgettracker-443b5',
  storageBucket: 'budgettracker-443b5.firebasestorage.app',
  messagingSenderId: '323953780053',
  appId: '1:323953780053:web:c1f7203e35fdb04a567bdc',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Long-polling auto-detect: React Native's WebChannel transport is flaky on
// some networks. initializeFirestore throws if it already ran (fast refresh),
// so fall back to the existing instance.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
})();

export const auth: Auth =
  Platform.OS === 'web' ? getAuth(app) : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
