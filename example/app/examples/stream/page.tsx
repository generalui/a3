'use client'

import { useState, useCallback } from 'react'
import { StreamChat, ExamplePageLayout } from '@organisms'

export default function StreamExample() {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [state, setState] = useState<Record<string, unknown>>({})

  const handleSessionUpdate = useCallback(
    (update: { activeAgentId: string | null; state: Record<string, unknown> }) => {
      setActiveAgentId(update.activeAgentId)
      setState(update.state)
    },
    [],
  )

  return (
    <ExamplePageLayout
      title="A3 Example — Streaming"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent."
      activeAgentId={activeAgentId}
      state={state}
    >
      <StreamChat sessionId="example-stream" onSessionUpdate={handleSessionUpdate} />
    </ExamplePageLayout>
  )
}
