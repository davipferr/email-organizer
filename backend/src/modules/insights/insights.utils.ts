// IANA zone names the runtime knows ("America/Sao_Paulo", "UTC"…). Postgres ships the
// same tz database, so a name valid here is valid for AT TIME ZONE.
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The last `count` months as "YYYY-MM", oldest first, ending with the month `now` falls
// in at `timeZone` (matches Postgres' to_char(date_trunc('month', local), 'YYYY-MM')).
export function lastMonths(now: Date, timeZone: string, count: number): string[] {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  return Array.from({ length: count }, (_, i) => {
    const total = year * 12 + (month - 1) - (count - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

// One entry per key, in the order given, with 0 where the query returned no row.
export function fillSeries<K extends string | number>(keys: K[], rows: { key: K; count: number }[]) {
  const byKey = new Map(rows.map((r) => [r.key, r.count]));
  return keys.map((key) => ({ key, count: byKey.get(key) ?? 0 }));
}
