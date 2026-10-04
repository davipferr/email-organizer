import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatBytes, formatRelative, senderName } from './format.ts'

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [1536, '1.5 KB'],
    [20 * 1024, '20 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [3 * 1024 ** 4, '3072 GB'],
  ])('%i bytes → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('formatRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('says "just now" under a minute', () => {
    expect(formatRelative('2026-01-10T11:59:30Z')).toBe('just now')
  })

  it('uses the largest fitting unit', () => {
    expect(formatRelative('2026-01-10T11:55:00Z')).toBe('5 minutes ago')
    expect(formatRelative('2026-01-10T09:00:00Z')).toBe('3 hours ago')
    expect(formatRelative('2026-01-09T12:00:00Z')).toBe('yesterday')
  })
})

describe('senderName', () => {
  it('prefers the name, falls back to the email', () => {
    expect(senderName({ email: 'a@x.com', name: 'Ann' })).toBe('Ann')
    expect(senderName({ email: 'a@x.com' })).toBe('a@x.com')
  })
})
