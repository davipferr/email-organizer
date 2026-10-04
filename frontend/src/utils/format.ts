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

export function senderName(from: { email: string; name?: string }): string {
  return from.name || from.email
}
