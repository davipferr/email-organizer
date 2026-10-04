import { useState, type ReactNode } from 'react'
import { Box, Button, Checkbox, Divider, Group, Popover, ScrollArea, Text, TextInput, UnstyledButton } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import type { MailLabel } from '../../api/types.ts'

export type PickState = 'checked' | 'indeterminate' | 'unchecked'

interface Props {
  target: ReactNode
  labels: MailLabel[]
  onPick: (label: MailLabel, state?: PickState) => void
  // Tag mode shows checkboxes; move mode is a plain list.
  stateOf?: (label: MailLabel) => PickState
  onCreate?: () => void
}

// Searchable list of tags, used by both "Tag" and "Move to".
export function LabelPicker({ target, labels, onPick, stateOf, onCreate }: Props) {
  const [opened, setOpened] = useState(false)
  const [filter, setFilter] = useState('')
  const visible = labels.filter((l) => l.name.toLowerCase().includes(filter.trim().toLowerCase()))

  const close = () => {
    setOpened(false)
    setFilter('')
  }

  return (
    <Popover opened={opened} onChange={(o) => (o ? setOpened(true) : close())} position="bottom-start" width={260} shadow="md">
      <Popover.Target>
        <Box onClick={() => (opened ? close() : setOpened(true))}>{target}</Box>
      </Popover.Target>
      <Popover.Dropdown p={6}>
        <TextInput
          size="xs"
          placeholder="Find a tag"
          leftSection={<IconSearch size={14} />}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          data-autofocus
          data-testid="label-picker-filter"
          mb={6}
        />
        <ScrollArea.Autosize mah={260}>
          {visible.length === 0 && (
            <Text size="xs" c="dimmed" p="xs">
              No tags found
            </Text>
          )}
          {visible.map((label) => {
            const state = stateOf?.(label)
            return (
              <UnstyledButton
                key={label.providerLabelId}
                w="100%"
                px={8}
                py={6}
                style={{ borderRadius: 4 }}
                className="label-picker-item"
                data-testid="label-picker-option"
                data-label-id={label.providerLabelId}
                onClick={() => {
                  onPick(label, state)
                  close()
                }}
              >
                <Group gap={8} wrap="nowrap">
                  {state && (
                    <Checkbox
                      size="xs"
                      readOnly
                      tabIndex={-1}
                      checked={state === 'checked'}
                      indeterminate={state === 'indeterminate'}
                    />
                  )}
                  <Box
                    w={8}
                    h={8}
                    style={{ borderRadius: '50%', flexShrink: 0, background: label.colorBg ?? 'var(--mantine-color-gray-5)' }}
                  />
                  <Text size="sm" truncate>
                    {label.name}
                  </Text>
                </Group>
              </UnstyledButton>
            )
          })}
        </ScrollArea.Autosize>
        {onCreate && (
          <>
            <Divider my={6} />
            <Button
              variant="subtle"
              size="xs"
              fullWidth
              justify="flex-start"
              data-testid="label-picker-new-tag"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                close()
                onCreate()
              }}
            >
              New tag
            </Button>
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}
