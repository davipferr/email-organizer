import { describe, expect, it } from 'vitest';
import { withDbSuffix } from './database-url.js';

const url = 'postgresql://mail:pw@localhost:5433/mail_organizer';

describe('withDbSuffix', () => {
  it('leaves the URL alone without a suffix', () => {
    expect(withDbSuffix(url, undefined)).toBe(url);
  });

  it('appends the suffix to the database name only', () => {
    expect(withDbSuffix(`${url}?schema=public`, '_slot1')).toBe('postgresql://mail:pw@localhost:5433/mail_organizer_slot1?schema=public');
  });

  it('rejects suffixes that could change more than the name', () => {
    expect(() => withDbSuffix(url, '/other')).toThrow();
    expect(() => withDbSuffix(url, '_x?y')).toThrow();
  });
});
