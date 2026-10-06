import type { ReactNode } from 'react'
import { NavLink as RouterNavLink, useLocation, useSearchParams } from 'react-router'
import { ActionIcon, Box, Group, Menu, NavLink, ScrollArea, Skeleton, Text } from '@mantine/core'
import {
  IconBookmark,
  IconChartBar,
  IconDatabase,
  IconDots,
  IconEyeOff,
  IconInbox,
  IconMessageQuestion,
  IconPlus,
  IconSend,
  IconStar,
  IconTags,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { useCurrentAccount, useLabels, useSavedSearches } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'
import { openTagForm } from '../features/tags/TagForm.tsx'
import { openDeleteSavedSearch, openSavedSearchForm } from '../features/saved-searches/SavedSearchForm.tsx'

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
  const [params] = useSearchParams()
  const account = useCurrentAccount()
  const { data: labels, isLoading } = useLabels(account?.id)
  const { data: savedSearches } = useSavedSearches(account?.id)
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
        to="/ignored"
        label="Stopped reading"
        data-testid="nav-ignored"
        leftSection={<IconEyeOff size={18} />}
        active={pathname === '/ignored'}
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
      <NavLink
        component={RouterNavLink}
        to="/ask"
        label="Ask your mailbox"
        data-testid="nav-ask"
        leftSection={<IconMessageQuestion size={18} />}
        active={pathname === '/ask'}
      />

      {!!savedSearches?.length && (
        <>
          <Text size="xs" c="dimmed" px="sm" mt="md" mb={4}>
            Saved searches
          </Text>
          {savedSearches.map((s) => (
            <NavLink
              key={s.id}
              component={RouterNavLink}
              to={`/search?q=${encodeURIComponent(s.query)}`}
              label={s.name}
              title={s.query}
              data-testid="nav-saved-search"
              data-query={s.query}
              leftSection={<IconBookmark size={16} />}
              active={pathname === '/search' && params.get('q') === s.query}
              rightSection={
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      component="span"
                      variant="subtle"
                      size="sm"
                      aria-label={`Options for ${s.name}`}
                      data-testid="saved-search-menu"
                      onClick={(e) => {
                        // Inside the link: open the menu without navigating.
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      <IconDots size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => openSavedSearchForm(s.query, s)} data-testid="saved-search-rename">
                      Rename
                    </Menu.Item>
                    <Menu.Item color="red" onClick={() => openDeleteSavedSearch(s)} data-testid="saved-search-delete">
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              }
            />
          ))}
        </>
      )}

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
