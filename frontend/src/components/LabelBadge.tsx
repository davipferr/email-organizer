import { Badge } from '@mantine/core'
import type { MailLabel } from '../api/types.ts'

export function LabelBadge({ label }: { label: MailLabel }) {
  const leaf = label.name.split('/').pop()
  return (
    <Badge
      size="sm"
      radius="sm"
      variant={label.colorBg ? 'filled' : 'light'}
      color={label.colorBg ?? 'gray'}
      style={label.colorText ? { color: label.colorText } : undefined}
      tt="none"
      title={label.name}
    >
      {leaf}
    </Badge>
  )
}
