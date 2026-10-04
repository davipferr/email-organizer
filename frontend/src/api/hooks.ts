import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from './client.ts'
import type { MailLabel, MailMessageFull, Me, MessagePage } from './types.ts'

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

export function useLogout() {
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSettled: () => window.location.assign('/login'),
  })
}
