'use client'

import { useState, useCallback } from 'react'
import styled from 'styled-components'
import { Paper, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from '@molecules'
import type { ChatMessage as ChatMessageType } from 'types'

type Props = {
  initialMessages?: ChatMessageType[]
}

const defaultMessages: ChatMessageType[] = [
  { id: '1', body: 'Hi, how can I help you today?', source: 'assistant' },
  { id: '2', body: 'I have a question about my visit.', source: 'user' },
  { id: '3', body: 'Sure. What would you like to know?', source: 'assistant' },
]

const ChatContainer = styled(Paper)`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

const ChatHeader = styled.div`
  border-bottom: 1px solid ${({ theme }) => (theme as Theme).palette.divider};
  background-color: ${({ theme }) => (theme as Theme).palette.background.paper};
  padding: ${({ theme }) => (theme as Theme).spacing(2, 3)};
  flex-shrink: 0;
`

export function Chat({ initialMessages = defaultMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages)

  const handleSubmit = useCallback((text: string) => {
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      body: text,
      source: 'user',
    }
    setMessages((prev) => [...prev, userMsg])
  }, [])

  return (
    <ChatContainer elevation={0}>
      <ChatHeader>
        <Typography variant="h6" component="h2">
          Chat
        </Typography>
      </ChatHeader>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} />
    </ChatContainer>
  )
}
