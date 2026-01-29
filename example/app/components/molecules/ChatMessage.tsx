import styled from 'styled-components'
import { Typography } from '@mui/material'
import { MessageBubble } from '@atoms'
import { MESSAGE_SENDER } from '@constants/chat'
import type { ChatMessage as ChatMessageType } from 'types'

type Props = { message: ChatMessageType }

const MessageRow = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${({ $isUser }) => ($isUser ? 'flex-end' : 'flex-start')};
`

export function ChatMessage({ message }: Props) {
  const isUser = message?.source === MESSAGE_SENDER.USER
  return (
    <MessageRow $isUser={isUser} data-testid="chat-message">
      <MessageBubble $isUser={isUser} elevation={0}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {message.body}
        </Typography>
      </MessageBubble>
    </MessageRow>
  )
}
