export interface UnsubscribeTarget {
  kind: 'web' | 'email'
  url: string
}

// Picks the link to open from a List-Unsubscribe header (RFC 2369), e.g.
// "<https://x.com/u?id=1>, <mailto:u@x.com?subject=unsubscribe>". A web page is preferred:
// a mailto would need the user's mail client, since the app can't send email.
// Anything other than https/http/mailto is ignored, so a header can't inject javascript: URLs.
export function unsubscribeTarget(header: string | null | undefined): UnsubscribeTarget | null {
  if (!header) return null
  const links = [...header.matchAll(/<([^>]+)>/g)].map((m) => m.at(1)?.trim() ?? '')
  const web = links.find((l) => /^https?:\/\//i.test(l))
  if (web) return { kind: 'web', url: web }
  const mail = links.find((l) => /^mailto:[^\s]+@/i.test(l))
  return mail ? { kind: 'email', url: mail } : null
}
