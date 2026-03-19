'use client'

import { useState, useCallback } from 'react'
import { AguiChat, ExamplePageLayout } from '@organisms'

export default function AguiExample() {
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
      title="A3 Example — AG-UI Protocol"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Communication uses the AG-UI protocol, streaming structured events for text, transitions, and run lifecycle."
      activeAgentId={activeAgentId}
      state={state}
    >
      <AguiChat onSessionUpdate={handleSessionUpdate} />
    </ExamplePageLayout>
  )
}
