import { Button, Group } from '@mantine/core'
import { IconArchive, IconFolderShare, IconMail, IconMailOpened, IconRestore, IconTag, IconTrash } from '@tabler/icons-react'
import type { MailLabel } from '../../api/types.ts'
import { openTagForm } from '../tags/TagForm.tsx'
import { LabelPicker, type PickState } from './LabelPicker.tsx'
import type { MessageActions } from './useMessageActions.tsx'

const INBOX: MailLabel = { providerLabelId: 'INBOX', name: 'Inbox', type: 'SYSTEM' }

interface Props {
  messages: { providerMessageId: string; labelIds: string[]; isUnread: boolean }[]
  viewLabelId?: string // the folder/tag being viewed (undefined for search)
  userLabels: MailLabel[]
  actions: MessageActions
  // Called after an action that removes the emails from the current view.
  onRemoved?: () => void
}

export function MessageActionsBar({ messages, viewLabelId, userLabels, actions, onRemoved }: Props) {
  const ids = messages.map((m) => m.providerMessageId)
  const inTrash = viewLabelId === 'TRASH' || messages.every((m) => m.labelIds.includes('TRASH'))
  const inInbox = messages.some((m) => m.labelIds.includes('INBOX'))
  const anyUnread = messages.some((m) => m.isUnread)

  // "Move" removes the current folder: the tag being viewed, otherwise the Inbox.
  const from =
    viewLabelId && (viewLabelId === 'INBOX' || userLabels.some((l) => l.providerLabelId === viewLabelId))
      ? viewLabelId
      : 'INBOX'
  const moveTargets = [INBOX, ...userLabels].filter((l) => l.providerLabelId !== from)

  const tagState = (label: MailLabel): PickState => {
    const count = messages.filter((m) => m.labelIds.includes(label.providerLabelId)).length
    return count === 0 ? 'unchecked' : count === messages.length ? 'checked' : 'indeterminate'
  }

  const done = (ok: boolean) => ok && onRemoved?.()

  if (inTrash) {
    return (
      <Button
        variant="default"
        size="xs"
        leftSection={<IconRestore size={14} />}
        loading={actions.busy}
        onClick={async () => done(await actions.restore(ids))}
      >
        Restore
      </Button>
    )
  }

  return (
    <Group gap="xs">
      <LabelPicker
        labels={userLabels}
        stateOf={tagState}
        onPick={(label, state) => actions.setTag(ids, label, state !== 'checked')}
        onCreate={() => openTagForm({ onSaved: (tag) => actions.setTag(ids, tag, true) })}
        target={
          <Button variant="default" size="xs" leftSection={<IconTag size={14} />}>
            Tag
          </Button>
        }
      />
      <LabelPicker
        labels={moveTargets}
        onPick={async (label) => done(await actions.move(ids, label, from))}
        target={
          <Button variant="default" size="xs" leftSection={<IconFolderShare size={14} />}>
            Move to
          </Button>
        }
      />
      {inInbox && (
        <Button
          variant="default"
          size="xs"
          leftSection={<IconArchive size={14} />}
          onClick={async () => done(await actions.archive(ids))}
        >
          Archive
        </Button>
      )}
      <Button
        variant="default"
        size="xs"
        leftSection={anyUnread ? <IconMailOpened size={14} /> : <IconMail size={14} />}
        onClick={() => actions.markRead(ids, anyUnread)}
      >
        {anyUnread ? 'Mark as read' : 'Mark as unread'}
      </Button>
      <Button
        variant="default"
        size="xs"
        color="red"
        c="red"
        leftSection={<IconTrash size={14} />}
        onClick={async () => done(await actions.trash(ids))}
      >
        Trash
      </Button>
    </Group>
  )
}
