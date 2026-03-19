'use client'

import { ReactNode } from 'react'
import { AppLogo } from '@atoms'
import { Box, Typography } from '@mui/material'

interface PageLayoutProps {
  title: string
  headerAction?: ReactNode
  children: ReactNode
}

export function PageLayout({ title, headerAction, children }: PageLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
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
        }}
      >
        <AppLogo width={32} height={32} />
        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {headerAction}
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1600, width: '100%', mx: 'auto', px: { xs: 2, sm: 3, md: 5, lg: 8 } }}>
        {children}
      </Box>
    </Box>
  )
}
