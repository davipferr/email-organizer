import { Button, Group, Paper, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

// TODO: tags table with counts, color picker, rename, delete (asks about child tags).
export function TagsPage() {
  return (
    <>
      <Group mb="md" justify="space-between">
        <Title order={3}>Manage tags</Title>
        <Button leftSection={<IconPlus size={16} />}>New tag</Button>
      </Group>
      <Paper withBorder radius="md" p="xl">
        <Text c="dimmed" ta="center">
          Your tags will appear here.
        </Text>
      </Paper>
    </>
  )
}
