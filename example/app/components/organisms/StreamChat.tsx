'use client'

import { useState, useCallback, useRef } from 'react'
import { Typography } from '@mui/material'
import { ChatMessageList } from '@organisms/ChatMessageList'
import { ChatContainer, ChatHeader } from '@atoms'
import { ChatInput } from '@molecules'
import { MessageSender } from '@genui/a3'
import type { Message } from '@genui/a3'
import { EventType } from '@ag-ui/client'
import { CHAT_ERROR, CHAT_ERROR_SHORT, CHAT_TRANSITION } from '@constants/ui'
import { useRestart, type RestartResult } from '@lib/hooks/useRestart'

type StreamEvent = {
  type: EventType
  delta?: string
  agentId?: string
  result?: Record<string, unknown>
  message?: string
  content?: string
  name?: string
  value?: Record<string, unknown>
}

interface StreamChatProps {
  sessionId: string
  initialMessages?: Message[]
  onSessionUpdate?: (update: { activeAgentId: string | null; state: Record<string, unknown> }) => void
  onRestart?: () => Promise<RestartResult>
}

export function StreamChat({ sessionId, initialMessages, onSessionUpdate, onRestart }: StreamChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const assistantIdRef = useRef<string>('')
  const { isRestarting, handleRestart } = useRestart({ onRestart, setMessages, onSessionUpdate })

  const handleSubmit = useCallback(async (text: string) => {
    const userMsg: Message = {
      messageId: crypto.randomUUID(),
      text,
      metadata: { source: MessageSender.USER },
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // Create a placeholder assistant message for streaming into
    let assistantId = crypto.randomUUID()
    assistantIdRef.current = assistantId

    const streamingMsg: Message = {
      messageId: assistantId,
      text: '',
      metadata: { source: MessageSender.ASSISTANT },
      isStreaming: true,
    }
    setMessages((prev) => [...prev, streamingMsg])

    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
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

            if (event.type === EventType.TEXT_MESSAGE_CONTENT && event.delta) {
              setIsTransitioning(false)
              setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, text: m.text + event.delta } : m)))
            } else if (event.type === EventType.CUSTOM && event.name === 'AgentTransition') {
              const transitionEvent = event as StreamEvent & {
                value?: { toAgentId?: string; state?: Record<string, unknown> }
              }
              onSessionUpdate?.({
                activeAgentId: transitionEvent.value?.toAgentId ?? null,
                state: transitionEvent.value?.state ?? {},
              })
              const prevAssistantId = assistantId
              assistantId = crypto.randomUUID()
              assistantIdRef.current = assistantId
              setIsTransitioning(true)
              setMessages((prev) => {
                const updated = prev.map((m) => (m.messageId === prevAssistantId ? { ...m, isStreaming: false } : m))
                return [...updated, { messageId: assistantId, text: '', metadata: { source: MessageSender.ASSISTANT }, isStreaming: true }]
              })
            } else if (event.type === EventType.RUN_FINISHED) {
              setIsTransitioning(false)
              const result = event.result
              onSessionUpdate?.({
                activeAgentId: (result?.activeAgentId as string) ?? null,
                state: (result?.state as Record<string, unknown>) ?? {},
              })
              setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, isStreaming: false } : m)))
            } else if (event.type === EventType.RUN_ERROR) {
              setIsTransitioning(false)
              setMessages((prev) =>
                prev.map((m) =>
                  m.messageId === assistantId
                    ? { ...m, text: m.text || CHAT_ERROR_SHORT, isStreaming: false }
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
      setMessages((prev) => prev.map((m) => (m.messageId === assistantId ? { ...m, isStreaming: false } : m)))
    } catch (error) {
      console.error('Chat stream error:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === assistantId
            ? { ...m, text: m.text || CHAT_ERROR, isStreaming: false }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [onSessionUpdate, sessionId])

  return (
    <ChatContainer elevation={0}>
      <ChatHeader onRestart={() => void handleRestart?.()} isRestarting={isRestarting} />
      <ChatMessageList messages={messages} />
      {isTransitioning && (
        <Typography variant="caption" color="textSecondary" sx={{ px: 2, pb: 1, fontStyle: 'italic' }}>
          {CHAT_TRANSITION}
        </Typography>
      )}
      <ChatInput onSubmit={handleSubmit} disabled={isLoading || isRestarting} />
    </ChatContainer>
  )
}
