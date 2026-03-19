'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Box, Collapse, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined'
import CodeOutlined from '@mui/icons-material/CodeOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import StreamIcon from '@mui/icons-material/Stream'
import ExtensionIcon from '@mui/icons-material/Extension'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { AppLogo } from '@atoms'
import { SIDEBAR_WIDTH } from './SidebarLayout'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const isExamplesPath = pathname.startsWith('/examples')
  const [examplesOpen, setExamplesOpen] = useState(isExamplesPath)

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AppLogo width={28} height={28} />
        <Typography variant="h6" fontWeight="bold">
          A3
        </Typography>
      </Box>

      <List component="nav" sx={{ px: 1 }}>
        <ListItemButton
          component={Link}
          href="/"
          selected={pathname === '/'}
          onClick={onClose}
          sx={{ borderRadius: 1, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <HomeOutlined />
          </ListItemIcon>
          <ListItemText primary="Home" />
        </ListItemButton>

        <ListItemButton
          component={Link}
          href="/onboarding"
          selected={pathname === '/onboarding'}
          onClick={onClose}
          sx={{ borderRadius: 1, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <SmartToyOutlined />
          </ListItemIcon>
          <ListItemText primary="Onboarding" />
        </ListItemButton>

        <ListItemButton onClick={() => setExamplesOpen(!examplesOpen)} sx={{ borderRadius: 1, mb: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <CodeOutlined />
          </ListItemIcon>
          <ListItemText primary="Examples" />
          {examplesOpen ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>

        <Collapse in={examplesOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItemButton
              component={Link}
              href="/examples/chat"
              selected={pathname === '/examples/chat'}
              onClick={onClose}
              sx={{ borderRadius: 1, mb: 0.5, pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <ChatBubbleOutlineIcon />
              </ListItemIcon>
              <ListItemText primary="Chat" />
            </ListItemButton>

            <ListItemButton
              component={Link}
              href="/examples/stream"
              selected={pathname === '/examples/stream'}
              onClick={onClose}
              sx={{ borderRadius: 1, mb: 0.5, pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <StreamIcon />
              </ListItemIcon>
              <ListItemText primary="Streaming" />
            </ListItemButton>

            <ListItemButton
              component={Link}
              href="/examples/agui"
              selected={pathname === '/examples/agui'}
              onClick={onClose}
              sx={{ borderRadius: 1, mb: 0.5, pl: 4 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <ExtensionIcon />
              </ListItemIcon>
              <ListItemText primary="AG-UI" />
            </ListItemButton>
          </List>
        </Collapse>
      </List>
    </Box>
  )

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  )
}
