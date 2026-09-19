import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { deleteCloudBackup } from './cloud-backup';
import { auth } from './firebase';

export type { User };

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

// rawNonce is the pre-hash value the caller sent Apple as `nonce` (hashed) —
// Firebase re-hashes it here and checks the result against the identity
// token's nonce claim, so this must be the *un*hashed original.
export async function signInWithAppleCredential(idToken: string, rawNonce: string): Promise<void> {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken, rawNonce });
  await signInWithCredential(auth, credential);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// Swallows auth/user-not-found so the UI can show the same "check your
// inbox" message regardless of whether the email is actually registered —
// otherwise the response itself would leak which emails have accounts.
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    const code = e instanceof Error && 'code' in e ? String((e as { code: unknown }).code) : '';
    if (code !== 'auth/user-not-found') throw e;
  }
}

// Firebase requires a "recent" login for this — if the user's session is
// stale it throws auth/requires-recent-login instead of deleting, which the
// caller surfaces via getAuthErrorMessage and asks the user to sign in again.
export async function deleteCurrentUser(): Promise<void> {
  if (!auth.currentUser) return;
  // Best-effort and first: once the user is deleted there's no auth left to
  // authorize removing the backup. A failure here (offline, rules) shouldn't
  // block deleting the account itself.
  await deleteCloudBackup().catch(() => {});
  await deleteUser(auth.currentUser);
}

// Firebase's raw error codes ("Firebase: Error (auth/invalid-credential).")
// aren't fit for a UI — map the ones a user is actually likely to hit.
export function getAuthErrorMessage(error: unknown): string {
  const code = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/invalid-email':
      return "That email address doesn't look right.";
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and log back in, then try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
