import { EventType } from '@ag-ui/client'
import { z } from 'zod'
import { processOpenAIStream } from '@providers-openai/streamProcessor'
import type { StreamTextResult, ToolSet } from 'ai'

/** Helper: collect all events from an async generator */
async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

const testSchema = z.object({
  chatbotMessage: z.string(),
  goalAchieved: z.boolean(),
  conversationPayload: z.object({ userName: z.string().optional() }),
  redirectToAgent: z.string().nullable(),
})

interface MockStreamOptions {
  partials: Record<string, unknown>[]
  finalObject: unknown
}

function createMockStreamResult(options: MockStreamOptions) {
  const result = {
    output: Promise.resolve(options.finalObject),
  } as unknown as StreamTextResult<ToolSet, never>

  // Build iterator from partials
  let index = 0
  const partials = options.partials
  const reader: AsyncIterator<unknown> = {
    next: () => {
      if (index < partials.length) {
        return Promise.resolve({ done: false as const, value: partials[index++] })
      }
      return Promise.resolve({ done: true as const, value: undefined })
    },
  }

  // First is the first partial (already consumed)
  const first: IteratorResult<unknown> =
    partials.length > 0 ? { done: false, value: partials[0] } : { done: true, value: undefined }

  // Skip first in reader since it's already consumed
  if (partials.length > 0) {
    index = 1
  }

  return { result, reader, first }
}

describe('processOpenAIStream', () => {
  describe('chatbotMessage extraction', () => {
    it('should extract chatbotMessage and yield TEXT_MESSAGE_CONTENT deltas', async () => {
      const finalObject = {
        chatbotMessage: 'Hello world',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [
          { chatbotMessage: 'Hello' },
          { chatbotMessage: 'Hello world' },
          { chatbotMessage: 'Hello world', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        ],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Hello world')

      const toolCallResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolCallResult).toBeDefined()
    })

    it('should compute deltas correctly across progressive partials', async () => {
      const finalObject = {
        chatbotMessage: 'ABCDEF',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'AB' }, { chatbotMessage: 'ABCD' }, { chatbotMessage: 'ABCDEF' }],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)

      expect(textDeltas).toEqual(['AB', 'CD', 'EF'])
    })

    it('should handle chatbotMessage missing in early partials', async () => {
      const finalObject = {
        chatbotMessage: 'Hello',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{}, { goalAchieved: false }, { chatbotMessage: 'Hello', goalAchieved: false }],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Hello')
    })

    it('should handle empty chatbotMessage', async () => {
      const finalObject = {
        chatbotMessage: '',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [
          { chatbotMessage: '' },
          { chatbotMessage: '', goalAchieved: false, conversationPayload: {}, redirectToAgent: null },
        ],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))

      const textDeltas = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textDeltas).toHaveLength(0)

      const toolCallResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolCallResult).toBeDefined()
    })
  })

  describe('final response parsing', () => {
    it('should yield TOOL_CALL_RESULT with validated content on stream end', async () => {
      const finalObject = {
        chatbotMessage: 'Test',
        goalAchieved: true,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'Test' }],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect(toolResult).toBeDefined()
      expect(toolResult!.type).toBe(EventType.TOOL_CALL_RESULT)
      const content = JSON.parse((toolResult as { content: string }).content) as Record<string, unknown>
      expect(content.chatbotMessage).toBe('Test')
      expect(content.goalAchieved).toBe(true)
      expect((content.conversationPayload as Record<string, unknown>).userName).toBe('Alice')
    })

    it('should yield RUN_ERROR on null output', async () => {
      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'partial' }],
        finalObject: null,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('null output')
    })

    it('should yield RUN_ERROR on schema validation failure', async () => {
      const invalidObject = {
        chatbotMessage: 'Hi',
        // Missing required fields
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'Hi' }],
        finalObject: invalidObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('OpenAI stream error')
    })
  })

  describe('error handling', () => {
    it('should yield RUN_ERROR when stream iterator throws', async () => {
      const result = {
        output: Promise.resolve(null),
      } as unknown as StreamTextResult<ToolSet, never>

      const reader: AsyncIterator<unknown> = {
        next: () => Promise.reject(new Error('Connection lost')),
      }

      const first: IteratorResult<unknown> = { done: false, value: { chatbotMessage: 'start' } }

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('Connection lost')
    })

    it('should yield RUN_ERROR when output promise rejects', async () => {
      const result = {
        output: Promise.reject(new Error('Object parsing failed')),
      } as unknown as StreamTextResult<ToolSet, never>

      const reader: AsyncIterator<unknown> = {
        next: () => Promise.resolve({ done: true as const, value: undefined }),
      }

      const first: IteratorResult<unknown> = { done: true, value: undefined }

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('Object parsing failed')
    })
  })

  describe('event metadata', () => {
    it('should include agentId on all TEXT_MESSAGE_CONTENT events', async () => {
      const finalObject = {
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'H' }, { chatbotMessage: 'Hi' }],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'my-agent', testSchema))
      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)

      for (const event of textEvents) {
        expect((event as { agentId: string }).agentId).toBe('my-agent')
      }
    })

    it('should include agentId on TOOL_CALL_RESULT event', async () => {
      const finalObject = {
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      }

      const { result, reader, first } = createMockStreamResult({
        partials: [{ chatbotMessage: 'Hi' }],
        finalObject,
      })

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'my-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect((toolResult as { agentId: string }).agentId).toBe('my-agent')
    })

    it('should include agentId on RUN_ERROR events', async () => {
      const result = {
        output: Promise.reject(new Error('fail')),
      } as unknown as StreamTextResult<ToolSet, never>

      const reader: AsyncIterator<unknown> = {
        next: () => Promise.resolve({ done: true as const, value: undefined }),
      }

      const first: IteratorResult<unknown> = { done: true, value: undefined }

      const events = await collectEvents(processOpenAIStream(result, reader, first, 'my-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect((errorEvent as { agentId: string }).agentId).toBe('my-agent')
    })
  })
})
