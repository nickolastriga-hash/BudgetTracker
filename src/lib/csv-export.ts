import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getCategories, getCategory } from '@/lib/categories';
import { toDateStr } from '@/lib/date-range';
import type { ExportOutcome } from '@/lib/backup';
import { getRecurring, isActiveRecurring } from '@/lib/recurring';
import { getTransactions } from '@/lib/transactions';

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// A field a spreadsheet app would read as a date/number rather than text
// (e.g. "1E5" for a note, or a date-like category name) still needs quoting
// to round-trip as the literal string it is, not something re-parsed.
const HEADER = ['Date', 'Type', 'Category', 'Amount', 'Note', 'Recurring'];

export async function exportTransactionsCsv(): Promise<ExportOutcome> {
  const [transactions, categories, recurring] = await Promise.all([getTransactions(), getCategories(), getRecurring()]);
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      t.date,
      t.type,
      getCategory(categories, t.categoryId)?.name ?? 'Unknown',
      t.amount.toFixed(2),
      t.note ?? '',
      isActiveRecurring(t.recurringId, recurring) ? 'Yes' : 'No',
    ]);
  const csv = [HEADER, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
  const fileName = `budgettracker-transactions-${toDateStr(new Date())}.csv`;

  if (Platform.OS === 'web') {
    // No share sheet on web — hand the browser a download instead.
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, fileName);
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Save transactions CSV',
  });
  return 'shared';
}
