import { EventType } from '@ag-ui/client'
import { z } from 'zod'
import { processBedrockStream } from '@providers-bedrock/streamProcessor'
import type { ConverseStreamOutput } from '@aws-sdk/client-bedrock-runtime'

/** Helper: collect all events from an async generator */
async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

/** Helper: create mock async iterable from events */
function mockStream(events: unknown[]): AsyncIterable<ConverseStreamOutput> {
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve()
      for (const event of events) {
        yield event as ConverseStreamOutput
      }
    },
  }
}

const testSchema = z.object({
  chatbotMessage: z.string(),
  goalAchieved: z.boolean(),
  conversationPayload: z.object({ userName: z.string().optional() }),
  redirectToAgent: z.string().nullable(),
})

describe('processBedrockStream', () => {
  describe('text streaming', () => {
    it('should yield TEXT_MESSAGE_CONTENT for text deltas', async () => {
      const stream = mockStream([
        { contentBlockStart: { start: {}, contentBlockIndex: 0 } },
        { contentBlockDelta: { delta: { text: 'Hello ' }, contentBlockIndex: 0 } },
        { contentBlockDelta: { delta: { text: 'world!' }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)

      expect(textEvents).toHaveLength(2)
      expect((textEvents[0] as { delta: string }).delta).toBe('Hello ')
      expect((textEvents[1] as { delta: string }).delta).toBe('world!')
    })

    it('should infer text block type from delta when contentBlockStart is absent', async () => {
      const stream = mockStream([
        { contentBlockDelta: { delta: { text: 'Inferred text' }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)

      expect(textEvents).toHaveLength(1)
      expect((textEvents[0] as { delta: string }).delta).toBe('Inferred text')
    })
  })

  describe('tool use processing', () => {
    it('should yield TOOL_CALL_RESULT for valid tool use blocks', async () => {
      const toolInput = JSON.stringify({
        chatbotMessage: 'Hello!',
        goalAchieved: false,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      })

      const stream = mockStream([
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 0,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: toolInput } }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect(toolResult).toBeDefined()
      const content = JSON.parse((toolResult as { content: string }).content) as Record<string, unknown>
      expect(content.chatbotMessage).toBe('Hello!')
      expect((content.conversationPayload as Record<string, unknown>).userName).toBe('Alice')
    })

    it('should accumulate tool input across multiple deltas', async () => {
      const fullInput = JSON.stringify({
        chatbotMessage: 'Chunked response',
        goalAchieved: true,
        conversationPayload: {},
        redirectToAgent: null,
      })
      const half = Math.floor(fullInput.length / 2)
      const chunk1 = fullInput.slice(0, half)
      const chunk2 = fullInput.slice(half)

      const stream = mockStream([
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 0,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: chunk1 } }, contentBlockIndex: 0 } },
        { contentBlockDelta: { delta: { toolUse: { input: chunk2 } }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect(toolResult).toBeDefined()
      const content = JSON.parse((toolResult as { content: string }).content) as Record<string, unknown>
      expect(content.chatbotMessage).toBe('Chunked response')
      expect(content.goalAchieved).toBe(true)
    })

    it('should yield RUN_ERROR when tool input JSON is invalid', async () => {
      const stream = mockStream([
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 0,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: '{"invalid json' } }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('parse/validation failed')
    })

    it('should yield RUN_ERROR when schema validation fails', async () => {
      const toolInput = JSON.stringify({
        chatbotMessage: 'Hi',
        // Missing required fields
      })

      const stream = mockStream([
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 0,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: toolInput } }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('parse/validation failed')
    })
  })

  describe('mixed text + tool use', () => {
    it('should handle text block followed by tool use block', async () => {
      const toolInput = JSON.stringify({
        chatbotMessage: 'Hello from tool',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })

      const stream = mockStream([
        { contentBlockStart: { start: {}, contentBlockIndex: 0 } },
        { contentBlockDelta: { delta: { text: 'Streaming text' }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 1,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: toolInput } }, contentBlockIndex: 1 } },
        { contentBlockStop: { contentBlockIndex: 1 } },
        { metadata: { usage: { inputTokens: 10, outputTokens: 20 } } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))

      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textEvents).toHaveLength(1)
      expect((textEvents[0] as { delta: string }).delta).toBe('Streaming text')

      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolResult).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should throw on internalServerException', async () => {
      const stream = mockStream([{ internalServerException: { message: 'Internal error' } }])

      await expect(collectEvents(processBedrockStream(stream, 'test-agent', testSchema))).rejects.toThrow(
        'Bedrock internal error',
      )
    })

    it('should throw on modelStreamErrorException', async () => {
      const stream = mockStream([{ modelStreamErrorException: { message: 'Model error' } }])

      await expect(collectEvents(processBedrockStream(stream, 'test-agent', testSchema))).rejects.toThrow(
        'Bedrock model stream error',
      )
    })

    it('should throw on throttlingException', async () => {
      const stream = mockStream([{ throttlingException: { message: 'Too many requests' } }])

      await expect(collectEvents(processBedrockStream(stream, 'test-agent', testSchema))).rejects.toThrow(
        'Bedrock throttling',
      )
    })

    it('should throw on validationException', async () => {
      const stream = mockStream([{ validationException: { message: 'Invalid input' } }])

      await expect(collectEvents(processBedrockStream(stream, 'test-agent', testSchema))).rejects.toThrow(
        'Bedrock validation error',
      )
    })

    it('should throw on serviceUnavailableException', async () => {
      const stream = mockStream([{ serviceUnavailableException: { message: 'Service down' } }])

      await expect(collectEvents(processBedrockStream(stream, 'test-agent', testSchema))).rejects.toThrow(
        'Bedrock service unavailable',
      )
    })
  })

  describe('metadata events', () => {
    it('should skip metadata events without yielding', async () => {
      const stream = mockStream([{ metadata: { usage: { inputTokens: 50, outputTokens: 25 } } }])

      const events = await collectEvents(processBedrockStream(stream, 'test-agent', testSchema))
      expect(events).toHaveLength(0)
    })
  })

  describe('event metadata', () => {
    it('should include agentId on TEXT_MESSAGE_CONTENT events', async () => {
      const stream = mockStream([
        { contentBlockStart: { start: {}, contentBlockIndex: 0 } },
        { contentBlockDelta: { delta: { text: 'Hi' }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'my-agent', testSchema))
      const textEvent = events.find((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)

      expect((textEvent as { agentId: string }).agentId).toBe('my-agent')
    })

    it('should include agentId on TOOL_CALL_RESULT events', async () => {
      const toolInput = JSON.stringify({
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })

      const stream = mockStream([
        {
          contentBlockStart: {
            start: { toolUse: { name: 'structuredResponse', toolUseId: 't-1' } },
            contentBlockIndex: 0,
          },
        },
        { contentBlockDelta: { delta: { toolUse: { input: toolInput } }, contentBlockIndex: 0 } },
        { contentBlockStop: { contentBlockIndex: 0 } },
      ])

      const events = await collectEvents(processBedrockStream(stream, 'my-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect((toolResult as { agentId: string }).agentId).toBe('my-agent')
    })
  })
})
