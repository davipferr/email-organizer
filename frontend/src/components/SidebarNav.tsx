import type { ReactNode } from 'react'
import { NavLink as RouterNavLink, useLocation } from 'react-router'
import { Box, Group, NavLink, ScrollArea, Skeleton, Text } from '@mantine/core'
import { IconInbox, IconSend, IconStar, IconTags, IconTrash, IconUsers } from '@tabler/icons-react'
import { useCurrentAccount, useLabels } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'

const systemItems = [
  { label: 'Inbox', to: '/inbox', icon: IconInbox },
  { label: 'Starred', to: '/label/STARRED', icon: IconStar },
  { label: 'Sent', to: '/label/SENT', icon: IconSend },
  { label: 'Trash', to: '/label/TRASH', icon: IconTrash },
]

interface TagNode {
  name: string
  label?: MailLabel
  children: TagNode[]
}

// "Finance/Nubank" → Finance ▸ Nubank
function buildTree(labels: MailLabel[]): TagNode[] {
  const root: TagNode[] = []
  for (const label of labels) {
    let level = root
    const parts = label.name.split('/')
    parts.forEach((part, i) => {
      let node = level.find((n) => n.name === part)
      if (!node) {
        node = { name: part, children: [] }
        level.push(node)
      }
      if (i === parts.length - 1) node.label = label
      level = node.children
    })
  }
  return root
}

function Dot({ color }: { color?: string }) {
  return <Box w={8} h={8} style={{ borderRadius: '50%', background: color ?? 'var(--mantine-color-gray-5)' }} />
}

function TagLinks({ nodes, pathname }: { nodes: TagNode[]; pathname: string }): ReactNode {
  return nodes.map((node) => {
    const to = node.label ? `/label/${node.label.providerLabelId}` : undefined
    const children = node.children.length ? <TagLinks nodes={node.children} pathname={pathname} /> : undefined
    return to ? (
      <NavLink
        key={node.name}
        component={RouterNavLink}
        to={to}
        label={node.name}
        leftSection={<Dot color={node.label?.colorBg} />}
        active={pathname === to}
        defaultOpened
        childrenOffset={16}
      >
        {children}
      </NavLink>
    ) : (
      <NavLink key={node.name} label={node.name} leftSection={<Dot />} defaultOpened childrenOffset={16}>
        {children}
      </NavLink>
    )
  })
}

export function SidebarNav() {
  const { pathname } = useLocation()
  const account = useCurrentAccount()
  const { data: labels, isLoading } = useLabels(account?.id)
  const userLabels = (labels ?? []).filter((l) => l.type === 'USER')

  return (
    <ScrollArea>
      {systemItems.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          component={RouterNavLink}
          to={to}
          label={label}
          leftSection={<Icon size={18} />}
          active={pathname === to}
        />
      ))}

      <NavLink
        component={RouterNavLink}
        to="/senders"
        label="Senders"
        leftSection={<IconUsers size={18} />}
        active={pathname === '/senders'}
        mt="xs"
      />
      <NavLink
        component={RouterNavLink}
        to="/tags"
        label="Manage tags"
        leftSection={<IconTags size={18} />}
        active={pathname === '/tags'}
      />

      <Group px="sm" mt="md" mb={4}>
        <Text size="xs" c="dimmed">
          Tags
        </Text>
      </Group>
      {isLoading ? (
        <Skeleton h={28} mx="sm" />
      ) : userLabels.length ? (
        <TagLinks nodes={buildTree(userLabels)} pathname={pathname} />
      ) : (
        <Text size="xs" c="dimmed" px="sm">
          No tags yet
        </Text>
      )}
    </ScrollArea>
  )
}
