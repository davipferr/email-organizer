import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { apiPost, errorMessage } from '../../api/client.ts'
import type { MailLabel } from '../../api/types.ts'

const emails = (n: number) => `${n} email${n === 1 ? '' : 's'}`

interface Step {
  run: () => Promise<unknown>
  undo?: () => Promise<unknown>
  message?: string // omitted = silent
}

// All email actions in one place, each with an "Undo" notification.
export function useMessageActions(accountId: string | undefined) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  const post = (path: string, body: unknown) => apiPost(`/accounts/${accountId}/messages/${path}`, body)
  const changeLabels = (ids: string[], add: string[], remove: string[]) =>
    post('labels', { selector: { ids }, add, remove })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['messages', accountId] })
    void qc.invalidateQueries({ queryKey: ['message', accountId] })
  }

  async function perform({ run, undo, message }: Step): Promise<boolean> {
    setBusy(true)
    try {
      await run()
    } catch (err) {
      notifications.show({ color: 'red', message: errorMessage(err) })
      return false
    } finally {
      setBusy(false)
      refresh()
    }
    if (!message) return true

    const id = notifications.show({
      autoClose: 6000,
      message: (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{message}</Text>
          {undo && (
            <Button
              size="compact-sm"
              variant="subtle"
              onClick={async () => {
                notifications.hide(id)
                try {
                  await undo()
                  notifications.show({ message: 'Undone', autoClose: 2000 })
                } catch (err) {
                  notifications.show({ color: 'red', message: errorMessage(err) })
                } finally {
                  refresh()
                }
              }}
            >
              Undo
            </Button>
          )}
        </Group>
      ),
    })
    return true
  }

  return {
    busy,

    trash: (ids: string[]) =>
      perform({
        run: () => post('trash', { selector: { ids } }),
        undo: () => post('untrash', { selector: { ids } }),
        message: `${emails(ids.length)} moved to Trash`,
      }),

    restore: (ids: string[]) =>
      perform({
        run: () => post('untrash', { selector: { ids } }),
        undo: () => post('trash', { selector: { ids } }),
        message: `${emails(ids.length)} restored`,
      }),

    archive: (ids: string[]) =>
      perform({
        run: () => changeLabels(ids, [], ['INBOX']),
        undo: () => changeLabels(ids, ['INBOX'], []),
        message: `${emails(ids.length)} archived`,
      }),

    // Adds the target tag and removes the current folder/tag (Gmail has no real folders).
    move: (ids: string[], to: MailLabel, from: string) =>
      perform({
        run: () => post('move', { selector: { ids }, to: to.providerLabelId, from }),
        undo: () => changeLabels(ids, [from], from === to.providerLabelId ? [] : [to.providerLabelId]),
        message: `${emails(ids.length)} moved to ${to.name}`,
      }),

    setTag: (ids: string[], tag: MailLabel, add: boolean) =>
      perform({
        run: () => changeLabels(ids, add ? [tag.providerLabelId] : [], add ? [] : [tag.providerLabelId]),
        undo: () => changeLabels(ids, add ? [] : [tag.providerLabelId], add ? [tag.providerLabelId] : []),
        message: `Tag ${tag.name} ${add ? 'added to' : 'removed from'} ${emails(ids.length)}`,
      }),

    markRead: (ids: string[], read: boolean, { silent = false } = {}) =>
      perform({
        run: () => changeLabels(ids, read ? [] : ['UNREAD'], read ? ['UNREAD'] : []),
        message: silent ? undefined : `${emails(ids.length)} marked as ${read ? 'read' : 'unread'}`,
      }),
  }
}

export type MessageActions = ReturnType<typeof useMessageActions>
