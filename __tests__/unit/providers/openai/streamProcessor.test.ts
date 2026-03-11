import { EventType } from '@ag-ui/client'
import { z } from 'zod'
import { processOpenAIStream } from '../../../../providers/openai/streamProcessor'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { Stream } from 'openai/streaming'

jest.unmock('../../../../providers/openai/streamProcessor')

/** Helper: create a mock ChatCompletionChunk with content delta */
function makeChunk(content: string, finishReason: string | null = null): ChatCompletionChunk {
  return {
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  } as ChatCompletionChunk
}

/** Helper: create a mock stream from chunks */
function mockStream(chunks: ChatCompletionChunk[]): Stream<ChatCompletionChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve()
      for (const chunk of chunks) {
        yield chunk
      }
    },
  } as unknown as Stream<ChatCompletionChunk>
}

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

describe('processOpenAIStream', () => {
  describe('chatbotMessage extraction', () => {
    it('should extract chatbotMessage and yield TEXT_MESSAGE_CONTENT deltas', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Hello world',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })
      // Deliver JSON in small chunks to simulate streaming
      const chunks = json.match(/.{1,5}/g)!.map((s) => makeChunk(s))
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Hello world')

      const toolCallResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolCallResult).toBeDefined()
    })

    it('should handle chatbotMessage delivered across chunk boundaries', async () => {
      // Split right in the middle of "chatbotMessage" key
      const chunks = [
        makeChunk('{"chatbot'),
        makeChunk('Message":"Hi t'),
        makeChunk('here","goalAchie'),
        makeChunk('ved":false,"conversationPayload":{},"redirectToAgent":null}'),
      ]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Hi there')
    })

    it('should handle empty chatbotMessage', async () => {
      const json = JSON.stringify({
        chatbotMessage: '',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textDeltas).toHaveLength(0)

      const toolCallResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)
      expect(toolCallResult).toBeDefined()
    })
  })

  describe('JSON escape handling', () => {
    it('should unescape \\" in chatbotMessage', async () => {
      const json = '{"chatbotMessage":"He said \\"hello\\"","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}'
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('He said "hello"')
    })

    it('should unescape \\n in chatbotMessage', async () => {
      const json = '{"chatbotMessage":"Line 1\\nLine 2","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}'
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Line 1\nLine 2')
    })

    it('should unescape \\\\ in chatbotMessage', async () => {
      const json = '{"chatbotMessage":"path\\\\to\\\\file","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}'
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('path\\to\\file')
    })

    it('should unescape \\t in chatbotMessage', async () => {
      const json = '{"chatbotMessage":"col1\\tcol2","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}'
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('col1\tcol2')
    })

    it('should handle escape sequences split across chunks', async () => {
      // The \n escape is split: backslash at end of one chunk, n at start of next
      const chunks = [
        makeChunk('{"chatbotMessage":"Hello\\'),
        makeChunk('nWorld","goalAchieved":false,"conversationPayload":{},"redirectToAgent":null}'),
      ]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))

      const textDeltas = events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((e) => (e as { delta: string }).delta)
        .join('')

      expect(textDeltas).toBe('Hello\nWorld')
    })
  })

  describe('final response parsing', () => {
    it('should yield TOOL_CALL_RESULT with validated content on stream end', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Test',
        goalAchieved: true,
        conversationPayload: { userName: 'Alice' },
        redirectToAgent: null,
      })
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect(toolResult).toBeDefined()
      expect(toolResult!.type).toBe(EventType.TOOL_CALL_RESULT)
      const content = JSON.parse((toolResult as { content: string }).content) as Record<string, unknown>
      expect(content.chatbotMessage).toBe('Test')
      expect(content.goalAchieved).toBe(true)
      expect((content.conversationPayload as Record<string, unknown>).userName).toBe('Alice')
    })

    it('should yield RUN_ERROR when JSON is invalid', async () => {
      const chunks = [makeChunk('{"chatbotMessage":"Hi","invalid json')]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('parse/validation failed')
    })

    it('should yield RUN_ERROR when schema validation fails', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Hi',
        // Missing required fields
      })
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('parse/validation failed')
    })
  })

  describe('error handling', () => {
    it('should yield RUN_ERROR when stream is empty', async () => {
      const stream = mockStream([])

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('empty response')
    })

    it('should yield RUN_ERROR on finish_reason: length (truncation)', async () => {
      const chunks = [
        makeChunk('{"chatbotMessage":"partial'),
        makeChunk('...', 'length'),
      ]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('truncated')
    })

    it('should yield RUN_ERROR when stream throws', async () => {
      const errorStream = {
        async *[Symbol.asyncIterator]() {
          await Promise.resolve()
          yield makeChunk('{"chatbot')
          throw new Error('Connection lost')
        },
      } as unknown as Stream<ChatCompletionChunk>

      const events = await collectEvents(processOpenAIStream(errorStream, 'test-agent', testSchema))
      const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR)

      expect(errorEvent).toBeDefined()
      expect((errorEvent as { message: string }).message).toContain('Connection lost')
    })
  })

  describe('event metadata', () => {
    it('should include agentId on all TEXT_MESSAGE_CONTENT events', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'my-agent', testSchema))
      const textEvents = events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)

      for (const event of textEvents) {
        expect((event as { agentId: string }).agentId).toBe('my-agent')
      }
    })

    it('should include agentId on TOOL_CALL_RESULT event', async () => {
      const json = JSON.stringify({
        chatbotMessage: 'Hi',
        goalAchieved: false,
        conversationPayload: {},
        redirectToAgent: null,
      })
      const chunks = [makeChunk(json)]
      const stream = mockStream(chunks)

      const events = await collectEvents(processOpenAIStream(stream, 'my-agent', testSchema))
      const toolResult = events.find((e) => e.type === EventType.TOOL_CALL_RESULT)

      expect((toolResult as { agentId: string }).agentId).toBe('my-agent')
    })
  })
})
