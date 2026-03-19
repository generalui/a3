'use client'

import { useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Box } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { ChatMessage } from '@molecules'
import type { Message } from '@genui-a3/a3'

const MessageListContainer = styled(Box)`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => (theme as Theme).spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (theme as Theme).spacing(1.5)};
`

export function ChatMessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastMessage = messages[messages.length - 1]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, lastMessage?.text])

  return (
    <MessageListContainer>
      {messages.map((m) => (
        <ChatMessage key={m.messageId} message={m} />
      ))}
      <div ref={bottomRef} />
    </MessageListContainer>
  )
}
