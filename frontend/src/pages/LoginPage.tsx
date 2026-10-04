import { Button, Center, Paper, Stack, Text, Title } from '@mantine/core'
import { IconBrandGoogle, IconMail } from '@tabler/icons-react'

export function LoginPage() {
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder radius="lg" p="xl" maw={400} w="100%">
        <Stack align="center" gap="md">
          <IconMail size={36} />
          <Title order={3}>Mail organizer</Title>
          <Text c="dimmed" ta="center" size="sm">
            Organize your inbox by sender, tag and search — fast.
          </Text>
          <Button
            component="a"
            href="/api/auth/google"
            leftSection={<IconBrandGoogle size={18} />}
            fullWidth
            size="md"
          >
            Continue with Google
          </Button>
          <Text c="dimmed" ta="center" size="xs">
            This is a private app, so Google shows an “unverified app” warning. Choose Advanced → Go to
            app to continue.
          </Text>
        </Stack>
      </Paper>
    </Center>
  )
}
