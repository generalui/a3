'use client'

import { ReactNode, useState } from 'react'
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { AppLogo } from '@atoms'
import { Sidebar } from './Sidebar'

export const SIDEBAR_WIDTH = 260

interface SidebarLayoutProps {
  children: ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          height: '100vh',
          ml: { md: `${SIDEBAR_WIDTH}px` },
        }}
      >
        {!isDesktop && (
          <Box
            sx={{
              p: 1,
              px: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <IconButton onClick={() => setMobileOpen(true)} edge="start">
              <MenuIcon />
            </IconButton>
            <AppLogo width={24} height={24} />
          </Box>
        )}
        {children}
      </Box>
    </Box>
  )
}
