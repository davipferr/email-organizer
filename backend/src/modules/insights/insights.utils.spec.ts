import { describe, expect, it } from 'vitest';
import { fillSeries, isValidTimeZone, lastMonths } from './insights.utils.js';

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects anything else', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone("UTC'; DROP TABLE messages; --")).toBe(false);
  });
});

describe('lastMonths', () => {
  it('ends with the current month and crosses the year boundary', () => {
    expect(lastMonths(new Date('2026-02-15T12:00:00Z'), 'UTC', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('uses the month in the given time zone', () => {
    // 02:00 UTC on Mar 1 is still Feb 28 in São Paulo (UTC-3).
    const now = new Date('2026-03-01T02:00:00Z');
    expect(lastMonths(now, 'UTC', 1)).toEqual(['2026-03']);
    expect(lastMonths(now, 'America/Sao_Paulo', 1)).toEqual(['2026-02']);
  });

  it('returns 12 months for a full year', () => {
    const months = lastMonths(new Date('2026-12-31T12:00:00Z'), 'UTC', 12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });
});

describe('fillSeries', () => {
  it('keeps the key order and fills gaps with 0', () => {
    expect(fillSeries([0, 1, 2], [{ key: 2, count: 5 }, { key: 0, count: 1 }])).toEqual([
      { key: 0, count: 1 },
      { key: 1, count: 0 },
      { key: 2, count: 5 },
    ]);
  });
});
