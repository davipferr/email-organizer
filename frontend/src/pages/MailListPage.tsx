import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ActionIcon, Alert, Button, Center, Checkbox, Group, Loader, Paper, Table, Text, Title, Tooltip } from '@mantine/core'
import { IconBookmark, IconBookmarkFilled, IconChevronLeft, IconChevronRight, IconNote, IconRefresh } from '@tabler/icons-react'
import { useCurrentAccount, useLabels, useMessages, useNotes, useSavedSearches } from '../api/hooks.ts'
import type { MailLabel, MailMessageSummary } from '../api/types.ts'
import { formatListDate, senderName } from '../utils/format.ts'
import { mailCategory } from '../utils/mailCategory.ts'
import { CategoryBadge } from '../components/CategoryBadge.tsx'
import { LabelBadge } from '../components/LabelBadge.tsx'
import { MessageDrawer } from '../components/MessageDrawer.tsx'
import { MessageActionsBar } from '../features/messages/MessageActionsBar.tsx'
import { useMessageActions } from '../features/messages/useMessageActions.tsx'
import { openSavedSearchForm } from '../features/saved-searches/SavedSearchForm.tsx'

const SYSTEM_TITLES: Record<string, string> = { INBOX: 'Inbox', STARRED: 'Starred', SENT: 'Sent', TRASH: 'Trash' }

// Inbox, a label, or search results — all live from Gmail.
export function MailListPage() {
  const { labelId: routeLabelId } = useParams()
  const [params] = useSearchParams()
  const q = params.get('q') ?? undefined
  const labelId = q ? undefined : (routeLabelId ?? 'INBOX')
  // A new key resets paging, selection and the open email when the folder or search changes.
  return <MailList key={`${labelId}|${q}`} labelId={labelId} q={q} />
}

function MailList({ labelId, q }: { labelId?: string; q?: string }) {
  const account = useCurrentAccount()
  const actions = useMessageActions(account?.id)
  const { data: labels } = useLabels(account?.id)
  const labelsById = useMemo(
    () => new Map<string, MailLabel>((labels ?? []).map((l) => [l.providerLabelId, l])),
    [labels],
  )
  const userLabels = useMemo(() => (labels ?? []).filter((l) => l.type === 'USER'), [labels])

  // Gmail pages forward only, so keep the tokens of the pages already visited.
  const [pageTokens, setPageTokens] = useState<(string | undefined)[]>([undefined])
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const pageIndex = pageTokens.length - 1
  const { data, isLoading, isError, isFetching, refetch } = useMessages(account?.id, {
    labelId,
    q,
    pageToken: pageTokens[pageIndex],
  })

  const messages = data?.messages ?? []
  const { data: notes } = useNotes(account?.id, 'EMAIL', messages.map((m) => m.providerMessageId))
  const { data: savedSearches } = useSavedSearches(account?.id)
  const savedSearch = q ? savedSearches?.find((s) => s.query === q) : undefined
  const selectedMessages = messages.filter((m) => selected.has(m.providerMessageId))
  const allSelected = messages.length > 0 && selectedMessages.length === messages.length
  const title = q
    ? `Search: ${q}`
    : (SYSTEM_TITLES[labelId!] ?? labelsById.get(labelId!)?.name ?? labelId)
  const first = pageIndex * 50 + 1

  const changePage = (tokens: (string | undefined)[]) => {
    setSelected(new Set())
    setPageTokens(tokens)
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const open = (m: MailMessageSummary) => {
    setOpenId(m.providerMessageId)
    if (m.isUnread) void actions.markRead([m.providerMessageId], true, { silent: true })
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Title order={3} data-testid="mail-list-title" style={{ overflowWrap: 'anywhere' }}>
            {savedSearch ? savedSearch.name : title}
          </Title>
          {q && (
            <Button
              size="xs"
              variant={savedSearch ? 'light' : 'default'}
              leftSection={savedSearch ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />}
              disabled={!!savedSearch}
              onClick={() => openSavedSearchForm(q)}
              data-testid="save-search"
            >
              {savedSearch ? 'Saved' : 'Save search'}
            </Button>
          )}
        </Group>
        <Group gap="xs">
          {(isFetching || actions.busy) && <Loader size="xs" />}
          <Text size="sm" c="dimmed">
            {messages.length ? `${first}–${first + messages.length - 1}` : ''}
          </Text>
          <ActionIcon variant="default" aria-label="Refresh" data-testid="mail-refresh" onClick={() => refetch()}>
            <IconRefresh size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Previous page"
            data-testid="page-prev"
            disabled={pageIndex === 0}
            onClick={() => changePage(pageTokens.slice(0, -1))}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Next page"
            data-testid="page-next"
            disabled={!data?.nextPageToken}
            onClick={() => changePage([...pageTokens, data!.nextPageToken])}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {isError && <Alert color="red" mb="md">Couldn't load your emails. Try again.</Alert>}

      <Paper withBorder radius="md">
        <Group px="sm" py={8} gap="sm" mih={46} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Checkbox
            aria-label="Select all"
            data-testid="select-all"
            checked={allSelected}
            indeterminate={selectedMessages.length > 0 && !allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(messages.map((m) => m.providerMessageId)))
            }
          />
          {selectedMessages.length > 0 ? (
            <>
              <Text size="sm" fw={500}>
                {selectedMessages.length} selected
              </Text>
              <MessageActionsBar
                messages={selectedMessages}
                viewLabelId={labelId}
                userLabels={userLabels}
                actions={actions}
                onRemoved={() => setSelected(new Set())}
              />
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Select emails to tag, move or trash them
            </Text>
          )}
        </Group>

        {isLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : messages.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl" data-testid="mail-empty">
            {q ? 'No emails match this search.' : 'No emails here.'}
          </Text>
        ) : (
          <Table highlightOnHover verticalSpacing={8} style={{ tableLayout: 'fixed' }}>
            <Table.Tbody>
              {messages.map((m) => {
                const fw = m.isUnread ? 600 : 400
                const isSelected = selected.has(m.providerMessageId)
                const rowLabels = m.labelIds
                  .map((id) => labelsById.get(id))
                  .filter((l): l is MailLabel => l?.type === 'USER')
                return (
                  <Table.Tr
                    key={m.providerMessageId}
                    data-testid="mail-row"
                    data-message-id={m.providerMessageId}
                    data-unread={m.isUnread || undefined}
                    onClick={() => open(m)}
                    bg={isSelected ? 'var(--mantine-primary-color-light)' : undefined}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td w={44} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label="Select email"
                        data-testid="mail-row-checkbox"
                        checked={isSelected}
                        onChange={() => toggle(m.providerMessageId)}
                      />
                    </Table.Td>
                    <Table.Td w={200}>
                      <Text size="sm" fw={fw} truncate title={m.from.email}>
                        {senderName(m.from)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {notes?.has(m.providerMessageId) && (
                          <Tooltip label={notes.get(m.providerMessageId)!.body} multiline maw={320} openDelay={300}>
                            <IconNote size={16} color="var(--mantine-color-yellow-6)" style={{ flexShrink: 0 }} data-testid="mail-row-note" />
                          </Tooltip>
                        )}
                        {labelId === 'INBOX' && <CategoryBadge category={mailCategory(m.labelIds)} />}
                        {rowLabels.map((l) => (
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

      <MessageDrawer
        accountId={account?.id}
        messageId={openId}
        labelsById={labelsById}
        userLabels={userLabels}
        viewLabelId={labelId}
        actions={actions}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
