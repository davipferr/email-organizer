import { useParams, useSearchParams } from 'react-router'
import { Button, Checkbox, Group, Paper, Text, Title } from '@mantine/core'
import { IconArchive, IconFolderShare, IconTag, IconTrash } from '@tabler/icons-react'

// Inbox, a label, or search results — all live from Gmail.
// TODO: list (TanStack Query + Virtual), selection, actions, reading drawer.
export function MailListPage() {
  const { labelId } = useParams()
  const [params] = useSearchParams()
  const q = params.get('q')
  const title = q ? `Search: ${q}` : labelId ? labelId : 'Inbox'

  return (
    <>
      <Title order={3} mb="md">
        {title}
      </Title>
      <Paper withBorder radius="md">
        <Group p="xs" gap="xs">
          <Checkbox aria-label="Select all" />
          <Button variant="default" size="xs" leftSection={<IconTag size={14} />}>
            Tag
          </Button>
          <Button variant="default" size="xs" leftSection={<IconFolderShare size={14} />}>
            Move
          </Button>
          <Button variant="default" size="xs" leftSection={<IconArchive size={14} />}>
            Archive
          </Button>
          <Button variant="default" size="xs" color="red" leftSection={<IconTrash size={14} />}>
            Trash
          </Button>
        </Group>
        <Text c="dimmed" ta="center" p="xl">
          Emails will appear here.
        </Text>
      </Paper>
    </>
  )
}
