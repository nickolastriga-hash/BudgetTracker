import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

import { buildBackup, markBackedUp, parseBackup, restoreBackup } from '@/lib/backup';
import { auth, db } from '@/lib/firebase';

// One document per user holding the same JSON string a file backup contains
// (see lib/backup.ts), so cloud and file backups share one format and one
// restore path. Manual upload/download only, no background sync: a restore
// replaces local data, same as restoring from a file. Firestore caps a
// document at 1 MiB; the payload is checked against a margin below that.
const MAX_PAYLOAD_BYTES = 900_000;

function backupRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to use cloud backup.');
  return doc(db, 'backups', uid);
}

export async function uploadCloudBackup(): Promise<string> {
  const ref = backupRef();
  const json = JSON.stringify(await buildBackup());
  if (json.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Your data is too large for cloud backup. Use Back up to file instead.');
  }
  const updatedAt = new Date().toISOString();
  await setDoc(ref, { payload: json, updatedAt });
  await markBackedUp();
  return updatedAt;
}

export async function getCloudBackupDate(): Promise<string | null> {
  const snap = await getDoc(backupRef());
  return snap.exists() ? ((snap.data().updatedAt as string | undefined) ?? null) : null;
}

// Returns the number of data sets restored, or null when nothing is stored.
export async function restoreCloudBackup(): Promise<number | null> {
  const snap = await getDoc(backupRef());
  if (!snap.exists()) return null;
  const payload = snap.data().payload;
  if (typeof payload !== 'string') throw new Error('The cloud backup looks corrupted.');
  return restoreBackup(parseBackup(payload));
}

export async function deleteCloudBackup(): Promise<void> {
  await deleteDoc(backupRef());
}
