import { Box, Typography } from '@mui/material'
import { OnboardingChat } from '@organisms'
import { initRegistry, getChatSessionInstance, SESSION_ID } from '@agents/onboarding'
import { ONBOARDING_TAGLINE } from '@constants/ui'

export default async function OnboardingPage() {
  initRegistry()
  const session = getChatSessionInstance(SESSION_ID)
  const sessionData = await session.getOrCreateSessionData()

  return (
    <>
      <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" dangerouslySetInnerHTML={{ __html: ONBOARDING_TAGLINE }} />
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 3, px: { xs: 2, sm: 3, md: 5, lg: 8 } }}>
        <OnboardingChat sessionId={SESSION_ID} initialMessages={sessionData.messages} />
      </Box>
    </>
  )
}
