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
  status: JobStatus
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
}

export interface SendersPage {
  lastSyncedAt: string | null
  totalGroups: number
  page: number
  pageSize: number
  senders: SenderGroup[]
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
