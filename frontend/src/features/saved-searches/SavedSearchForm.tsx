import { useState } from 'react'
import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { errorMessage } from '../../api/client.ts'
import { useCurrentAccount, useDeleteSavedSearch, useSaveSearch } from '../../api/hooks.ts'
import type { SavedSearch } from '../../api/types.ts'

const MODAL_ID = 'saved-search-form'

// Saves the current search (or renames a saved one) under a name shown in the sidebar.
function SavedSearchForm({ query, existing }: { query: string; existing?: SavedSearch }) {
  const account = useCurrentAccount()
  const save = useSaveSearch(account?.id)
  const [name, setName] = useState(existing?.name ?? query)

  const submit = () => {
    if (!name.trim()) return
    save.mutate(
      { id: existing?.id, name: name.trim(), ...(existing ? {} : { query }) },
      {
        onSuccess: () => {
          modals.close(MODAL_ID)
          notifications.show({ message: existing ? 'Saved search renamed' : 'Search saved', autoClose: 2000 })
        },
        onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
      },
    )
  }

  return (
    <Stack>
      <TextInput
        label="Name"
        value={name}
        maxLength={100}
        data-autofocus
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        data-testid="saved-search-name"
      />
      <Text size="xs" c="dimmed">
        Search: <code>{existing?.query ?? query}</code>
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.close(MODAL_ID)}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending} disabled={!name.trim()} data-testid="saved-search-submit">
          Save
        </Button>
      </Group>
    </Stack>
  )
}

export function openSavedSearchForm(query: string, existing?: SavedSearch) {
  modals.open({
    modalId: MODAL_ID,
    title: existing ? 'Rename saved search' : 'Save this search',
    children: <SavedSearchForm query={query} existing={existing} />,
  })
}

function DeleteSavedSearch({ search }: { search: SavedSearch }) {
  const account = useCurrentAccount()
  const remove = useDeleteSavedSearch(account?.id)
  return (
    <Stack>
      <Text size="sm">
        Delete the saved search <b>{search.name}</b>? The emails it finds are not affected.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          data-testid="saved-search-delete-confirm"
          onClick={() =>
            remove.mutate(search.id, {
              onSuccess: () => modals.closeAll(),
              onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
            })
          }
        >
          Delete
        </Button>
      </Group>
    </Stack>
  )
}

export function openDeleteSavedSearch(search: SavedSearch) {
  modals.open({ title: 'Delete saved search', children: <DeleteSavedSearch search={search} /> })
}
