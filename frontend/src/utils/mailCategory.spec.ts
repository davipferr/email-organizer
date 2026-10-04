import { describe, expect, it } from 'vitest'
import { mailCategory } from './mailCategory.ts'

describe('mailCategory', () => {
  it.each([
    [['INBOX', 'CATEGORY_PROMOTIONS'], 'Promotions'],
    [['INBOX', 'UNREAD', 'CATEGORY_SOCIAL'], 'Social'],
    [['INBOX', 'CATEGORY_PERSONAL'], 'Primary'],
    [['INBOX', 'CATEGORY_UPDATES', 'Label_4'], 'Primary'],
    [['INBOX', 'CATEGORY_FORUMS'], 'Primary'],
    [['INBOX', 'IMPORTANT'], 'Primary'],
    [[], 'Primary'],
  ])('%j → %s', (labelIds, expected) => {
    expect(mailCategory(labelIds)).toBe(expected)
  })
})
