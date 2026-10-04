import type { QueryClient } from '@tanstack/react-query'
import { Progress, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { apiGet, apiPost, errorMessage } from '../../api/client.ts'
import type { BulkAction } from '../../api/types.ts'

export type BulkBody = {
  selector: { from: string } | { q: string }
  action: { type: 'trash' } | { type: 'labels'; add: string[]; remove: string[] }
}

const progressMessage = (b: BulkAction) =>
  b.total === 0 ? (
    <Text size="sm">Finding the emails…</Text>
  ) : (
    <Stack gap={4}>
      <Text size="sm">
        {b.processed.toLocaleString()} of {b.total.toLocaleString()} emails
      </Text>
      <Progress value={(b.processed / b.total) * 100} size="sm" />
    </Stack>
  )

// Starts a background bulk action and shows its progress in a notification until it ends.
export async function runBulkAction(accountId: string, body: BulkBody, title: string, qc: QueryClient) {
  const id = notifications.show({ title, message: 'Starting…', loading: true, autoClose: false, withCloseButton: false })

  let bulk: BulkAction
  try {
    bulk = await apiPost<BulkAction>(`/accounts/${accountId}/messages/bulk`, body)
  } catch (err) {
    notifications.update({ id, title, message: errorMessage(err), color: 'red', loading: false, autoClose: 5000, withCloseButton: true })
    return
  }

  const finish = (b: BulkAction | null, error?: string) => {
    clearInterval(timer)
    const ok = b?.status === 'DONE'
    notifications.update({
      id,
      title,
      color: ok ? 'green' : 'red',
      loading: false,
      autoClose: 5000,
      withCloseButton: true,
      message: ok ? `Done — ${b!.total.toLocaleString()} emails updated` : (error ?? b?.error ?? 'Action failed. Try again.'),
    })
    for (const key of ['senders', 'messages', 'message', 'labels', 'sync']) {
      void qc.invalidateQueries({ queryKey: [key, accountId] })
    }
  }

  const timer = setInterval(async () => {
    try {
      const b = await apiGet<BulkAction>(`/accounts/${accountId}/messages/bulk/${bulk.id}`)
      if (b.status === 'RUNNING') notifications.update({ id, title, message: progressMessage(b), loading: true })
      else finish(b)
    } catch (err) {
      finish(null, errorMessage(err))
    }
  }, 1000)
}
