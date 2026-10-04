import { useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router'
import { ActionIcon, Alert, AppShell, Avatar, Burger, Button, Center, Group, Loader, Menu, Text, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout, IconMail, IconPlugConnected, IconSearch } from '@tabler/icons-react'
import { useCurrentAccount, useLogout, useMe } from '../api/hooks.ts'
import { SidebarNav } from '../components/SidebarNav.tsx'

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const { data: me, isLoading } = useMe()
  const account = useCurrentAccount()
  const logout = useLogout()

  const submitSearch = () => {
    const q = search.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  // A 401 from /auth/me redirects to /login (see api/client.ts).
  if (isLoading || !me) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
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
            data-testid="search-input"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
          />
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" radius="xl" size="lg" ml="auto" aria-label="Account menu" data-testid="account-menu">
                <Avatar src={me.user.avatarUrl} name={me.user.name ?? me.user.email} size="sm" radius="xl" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{me.user.email}</Menu.Label>
              <Menu.Item component="a" href="/api/auth/google" leftSection={<IconPlugConnected size={16} />}>
                Reconnect Gmail
              </Menu.Item>
              <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={() => logout.mutate()}>
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
        {account?.needsReconnect && (
          <Alert color="yellow" mb="md" title="Gmail access expired">
            <Group justify="space-between">
              <Text size="sm">Reconnect your Gmail account to keep organizing your emails.</Text>
              <Button component="a" href="/api/auth/google" size="xs">
                Reconnect Gmail
              </Button>
            </Group>
          </Alert>
        )}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
