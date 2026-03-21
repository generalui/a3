'use client'

import { useState, useCallback } from 'react'
import { Box, Typography } from '@mui/material'
import { AgentGraph } from './AgentGraph'
import { Chat } from './Chat'
import { AguiChat } from './AguiChat'
import { StreamChat } from './StreamChat'
import { StateViewer } from './StateViewer'
import { restartSession } from '@lib/actions/restartSession'
import type { AgentInfo } from '@lib/getAgentGraphData'
import type { Message } from '@genui/a3'

type ExampleVariant = 'blocking' | 'stream' | 'agui'

interface ExamplePageLayoutProps {
  title: string
  description: string
  sessionId: string
  initialMessages: Message[]
  variant: ExampleVariant
  agents: AgentInfo[]
  initialActiveAgentId?: string | null
  initialState?: Record<string, unknown>
}

export function ExamplePageLayout({ title, description, sessionId, initialMessages, variant, agents, initialActiveAgentId, initialState }: ExamplePageLayoutProps) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(initialActiveAgentId ?? null)
  const [state, setState] = useState<Record<string, unknown>>(initialState ?? {})

  const handleSessionUpdate = useCallback((update: { activeAgentId: string | null; state: Record<string, unknown> }) => {
    setActiveAgentId(update.activeAgentId)
    setState(update.state)
  }, [])

  const handleRestart = useCallback(async () => {
    const fresh = await restartSession(sessionId)
    return {
      messages: fresh.messages,
      activeAgentId: fresh.activeAgentId,
      state: fresh.state as Record<string, unknown>,
    }
  }, [sessionId])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: { xs: 2, sm: 3, md: 5, lg: 8 }, maxWidth: 1600, width: '100%', mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" sx={{ pt: 3 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ pt: 1, pb: 0, lineHeight: 1.6 }}>
        {description}
      </Typography>
      <Box
        sx={{
          flex: 1,
          py: 3,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '60% 40%' },
          gap: 3,
        }}
      >
        <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {variant === 'blocking' && <Chat sessionId={sessionId} initialMessages={initialMessages} onSessionUpdate={handleSessionUpdate} onRestart={handleRestart} />}
          {variant === 'stream' && <StreamChat sessionId={sessionId} initialMessages={initialMessages} onSessionUpdate={handleSessionUpdate} onRestart={handleRestart} />}
          {variant === 'agui' && <AguiChat sessionId={sessionId} initialMessages={initialMessages} onSessionUpdate={handleSessionUpdate} onRestart={handleRestart} />}
        </Box>
        <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
          <AgentGraph agents={agents} activeAgentId={activeAgentId} />
          <StateViewer state={state} />
        </Box>
      </Box>
    </Box>
  )
}
