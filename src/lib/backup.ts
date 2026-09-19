import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { APP_LOCK_STORAGE_KEY } from '@/lib/app-lock';
import { CURRENCY_STORAGE_KEY } from '@/lib/currency';
import { toDateStr } from '@/lib/date-range';

// A backup is every '@budgettracker/*' AsyncStorage key, value kept as its
// raw JSON string — enumerated by prefix rather than a hand-kept list, so a
// new lib module's key is picked up the moment it exists (goals/debts/
// accounts all landed this way). Device-level settings are excluded: the
// app-lock config (a PIN hash has no business leaving the device, and a
// restore shouldn't flip the lock), the theme preference, and the currency
// display setting ("how this phone shows things" choices, not data).
const APP_PREFIX = '@budgettracker/';
const THEME_PREFERENCE_KEY = '@budgettracker/theme-preference';
const LAST_BACKUP_KEY = '@budgettracker/last-backup';
const EXCLUDED_KEYS = new Set([APP_LOCK_STORAGE_KEY, THEME_PREFERENCE_KEY, CURRENCY_STORAGE_KEY, LAST_BACKUP_KEY]);

// ISO timestamp of the last file or cloud backup on this device. Excluded from
// backups like the other device-level keys: restoring an old backup shouldn't
// make the reminder think a fresh one just happened.
export async function getLastBackupDate(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_KEY);
}

export async function markBackedUp(): Promise<void> {
  await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

export interface BackupFile {
  app: 'BudgetTracker';
  version: 1;
  exportedAt: string; // ISO timestamp
  data: Record<string, string>; // storage key -> raw JSON string
}

async function dataKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith(APP_PREFIX) && !EXCLUDED_KEYS.has(k));
}

export async function buildBackup(): Promise<BackupFile> {
  const pairs = await AsyncStorage.multiGet(await dataKeys());
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) if (value != null) data[key] = value;
  return { app: 'BudgetTracker', version: 1, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const candidate = parsed as Partial<BackupFile> | null;
  if (!candidate || candidate.app !== 'BudgetTracker' || typeof candidate.data !== 'object' || candidate.data === null) {
    throw new Error('That file isn’t a BudgetTracker backup.');
  }
  if (candidate.version !== 1) {
    throw new Error(`Unsupported backup version (${String(candidate.version)}).`);
  }
  for (const [key, value] of Object.entries(candidate.data)) {
    if (!key.startsWith(APP_PREFIX) || typeof value !== 'string') throw new Error('Backup contents look corrupted.');
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Backup entry ${key} is corrupted.`);
    }
  }
  return candidate as BackupFile;
}

// Replace, not merge: the file becomes the whole truth for every data key,
// including ones the file doesn't mention (a category deleted since the
// backup shouldn't survive it). The excluded device settings are untouched
// either way.
export async function restoreBackup(backup: BackupFile): Promise<number> {
  const existing = await dataKeys();
  if (existing.length > 0) await AsyncStorage.multiRemove(existing);
  const entries = Object.entries(backup.data).filter(([key]) => !EXCLUDED_KEYS.has(key));
  if (entries.length > 0) await AsyncStorage.multiSet(entries);
  return entries.length;
}

// Same key set as a backup, so anything backed up is exactly what gets wiped;
// categories re-seed from defaults on next read.
export async function clearAllData(): Promise<number> {
  const existing = await dataKeys();
  if (existing.length > 0) await AsyncStorage.multiRemove(existing);
  return existing.length;
}

export type ExportOutcome = 'shared' | 'downloaded' | 'unavailable';

export async function exportBackup(): Promise<ExportOutcome> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const fileName = `budgettracker-backup-${toDateStr(new Date())}.json`;

  if (Platform.OS === 'web') {
    // No share sheet on web — hand the browser a download instead.
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    await markBackedUp();
    return 'downloaded';
  }

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, fileName);
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save backup' });
  // shareAsync resolves even if the sheet was dismissed, so this is "offered", the best signal available.
  await markBackedUp();
  return 'shared';
}

// null = the picker was dismissed; otherwise the number of entries restored.
// Throws (with a user-readable message) on an unreadable or invalid file.
export async function importBackup(): Promise<number | null> {
  // '*/*' rather than 'application/json' — some Android pickers report a
  // .json from Downloads as text/plain or octet-stream and would hide it;
  // parseBackup validates the contents regardless.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const text = Platform.OS === 'web' ? await (asset.file ? asset.file.text() : fetch(asset.uri).then((r) => r.text())) : await new File(asset.uri).text();
  return restoreBackup(parseBackup(text));
}
