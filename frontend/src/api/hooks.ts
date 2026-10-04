import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from './client.ts'
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

export function useLogout() {
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSettled: () => window.location.assign('/login'),
  })
}
