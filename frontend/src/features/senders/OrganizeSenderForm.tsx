import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Anchor, Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconTrash } from '@tabler/icons-react'
import { useCurrentAccount, useLabels } from '../../api/hooks.ts'
import type { SenderGroup } from '../../api/types.ts'
import { runBulkAction } from '../messages/runBulkAction.tsx'
import { openTagForm } from '../tags/TagForm.tsx'

const MODAL_ID = 'organize-sender'

function OrganizeSenderForm({ group, initialTagId }: { group: SenderGroup; initialTagId?: string }) {
  const qc = useQueryClient()
  const account = useCurrentAccount()
  const { data: labels } = useLabels(account?.id)
  const userLabels = (labels ?? []).filter((l) => l.type === 'USER')

  const [tagId, setTagId] = useState<string | null>(initialTagId ?? null)
  const [archive, setArchive] = useState(true)
  const [markRead, setMarkRead] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const who = group.key
  const count = `${group.total.toLocaleString()} email${group.total === 1 ? '' : 's'}`

  const apply = () => {
    if (!tagId && !archive && !markRead) return setError('Choose at least one change')
    modals.close(MODAL_ID)
    void runBulkAction(
      account!.id,
      {
        selector: { from: who },
        action: {
          type: 'labels',
          add: tagId ? [tagId] : [],
          remove: [...(archive ? ['INBOX'] : []), ...(markRead ? ['UNREAD'] : [])],
        },
      },
      `Organizing emails from ${who}`,
      qc,
    )
  }

  const trashAll = () =>
    modals.openConfirmModal({
      title: 'Move to Trash',
      children: (
        <Text size="sm">
          Move all {count} from <b>{who}</b> to Trash? You can restore them from Trash for 30 days.
        </Text>
      ),
      labels: { confirm: 'Move to Trash', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        modals.close(MODAL_ID)
        void runBulkAction(account!.id, { selector: { from: who }, action: { type: 'trash' } }, `Trashing emails from ${who}`, qc)
      },
    })

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Applies to every email from <b>{who}</b> in your mailbox (about {count}).
      </Text>
      <Stack gap={4}>
        <Select
          label="Add tag"
          placeholder="No tag"
          data={userLabels.map((l) => ({ value: l.providerLabelId, label: l.name }))}
          value={tagId}
          onChange={(v) => {
            setTagId(v)
            setError(null)
          }}
          searchable
          clearable
        />
        <Anchor
          size="xs"
          component="button"
          type="button"
          ta="left"
          onClick={() => {
            // Reopens this dialog with the new tag selected once it's created.
            modals.close(MODAL_ID)
            openTagForm({ onSaved: (tag) => openOrganizeSender(group, tag.providerLabelId) })
          }}
        >
          Create a new tag
        </Anchor>
      </Stack>
      <Checkbox
        label="Archive (remove from Inbox)"
        checked={archive}
        onChange={(e) => {
          setArchive(e.currentTarget.checked)
          setError(null)
        }}
      />
      <Checkbox
        label="Mark as read"
        checked={markRead}
        onChange={(e) => {
          setMarkRead(e.currentTarget.checked)
          setError(null)
        }}
      />
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
      <Group justify="space-between" mt="sm">
        <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={trashAll}>
          Trash all
        </Button>
        <Group gap="xs">
          <Button variant="default" onClick={() => modals.close(MODAL_ID)}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </Group>
      </Group>
    </Stack>
  )
}

export function openOrganizeSender(group: SenderGroup, initialTagId?: string) {
  modals.open({
    modalId: MODAL_ID,
    title: `Organize ${group.total.toLocaleString()} emails`,
    children: <OrganizeSenderForm group={group} initialTagId={initialTagId} />,
  })
}
