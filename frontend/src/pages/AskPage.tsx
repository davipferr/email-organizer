import { Fragment, useMemo, useState } from 'react'
import { Alert, Anchor, Button, Center, Chip, Group, Loader, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMessageQuestion, IconSend } from '@tabler/icons-react'
import { errorMessage } from '../api/client.ts'
import { useAsk, useAskStatus, useCurrentAccount, useLabels, useSyncStatus } from '../api/hooks.ts'
import type { AskAnswer, MailLabel } from '../api/types.ts'
import { MessageDrawer } from '../components/MessageDrawer.tsx'
import { SyncFirst } from '../components/SyncFirst.tsx'
import { useMessageActions } from '../features/messages/useMessageActions.tsx'
import { formatListDate } from '../utils/format.ts'

const EXAMPLES = [
  'How many unread emails do I have from LinkedIn?',
  'What did Ana Souza say about the trip?',
  'When was my last Nubank bill?',
  'Which newsletters do I get the most?',
]

interface Exchange {
  question: string
  answer?: AskAnswer
}

// Turns "text [[fake-0012]] more" into text with numbered links to the cited emails.
function AnswerText({ answer, onOpen }: { answer: AskAnswer; onOpen: (id: string) => void }) {
  const numbers = new Map(answer.sources.map((s, i) => [s.id, i + 1]))
  const parts = answer.answer.split(/(\[\[[^\]\s]+\]\])/g)
  return (
    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} data-testid="ask-answer">
      {parts.map((part, i) => {
        const id = /^\[\[([^\]\s]+)\]\]$/.exec(part)?.[1]
        if (!id) return <Fragment key={i}>{part}</Fragment>
        const n = numbers.get(id)
        return n ? (
          <Anchor key={i} component="button" size="xs" fw={600} onClick={() => onOpen(id)} data-testid="ask-citation">
            [{n}]
          </Anchor>
        ) : null
      })}
    </Text>
  )
}

// "Ask your mailbox": a question in plain language, answered by Claude from the synced
// emails (and the text of the ones it opens). Read-only: it never changes the mailbox.
export function AskPage() {
  const account = useCurrentAccount()
  const { data: status, isLoading } = useAskStatus(account?.id)
  const { data: sync } = useSyncStatus(account?.id)
  const ask = useAsk(account?.id)
  const actions = useMessageActions(account?.id)
  const { data: labels } = useLabels(account?.id)
  const labelsById = useMemo(
    () => new Map<string, MailLabel>((labels ?? []).map((l) => [l.providerLabelId, l])),
    [labels],
  )
  const userLabels = useMemo(() => (labels ?? []).filter((l) => l.type === 'USER'), [labels])

  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Exchange[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  if (isLoading || !sync) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    )
  }
  if (!status?.configured) {
    return (
      <>
        <Title order={3} mb="md">
          Ask your mailbox
        </Title>
        <Alert color="yellow" title="Not set up" data-testid="ask-not-configured">
          Add <code>ANTHROPIC_API_KEY</code> (from the Claude Platform, platform.claude.com → API keys) to <code>.env</code>{' '}
          and restart the backend.
        </Alert>
      </>
    )
  }
  if (!sync.lastSyncedAt) return <SyncFirst icon={IconMessageQuestion} title="Sync your mailbox before asking about it" />

  const submit = (text = question) => {
    const q = text.trim()
    if (q.length < 3 || ask.isPending) return
    setQuestion('')
    setHistory((h) => [...h, { question: q }])
    ask.mutate(q, {
      onSuccess: (answer) => setHistory((h) => h.map((e, i) => (i === h.length - 1 ? { ...e, answer } : e))),
      onError: (err) => {
        // Put the question back so it can be retried.
        setHistory((h) => h.slice(0, -1))
        setQuestion(q)
        notifications.show({ color: 'red', message: errorMessage(err) })
      },
    })
  }

  return (
    <>
      <Title order={3} mb={4}>
        Ask your mailbox
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Claude searches your synced emails and opens the ones it needs. Questions, matching emails' details and the text
        of opened emails are sent to Anthropic's API. Nothing in your mailbox is changed.
      </Text>

      <Stack gap="md" mb="md">
        {history.map((e, i) => (
          <Paper key={i} withBorder radius="md" p="md" data-testid="ask-exchange">
            <Text size="sm" fw={600} mb="xs">
              {e.question}
            </Text>
            {e.answer ? (
              <>
                <AnswerText answer={e.answer} onOpen={setOpenId} />
                {e.answer.sources.length > 0 && (
                  <Stack gap={2} mt="sm">
                    {e.answer.sources.map((s, n) => (
                      <Anchor
                        key={s.id}
                        component="button"
                        size="xs"
                        ta="left"
                        onClick={() => setOpenId(s.id)}
                        data-testid="ask-source"
                        data-id={s.id}
                      >
                        [{n + 1}] {s.subject ?? '(no subject)'} — {s.from} · {formatListDate(s.date)}
                      </Anchor>
                    ))}
                  </Stack>
                )}
              </>
            ) : (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed" data-testid="ask-thinking">
                  Searching your mailbox…
                </Text>
              </Group>
            )}
          </Paper>
        ))}
      </Stack>

      {history.length === 0 && (
        <Group gap="xs" mb="sm">
          {EXAMPLES.map((ex) => (
            <Chip key={ex} checked={false} size="xs" onClick={() => submit(ex)} data-testid="ask-example">
              {ex}
            </Chip>
          ))}
        </Group>
      )}

      <Group align="flex-end" gap="sm" wrap="nowrap">
        <Textarea
          flex={1}
          autosize
          minRows={1}
          maxRows={6}
          maxLength={2000}
          placeholder="e.g. When does my apartment lease end?"
          value={question}
          onChange={(e) => setQuestion(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          data-testid="ask-input"
        />
        <Button
          leftSection={<IconSend size={16} />}
          onClick={() => submit()}
          loading={ask.isPending}
          disabled={question.trim().length < 3}
          data-testid="ask-submit"
        >
          Ask
        </Button>
      </Group>

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
