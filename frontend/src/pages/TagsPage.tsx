import { Link } from 'react-router'
import { ActionIcon, Anchor, Box, Button, Center, Group, Loader, Paper, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { IconPencil, IconPlus, IconTags, IconTrash } from '@tabler/icons-react'
import { useCurrentAccount, useLabelsWithCounts } from '../api/hooks.ts'
import { openTagForm } from '../features/tags/TagForm.tsx'
import { openDeleteTag } from '../features/tags/DeleteTagConfirm.tsx'

const count = (n?: number) => (n === undefined ? '—' : n.toLocaleString())

export function TagsPage() {
  const account = useCurrentAccount()
  const { data: labels, isLoading, isFetching } = useLabelsWithCounts(account?.id)
  // Sorted by full name, so sub-tags come right after their parent.
  const tags = (labels ?? []).filter((l) => l.type === 'USER')

  return (
    <>
      <Group mb="md" justify="space-between">
        <Group gap="xs">
          <Title order={3}>Manage tags</Title>
          {isFetching && !isLoading && <Loader size="xs" />}
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => openTagForm()} data-testid="tags-new">
          New tag
        </Button>
      </Group>

      <Paper withBorder radius="md">
        {isLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : tags.length === 0 ? (
          <Stack align="center" gap="xs" p="xl">
            <IconTags size={32} />
            <Text fw={500}>Create your first tag</Text>
            <Text size="sm" c="dimmed">
              Tags are Gmail labels. Use them to group emails, like Finance or Finance/Nubank.
            </Text>
          </Stack>
        ) : (
          <Table verticalSpacing={8} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tag</Table.Th>
                <Table.Th w={100} ta="right">
                  Emails
                </Table.Th>
                <Table.Th w={100} ta="right">
                  Unread
                </Table.Th>
                <Table.Th w={96} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tags.map((tag) => {
                const depth = tag.name.split('/').length - 1
                return (
                  <Table.Tr key={tag.providerLabelId} data-testid="tag-row" data-label-id={tag.providerLabelId}>
                    <Table.Td>
                      <Group gap={8} pl={depth * 20} wrap="nowrap">
                        <Box
                          w={10}
                          h={10}
                          style={{
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: tag.colorBg ?? 'var(--mantine-color-gray-5)',
                          }}
                        />
                        <Anchor component={Link} to={`/label/${tag.providerLabelId}`} size="sm" title={tag.name}>
                          {tag.name.split('/').pop()}
                        </Anchor>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm">{count(tag.messagesTotal)}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed">
                        {count(tag.messagesUnread)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" aria-label={`Edit ${tag.name}`} data-testid="tag-edit" onClick={() => openTagForm({ tag })}>
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Delete ${tag.name}`}
                            data-testid="tag-delete"
                            onClick={() => openDeleteTag(tag, tags)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  )
}
