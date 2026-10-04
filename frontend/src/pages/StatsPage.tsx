import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar, Center, Group, Loader, Paper, SimpleGrid, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { IconChartBar } from '@tabler/icons-react'
import { useCurrentAccount, useStats } from '../api/hooks.ts'
import type { MailCategory } from '../utils/mailCategory.ts'
import { SyncFirst } from '../components/SyncFirst.tsx'
import { formatBytes, formatRelative } from '../utils/format.ts'
import { hourLabel, monthLabel, peak, weekdayLabel } from '../utils/statsLabels.ts'

const CATEGORY_COLORS: Record<MailCategory, string> = {
  Primary: 'blue.6',
  Promotions: 'orange.6',
  Social: 'grape.6',
}

const SERIES = [{ name: 'count', label: 'Emails', color: 'blue.6' }]

function Stat({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={600} data-testid={testId}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  )
}

function Card({ title, subtitle, children, testId }: { title: string; subtitle?: string; children: ReactNode; testId: string }) {
  return (
    <Paper withBorder radius="md" p="md" data-testid={testId}>
      <Text fw={500}>{title}</Text>
      {subtitle && (
        <Text size="xs" c="dimmed">
          {subtitle}
        </Text>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </Paper>
  )
}

// Overview of the synced mailbox (Trash and Spam left out). Times are in the browser's zone.
export function StatsPage() {
  const navigate = useNavigate()
  const account = useCurrentAccount()
  const { data, isLoading, isFetching } = useStats(account?.id)

  if (isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    )
  }
  if (!data?.lastSyncedAt) return <SyncFirst icon={IconChartBar} title="Sync your mailbox to see its stats" />

  const { totals } = data
  const months = data.byMonth.map((p) => ({ label: monthLabel(p.key), count: p.count }))
  const hours = data.byHour.map((p) => ({ label: hourLabel(p.key), count: p.count }))
  const weekdays = data.byWeekday.map((p) => ({ label: weekdayLabel(p.key), count: p.count }))
  const busiestHour = peak(data.byHour)
  const busiestDay = peak(data.byWeekday)
  const unreadShare = totals.messages ? Math.round((totals.unread / totals.messages) * 100) : 0
  const topMax = data.topSenders[0]?.count ?? 0

  return (
    <>
      <Group mb="md" gap="sm">
        <Title order={3}>Stats</Title>
        {isFetching && <Loader size="xs" />}
        <Text size="sm" c="dimmed" ml="auto">
          Last synced {formatRelative(data.lastSyncedAt)}
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <Stat label="Emails" value={totals.messages.toLocaleString()} hint="Not counting Trash and Spam" testId="stats-total" />
        <Stat label="Unread" value={totals.unread.toLocaleString()} hint={`${unreadShare}% of all emails`} testId="stats-unread" />
        <Stat label="Senders" value={totals.senders.toLocaleString()} hint="Different addresses" testId="stats-senders" />
        <Stat label="Size" value={formatBytes(totals.sizeBytes)} hint="Including attachments" testId="stats-size" />
      </SimpleGrid>

      <Stack gap="md">
        <Card title="Emails per month" subtitle="The last 12 months" testId="stats-by-month">
          <BarChart h={220} data={months} dataKey="label" series={SERIES} tickLine="none" gridAxis="y" />
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card
            title="Busiest hours"
            subtitle={busiestHour === null ? undefined : `Most email arrives around ${hourLabel(busiestHour)} (${data.timeZone})`}
            testId="stats-by-hour"
          >
            <BarChart h={200} data={hours} dataKey="label" series={SERIES} tickLine="none" gridAxis="y" />
          </Card>
          <Card
            title="Busiest weekdays"
            subtitle={busiestDay === null ? undefined : `${weekdayLabel(busiestDay)} gets the most email`}
            testId="stats-by-weekday"
          >
            <BarChart h={200} data={weekdays} dataKey="label" series={SERIES} tickLine="none" gridAxis="y" />
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card title="Categories" subtitle="Gmail's Primary, Promotions and Social tabs" testId="stats-categories">
            <Group gap="xl" wrap="nowrap">
              <DonutChart
                size={150}
                thickness={24}
                withTooltip
                tooltipDataSource="segment"
                data={data.categories.map((c) => ({ name: c.category, value: c.count, color: CATEGORY_COLORS[c.category] }))}
              />
              <Stack gap={6}>
                {data.categories.map((c) => (
                  <Group key={c.category} gap="xs" wrap="nowrap" data-testid="stats-category" data-category={c.category}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: `var(--mantine-color-${CATEGORY_COLORS[c.category].replace('.', '-')})`,
                      }}
                    />
                    <Text size="sm">
                      {c.category}: <b>{c.count.toLocaleString()}</b>{' '}
                      <Text span size="xs" c="dimmed">
                        ({c.unread.toLocaleString()} unread)
                      </Text>
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Group>
          </Card>

          <Card title="Top senders" subtitle="By number of emails" testId="stats-top-senders">
            <Stack gap={8}>
              {data.topSenders.map((s) => (
                <UnstyledButton
                  key={s.email}
                  data-testid="stats-top-sender"
                  data-key={s.email}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(`from:${s.email}`)}`)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar name={s.name ?? s.email} color="initials" size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text size="sm" truncate>
                          {s.name ?? s.email}
                        </Text>
                        <Text size="sm" fw={500}>
                          {s.count.toLocaleString()}
                        </Text>
                      </Group>
                      <div
                        style={{
                          height: 4,
                          marginTop: 4,
                          borderRadius: 2,
                          width: `${topMax ? (s.count / topMax) * 100 : 0}%`,
                          background: 'var(--mantine-color-blue-6)',
                        }}
                      />
                    </div>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </>
  )
}
