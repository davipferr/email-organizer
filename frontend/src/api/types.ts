// Shapes returned by the backend API.

export interface Account {
  id: string
  provider: 'GMAIL'
  emailAddress: string
  needsReconnect: boolean
  lastSyncedAt: string | null
}

export interface Me {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null }
  accounts: Account[]
}

export interface MailAddress {
  email: string
  name?: string
}

export interface MailMessageSummary {
  providerMessageId: string
  threadId: string
  from: MailAddress
  subject?: string
  snippet?: string
  date: string
  sizeBytes: number
  labelIds: string[]
  isUnread: boolean
  listUnsubscribe?: string
}

export interface MailMessageFull extends MailMessageSummary {
  to: MailAddress[]
  cc: MailAddress[]
  html?: string
  text?: string
}

export interface MessagePage {
  messages: MailMessageSummary[]
  nextPageToken?: string
  totalEstimate?: number
}

export interface MailLabel {
  providerLabelId: string
  name: string
  type: 'SYSTEM' | 'USER'
  colorBg?: string
  colorText?: string
}
