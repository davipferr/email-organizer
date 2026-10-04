import { useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router'
import { ActionIcon, AppShell, Avatar, Burger, Group, Menu, Text, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout, IconMail, IconPlugConnected, IconSearch } from '@tabler/icons-react'
import { SidebarNav } from '../components/SidebarNav.tsx'

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')

  const submitSearch = () => {
    const q = search.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="md" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Group gap={6} wrap="nowrap">
            <IconMail size={22} />
            <Text fw={500} visibleFrom="xs">
              Mail organizer
            </Text>
          </Group>
          <TextInput
            flex={1}
            maw={560}
            placeholder="from:todomundo@nubank.com.br label:finance"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
          />
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" radius="xl" size="lg" ml="auto" aria-label="Account menu">
                <Avatar size="sm" radius="xl" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPlugConnected size={16} />}>Reconnect Gmail</Menu.Item>
              <Menu.Item leftSection={<IconLogout size={16} />} color="red">
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <SidebarNav />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
