import { NextRequest } from 'next/server'
import { EventType, type RunAgentInput } from '@ag-ui/client'
import { EventEncoder } from '@ag-ui/encoder'
import { AgentRegistry, ChatSession, MemorySessionStore, AGUIAgent } from '@genui-a3/core'
import { createBedrockProvider } from '@genui-a3/providers/bedrock'
import { greetingAgent, State } from '../../agents/greeting'
import { ageAgent } from '../../agents/age'

const registry = AgentRegistry.getInstance<State>()
if (!registry.has('greeting')) {
  registry.register(greetingAgent)
}
if (!registry.has('age')) {
  registry.register(ageAgent)
}

const store = new MemorySessionStore<State>()

const provider = createBedrockProvider({
  models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'],
})

const a3Agent = new AGUIAgent({
  agentId: 'a3-demo',
  createSession: (input: RunAgentInput) =>
    new ChatSession<State>({
      sessionId: input.threadId,
      store,
      initialAgentId: 'greeting',
      provider,
    }),
})

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunAgentInput

  const encoder = new EventEncoder()
  const events$ = a3Agent.run(body)

  const stream = new ReadableStream({
    start(controller) {
      const textEncoder = new TextEncoder()
      const subscription = events$.subscribe({
        next(event) {
          controller.enqueue(textEncoder.encode(encoder.encodeSSE(event)))
        },
        error(err) {
          const errorEvent = {
            type: EventType.RUN_ERROR,
            message: String(err),
          }
          controller.enqueue(textEncoder.encode(encoder.encodeSSE(errorEvent)))
          controller.close()
        },
        complete() {
          controller.close()
        },
      })

      // Clean up on cancel
      request.signal.addEventListener('abort', () => {
        subscription.unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': encoder.getContentType(),
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
