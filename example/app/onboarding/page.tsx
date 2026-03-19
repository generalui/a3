import { Box, Typography } from '@mui/material'
import { StreamChat } from '@organisms'
import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'

export default async function OnboardingPage() {
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.ONBOARDING, initialAgentId: 'onboarding' })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <>
      <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          <strong>A3</strong> — Predictable, governable multi-agent orchestration for TypeScript.
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 3, px: { xs: 2, sm: 3, md: 5, lg: 8 } }}>
        <StreamChat sessionId={SESSION_IDS.ONBOARDING} initialMessages={sessionData.messages} />
      </Box>
    </>
  )
}
