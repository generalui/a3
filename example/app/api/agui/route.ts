import { NextRequest } from 'next/server'
import { EventType, type RunAgentInput } from '@ag-ui/client'
import { EventEncoder } from '@ag-ui/encoder'
import { AGUIAgent } from '@genui/a3'
import { initRegistry, getChatSessionInstance } from '@agents/steadfastPlumbing'

const a3Agent = new AGUIAgent({
  agentId: 'a3-demo',
  createSession: (input: RunAgentInput) => getChatSessionInstance(input.threadId),
})

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunAgentInput

  const encoder = new EventEncoder()
  const events$ = a3Agent.run(body)

  initRegistry()

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
