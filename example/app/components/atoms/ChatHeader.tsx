'use client'

import type { ReactNode } from 'react'
import styled from 'styled-components'
import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import type { Theme } from '@mui/material/styles'
import { CHAT_RESTART } from '@constants/ui'

const HeaderContainer = styled.div`
  border-bottom: 1px solid ${({ theme }) => (theme as Theme).palette.divider};
  background-color: ${({ theme }) => (theme as Theme).palette.background.paper};
  padding: ${({ theme }) => (theme as Theme).spacing(2, 3)};
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${({ theme }) => (theme as Theme).spacing(1)};
  min-height: 40px;
  height: 40px;
`

interface ChatHeaderProps {
  children?: ReactNode
  onRestart?: () => void
  isRestarting?: boolean
}

export function ChatHeader({ children, onRestart, isRestarting }: ChatHeaderProps) {
  return (
    <HeaderContainer>
      {children}
      {onRestart && (
        <Tooltip title={CHAT_RESTART}>
          <span>
            <IconButton
              aria-label={CHAT_RESTART}
              onClick={onRestart}
              disabled={isRestarting}
              size="small"
            >
              {isRestarting ? <CircularProgress size={16} /> : <RestartAltIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </HeaderContainer>
  )
}
