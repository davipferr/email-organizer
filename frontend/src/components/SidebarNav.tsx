import { NavLink as RouterNavLink, useLocation } from 'react-router'
import { ActionIcon, Group, NavLink, ScrollArea, Text } from '@mantine/core'
import { IconInbox, IconPlus, IconSend, IconStar, IconTags, IconTrash, IconUsers } from '@tabler/icons-react'

const systemItems = [
  { label: 'Inbox', to: '/inbox', icon: IconInbox },
  { label: 'Starred', to: '/label/STARRED', icon: IconStar },
  { label: 'Sent', to: '/label/SENT', icon: IconSend },
  { label: 'Trash', to: '/label/TRASH', icon: IconTrash },
]

export function SidebarNav() {
  const { pathname } = useLocation()

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

      <Group justify="space-between" px="sm" mt="md" mb={4}>
        <Text size="xs" c="dimmed">
          Tags
        </Text>
        <ActionIcon variant="subtle" size="sm" aria-label="New tag">
          <IconPlus size={14} />
        </ActionIcon>
      </Group>
      {/* User tags (tree) are loaded from GET /api/accounts/:id/labels */}
    </ScrollArea>
  )
}
