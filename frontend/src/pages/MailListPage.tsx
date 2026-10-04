import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ActionIcon, Alert, Center, Group, Loader, Paper, Table, Text, Title } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react'
import { useCurrentAccount, useLabels, useMessages } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'
import { formatListDate, senderName } from '../utils/format.ts'
import { LabelBadge } from '../components/LabelBadge.tsx'
import { MessageDrawer } from '../components/MessageDrawer.tsx'

// Inbox, a label, or search results — all live from Gmail.
export function MailListPage() {
  const { labelId: routeLabelId } = useParams()
  const [params] = useSearchParams()
  const q = params.get('q') ?? undefined
  const labelId = q ? undefined : (routeLabelId ?? 'INBOX')
  // A new key resets paging and the open email when the folder or search changes.
  return <MailList key={`${labelId}|${q}`} labelId={labelId} q={q} />
}

function MailList({ labelId, q }: { labelId?: string; q?: string }) {
  const account = useCurrentAccount()
  const { data: labels } = useLabels(account?.id)
  const labelsById = useMemo(
    () => new Map<string, MailLabel>((labels ?? []).map((l) => [l.providerLabelId, l])),
    [labels],
  )

  // Gmail pages forward only, so keep the tokens of the pages already visited.
  const [pageTokens, setPageTokens] = useState<(string | undefined)[]>([undefined])
  const [openId, setOpenId] = useState<string | null>(null)

  const pageIndex = pageTokens.length - 1
  const { data, isLoading, isError, isFetching, refetch } = useMessages(account?.id, {
    labelId,
    q,
    pageToken: pageTokens[pageIndex],
  })

  const title = q ? `Search: ${q}` : labelId === 'INBOX' ? 'Inbox' : (labelsById.get(labelId!)?.name ?? labelId)
  const messages = data?.messages ?? []
  const from = pageIndex * 50 + (messages.length ? 1 : 0)

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3}>{title}</Title>
        <Group gap="xs">
          {isFetching && <Loader size="xs" />}
          <Text size="sm" c="dimmed">
            {messages.length ? `${from}–${from + messages.length - 1}` : ''}
          </Text>
          <ActionIcon variant="default" aria-label="Refresh" onClick={() => refetch()}>
            <IconRefresh size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Previous page"
            disabled={pageIndex === 0}
            onClick={() => setPageTokens((t) => t.slice(0, -1))}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Next page"
            disabled={!data?.nextPageToken}
            onClick={() => setPageTokens((t) => [...t, data!.nextPageToken])}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {isError && <Alert color="red">Couldn't load your emails. Try again.</Alert>}

      <Paper withBorder radius="md">
        {isLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : messages.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl">
            {q ? 'No emails match this search.' : 'No emails here.'}
          </Text>
        ) : (
          <Table highlightOnHover verticalSpacing={8} style={{ tableLayout: 'fixed' }}>
            <Table.Tbody>
              {messages.map((m) => {
                const fw = m.isUnread ? 600 : 400
                const userLabels = m.labelIds
                  .map((id) => labelsById.get(id))
                  .filter((l): l is MailLabel => l?.type === 'USER')
                return (
                  <Table.Tr key={m.providerMessageId} onClick={() => setOpenId(m.providerMessageId)} style={{ cursor: 'pointer' }}>
                    <Table.Td w={200}>
                      <Text size="sm" fw={fw} truncate title={m.from.email}>
                        {senderName(m.from)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {userLabels.map((l) => (
                          <LabelBadge key={l.providerLabelId} label={l} />
                        ))}
                        <Text size="sm" truncate>
                          <Text span fw={fw}>
                            {m.subject ?? '(no subject)'}
                          </Text>
                          <Text span c="dimmed">
                            {m.snippet ? ` — ${m.snippet}` : ''}
                          </Text>
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td w={80} ta="right">
                      <Text size="xs" fw={fw} c={m.isUnread ? undefined : 'dimmed'}>
                        {formatListDate(m.date)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <MessageDrawer accountId={account?.id} messageId={openId} labelsById={labelsById} onClose={() => setOpenId(null)} />
    </>
  )
}
