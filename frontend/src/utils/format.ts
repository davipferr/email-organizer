const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' })
const longFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' })

// Like Gmail: time for today, "Oct 2" for this year, short date otherwise.
export function formatListDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return timeFmt.format(date)
  if (date.getFullYear() === now.getFullYear()) return dayFmt.format(date)
  return fullDateFmt.format(date)
}

export function formatLongDate(iso: string): string {
  return longFmt.format(new Date(iso))
}

// English to match the rest of the UI.
const relativeFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

// "5 minutes ago", "yesterday"…
export function formatRelative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFmt.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

export function senderName(from: { email: string; name?: string }): string {
  return from.name || from.email
}
