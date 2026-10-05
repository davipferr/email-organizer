import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from './client.ts'
import type {
  MailLabel,
  MailMessageFull,
  MailboxStats,
  Me,
  MessagePage,
  SendersPage,
  StoragePage,
  SyncRun,
  SyncStatus,
} from './types.ts'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/auth/me'), staleTime: Infinity })
}

// The mailbox being viewed. One account per user for now.
export function useCurrentAccount() {
  return useMe().data?.accounts[0]
}

export function useLabels(accountId: string | undefined) {
  return useQuery({
    queryKey: ['labels', accountId],
    queryFn: () => apiGet<MailLabel[]>(`/accounts/${accountId}/labels`),
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  })
}

// Same list plus email counts per tag (slower) — for the Manage tags page.
export function useLabelsWithCounts(accountId: string | undefined) {
  return useQuery({
    queryKey: ['labels', accountId, 'counts'],
    queryFn: () => apiGet<MailLabel[]>(`/accounts/${accountId}/labels?counts=true`),
    enabled: !!accountId,
  })
}

export interface LabelInput {
  name: string
  colorBg?: string
  colorText?: string
}

export function useSaveLabel(accountId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LabelInput }) =>
      id
        ? apiPatch<MailLabel>(`/accounts/${accountId}/labels/${id}`, input)
        : apiPost<MailLabel>(`/accounts/${accountId}/labels`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels', accountId] }),
  })
}

export function useDeleteLabel(accountId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, withChildren }: { id: string; withChildren: boolean }) =>
      apiDelete<{ deleted: number }>(`/accounts/${accountId}/labels/${id}?children=${withChildren}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels', accountId] }),
  })
}

export interface MessagesQuery {
  labelId?: string
  q?: string
  pageToken?: string
}

export function useMessages(accountId: string | undefined, query: MessagesQuery) {
  const params = new URLSearchParams()
  if (query.labelId) params.set('labelId', query.labelId)
  if (query.q) params.set('q', query.q)
  if (query.pageToken) params.set('pageToken', query.pageToken)

  return useQuery({
    queryKey: ['messages', accountId, query],
    queryFn: () => apiGet<MessagePage>(`/accounts/${accountId}/messages?${params}`),
    enabled: !!accountId,
    placeholderData: keepPreviousData,
  })
}

export function useMessage(accountId: string | undefined, messageId: string | null) {
  return useQuery({
    queryKey: ['message', accountId, messageId],
    queryFn: () => apiGet<MailMessageFull>(`/accounts/${accountId}/messages/${messageId}`),
    enabled: !!accountId && !!messageId,
    staleTime: Infinity,
  })
}

const syncStatusQuery = (accountId: string | undefined) => ({
  queryKey: ['sync', accountId],
  queryFn: () => apiGet<SyncStatus>(`/accounts/${accountId}/sync`),
})

// Polls every 1.5 s while a sync is running.
export function useSyncStatus(accountId: string | undefined) {
  return useQuery({
    ...syncStatusQuery(accountId),
    enabled: !!accountId,
    refetchInterval: (query) => (query.state.data?.run?.status === 'RUNNING' ? 1500 : false),
  })
}

// Starts a sync and resolves with the finished run (DONE, FAILED or CANCELLED), so callers can react
// to the end of the sync in the same event that started it.
export function useStartSync(accountId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (full: boolean): Promise<SyncRun | null> => {
      await apiPost(`/accounts/${accountId}/sync`, full ? { force: 'full' } : {})
      for (;;) {
        const status = await qc.fetchQuery({ ...syncStatusQuery(accountId), staleTime: 0 })
        if (status.run?.status !== 'RUNNING') return status.run
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    },
  })
}

// The Stop button. The status poll shows "Stopping…" until the run ends as CANCELLED.
export function useCancelSync(accountId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<SyncRun>(`/accounts/${accountId}/sync/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync', accountId] }),
  })
}

export interface SendersQuery {
  groupBy: 'email' | 'domain'
  sort: 'count' | 'latest' | 'size'
  search: string
  page: number
  unsubscribable?: boolean
}

export function useSenders(accountId: string | undefined, query: SendersQuery) {
  // Part of the key, so the list reloads by itself whenever a sync finishes.
  const lastSyncedAt = useSyncStatus(accountId).data?.lastSyncedAt
  const params = new URLSearchParams({ groupBy: query.groupBy, sort: query.sort, page: String(query.page) })
  if (query.search.trim()) params.set('search', query.search.trim())
  if (query.unsubscribable) params.set('unsubscribable', 'true')
  return useQuery({
    queryKey: ['senders', accountId, query, lastSyncedAt],
    queryFn: () => apiGet<SendersPage>(`/accounts/${accountId}/senders?${params}`),
    enabled: !!accountId,
    placeholderData: keepPreviousData,
  })
}

// From the synced copy, like useSenders: reloads by itself whenever a sync finishes.
export function useStorage(accountId: string | undefined, page: number) {
  const lastSyncedAt = useSyncStatus(accountId).data?.lastSyncedAt
  return useQuery({
    queryKey: ['storage', accountId, page, lastSyncedAt],
    queryFn: () => apiGet<StoragePage>(`/accounts/${accountId}/storage?page=${page}`),
    enabled: !!accountId,
    placeholderData: keepPreviousData,
  })
}

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export function useStats(accountId: string | undefined) {
  const lastSyncedAt = useSyncStatus(accountId).data?.lastSyncedAt
  return useQuery({
    queryKey: ['stats', accountId, lastSyncedAt],
    queryFn: () => apiGet<MailboxStats>(`/accounts/${accountId}/stats?tz=${encodeURIComponent(browserTimeZone)}`),
    enabled: !!accountId,
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSettled: () => window.location.assign('/login'),
  })
}
