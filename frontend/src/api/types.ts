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

export type JobStatus = 'RUNNING' | 'DONE' | 'FAILED'

export interface SyncRun {
  id: string
  type: 'FULL' | 'INCREMENTAL'
  status: JobStatus | 'CANCELLED'
  cancelRequested: boolean // Stop was clicked; still RUNNING until the worker stops
  total: number
  processed: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface SyncStatus {
  lastSyncedAt: string | null
  messageCount: number
  run: SyncRun | null
}

export interface SenderGroup {
  key: string // email or domain
  name: string | null
  senders: number
  total: number
  unread: number
  latest: string
  sizeBytes: number
  listUnsubscribe: string | null // newest List-Unsubscribe header from this sender/domain
}

export interface SendersPage {
  lastSyncedAt: string | null
  totalGroups: number
  page: number
  pageSize: number
  senders: SenderGroup[]
}

export interface StoragePage {
  lastSyncedAt: string | null
  totalMessages: number
  totalBytes: number
  page: number
  pageSize: number
  messages: MailMessageSummary[] // biggest first
}

export interface CountPoint<K> {
  key: K
  count: number
}

export interface MailboxStats {
  lastSyncedAt: string | null
  timeZone: string
  totals: { messages: number; unread: number; senders: number; sizeBytes: number }
  byMonth: CountPoint<string>[] // "YYYY-MM", last 12 months, oldest first
  byHour: CountPoint<number>[] // 0–23
  byWeekday: CountPoint<number>[] // 1 = Monday … 7 = Sunday
  categories: { category: 'Primary' | 'Promotions' | 'Social'; count: number; unread: number }[]
  topSenders: { email: string; name: string | null; count: number }[]
}

export interface BulkAction {
  id: string
  status: JobStatus
  total: number
  processed: number
  error: string | null
}

export interface MailLabel {
  providerLabelId: string
  name: string
  type: 'SYSTEM' | 'USER'
  colorBg?: string
  colorText?: string
  messagesTotal?: number
  messagesUnread?: number
}
