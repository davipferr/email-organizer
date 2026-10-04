import { Link } from 'react-router'
import { Anchor, Container, List, Stack, Text, Title } from '@mantine/core'

// Public page — Google requires a privacy policy URL to publish the OAuth app.
export function PrivacyPage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={2}>Privacy policy</Title>
        <Text>
          Mail organizer is a private tool used by a small group of people to organize their own Gmail
          inboxes. It is not a commercial service.
        </Text>

        <Title order={4}>What the app accesses</Title>
        <List spacing="xs">
          <List.Item>Your name, email address and profile picture from your Google account, to log you in.</List.Item>
          <List.Item>
            Your Gmail messages and labels, to show, search, tag, move and move to Trash the emails you choose.
          </List.Item>
        </List>

        <Title order={4}>What is stored</Title>
        <List spacing="xs">
          <List.Item>Your Google access tokens, encrypted.</List.Item>
          <List.Item>
            When you click Sync: email metadata only (sender, subject, date, size, labels and a short preview),
            used to group emails by sender. Email bodies and attachments are never stored.
          </List.Item>
        </List>

        <Title order={4}>What is never done</Title>
        <List spacing="xs">
          <List.Item>Your data is never sold, shared with third parties or used for advertising.</List.Item>
          <List.Item>Emails are never permanently deleted — deleting moves them to Gmail's Trash.</List.Item>
        </List>

        <Title order={4}>Removing your data</Title>
        <Text>
          You can revoke the app's access at any time in your Google account under Security → Third-party
          access. Ask the site owner to delete your stored data.
        </Text>

        <Text size="sm" c="dimmed">
          Use of information received from Google APIs adheres to the Google API Services User Data Policy,
          including the Limited Use requirements.
        </Text>

        <Anchor component={Link} to="/login">
          Back to login
        </Anchor>
      </Stack>
    </Container>
  )
}
