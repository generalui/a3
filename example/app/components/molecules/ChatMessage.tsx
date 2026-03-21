import styled, { keyframes } from 'styled-components'
import { Typography } from '@mui/material'
import { MarkdownRenderer, MessageBubble } from '@atoms'
import { MessageSender } from '@genui/a3'
import type { Message } from '@genui/a3'

const MessageRow = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${({ $isUser }) => ($isUser ? 'flex-end' : 'flex-start')};
`

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`

const StreamingCursor = styled.span`
  display: inline-block;
  width: 6px;
  height: 14px;
  margin-left: 2px;
  background-color: currentColor;
  vertical-align: text-bottom;
  animation: ${blink} 0.8s step-end infinite;
`

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message?.metadata?.source === MessageSender.USER
  return (
    <MessageRow $isUser={isUser} data-testid="chat-message">
      <MessageBubble $isUser={isUser} elevation={0}>
        {isUser ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.text.trim()}
          </Typography>
        ) : (
          <>
            <MarkdownRenderer content={message.text.trim()} />
            {message.isStreaming && <StreamingCursor />}
          </>
        )}
      </MessageBubble>
    </MessageRow>
  )
}
