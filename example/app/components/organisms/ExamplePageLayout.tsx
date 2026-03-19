'use client'

import { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Link from 'next/link'
import { AgentGraph } from './AgentGraph'
import { StateViewer } from './StateViewer'
import { PageLayout } from './PageLayout'

interface ExamplePageLayoutProps {
  title: string
  description: string
  children: ReactNode
  activeAgentId: string | null
  state: Record<string, unknown>
}

function BackButton() {
  return (
    <Button component={Link} href="/examples" variant="text" startIcon={<ArrowBackIcon />} sx={{ color: 'text.secondary' }}>
      Back to Examples
    </Button>
  )
}

export function ExamplePageLayout({ title, description, children, activeAgentId, state }: ExamplePageLayoutProps) {
  return (
    <PageLayout title={title} headerAction={<BackButton />}>
      <Typography variant="body1" color="text.secondary" sx={{ pt: 3, pb: 0, lineHeight: 1.6 }}>
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
          {children}
        </Box>
        <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
          <AgentGraph activeAgentId={activeAgentId} />
          <StateViewer state={state} />
        </Box>
      </Box>
    </PageLayout>
  )
}
