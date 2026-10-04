// English to match the rest of the UI.
const monthFmt = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('en', { weekday: 'short' })

// "2026-02" → "Feb 26". Built from local parts so the month never shifts with the time zone.
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return monthFmt.format(new Date(year, month - 1, 1))
}

// ISO weekday (1 = Monday … 7 = Sunday) → "Mon". Jan 1, 2024 was a Monday.
export function weekdayLabel(isoDay: number): string {
  return weekdayFmt.format(new Date(2024, 0, isoDay))
}

// 0–23 → "00h" … "23h"
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`
}

// The key with the highest count (the first one on a tie), or null when all are 0.
export function peak<K>(points: { key: K; count: number }[]): K | null {
  let best: { key: K; count: number } | null = null
  for (const p of points) if (p.count > (best?.count ?? 0)) best = p
  return best?.key ?? null
}
