import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EditorHeader } from '@/components/editor-header';
import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { getCloudBackupDate, restoreCloudBackup, uploadCloudBackup } from '@/lib/cloud-backup';
import {
  deleteCurrentUser,
  getAuthErrorMessage,
  sendPasswordReset,
  signInWithAppleCredential,
  signInWithEmail,
  signInWithGoogleIdToken,
  signOutUser,
  signUpWithEmail,
} from '@/lib/auth';

// Web OAuth client ID from Google Cloud Console — created automatically once
// you enable the Google sign-in provider under Firebase Authentication.
// Find it at console.cloud.google.com -> APIs & Services -> Credentials, or
// via the Firebase console's Google provider settings ("Web SDK configuration").
// Firebase Auth needs the native sign-in's idToken audience to be this Web
// client even though the actual sign-in flow below runs through the native
// SDK — that's what `configure({ webClientId })` is for, not a redirect URI.
const GOOGLE_WEB_CLIENT_ID = '323953780053-d298bfactckaavqvs37000mq3k95d5ls.apps.googleusercontent.com';

export default function AccountScreen() {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // expo-apple-authentication is iOS-only and the button must not render
  // (App Store Guidelines) when the OS doesn't actually support it — the
  // simulator on an old iOS version, for instance.
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cloudDate, setCloudDate] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [confirmingCloudRestore, setConfirmingCloudRestore] = useState(false);
  const [cloudResult, setCloudResult] = useState<{ text: string; ok: boolean } | null>(null);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getCloudBackupDate()
      .then((d) => !cancelled && setCloudDate(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  // Configured here (on mount) rather than at module top level — expo-router's
  // route discovery requires every file under app/ eagerly at startup, so a
  // top-level configure() call would run on every launch regardless of
  // whether this screen was ever opened, with no try/catch around it. If the
  // installed native build's Google Sign-In module isn't set up right, that
  // would crash the whole app before React could even render an error screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    } catch (e) {
      console.warn('GoogleSignin.configure failed', e);
    }
  }, []);

  const handleEmailSubmit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter your email above first.');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordReset(email.trim());
      setInfo('If that email has an account, a reset link is on its way.');
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') return; // user cancelled, not an error
      if (!response.data.idToken) throw new Error('Google sign-in did not return an id token');
      await signInWithGoogleIdToken(response.data.idToken);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code !== statusCodes.SIGN_IN_CANCELLED) {
        setError(getAuthErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // Apple wants the SHA-256 hash of the nonce; Firebase's credential()
      // wants the original raw value so it can verify that hash itself.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple sign-in did not return an identity token');
      await signInWithAppleCredential(credential.identityToken, rawNonce);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        setError(getAuthErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    try {
      await signOutUser();
      // Clears the native Google session too, so a later "Continue with
      // Google" prompts for an account again instead of silently reusing
      // whichever one was cached.
      if (await GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteCurrentUser();
      if (await GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut();
      }
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const runCloud = async (action: () => Promise<{ text: string; ok: boolean } | void>) => {
    setCloudBusy(true);
    setCloudResult(null);
    try {
      const outcome = await action();
      if (outcome) setCloudResult(outcome);
    } catch (e) {
      setCloudResult({ text: e instanceof Error ? e.message : 'Something went wrong.', ok: false });
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudUpload = () =>
    runCloud(async () => {
      const at = await uploadCloudBackup();
      setCloudDate(at);
      return { text: 'Backed up to the cloud.', ok: true };
    });

  const handleCloudRestore = () => {
    if (!confirmingCloudRestore) {
      setConfirmingCloudRestore(true);
      return;
    }
    setConfirmingCloudRestore(false);
    return runCloud(async () => {
      const restored = await restoreCloudBackup();
      return restored === null
        ? { text: 'No cloud backup found for this account.', ok: false }
        : { text: `Restored ${restored} data sets from the cloud.`, ok: true };
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <EditorHeader title="Account" />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <EditorHeader title="Account" />
      <ScrollView contentContainerStyle={styles.content}>
        {user ? (
          <>
          <View style={[styles.card, styles.cloudCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold">Cloud backup</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {cloudDate ? `Last backed up ${new Date(cloudDate).toLocaleString()}.` : 'No cloud backup yet.'} Backing up
              replaces the copy in the cloud. Restoring replaces everything on this device.
            </ThemedText>
            <Pressable
              style={[styles.primaryButton, styles.cloudButton, { backgroundColor: theme.accent }]}
              onPress={handleCloudUpload}
              disabled={cloudBusy}>
              {cloudBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Back up now
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.signOutButton, { borderColor: theme.border }]}
              onPress={handleCloudRestore}
              disabled={cloudBusy}>
              <ThemedText type="smallBold" themeColor={confirmingCloudRestore ? 'destructive' : 'text'}>
                {confirmingCloudRestore ? 'Tap again to replace local data' : 'Restore from cloud'}
              </ThemedText>
            </Pressable>
            {cloudResult && (
              <ThemedText type="small" themeColor={cloudResult.ok ? 'success' : 'destructive'}>
                {cloudResult.text}
              </ThemedText>
            )}
          </View>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as
            </ThemedText>
            <ThemedText type="default" style={styles.email}>
              {user.email}
            </ThemedText>
            <Pressable
              style={[styles.signOutButton, { borderColor: theme.destructive }]}
              onPress={handleSignOut}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.destructive} />
              ) : (
                <ThemedText type="smallBold" themeColor="destructive">
                  Log out
                </ThemedText>
              )}
            </Pressable>
            {error && (
              <ThemedText type="small" themeColor="destructive">
                {error}
              </ThemedText>
            )}
            <Pressable style={styles.deleteAccountButton} onPress={handleDeleteAccount} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={theme.destructive} />
              ) : (
                <ThemedText type="small" themeColor="destructive" style={styles.deleteAccountText}>
                  {confirmingDelete ? 'Tap again to permanently delete account' : 'Delete account'}
                </ThemedText>
              )}
            </Pressable>
          </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
              Sign in to back your data up to the cloud and restore it on another device. Nothing leaves this
              device unless you tap Back up now.
            </ThemedText>

            {error && (
              <ThemedText type="small" themeColor="destructive" style={styles.message}>
                {error}
              </ThemedText>
            )}
            {info && (
              <ThemedText type="small" themeColor="success" style={styles.message}>
                {info}
              </ThemedText>
            )}

            <ThemedText type="smallBold" style={styles.label}>
              Email
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              placeholder="you@example.com"
              placeholderTextColor={theme.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <ThemedText type="smallBold" style={styles.label}>
              Password
            </ThemedText>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              placeholder="At least 6 characters"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            {mode === 'signIn' && (
              <Pressable onPress={handleForgotPassword} disabled={resetting} style={styles.forgotPasswordLink}>
                <ThemedText type="small" themeColor="accent">
                  Forgot password?
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}
              onPress={handleEmailSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {mode === 'signUp' ? 'Create account' : 'Log in'}
                </ThemedText>
              )}
            </Pressable>

            <Pressable onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')} style={styles.switchModeLink}>
              <ThemedText type="small" themeColor="accent">
                {mode === 'signUp' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
              </ThemedText>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <ThemedText type="small" themeColor="textTertiary">
                or
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Pressable
              style={[styles.googleButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleGoogleSignIn}
              disabled={submitting}>
              <ThemedText type="smallBold">Continue with Google</ThemedText>
            </Pressable>

            {/* App Store Guidelines require Apple's own button component here,
                not a custom-styled Pressable like the Google button above. */}
            {Platform.OS === 'ios' && appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={CardRadius}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  caption: { lineHeight: 20, marginBottom: Spacing.three },
  message: { marginBottom: Spacing.two },
  label: { marginBottom: Spacing.two, marginTop: Spacing.three },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CardRadius / 2,
    padding: Spacing.three,
    fontSize: 16,
  },
  forgotPasswordLink: { alignSelf: 'flex-end', marginTop: Spacing.two },
  primaryButton: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  primaryButtonText: { color: '#ffffff' },
  switchModeLink: { alignItems: 'center', marginTop: Spacing.three },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four, marginBottom: Spacing.three },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  googleButton: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  appleButton: { height: 52, marginTop: Spacing.two },
  card: {
    borderRadius: CardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cloudCard: { marginBottom: Spacing.three },
  cloudButton: { marginTop: Spacing.two },
  email: { fontWeight: '600', marginBottom: Spacing.two },
  signOutButton: {
    borderRadius: CardRadius / 2,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleteAccountButton: { alignItems: 'center', marginTop: Spacing.two, paddingVertical: Spacing.two },
  deleteAccountText: { textDecorationLine: 'underline' },
});
