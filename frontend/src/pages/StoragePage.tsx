import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Pagination,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconDatabase, IconTrash } from '@tabler/icons-react'
import { useCurrentAccount, useLabels, useSenders, useStorage } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'
import { MessageDrawer } from '../components/MessageDrawer.tsx'
import { SyncFirst } from '../components/SyncFirst.tsx'
import { useMessageActions } from '../features/messages/useMessageActions.tsx'
import { openOrganizeSender } from '../features/senders/OrganizeSenderForm.tsx'
import { formatBytes, formatListDate, formatRelative, senderName } from '../utils/format.ts'

const TOP_SENDERS = 8

// Where the space goes: the senders and single emails that take the most of it.
// Built from the synced copy (Trash and Spam left out).
export function StoragePage() {
  const account = useCurrentAccount()
  const actions = useMessageActions(account?.id)
  const { data: labels } = useLabels(account?.id)
  const labelsById = useMemo(
    () => new Map<string, MailLabel>((labels ?? []).map((l) => [l.providerLabelId, l])),
    [labels],
  )
  const userLabels = useMemo(() => (labels ?? []).filter((l) => l.type === 'USER'), [labels])

  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useStorage(account?.id, page)
  const { data: bySize } = useSenders(account?.id, { groupBy: 'email', sort: 'size', search: '', page: 1 })

  if (isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    )
  }
  if (!data?.lastSyncedAt) return <SyncFirst icon={IconDatabase} title="Sync your mailbox to see what uses space" />

  const messages = data.messages
  const selectedMessages = messages.filter((m) => selected.has(m.providerMessageId))
  const selectedIds = selectedMessages.map((m) => m.providerMessageId)
  const selectedBytes = selectedMessages.reduce((sum, m) => sum + m.sizeBytes, 0)
  const allSelected = messages.length > 0 && selectedIds.length === messages.length
  const pageBytes = messages.reduce((sum, m) => sum + m.sizeBytes, 0)
  const totalPages = Math.max(1, Math.ceil(data.totalMessages / data.pageSize))
  const topSenders = (bySize?.senders ?? []).slice(0, TOP_SENDERS)
  const share = (bytes: number) => (data.totalBytes ? (bytes / data.totalBytes) * 100 : 0)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const changePage = (p: number) => {
    setSelected(new Set())
    setPage(p)
  }
  const trashSelected = async () => {
    if (await actions.trash(selectedIds)) setSelected(new Set())
  }

  return (
    <>
      <Group mb="md" gap="sm">
        <Title order={3}>Storage</Title>
        {isFetching && <Loader size="xs" />}
        <Text size="sm" c="dimmed" ml="auto">
          Last synced {formatRelative(data.lastSyncedAt)}
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Paper withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Total size
          </Text>
          <Text size="xl" fw={600} data-testid="storage-total">
            {formatBytes(data.totalBytes)}
          </Text>
          <Text size="xs" c="dimmed">
            {data.totalMessages.toLocaleString()} emails, not counting Trash and Spam
          </Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Biggest {data.pageSize} emails
          </Text>
          <Text size="xl" fw={600}>
            {page === 1 ? formatBytes(pageBytes) : '—'}
          </Text>
          <Text size="xs" c="dimmed">
            {page === 1 ? `${share(pageBytes).toFixed(0)}% of the total` : 'Shown on the first page'}
          </Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Average email
          </Text>
          <Text size="xl" fw={600}>
            {formatBytes(data.totalMessages ? Math.round(data.totalBytes / data.totalMessages) : 0)}
          </Text>
          <Text size="xs" c="dimmed">
            Sizes include attachments
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md" mb="md">
        <Text fw={500} mb="sm">
          Senders using the most space
        </Text>
        <Stack gap="sm">
          {topSenders.map((g) => (
            <Group key={g.key} gap="sm" wrap="nowrap" data-testid="storage-sender" data-key={g.key}>
              <Avatar name={g.name ?? g.key} color="initials" size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm" truncate>
                    {g.name ?? g.key}{' '}
                    <Text span size="xs" c="dimmed">
                      {g.total.toLocaleString()} emails
                    </Text>
                  </Text>
                  <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                    {formatBytes(g.sizeBytes)}
                  </Text>
                </Group>
                <Progress value={share(g.sizeBytes)} size="sm" mt={4} />
              </div>
              <Button size="xs" variant="light" data-testid="storage-sender-organize" onClick={() => openOrganizeSender(g)}>
                Organize
              </Button>
            </Group>
          ))}
        </Stack>
      </Paper>

      <Group mb="xs" justify="space-between">
        <Text fw={500}>Biggest emails</Text>
        <Button
          size="xs"
          color="red"
          variant="light"
          leftSection={<IconTrash size={14} />}
          disabled={!selectedIds.length}
          loading={actions.busy}
          onClick={trashSelected}
          data-testid="storage-trash"
        >
          Move to Trash{selectedIds.length ? ` (${selectedIds.length}, ${formatBytes(selectedBytes)})` : ''}
        </Button>
      </Group>
      <Paper withBorder radius="md">
        {!messages.length ? (
          <Text c="dimmed" ta="center" p="xl">
            No emails synced yet.
          </Text>
        ) : (
          <Table verticalSpacing={6} highlightOnHover style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    size="xs"
                    aria-label="Select all"
                    checked={allSelected}
                    indeterminate={selectedIds.length > 0 && !allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(messages.map((m) => m.providerMessageId)))}
                    data-testid="storage-select-all"
                  />
                </Table.Th>
                <Table.Th w={200}>From</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th w={90} ta="right">Date</Table.Th>
                <Table.Th w={90} ta="right">Size</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {messages.map((m) => (
                <Table.Tr
                  key={m.providerMessageId}
                  data-testid="storage-row"
                  data-id={m.providerMessageId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setOpenId(m.providerMessageId)}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="xs"
                      aria-label="Select"
                      checked={selected.has(m.providerMessageId)}
                      onChange={() => toggle(m.providerMessageId)}
                      data-testid="storage-row-checkbox"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" truncate>
                      {senderName(m.from)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" truncate>
                      {m.subject ?? '(no subject)'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs" c="dimmed">
                      {formatListDate(m.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={500}>
                      {formatBytes(m.sizeBytes)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={changePage} size="sm" />
        </Group>
      )}

      <MessageDrawer
        accountId={account?.id}
        messageId={openId}
        labelsById={labelsById}
        userLabels={userLabels}
        actions={actions}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
