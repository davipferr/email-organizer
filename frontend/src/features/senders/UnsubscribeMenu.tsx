import { useQueryClient } from '@tanstack/react-query'
import { Button, Menu, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconChevronDown, IconExternalLink, IconMail, IconTrash } from '@tabler/icons-react'
import { useCurrentAccount } from '../../api/hooks.ts'
import type { SenderGroup } from '../../api/types.ts'
import { unsubscribeTarget, type UnsubscribeTarget } from '../../utils/unsubscribe.ts'
import { runBulkAction } from '../messages/runBulkAction.tsx'

// The app can't send email or act on the sender's site for you (Gmail scopes are modify +
// labels only), so unsubscribing always ends in the browser or the user's mail app.
function openTarget(target: UnsubscribeTarget) {
  if (target.kind === 'web') window.open(target.url, '_blank', 'noopener,noreferrer')
  else window.location.assign(target.url)
}

export function UnsubscribeMenu({ group }: { group: SenderGroup }) {
  const qc = useQueryClient()
  const account = useCurrentAccount()
  const target = unsubscribeTarget(group.listUnsubscribe)
  if (!target) return null

  const who = group.key
  const count = `${group.total.toLocaleString()} email${group.total === 1 ? '' : 's'}`
  const howTo =
    target.kind === 'web'
      ? "The sender's unsubscribe page opens in a new tab; finish there."
      : 'Your mail app opens with an unsubscribe email ready; send it from there.'

  const unsubscribeAndTrash = () =>
    modals.openConfirmModal({
      title: 'Unsubscribe and move to Trash',
      children: (
        <>
          <Text size="sm">
            Move all {count} from <b>{who}</b> to Trash? You can restore them from Trash for 30 days.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            {howTo}
          </Text>
        </>
      ),
      labels: { confirm: 'Unsubscribe & trash', cancel: 'Cancel' },
      confirmProps: { color: 'red', 'data-testid': 'unsubscribe-trash-confirm' },
      onConfirm: () => {
        openTarget(target)
        void runBulkAction(account!.id, { selector: { from: who }, action: { type: 'trash' } }, `Trashing emails from ${who}`, qc)
      },
    })

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button size="xs" variant="light" color="orange" rightSection={<IconChevronDown size={12} />} data-testid="sender-unsubscribe">
          Unsubscribe
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{target.kind === 'web' ? 'Web page' : 'Unsubscribe email'}</Menu.Label>
        {target.kind === 'web' ? (
          <Menu.Item
            component="a"
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconExternalLink size={14} />}
            data-testid="sender-unsubscribe-open"
          >
            Open unsubscribe page
          </Menu.Item>
        ) : (
          <Menu.Item component="a" href={target.url} leftSection={<IconMail size={14} />} data-testid="sender-unsubscribe-open">
            Write unsubscribe email
          </Menu.Item>
        )}
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={unsubscribeAndTrash} data-testid="sender-unsubscribe-trash">
          Unsubscribe &amp; trash all
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
