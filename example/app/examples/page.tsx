'use client'

import Link from 'next/link'
import { Typography, Card, CardActionArea, Container, Stack, Box } from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import StreamIcon from '@mui/icons-material/Stream'
import ExtensionIcon from '@mui/icons-material/Extension'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import {
  EXAMPLES_HEADING,
  EXAMPLES_SUBTITLE,
  EXAMPLES_CTA,
  EXAMPLE_BLOCKING_TITLE,
  EXAMPLE_BLOCKING_DESCRIPTION,
  EXAMPLE_STREAMING_TITLE,
  EXAMPLE_STREAMING_DESCRIPTION,
  EXAMPLE_AGUI_TITLE,
  EXAMPLE_AGUI_DESCRIPTION,
} from '@constants/ui'

const EXAMPLES = [
  {
    title: EXAMPLE_BLOCKING_TITLE,
    description: EXAMPLE_BLOCKING_DESCRIPTION,
    href: '/examples/chat',
    icon: <ChatBubbleOutlineIcon fontSize="large" />,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.1)',
  },
  {
    title: EXAMPLE_STREAMING_TITLE,
    description: EXAMPLE_STREAMING_DESCRIPTION,
    href: '/examples/stream',
    icon: <StreamIcon fontSize="large" />,
    color: '#9c27b0',
    bgColor: 'rgba(156, 39, 176, 0.1)',
  },
  {
    title: EXAMPLE_AGUI_TITLE,
    description: EXAMPLE_AGUI_DESCRIPTION,
    href: '/examples/agui',
    icon: <ExtensionIcon fontSize="large" />,
    color: '#2e7d32',
    bgColor: 'rgba(46, 125, 50, 0.1)',
  },
]

export default function ExamplesIndex() {
  return (
    <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
      <Container maxWidth="lg" sx={{ mt: 5, mb: 10 }}>
        <Stack spacing={3} alignItems="center" mb={10} textAlign="center">
          <Typography variant="h3" fontWeight={800} color="text.primary">
            {EXAMPLES_HEADING}
          </Typography>
          <Typography variant="h6" color="text.secondary" maxWidth="md">
            {EXAMPLES_SUBTITLE}
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
                  {EXAMPLES_CTA} <ArrowForwardIcon fontSize="small" />
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  )
}
