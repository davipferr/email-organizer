import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Avatar,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Pagination,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconRefresh, IconSearch, IconUsers } from '@tabler/icons-react'
import { errorMessage } from '../api/client.ts'
import { useCurrentAccount, useSenders, useStartSync, useSyncStatus, type SendersQuery } from '../api/hooks.ts'
import type { SenderGroup } from '../api/types.ts'
import { formatBytes, formatListDate, formatRelative } from '../utils/format.ts'
import { openOrganizeSender } from '../features/senders/OrganizeSenderForm.tsx'

const SORT_OPTIONS = [
  { value: 'count', label: 'Most emails' },
  { value: 'latest', label: 'Latest' },
  { value: 'size', label: 'Largest' },
]

// Grouped by sender, from PostgreSQL. Only updated when you click Sync
// (and by actions taken in the app).
export function SendersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const account = useCurrentAccount()

  const [groupBy, setGroupBy] = useState<SendersQuery['groupBy']>('email')
  const [sort, setSort] = useState<SendersQuery['sort']>('count')
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [groupBy, sort, debouncedSearch])

  const { data: sync } = useSyncStatus(account?.id)
  const startSync = useStartSync(account?.id)
  const running = sync?.run?.status === 'RUNNING'
  const { data, isLoading, isFetching } = useSenders(account?.id, { groupBy, sort, search: debouncedSearch, page })

  // When a sync finishes, reload the senders and report failures.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running && sync?.run) {
      void qc.invalidateQueries({ queryKey: ['senders', account?.id] })
      if (sync.run.status === 'FAILED') notifications.show({ color: 'red', message: sync.run.error ?? 'Sync failed' })
      else notifications.show({ message: 'Sync finished', autoClose: 2500 })
    }
    wasRunning.current = running
  }, [running, sync, qc, account?.id])

  const runSync = (full: boolean) =>
    startSync.mutate(full, { onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }) })

  const neverSynced = !!sync && !sync.lastSyncedAt && !running
  const totalPages = data ? Math.max(1, Math.ceil(data.totalGroups / data.pageSize)) : 1
  const view = (g: SenderGroup) => navigate(`/search?q=${encodeURIComponent(`from:${g.key}`)}`)

  return (
    <>
      <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm">
          <Title order={3}>Senders</Title>
          {isFetching && !isLoading && <Loader size="xs" />}
        </Group>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {running
              ? 'Syncing…'
              : sync?.lastSyncedAt
                ? `Last synced ${formatRelative(sync.lastSyncedAt)}`
                : 'Never synced'}
          </Text>
          <Group gap={0} wrap="nowrap">
            <Button
              leftSection={<IconRefresh size={16} />}
              loading={running || startSync.isPending}
              onClick={() => runSync(false)}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            >
              Sync
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  size={36}
                  disabled={running}
                  aria-label="More sync options"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}
                >
                  <IconChevronDown size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => runSync(true)}>Run a full sync</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Group>

      {running && sync?.run && (
        <Paper withBorder radius="md" p="sm" mb="md">
          <Group justify="space-between" mb={6}>
            <Text size="sm">
              {sync.run.type === 'FULL' ? 'Copying your email metadata…' : 'Fetching changes since the last sync…'}
            </Text>
            <Text size="sm" c="dimmed">
              {sync.run.total
                ? `${sync.run.processed.toLocaleString()} / ${sync.run.total.toLocaleString()}`
                : 'Listing emails…'}
            </Text>
          </Group>
          <Progress
            value={sync.run.total ? (sync.run.processed / sync.run.total) * 100 : 100}
            animated={!sync.run.total}
            size="sm"
          />
        </Paper>
      )}

      {sync?.run?.status === 'FAILED' && !running && (
        <Alert color="red" mb="md">
          The last sync didn't finish: {sync.run.error}
        </Alert>
      )}

      {neverSynced ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="xs">
            <IconUsers size={32} />
            <Text fw={500}>Sync your mailbox to see your senders</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Sync copies your email metadata (sender, subject, date — never the content) so emails can be grouped
              by sender. The first sync can take a few minutes on a big mailbox.
            </Text>
            <Button mt="sm" leftSection={<IconRefresh size={16} />} onClick={() => runSync(false)} loading={startSync.isPending}>
              Sync now
            </Button>
          </Stack>
        </Paper>
      ) : (
        <>
          <Group mb="sm" gap="sm">
            <SegmentedControl
              size="xs"
              value={groupBy}
              onChange={(v) => setGroupBy(v as SendersQuery['groupBy'])}
              data={[
                { value: 'email', label: 'By email' },
                { value: 'domain', label: 'By domain' },
              ]}
            />
            <Select
              size="xs"
              w={140}
              data={SORT_OPTIONS}
              value={sort}
              onChange={(v) => v && setSort(v as SendersQuery['sort'])}
              allowDeselect={false}
            />
            <TextInput
              size="xs"
              w={220}
              placeholder={groupBy === 'email' ? 'Find a sender' : 'Find a domain'}
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </Group>

          <Paper withBorder radius="md">
            {isLoading ? (
              <Center p="xl">
                <Loader />
              </Center>
            ) : !data?.senders.length ? (
              <Text c="dimmed" ta="center" p="xl">
                {debouncedSearch ? 'No senders match this search.' : 'No emails synced yet.'}
              </Text>
            ) : (
              <Table verticalSpacing={8} highlightOnHover style={{ tableLayout: 'fixed' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{groupBy === 'email' ? 'Sender' : 'Domain'}</Table.Th>
                    <Table.Th w={90} ta="right">Emails</Table.Th>
                    <Table.Th w={80} ta="right">Unread</Table.Th>
                    <Table.Th w={90} ta="right">Latest</Table.Th>
                    <Table.Th w={90} ta="right">Size</Table.Th>
                    <Table.Th w={170} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.senders.map((g) => (
                    <Table.Tr key={g.key}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar name={g.name ?? g.key} color="initials" size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>
                              {groupBy === 'email' ? (g.name ?? g.key) : g.key}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {groupBy === 'email' ? g.key : `${g.senders} sender${g.senders === 1 ? '' : 's'}`}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={500}>
                          {g.total.toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">
                          {g.unread.toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">
                          {formatListDate(g.latest)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">
                          {formatBytes(g.sizeBytes)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} justify="flex-end" wrap="nowrap">
                          <Button size="xs" variant="default" onClick={() => view(g)}>
                            View
                          </Button>
                          <Button size="xs" variant="light" onClick={() => openOrganizeSender(g)}>
                            Organize
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </>
      )}
    </>
  )
}
