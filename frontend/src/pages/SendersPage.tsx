import { useState } from 'react'
import { useNavigate } from 'react-router'
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
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconNote, IconPlayerStop, IconRefresh, IconSearch, IconUsers } from '@tabler/icons-react'
import { errorMessage } from '../api/client.ts'
import {
  useCancelSync,
  useCurrentAccount,
  useNotes,
  useSenders,
  useStartSync,
  useSyncStatus,
  type SendersQuery,
} from '../api/hooks.ts'
import type { SenderGroup } from '../api/types.ts'
import { formatBytes, formatListDate, formatRelative } from '../utils/format.ts'
import { openOrganizeSender } from '../features/senders/OrganizeSenderForm.tsx'
import { UnsubscribeMenu } from '../features/senders/UnsubscribeMenu.tsx'
import { openSenderNote } from '../features/notes/NoteEditor.tsx'

const SORT_OPTIONS = [
  { value: 'count', label: 'Most emails' },
  { value: 'latest', label: 'Latest' },
  { value: 'size', label: 'Largest' },
]

// Grouped by sender, from PostgreSQL. Only updated when you click Sync
// (and by actions taken in the app).
export function SendersPage() {
  const navigate = useNavigate()
  const account = useCurrentAccount()

  const [groupBy, setGroupBy] = useState<SendersQuery['groupBy']>('email')
  const [sort, setSort] = useState<SendersQuery['sort']>('count')
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  const [unsubscribable, setUnsubscribable] = useState(false)

  const { data: sync } = useSyncStatus(account?.id)
  const startSync = useStartSync(account?.id)
  const cancelSync = useCancelSync(account?.id)
  const running = sync?.run?.status === 'RUNNING'
  const stopping = running && !!sync?.run?.cancelRequested
  const { data, isLoading, isFetching } = useSenders(account?.id, {
    groupBy,
    sort,
    search: debouncedSearch,
    page,
    unsubscribable,
  })

  // The senders list reloads by itself (useSenders keys on lastSyncedAt); this only reports the result.
  const runSync = (full: boolean) =>
    startSync.mutate(full, {
      onSuccess: (run) => {
        if (run?.status === 'FAILED') notifications.show({ color: 'red', message: run.error ?? 'Sync failed' })
        else if (run?.status === 'CANCELLED') notifications.show({ message: 'Sync stopped', autoClose: 2500 })
        else notifications.show({ message: 'Sync finished', autoClose: 2500 })
      },
      onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
    })

  const stopSync = () =>
    cancelSync.mutate(undefined, {
      onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
    })

  // Any filter change goes back to the first page.
  const changeFilter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPage(1)
  }

  // Notes are per sender address, so they show in the "By email" view.
  const { data: notes } = useNotes(account?.id, 'SENDER', groupBy === 'email' ? (data?.senders.map((g) => g.key) ?? []) : [])

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
          <Text size="sm" c="dimmed" data-testid="sync-status">
            {stopping
              ? 'Stopping…'
              : running
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
              data-testid="sync-button"
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
                  data-testid="sync-options"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}
                >
                  <IconChevronDown size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => runSync(true)} data-testid="sync-full">Run a full sync</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Group>

      {running && sync?.run && (
        <Paper withBorder radius="md" p="sm" mb="md">
          <Group justify="space-between" mb={6} wrap="nowrap">
            <Text size="sm">
              {stopping
                ? 'Stopping after the current batch…'
                : sync.run.type === 'FULL'
                  ? 'Copying your email metadata…'
                  : 'Fetching changes since the last sync…'}
            </Text>
            <Group gap="sm" wrap="nowrap">
              <Text size="sm" c="dimmed">
                {sync.run.total
                  ? `${sync.run.processed.toLocaleString()} / ${sync.run.total.toLocaleString()}`
                  : 'Listing emails…'}
              </Text>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                leftSection={<IconPlayerStop size={12} />}
                loading={cancelSync.isPending}
                disabled={stopping}
                onClick={stopSync}
                data-testid="sync-stop"
              >
                {stopping ? 'Stopping' : 'Stop'}
              </Button>
            </Group>
          </Group>
          <Progress
            value={sync.run.total ? (sync.run.processed / sync.run.total) * 100 : 100}
            animated={!sync.run.total}
            size="sm"
          />
        </Paper>
      )}

      {sync?.run?.status === 'CANCELLED' && (
        <Alert color="gray" mb="md" data-testid="sync-stopped">
          The last sync was stopped, so some emails may be missing or out of date here. Click Sync to finish it.
        </Alert>
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
            <Button mt="sm" leftSection={<IconRefresh size={16} />} onClick={() => runSync(false)} loading={startSync.isPending} data-testid="sync-now">
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
              data-testid="senders-group-by"
              onChange={(v) => changeFilter(setGroupBy)(v as SendersQuery['groupBy'])}
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
              onChange={(v) => v && changeFilter(setSort)(v as SendersQuery['sort'])}
              allowDeselect={false}
            />
            <TextInput
              size="xs"
              w={220}
              placeholder={groupBy === 'email' ? 'Find a sender' : 'Find a domain'}
              data-testid="senders-search"
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => changeFilter(setSearch)(e.currentTarget.value)}
            />
            <Switch
              size="sm"
              label="Can unsubscribe"
              checked={unsubscribable}
              onChange={(e) => changeFilter(setUnsubscribable)(e.currentTarget.checked)}
              data-testid="senders-unsubscribable"
            />
          </Group>

          <Paper withBorder radius="md">
            {isLoading ? (
              <Center p="xl">
                <Loader />
              </Center>
            ) : !data?.senders.length ? (
              <Text c="dimmed" ta="center" p="xl">
                {debouncedSearch || unsubscribable ? 'No senders match these filters.' : 'No emails synced yet.'}
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
                    <Table.Th w={320} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.senders.map((g) => (
                    <Table.Tr key={g.key} data-testid="sender-row" data-key={g.key}>
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
                            {notes?.has(g.key) && (
                              <Text size="xs" c="yellow.7" fs="italic" truncate title={notes.get(g.key)!.body} data-testid="sender-note-text">
                                {notes.get(g.key)!.body}
                              </Text>
                            )}
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
                          {groupBy === 'email' && (
                            <ActionIcon
                              variant={notes?.has(g.key) ? 'light' : 'subtle'}
                              color={notes?.has(g.key) ? 'yellow' : 'gray'}
                              aria-label="Note on this sender"
                              onClick={() => openSenderNote(g.key)}
                              data-testid="sender-note"
                            >
                              <IconNote size={16} />
                            </ActionIcon>
                          )}
                          <UnsubscribeMenu group={g} />
                          <Button size="xs" variant="default" data-testid="sender-view" onClick={() => view(g)}>
                            View
                          </Button>
                          <Button size="xs" variant="light" data-testid="sender-organize" onClick={() => openOrganizeSender(g)}>
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
