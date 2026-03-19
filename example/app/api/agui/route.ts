import { NextRequest } from 'next/server'
import { EventType, type RunAgentInput } from '@ag-ui/client'
import { EventEncoder } from '@ag-ui/encoder'
import { ChatSession, AGUIAgent, MemorySessionStore } from '@genui-a3/a3'
import { getProvider } from '@providers'
import { State } from '@agents/greeting'

export const aguiSessionStore = new MemorySessionStore<State>()

const a3Agent = new AGUIAgent({
  agentId: 'a3-demo',
  createSession: (input: RunAgentInput) =>
    new ChatSession<State>({
      sessionId: input.threadId,
      store: aguiSessionStore,
      initialAgentId: 'greeting',
      provider: getProvider(),
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
