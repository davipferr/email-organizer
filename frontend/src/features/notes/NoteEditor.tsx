import { useState } from 'react'
import { Button, Group, Text, Textarea } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { errorMessage } from '../../api/client.ts'
import { useCurrentAccount, useNotes, useSaveNote } from '../../api/hooks.ts'
import type { NoteTarget } from '../../api/types.ts'
import { formatRelative } from '../../utils/format.ts'

interface Props {
  targetType: NoteTarget
  targetKey: string
  label: string
  placeholder: string
  testId: string // e.g. "note-email" → note-email-input / note-email-save
  autoFocus?: boolean
  onSaved?: () => void
}

// A private note on an email or a sender, kept only in this app. Saving empty text deletes it.
export function NoteEditor(props: Props) {
  const account = useCurrentAccount()
  const key = props.targetType === 'SENDER' ? props.targetKey.toLowerCase() : props.targetKey
  const { data: notes, isLoading } = useNotes(account?.id, props.targetType, [key])
  if (isLoading) return null
  const note = notes?.get(key)
  // Keyed on the saved version, so the text box restarts from it after each save.
  return <NoteForm key={note?.updatedAt ?? 'new'} {...props} targetKey={key} saved={note?.body ?? ''} updatedAt={note?.updatedAt} />
}

function NoteForm({
  targetType,
  targetKey,
  label,
  placeholder,
  testId,
  autoFocus,
  onSaved,
  saved,
  updatedAt,
}: Props & { saved: string; updatedAt?: string }) {
  const account = useCurrentAccount()
  const saveNote = useSaveNote(account?.id)
  const [text, setText] = useState(saved)
  const changed = text.trim() !== saved

  const save = () =>
    saveNote.mutate(
      { targetType, targetKey, body: text },
      {
        onSuccess: () => {
          notifications.show({ message: text.trim() ? 'Note saved' : 'Note deleted', autoClose: 2000 })
          onSaved?.()
        },
        onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
      },
    )

  return (
    <div>
      <Textarea
        label={label}
        placeholder={placeholder}
        autosize
        minRows={2}
        maxRows={8}
        maxLength={10_000}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && changed) save()
        }}
        data-testid={`${testId}-input`}
      />
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          {updatedAt ? `Saved ${formatRelative(updatedAt)} · only visible to you` : 'Only visible to you'}
        </Text>
        <Button size="compact-xs" variant="light" disabled={!changed} loading={saveNote.isPending} onClick={save} data-testid={`${testId}-save`}>
          {saved && !text.trim() ? 'Delete note' : 'Save note'}
        </Button>
      </Group>
    </div>
  )
}

// The note on a sender, edited in a dialog (Senders and "Stopped reading" rows).
export function openSenderNote(email: string) {
  const id = 'sender-note'
  modals.open({
    modalId: id,
    title: `Note on ${email}`,
    children: (
      <NoteEditor
        targetType="SENDER"
        targetKey={email}
        label="Your note"
        placeholder="e.g. My accountant — always reply within a day"
        testId="note-sender"
        autoFocus
        onSaved={() => modals.close(id)}
      />
    ),
  })
}
