// Week/Month/Year/Custom range machinery shared by every screen with a range
// nav (Home, Transactions, Trends) — extracted here 2026-08-30 once Trends
// became the 3rd near-identical copy of this logic, crossing the
// no-premature-abstraction rule's own "not yet 3" threshold that Home's and
// Transactions' copies were explicitly left under until then.

export type RangeType = 'week' | 'month' | 'year' | 'custom';

// A custom range being built up by two taps on RangePickerModal's day grid —
// `end: null` means only the start day has been tapped so far and the
// picker is waiting on a second tap.
export type CustomRange = { start: string; end: string | null };

export function toMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function shortDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Sunday-start week, matching the weekday grid Transactions' own Calendar
// view uses (WEEKDAY_LABELS there starts with 'S').
export function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

// Shared by week and custom ranges below — both label as "MMM D – MMM D,
// YYYY", abbreviating the end date to just its day number when it falls in
// the same month as the start.
export function formatRangeLabel(start: Date, end: Date) {
  return start.getFullYear() === end.getFullYear()
    ? `${shortDateLabel(start)} – ${end.getMonth() === start.getMonth() ? end.getDate() : shortDateLabel(end)}, ${end.getFullYear()}`
    : `${shortDateLabel(start)}, ${start.getFullYear()} – ${shortDateLabel(end)}, ${end.getFullYear()}`;
}

// Resolves a range-type toggle + navigated anchor date into the [start, end]
// "YYYY-MM-DD" bounds the transaction range helpers take, plus the label
// shown between the nav chevrons. `customRange` is only read for rangeType
// 'custom' — the anchor-based types don't need it.
export function rangeBounds(
  rangeType: RangeType,
  anchor: Date,
  customRange: CustomRange | null
): { start: string; end: string; label: string } {
  if (rangeType === 'week') {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return { start: toDateStr(start), end: toDateStr(end), label: formatRangeLabel(start, end) };
  }
  if (rangeType === 'year') {
    const year = anchor.getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
  }
  if (rangeType === 'custom') {
    if (!customRange) return { start: toDateStr(anchor), end: toDateStr(anchor), label: 'Select dates' };
    if (!customRange.end) return { start: customRange.start, end: customRange.start, label: 'Select end date' };
    const startDate = new Date(`${customRange.start}T00:00:00`);
    const endDate = new Date(`${customRange.end}T00:00:00`);
    return {
      start: customRange.start,
      end: customRange.end,
      label:
        customRange.start === customRange.end
          ? `${shortDateLabel(startDate)}, ${startDate.getFullYear()}`
          : formatRangeLabel(startDate, endDate),
    };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end), label: monthLabel(anchor) };
}

export function shiftAnchor(rangeType: RangeType, anchor: Date, dir: 1 | -1): Date {
  if (rangeType === 'week') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * dir);
  if (rangeType === 'year') return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

// Slides a complete custom range by its own length (e.g. a 10-day range
// steps 10 days at a time) so the nav chevrons stay meaningful in custom
// mode too, the same "step by one period" idea as shiftAnchor above.
export function shiftCustomRange(range: CustomRange, dir: 1 | -1): CustomRange {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end ?? range.start}T00:00:00`);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  start.setDate(start.getDate() + dir * lengthDays);
  end.setDate(end.getDate() + dir * lengthDays);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// Every date "YYYY-MM-DD" from start to end inclusive — Trends' cumulative
// line buckets by day regardless of range type (Month/Year/Custom all use
// the same daily granularity, so there's one chart-building code path
// instead of three).
export function daysBetween(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    days.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Every "YYYY-MM" a [startDate, endDate] range touches, even partially —
// used to total a multi-month budget (each month's effectiveLimit summed)
// without prorating a month a custom range only partly overlaps.
export function monthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  cursor.setDate(1);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    months.push(toMonthStr(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
