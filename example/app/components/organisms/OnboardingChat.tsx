'use client'

import { useCallback } from 'react'
import { StreamChat } from './StreamChat'
import { restartSession } from '@lib/actions/restartSession'
import type { Message } from '@genui/a3'

interface OnboardingChatProps {
  sessionId: string
  initialMessages: Message[]
}

export function OnboardingChat({ sessionId, initialMessages }: OnboardingChatProps) {
  const handleRestart = useCallback(async () => {
    const fresh = await restartSession(sessionId)
    return {
      messages: fresh.messages,
      activeAgentId: fresh.activeAgentId,
      state: fresh.state as Record<string, unknown>,
    }
  }, [sessionId])

  return <StreamChat sessionId={sessionId} initialMessages={initialMessages} onRestart={handleRestart} />
}
