import { useState } from 'react'
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useCurrentAccount, useDeleteLabel } from '../../api/hooks.ts'
import { errorMessage } from '../../api/client.ts'
import type { MailLabel } from '../../api/types.ts'

const MODAL_ID = 'delete-tag'

function DeleteTagConfirm({ tag, subTags }: { tag: MailLabel; subTags: MailLabel[] }) {
  const account = useCurrentAccount()
  const remove = useDeleteLabel(account?.id)
  const [withChildren, setWithChildren] = useState(false)

  const confirm = async () => {
    try {
      const { deleted } = await remove.mutateAsync({ id: tag.providerLabelId, withChildren })
      modals.close(MODAL_ID)
      notifications.show({ message: deleted > 1 ? `${deleted} tags deleted` : 'Tag deleted', autoClose: 2500 })
    } catch (err) {
      notifications.show({ color: 'red', message: errorMessage(err) })
    }
  }

  return (
    <Stack>
      <Text size="sm">
        Delete the tag <b>{tag.name}</b>? Your emails are kept — only the tag is removed from them.
      </Text>
      {subTags.length > 0 && (
        <Checkbox
          checked={withChildren}
          onChange={(e) => setWithChildren(e.currentTarget.checked)}
          label={`Also delete its ${subTags.length} sub-tag${subTags.length === 1 ? '' : 's'}`}
          description={subTags.map((c) => c.name).join(', ')}
        />
      )}
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={() => modals.close(MODAL_ID)}>
          Cancel
        </Button>
        <Button color="red" onClick={confirm} loading={remove.isPending} data-testid="delete-tag-confirm">
          Delete tag
        </Button>
      </Group>
    </Stack>
  )
}

export function openDeleteTag(tag: MailLabel, allLabels: MailLabel[]) {
  const subTags = allLabels.filter((l) => l.name.startsWith(`${tag.name}/`))
  modals.open({ modalId: MODAL_ID, title: 'Delete tag', children: <DeleteTagConfirm tag={tag} subTags={subTags} /> })
}
