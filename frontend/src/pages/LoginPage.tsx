import { Link, useSearchParams } from 'react-router'
import { Alert, Anchor, Button, Center, Paper, Stack, Text, Title } from '@mantine/core'
import { IconBrandGoogle, IconMail } from '@tabler/icons-react'

const ERRORS: Record<string, string> = {
  denied: 'You cancelled the Google login.',
  scopes: 'Allow all the Gmail permissions on the Google screen so the app can organize your emails.',
  state: 'Your login expired. Try again.',
  failed: "Couldn't log in with Google. Try again.",
}

// Also serves as the public home page required by Google for production.
export function LoginPage() {
  const [params] = useSearchParams()
  const error = params.get('error')

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder radius="lg" p="xl" maw={400} w="100%">
        <Stack align="center" gap="md">
          <IconMail size={36} />
          <Title order={3}>Mail organizer</Title>
          <Text c="dimmed" ta="center" size="sm">
            Organize your inbox by sender, tag and search — fast.
          </Text>
          {error && (
            <Alert color="red" w="100%">
              {ERRORS[error] ?? ERRORS.failed}
            </Alert>
          )}
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
          <Anchor component={Link} to="/privacy" size="xs">
            Privacy policy
          </Anchor>
        </Stack>
      </Paper>
    </Center>
  )
}
