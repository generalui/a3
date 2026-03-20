import { useState, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Message } from '@genui-a3/a3'

export interface RestartResult {
  messages: Message[]
  activeAgentId: string | null
  state: Record<string, unknown>
}

interface UseRestartOptions {
  onRestart?: () => Promise<RestartResult>
  setMessages: Dispatch<SetStateAction<Message[]>>
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
}

export function useRestart({ onRestart, setMessages, onSessionUpdate }: UseRestartOptions) {
  const [isRestarting, setIsRestarting] = useState(false)

  const handleRestart = useCallback(async () => {
    if (!onRestart) return
    setIsRestarting(true)
    try {
      const fresh = await onRestart()
      setMessages(fresh.messages)
      onSessionUpdate?.({ activeAgentId: fresh.activeAgentId, state: fresh.state })
    } finally {
      setIsRestarting(false)
    }
  }, [onRestart, setMessages, onSessionUpdate])

  return { isRestarting, handleRestart: onRestart ? handleRestart : undefined }
}
