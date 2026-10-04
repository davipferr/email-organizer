export type MailCategory = 'Primary' | 'Promotions' | 'Social'

export const CATEGORY_DESCRIPTIONS: Record<MailCategory, string> = {
  Primary: 'Primary: person-to-person mail and anything Gmail did not put in another tab',
  Promotions: 'Promotions: deals, offers and marketing emails',
  Social: 'Social: messages from social networks and media-sharing sites',
}

// Gmail's tab for a message, from its CATEGORY_* labels. Updates and Forums mail is
// shown as Primary, which is where Gmail puts it when only these three tabs are on.
export function mailCategory(labelIds: string[]): MailCategory {
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'Promotions'
  if (labelIds.includes('CATEGORY_SOCIAL')) return 'Social'
  return 'Primary'
}
