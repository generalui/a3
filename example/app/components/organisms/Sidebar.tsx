'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined'
import CodeOutlined from '@mui/icons-material/CodeOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import StreamIcon from '@mui/icons-material/Stream'
import { AppLogo } from '@atoms'
import { SIDEBAR_WIDTH } from './SidebarLayout'
import { NAV_HOME, NAV_ONBOARDING, NAV_EXAMPLES, NAV_HELLO_WORLD, NAV_PLUMBING } from '@constants/ui'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AppLogo width={28} height={28} />
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
          <ListItemText primary={NAV_HOME} />
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
          <ListItemText primary={NAV_ONBOARDING} />
        </ListItemButton>

        <ListItemButton
          component={Link}
          href="/examples"
          selected={pathname === '/examples'}
          onClick={onClose}
          sx={{ borderRadius: 1, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <CodeOutlined />
          </ListItemIcon>
          <ListItemText primary={NAV_EXAMPLES} />
        </ListItemButton>

        <List component="div" disablePadding>
          <ListItemButton
            component={Link}
            href="/examples/hello-world"
            selected={pathname === '/examples/hello-world'}
            onClick={onClose}
            sx={{ borderRadius: 1, mb: 0.5, pl: 4 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <ChatBubbleOutlineIcon />
            </ListItemIcon>
            <ListItemText primary={NAV_HELLO_WORLD} />
          </ListItemButton>

          <ListItemButton
            component={Link}
            href="/examples/steadfast-plumbing"
            selected={pathname === '/examples/steadfast-plumbing'}
            onClick={onClose}
            sx={{ borderRadius: 1, mb: 0.5, pl: 4 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <StreamIcon />
            </ListItemIcon>
            <ListItemText primary={NAV_PLUMBING} />
          </ListItemButton>
        </List>
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
