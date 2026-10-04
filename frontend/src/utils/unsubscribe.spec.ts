import { describe, expect, it } from 'vitest'
import { unsubscribeTarget } from './unsubscribe.ts'

describe('unsubscribeTarget', () => {
  it('returns null without a usable header', () => {
    expect(unsubscribeTarget(undefined)).toBeNull()
    expect(unsubscribeTarget(null)).toBeNull()
    expect(unsubscribeTarget('')).toBeNull()
    expect(unsubscribeTarget('not a header')).toBeNull()
  })

  it('prefers the web link even when the mailto comes first', () => {
    expect(unsubscribeTarget('<mailto:u@shop.com>, <https://shop.com/unsub?id=1>')).toEqual({
      kind: 'web',
      url: 'https://shop.com/unsub?id=1',
    })
  })

  it('falls back to mailto, keeping its query', () => {
    expect(unsubscribeTarget('<mailto:unsubscribe@medium.com?subject=stop>')).toEqual({
      kind: 'email',
      url: 'mailto:unsubscribe@medium.com?subject=stop',
    })
  })

  it('ignores links with other schemes', () => {
    expect(unsubscribeTarget('<javascript:alert(1)>')).toBeNull()
    expect(unsubscribeTarget('<javascript:alert(1)>, <mailto:u@x.com>')).toEqual({ kind: 'email', url: 'mailto:u@x.com' })
  })

  it('handles whitespace and line folding inside the header', () => {
    expect(unsubscribeTarget(' <\n https://x.com/u >')).toEqual({ kind: 'web', url: 'https://x.com/u' })
  })
})
