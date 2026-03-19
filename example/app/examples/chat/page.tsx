'use client'

import { useState, useCallback } from 'react'
import { Chat, ExamplePageLayout } from '@organisms'

export default function ChatExample() {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [state, setState] = useState<Record<string, unknown>>({})

  const handleSessionUpdate = useCallback((update: { activeAgentId: string | null; state: Record<string, unknown> }) => {
    setActiveAgentId(update.activeAgentId)
    setState(update.state)
  }, [])

  return (
    <ExamplePageLayout
      title="A3 Example — Blocking Chat"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Each response arrives in full once the agent is done thinking."
      activeAgentId={activeAgentId}
      state={state}
    >
      <Chat onSessionUpdate={handleSessionUpdate} />
    </ExamplePageLayout>
  )
}
