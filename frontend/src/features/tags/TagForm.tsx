import { useState } from 'react'
import { Button, CheckIcon, ColorSwatch, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useCurrentAccount, useLabels, useSaveLabel } from '../../api/hooks.ts'
import { errorMessage } from '../../api/client.ts'
import type { MailLabel } from '../../api/types.ts'
import { TAG_COLORS } from '../../utils/tagColors.ts'

const MODAL_ID = 'tag-form'

interface Props {
  tag?: MailLabel // editing when set
  onSaved?: (tag: MailLabel) => void
}

function TagForm({ tag, onSaved }: Props) {
  const account = useCurrentAccount()
  const { data: labels } = useLabels(account?.id)
  const save = useSaveLabel(account?.id)

  const parts = tag?.name.split('/') ?? []
  const [name, setName] = useState(parts.pop() ?? '')
  const [parent, setParent] = useState<string | null>(parts.length ? parts.join('/') : null)
  const [color, setColor] = useState(TAG_COLORS.find((c) => c.bg === tag?.colorBg) ?? null)
  const [error, setError] = useState<string | null>(null)

  // A tag can't be nested under itself or one of its own sub-tags.
  const parentOptions = (labels ?? [])
    .filter((l) => l.type === 'USER')
    .map((l) => l.name)
    .filter((n) => !tag || (n !== tag.name && !n.startsWith(`${tag.name}/`)))

  const submit = async () => {
    const leaf = name.trim()
    if (!leaf) return setError('Enter a name')
    if (leaf.includes('/')) return setError('Use the Parent field to nest tags')
    try {
      const saved = await save.mutateAsync({
        id: tag?.providerLabelId,
        input: {
          name: parent ? `${parent}/${leaf}` : leaf,
          ...(color ? { colorBg: color.bg, colorText: color.text } : {}),
        },
      })
      modals.close(MODAL_ID)
      notifications.show({ message: tag ? 'Tag saved' : `Tag ${saved.name} created`, autoClose: 2500 })
      onSaved?.(saved)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Stack>
      <TextInput
        label="Name"
        placeholder="Nubank"
        value={name}
        onChange={(e) => {
          setName(e.currentTarget.value)
          setError(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        error={error}
        data-autofocus
        data-testid="tag-form-name"
      />
      <Select
        label="Nest under"
        data-testid="tag-form-parent"
        placeholder="No parent"
        data={parentOptions}
        value={parent}
        onChange={setParent}
        searchable
        clearable
      />
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Color
        </Text>
        <Group gap={8}>
          {!tag?.colorBg && (
            <Tooltip label="No color">
              <ColorSwatch
                component="button"
                type="button"
                color="transparent"
                withShadow={false}
                style={{ border: '1px dashed var(--mantine-color-gray-5)', cursor: 'pointer' }}
                onClick={() => setColor(null)}
                aria-label="No color"
              >
                {!color && <CheckIcon size={12} />}
              </ColorSwatch>
            </Tooltip>
          )}
          {TAG_COLORS.map((c) => (
            <ColorSwatch
              key={c.bg}
              component="button"
              type="button"
              color={c.bg}
              style={{ color: c.text, cursor: 'pointer' }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c.bg}`}
            >
              {color?.bg === c.bg && <CheckIcon size={12} />}
            </ColorSwatch>
          ))}
        </Group>
      </Stack>
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={() => modals.close(MODAL_ID)}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending} data-testid="tag-form-save">
          {tag ? 'Save' : 'Create tag'}
        </Button>
      </Group>
    </Stack>
  )
}

export function openTagForm(props: Props = {}) {
  modals.open({
    modalId: MODAL_ID,
    title: props.tag ? 'Edit tag' : 'New tag',
    children: <TagForm {...props} />,
  })
}
