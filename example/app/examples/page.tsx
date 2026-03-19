'use client'

import { AppLogo } from '@atoms'
import Link from 'next/link'
import { Box, Typography, Card, CardActionArea, Container, Stack, Button } from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import StreamIcon from '@mui/icons-material/Stream'
import ExtensionIcon from '@mui/icons-material/Extension'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

const EXAMPLES = [
  {
    title: 'Blocking Chat',
    description:
      'A synchronous (unary) chat implementation. The client waits for the agent to finish processing completely before rendering the response.',
    href: '/examples/chat',
    icon: <ChatBubbleOutlineIcon fontSize="large" />,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.1)',
  },
  {
    title: 'Streaming Chat',
    description:
      'A streaming response implementation using Server-Sent Events (SSE). The client renders the agent\'s response incrementally as it\'s being generated.',
    href: '/examples/stream',
    icon: <StreamIcon fontSize="large" />,
    color: '#9c27b0',
    bgColor: 'rgba(156, 39, 176, 0.1)',
  },
  {
    title: 'AG-UI Protocol',
    description:
      'Agentic UI implementation using the AG-UI protocol. The agent returns structured semantic events driving the client interface in real-time.',
    href: '/examples/agui',
    icon: <ExtensionIcon fontSize="large" />,
    color: '#2e7d32',
    bgColor: 'rgba(46, 125, 50, 0.1)',
  },
] as const

export default function ExamplesIndex() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="header"
        sx={{
          p: 2,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          zIndex: 10,
        }}
      >
        <AppLogo width={32} height={32} />
        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
          A3 Examples
        </Typography>
        <Button component={Link} href="/" variant="text" startIcon={<ArrowBackIcon />} sx={{ color: 'text.secondary' }}>
          Back to Home
        </Button>
      </Box>

      <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
        <Container maxWidth="lg" sx={{ mt: 5, mb: 10 }}>
          <Stack spacing={3} alignItems="center" mb={10} textAlign="center">
            <Typography variant="h3" fontWeight={800} color="text.primary">
              A3 Examples
            </Typography>
            <Typography variant="h6" color="text.secondary" maxWidth="md">
              Explore the different communication protocols and frontend implementations available in the A3 architecture.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
            {EXAMPLES.map((example) => (
              <Card
                key={example.href}
                elevation={0}
                sx={{
                  flex: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 4,
                  transition: '0.2s',
                  '&:hover': { borderColor: example.color, transform: 'translateY(-4px)', boxShadow: 4 },
                }}
              >
                <CardActionArea
                  component={Link}
                  href={example.href}
                  sx={{
                    p: 4,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <Box sx={{ p: 2, bgcolor: example.bgColor, color: example.color, borderRadius: 2 }}>
                    {example.icon}
                  </Box>
                  <Typography variant="h5" fontWeight="bold">
                    {example.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {example.description}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ color: example.color }} fontWeight="bold" mt={2}>
                    Try it out <ArrowForwardIcon fontSize="small" />
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
