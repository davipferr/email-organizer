import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ActionIcon, Avatar, Badge, Button, Center, Group, Loader, Pagination, Paper, Select, Table, Text, Title } from '@mantine/core'
import { IconEyeOff, IconNote } from '@tabler/icons-react'
import { useCurrentAccount, useIgnoredSenders } from '../api/hooks.ts'
import { SyncFirst } from '../components/SyncFirst.tsx'
import { openSenderNote } from '../features/notes/NoteEditor.tsx'
import { openOrganizeSender } from '../features/senders/OrganizeSenderForm.tsx'
import { UnsubscribeMenu } from '../features/senders/UnsubscribeMenu.tsx'
import { formatListDate, formatRelative } from '../utils/format.ts'

const STREAK_OPTIONS = ['3', '5', '10', '20'].map((v) => ({ value: v, label: `${v}+ unread in a row` }))

// "Who did I stop reading?": senders whose newest emails you keep leaving unread — the best
// candidates to unsubscribe from or clean up. Built from the synced copy.
export function IgnoredSendersPage() {
  const navigate = useNavigate()
  const account = useCurrentAccount()
  const [minStreak, setMinStreak] = useState(5)
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useIgnoredSenders(account?.id, minStreak, page)

  if (isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    )
  }
  if (!data?.lastSyncedAt) return <SyncFirst icon={IconEyeOff} title="Sync your mailbox to find the senders you stopped reading" />

  const totalPages = Math.max(1, Math.ceil(data.totalSenders / data.pageSize))

  return (
    <>
      <Group mb="xs" gap="sm">
        <Title order={3}>Stopped reading</Title>
        {isFetching && <Loader size="xs" />}
        <Text size="sm" c="dimmed" ml="auto">
          Last synced {formatRelative(data.lastSyncedAt)}
        </Text>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Senders whose newest emails you haven't opened. The streak counts their latest emails in a row that are still
        unread.
      </Text>

      <Group mb="sm">
        <Select
          size="xs"
          w={190}
          data={STREAK_OPTIONS}
          value={String(minStreak)}
          allowDeselect={false}
          onChange={(v) => {
            if (!v) return
            setMinStreak(Number(v))
            setPage(1)
          }}
          data-testid="ignored-min-streak"
        />
        <Text size="sm" c="dimmed" data-testid="ignored-count">
          {data.totalSenders.toLocaleString()} sender{data.totalSenders === 1 ? '' : 's'}
        </Text>
      </Group>

      <Paper withBorder radius="md">
        {!data.senders.length ? (
          <Text c="dimmed" ta="center" p="xl" data-testid="ignored-empty">
            No sender has {minStreak} or more unread emails in a row. Nice!
          </Text>
        ) : (
          <Table verticalSpacing={8} highlightOnHover style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sender</Table.Th>
                <Table.Th w={80} ta="right">Streak</Table.Th>
                <Table.Th w={90} ta="right">Last read</Table.Th>
                <Table.Th w={90} ta="right">Latest</Table.Th>
                <Table.Th w={330} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.senders.map((s) => (
                <Table.Tr key={s.key} data-testid="ignored-row" data-key={s.key} data-streak={s.streak}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Avatar name={s.name ?? s.key} color="initials" size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {s.name ?? s.key}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {s.key} · {s.unread.toLocaleString()} of {s.total.toLocaleString()} unread
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Badge color={s.streak === s.total ? 'red' : 'orange'} variant="light">
                      {s.streak === s.total ? `all ${s.streak}` : s.streak}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed">
                      {s.lastRead ? formatListDate(s.lastRead) : 'Never'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed">
                      {formatListDate(s.latest)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} justify="flex-end" wrap="nowrap">
                      <UnsubscribeMenu group={s} />
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Note on this sender"
                        onClick={() => openSenderNote(s.key)}
                        data-testid="ignored-note"
                      >
                        <IconNote size={16} />
                      </ActionIcon>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => navigate(`/search?q=${encodeURIComponent(`from:${s.key}`)}`)}
                        data-testid="ignored-view"
                      >
                        View
                      </Button>
                      <Button size="xs" variant="light" onClick={() => openOrganizeSender(s)} data-testid="ignored-organize">
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
  )
}
