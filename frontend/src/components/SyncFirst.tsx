import { Link } from 'react-router'
import { Button, Paper, Stack, Text } from '@mantine/core'
import type { Icon } from '@tabler/icons-react'

// Shown by pages built from the synced copy before the first sync has run.
export function SyncFirst({ icon: IconComponent, title }: { icon: Icon; title: string }) {
  return (
    <Paper withBorder radius="md" p="xl">
      <Stack align="center" gap="xs">
        <IconComponent size={32} />
        <Text fw={500}>{title}</Text>
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          This page is built from the copy of your email metadata that Sync makes. Run a sync from the Senders page first.
        </Text>
        <Button mt="sm" component={Link} to="/senders" data-testid="go-sync">
          Go to Senders
        </Button>
      </Stack>
    </Paper>
  )
}
