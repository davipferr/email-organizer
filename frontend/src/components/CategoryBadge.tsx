import { Badge, Tooltip } from '@mantine/core'
import { CATEGORY_DESCRIPTIONS, type MailCategory } from '../utils/mailCategory.ts'

const COLORS: Record<MailCategory, string> = { Primary: 'blue', Promotions: 'green', Social: 'grape' }

export function CategoryBadge({ category }: { category: MailCategory }) {
  return (
    <Tooltip label={CATEGORY_DESCRIPTIONS[category]} withArrow openDelay={300}>
      <Badge
        size="sm"
        radius="sm"
        variant="outline"
        color={COLORS[category]}
        tt="none"
        style={{ flexShrink: 0 }}
        data-testid="mail-row-category"
        data-category={category}
      >
        {category}
      </Badge>
    </Tooltip>
  )
}
