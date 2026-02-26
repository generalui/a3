'use client'

import { useState, useCallback, useRef } from 'react'
import styled from 'styled-components'
import { Paper, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from '@molecules'
import type { ChatMessage as ChatMessageType } from 'types'

const SESSION_ID = 'demo-stream-session'

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
  display: flex;
  justify-content: space-between;
  align-items: center;
`

type StreamEvent = {
  type: 'TextMessageContent' | 'ToolCallResult' | 'AgentTransition' | 'RunFinished' | 'RunError'
  delta?: string
  agentId?: string
  response?: Record<string, unknown>
  error?: Error
  data?: Record<string, unknown>
}

export function StreamChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const assistantIdRef = useRef<string>('')

  const handleSubmit = useCallback(async (text: string) => {
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      body: text,
      source: 'user',
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // Create a placeholder assistant message for streaming into
    let assistantId = crypto.randomUUID()
    assistantIdRef.current = assistantId

    const streamingMsg: ChatMessageType = {
      id: assistantId,
      body: '',
      source: 'assistant',
      isStreaming: true,
    }
    setMessages((prev) => [...prev, streamingMsg])

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data) as StreamEvent

            if (event.type === 'TextMessageContent' && event.delta) {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, body: m.body + event.delta } : m)))
            } else if (event.type === 'AgentTransition') {
              const prevAssistantId = assistantId
              assistantId = crypto.randomUUID()
              assistantIdRef.current = assistantId
              setMessages((prev) => {
                const updated = prev.map((m) => (m.id === prevAssistantId ? { ...m, isStreaming: false } : m))
                return [...updated, { id: assistantId, body: '', source: 'assistant', isStreaming: true }]
              })
            } else if (event.type === 'RunFinished') {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)))
            } else if (event.type === 'RunError') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, body: m.body || 'Sorry, something went wrong.', isStreaming: false }
                    : m,
                ),
              )
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Ensure streaming flag is cleared
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)))
    } catch (error) {
      console.error('Chat stream error:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, body: m.body || 'Sorry, something went wrong. Please try again.', isStreaming: false }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <ChatContainer elevation={0}>
      <ChatHeader>
        <Typography variant="h6" component="h2">
          Chat (Streaming)
        </Typography>
      </ChatHeader>
      <ChatMessageList messages={messages} />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </ChatContainer>
  )
}
