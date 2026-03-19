import Link from 'next/link'
import { Box, Typography } from '@mui/material'
import { PageLayout, StreamChat } from '@organisms'
import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'

function ViewExamplesLink() {
  return (
    <Link
      href="/examples"
      style={{
        color: 'inherit',
        textDecoration: 'none',
        fontWeight: 600,
      }}
    >
      <Typography
        sx={{
          color: 'primary.main',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        View Examples
      </Typography>
    </Link>
  )
}

export default async function Home() {
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.ONBOARDING })

  const sessionData = await session.getOrCreateSessionData()

  return (
    <PageLayout title="A3" headerAction={<ViewExamplesLink />}>
      <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          <strong>A3</strong> — Predictable, governable multi-agent orchestration for TypeScript.
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 3 }}>
        <StreamChat sessionId={SESSION_IDS.ONBOARDING} initialMessages={sessionData.messages} />
      </Box>
    </PageLayout>
  )
}
