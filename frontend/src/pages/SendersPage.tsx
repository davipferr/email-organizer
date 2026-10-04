import { Button, Group, Paper, SegmentedControl, Select, Stack, Text, Title } from '@mantine/core'
import { IconRefresh, IconUsers } from '@tabler/icons-react'

// Grouped by sender, from PostgreSQL. Only updated when you click Sync.
// TODO: sync status polling + progress bar, senders table, bulk action modal.
export function SendersPage() {
  return (
    <>
      <Group mb="md" justify="space-between" wrap="wrap">
        <Group>
          <Title order={3}>Senders</Title>
          <SegmentedControl size="xs" data={['By email', 'By domain']} />
          <Select size="xs" w={140} data={['Most emails', 'Latest', 'Largest']} defaultValue="Most emails" />
        </Group>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            Never synced
          </Text>
          <Button leftSection={<IconRefresh size={16} />}>Sync</Button>
        </Group>
      </Group>
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="xs">
          <IconUsers size={32} />
          <Text fw={500}>Sync your mailbox to see your senders</Text>
          <Text size="sm" c="dimmed">
            Sync copies your email metadata (not the bodies) so emails can be grouped by sender.
          </Text>
        </Stack>
      </Paper>
    </>
  )
}
