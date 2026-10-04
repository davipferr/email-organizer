import { useMemo } from 'react'
import { Link } from 'react-router'
import DOMPurify from 'dompurify'
import { Anchor, Box, Center, Drawer, Group, Loader, Stack, Text } from '@mantine/core'
import { useMessage } from '../api/hooks.ts'
import type { MailLabel } from '../api/types.ts'
import { formatLongDate } from '../utils/format.ts'
import { LabelBadge } from './LabelBadge.tsx'

interface Props {
  accountId: string | undefined
  messageId: string | null
  labelsById: Map<string, MailLabel>
  onClose: () => void
}

// Email HTML is sanitized and rendered in a sandboxed iframe without scripts,
// so it can't run code or read the app's cookies. Links open in a new tab.
const HEAD = `<meta charset="utf-8"><base target="_blank">
<style>body{margin:0;padding:8px;font-family:system-ui,sans-serif;font-size:14px;color:#222;background:#fff;word-break:break-word}img{max-width:100%;height:auto}</style>`

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function emailDocument(html: string | undefined, text: string | undefined): string {
  if (html) {
    // WHOLE_DOCUMENT keeps the email's own <style> blocks from <head>.
    const clean = DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true })
    return `<!doctype html>${clean.replace('<head>', `<head>${HEAD}`)}`
  }
  return `<!doctype html><html><head>${HEAD}</head><body><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text ?? '')}</pre></body></html>`
}

export function MessageDrawer({ accountId, messageId, labelsById, onClose }: Props) {
  const { data: message, isLoading, isError } = useMessage(accountId, messageId)
  const srcDoc = useMemo(() => (message ? emailDocument(message.html, message.text) : ''), [message])
  const userLabels = (message?.labelIds ?? [])
    .map((id) => labelsById.get(id))
    .filter((l): l is MailLabel => l?.type === 'USER')

  return (
    <Drawer
      opened={!!messageId}
      onClose={onClose}
      position="right"
      size="xl"
      title={<Text fw={500} lineClamp={1}>{message?.subject ?? ' '}</Text>}
    >
      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}
      {isError && <Text c="red">Couldn't load this email. Try again.</Text>}
      {message && (
        <Stack gap="sm">
          <Stack gap={2}>
            <Group gap={6}>
              <Text fw={500}>{message.from.name ?? message.from.email}</Text>
              <Anchor component={Link} to={`/search?q=${encodeURIComponent(`from:${message.from.email}`)}`} size="sm">
                {message.from.email}
              </Anchor>
            </Group>
            <Text size="sm" c="dimmed">
              To {message.to.map((a) => a.name ?? a.email).join(', ') || '—'} · {formatLongDate(message.date)}
            </Text>
          </Stack>
          {userLabels.length > 0 && (
            <Group gap={4}>
              {userLabels.map((l) => (
                <LabelBadge key={l.providerLabelId} label={l} />
              ))}
            </Group>
          )}
          <Box
            component="iframe"
            title="Email content"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={srcDoc}
            style={{ width: '100%', height: 'calc(100vh - 220px)', border: 0, borderRadius: 8, background: '#fff' }}
          />
        </Stack>
      )}
    </Drawer>
  )
}
