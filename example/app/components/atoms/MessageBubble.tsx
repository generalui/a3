import styled from 'styled-components'
import { Paper } from '@mui/material'

export const MessageBubble = styled(Paper)<{ $isUser: boolean }>`
  max-width: 80%;
  padding: ${({ theme }) => theme.spacing(1.5, 2)};
  border-radius: ${({ theme }) => theme.spacing(2.5)};
  ${({ $isUser, theme }) =>
    $isUser
      ? `
    background-color: ${theme.palette.primary.main};
    color: ${theme.palette.primary.contrastText};
    border-bottom-right-radius: ${theme.spacing(0.5)};
  `
      : `
    background-color: ${theme.palette.grey[200]};
    color: ${theme.palette.text.primary};
    border-bottom-left-radius: ${theme.spacing(0.5)};
  `}
`
