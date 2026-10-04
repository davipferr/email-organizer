import { describe, expect, it } from 'vitest'
import { hourLabel, monthLabel, peak, weekdayLabel } from './statsLabels.ts'

describe('stats labels', () => {
  it('formats months, including January and December', () => {
    expect(monthLabel('2026-02')).toBe('Feb 26')
    expect(monthLabel('2026-01')).toBe('Jan 26')
    expect(monthLabel('2025-12')).toBe('Dec 25')
  })

  it('maps ISO weekdays starting on Monday', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayLabel)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('pads hours', () => {
    expect(hourLabel(0)).toBe('00h')
    expect(hourLabel(9)).toBe('09h')
    expect(hourLabel(23)).toBe('23h')
  })
})

describe('peak', () => {
  it('returns the busiest key, the first one on a tie', () => {
    expect(peak([{ key: 1, count: 2 }, { key: 2, count: 5 }, { key: 3, count: 5 }])).toBe(2)
  })

  it('returns null when nothing was counted', () => {
    expect(peak([{ key: 1, count: 0 }])).toBeNull()
    expect(peak([])).toBeNull()
  })
})
