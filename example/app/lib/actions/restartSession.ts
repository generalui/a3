'use server'

import {
  initRegistry as initHelloWorld,
  getChatSessionInstance as getHelloWorldSession,
  SESSION_ID as HELLO_WORLD_ID,
} from '@agents/helloWorld'
import {
  initRegistry as initPlumbing,
  getChatSessionInstance as getPlumbingSession,
  SESSION_ID as PLUMBING_ID,
} from '@agents/steadfastPlumbing'
import {
  initRegistry as initOnboarding,
  getChatSessionInstance as getOnboardingSession,
  SESSION_ID as ONBOARDING_ID,
} from '@agents/onboarding'

export async function restartSession(sessionId: string) {
  switch (sessionId) {
    case HELLO_WORLD_ID: {
      initHelloWorld()
      const session = getHelloWorldSession(sessionId)
      return session.restart()
    }
    case ONBOARDING_ID: {
      initOnboarding()
      const session = getOnboardingSession(sessionId)
      return session.restart()
    }
    case PLUMBING_ID:
    default: {
      initPlumbing()
      const session = getPlumbingSession(sessionId)
      return session.restart()
    }
  }
}
