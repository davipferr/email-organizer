import type { ReactNode } from 'react'
import { NavLink as RouterNavLink, useLocation } from 'react-router'
import { ActionIcon, Box, Group, NavLink, ScrollArea, Skeleton, Text } from '@mantine/core'
import {
  IconChartBar,
  IconDatabase,
  IconInbox,
  IconPlus,
  IconSend,
  IconStar,
  IconTags,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { useCurrentAccount, useLabels } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'
import { openTagForm } from '../features/tags/TagForm.tsx'

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
        data-testid={`nav-tag-${node.label?.providerLabelId}`}
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
          data-testid={`nav-${label.toLowerCase()}`}
          leftSection={<Icon size={18} />}
          active={pathname === to}
        />
      ))}

      <NavLink
        component={RouterNavLink}
        to="/senders"
        label="Senders"
        data-testid="nav-senders"
        leftSection={<IconUsers size={18} />}
        active={pathname === '/senders'}
        mt="xs"
      />
      <NavLink
        component={RouterNavLink}
        to="/tags"
        label="Manage tags"
        data-testid="nav-tags"
        leftSection={<IconTags size={18} />}
        active={pathname === '/tags'}
      />
      <NavLink
        component={RouterNavLink}
        to="/storage"
        label="Storage"
        data-testid="nav-storage"
        leftSection={<IconDatabase size={18} />}
        active={pathname === '/storage'}
      />
      <NavLink
        component={RouterNavLink}
        to="/stats"
        label="Stats"
        data-testid="nav-stats"
        leftSection={<IconChartBar size={18} />}
        active={pathname === '/stats'}
      />

      <Group justify="space-between" px="sm" mt="md" mb={4}>
        <Text size="xs" c="dimmed">
          Tags
        </Text>
        <ActionIcon variant="subtle" size="sm" aria-label="New tag" data-testid="nav-new-tag" onClick={() => openTagForm()}>
          <IconPlus size={14} />
        </ActionIcon>
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
