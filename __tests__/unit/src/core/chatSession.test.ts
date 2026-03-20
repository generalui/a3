import { ChatSession } from '@core/chatSession'
import { AgentRegistry } from '@core/AgentRegistry'
import { manageFlow, manageFlowStream } from '@core/chatFlow'
import { MemorySessionStore } from '@stores/memoryStore'
import { EventType } from '@ag-ui/client'
import {
  BaseState,
  BaseChatContext,
  ChatResponse,
  SessionData,
  StreamEvent,
  Provider,
} from 'types'
import { z } from 'zod'

jest.mock('@core/chatFlow')

// ── helpers ───────────────────────────────────────────────────────────────────

interface TestState extends BaseState {
  step?: number
}

const mockProvider: Provider = {
  name: 'mock',
  sendRequest: jest.fn(),
  sendRequestStream: jest.fn(),
}

const mockAgent = {
  id: 'agent-a',
  prompt: 'test',
  outputSchema: z.object({}),
  generateResponse: jest.fn(),
}

const makeChatResponse = (overrides?: Partial<ChatResponse<TestState>>): ChatResponse<TestState> => ({
  responseMessage: 'Hello!',
  activeAgentId: 'agent-a',
  nextAgentId: null,
  state: {} as TestState,
  goalAchieved: false,
  sessionId: 'sid',
  ...overrides,
})

const makeRunFinished = (response: ChatResponse<TestState>): StreamEvent<TestState> => ({
  type: EventType.RUN_FINISHED,
  threadId: 'thread-1',
  runId: 'run-1',
  result: response,
})

function makeTextContent(): StreamEvent<TestState> {
  return { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'msg-1', delta: 'Hi' }
}

// eslint-disable-next-line @typescript-eslint/require-await
async function* streamOf(...events: StreamEvent<TestState>[]): AsyncGenerator<StreamEvent<TestState>> {
  for (const event of events) yield event
}

async function collectStream<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of gen) items.push(item)
  return items
}

function makeSession(sessionId = 'sid', store?: MemorySessionStore<TestState>) {
  const s = store ?? new MemorySessionStore<TestState>()
  return {
    store: s,
    session: new ChatSession<TestState>({
      sessionId,
      store: s,
      initialAgentId: 'agent-a',
      provider: mockProvider,
    }),
  }
}

function makeStoredSession(
  overrides?: Partial<SessionData<TestState, BaseChatContext>>,
): SessionData<TestState, BaseChatContext> {
  return {
    sessionId: 'sid',
    activeAgentId: 'agent-a',
    state: {} as TestState,
    messages: [],
    chatContext: {},
    ...overrides,
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  AgentRegistry.resetInstance()
  AgentRegistry.getInstance<TestState>().register(mockAgent)
})

// ── constructor ───────────────────────────────────────────────────────────────

describe('constructor', () => {
  it('defaults to MemorySessionStore when no store is provided', async () => {
    const session = new ChatSession<TestState>({
      sessionId: 'sid',
      initialAgentId: 'agent-a',
      provider: mockProvider,
    })

    const data = await session.getOrCreateSessionData()
    expect(data.sessionId).toBe('sid')
    // Verify it was persisted by the default store
    expect(await session.getSessionData()).toBe(data)
  })

  it('seeds the new session with initialState', async () => {
    const store = new MemorySessionStore<TestState>()
    const seeded = new ChatSession<TestState>({
      sessionId: 'sid',
      store,
      initialAgentId: 'agent-a',
      initialState: { step: 5 },
      provider: mockProvider,
    })

    const data = await seeded.getOrCreateSessionData()
    expect(data.state.step).toBe(5)
  })

  it('seeds the new session with initialMessages', async () => {
    const store = new MemorySessionStore<TestState>()
    const seeded = new ChatSession<TestState>({
      sessionId: 'sid',
      store,
      initialAgentId: 'agent-a',
      initialMessages: [{ text: 'system preamble' }],
      provider: mockProvider,
    })

    const data = await seeded.getOrCreateSessionData()
    expect(data.messages).toHaveLength(1)
    expect(data.messages[0].text).toBe('system preamble')
  })
})

// ── send() — blocking ─────────────────────────────────────────────────────────

describe('send() — blocking', () => {
  it('creates initial session when the store is empty', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(makeChatResponse())

    await session.send('hi')

    const saved = await store.load('sid')
    expect(saved?.sessionId).toBe('sid')
    expect(saved?.activeAgentId).toBe('agent-a')
  })

  it('loads existing session rather than reinitialising', async () => {
    const { session, store } = makeSession()
    await store.save('sid', makeStoredSession({ state: { step: 42 } }))

    let capturedState: TestState | undefined
    jest.mocked(manageFlow).mockImplementation(({ sessionData }) => {
      capturedState = sessionData.state as TestState
      return Promise.resolve(makeChatResponse())
    })

    await session.send('hi')
    expect(capturedState?.step).toBe(42)
  })

  it('appends the user message before calling manageFlow', async () => {
    const { session } = makeSession()

    let capturedText: string | undefined
    jest.mocked(manageFlow).mockImplementation(({ sessionData }) => {
      capturedText = sessionData.messages[0]?.text
      return Promise.resolve(makeChatResponse())
    })

    await session.send('Hello there')
    expect(capturedText).toBe('Hello there')
  })

  it('appends the assistant response to the session messages', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(makeChatResponse({ responseMessage: 'Assistant reply' }))

    await session.send('hi')

    const saved = await store.load('sid')
    expect(saved?.messages[1].text).toBe('Assistant reply')
  })

  it('persists updated state from the manageFlow result', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(makeChatResponse({ state: { step: 7 } }))

    await session.send('hi')

    expect((await store.load('sid'))?.state.step).toBe(7)
  })

  it('sets activeAgentId from nextAgentId when provided', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(
      makeChatResponse({ nextAgentId: 'agent-b', activeAgentId: 'agent-a' }),
    )

    await session.send('hi')

    expect((await store.load('sid'))?.activeAgentId).toBe('agent-b')
  })

  it('falls back to activeAgentId when nextAgentId is null', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(
      makeChatResponse({ nextAgentId: null, activeAgentId: 'agent-a' }),
    )

    await session.send('hi')

    expect((await store.load('sid'))?.activeAgentId).toBe('agent-a')
  })

  it('throws when the active agent is not in the registry', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('sid', makeStoredSession({ activeAgentId: 'missing-agent' }))
    const { session } = makeSession('sid', store)

    await expect(session.send('hi')).rejects.toThrow('Agent not found: missing-agent')
  })
})

// ── send() — streaming ────────────────────────────────────────────────────────

describe('send() — streaming', () => {
  it('yields all events from manageFlowStream unchanged', async () => {
    const { session } = makeSession()
    const response = makeChatResponse()
    jest.mocked(manageFlowStream).mockReturnValue(streamOf(makeTextContent(), makeRunFinished(response)))

    const events = await collectStream(session.send({ message: 'hi', stream: true }))

    expect(events).toHaveLength(2)
    expect(events[0].type).toBe(EventType.TEXT_MESSAGE_CONTENT)
    expect(events[1].type).toBe(EventType.RUN_FINISHED)
  })

  it('persists the session after RUN_FINISHED is received', async () => {
    const { session, store } = makeSession()
    const response = makeChatResponse({ responseMessage: 'streamed!' })
    jest.mocked(manageFlowStream).mockReturnValue(streamOf(makeRunFinished(response)))

    await collectStream(session.send({ message: 'hi', stream: true }))

    expect((await store.load('sid'))?.messages[1].text).toBe('streamed!')
  })

  it('does not persist the session when no RUN_FINISHED is received', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlowStream).mockReturnValue(streamOf(makeTextContent()))

    await collectStream(session.send({ message: 'hi', stream: true }))

    expect(await store.load('sid')).toBeNull()
  })
})

// ── getOrCreateSessionData() ──────────────────────────────────────────────────

describe('getOrCreateSessionData()', () => {
  it('returns the existing session without reinitialising it', async () => {
    const { session, store } = makeSession()
    await store.save('sid', makeStoredSession({ state: { step: 99 } }))

    const data = await session.getOrCreateSessionData()
    expect(data.state.step).toBe(99)
  })

  it('creates, saves, and returns a new session when none exists', async () => {
    const { session, store } = makeSession()

    const data = await session.getOrCreateSessionData()
    expect(data.sessionId).toBe('sid')
    expect(data.activeAgentId).toBe('agent-a')
    expect(await store.load('sid')).toBe(data)
  })
})

// ── getSessionData() ──────────────────────────────────────────────────────────

describe('getSessionData()', () => {
  it('returns null when no session exists', async () => {
    const { session } = makeSession()
    expect(await session.getSessionData()).toBeNull()
  })
})

// ── upsertSessionData() ───────────────────────────────────────────────────────

describe('upsertSessionData()', () => {
  it('merges updates into the existing session', async () => {
    const { session, store } = makeSession()
    await store.save('sid', makeStoredSession({ state: { step: 1 }, activeAgentId: 'agent-a' }))

    await session.upsertSessionData({ activeAgentId: 'agent-b' })

    const saved = await store.load('sid')
    expect(saved?.activeAgentId).toBe('agent-b')
    expect(saved?.state.step).toBe(1) // original state preserved
  })

  it('creates the session first when none exists, then applies updates', async () => {
    const { session, store } = makeSession()

    await session.upsertSessionData({ activeAgentId: 'agent-b' })

    expect((await store.load('sid'))?.activeAgentId).toBe('agent-b')
  })
})

// ── getHistory() ──────────────────────────────────────────────────────────────

describe('getHistory()', () => {
  it('returns an empty array when no session exists', async () => {
    const { session } = makeSession()
    expect(await session.getHistory()).toEqual([])
  })

  it('returns [user, assistant] messages in insertion order after send()', async () => {
    const { session } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(makeChatResponse({ responseMessage: 'World' }))

    await session.send('Hello')

    const history = await session.getHistory()
    expect(history).toHaveLength(2)
    expect(history[0].text).toBe('Hello')
    expect(history[1].text).toBe('World')
  })
})

// ── clear() ───────────────────────────────────────────────────────────────────

describe('clear()', () => {
  it('deletes the session from the store', async () => {
    const { session, store } = makeSession()
    jest.mocked(manageFlow).mockResolvedValue(makeChatResponse())
    await session.send('hi')
    expect(await store.load('sid')).not.toBeNull()

    await session.clear()

    expect(await store.load('sid')).toBeNull()
  })
})

// ── restart() ─────────────────────────────────────────────────────────────────

describe('restart()', () => {
  it('deletes existing session and returns fresh initial data', async () => {
    const { session, store } = makeSession()
    await store.save('sid', makeStoredSession({ state: { step: 42 }, messages: [{ text: 'old message' }] }))

    const fresh = await session.restart()

    expect(fresh.sessionId).toBe('sid')
    expect(fresh.messages).toEqual([])
    expect(fresh.state).toEqual({})
    expect(fresh.activeAgentId).toBe('agent-a')
    expect(await store.load('sid')).toEqual(fresh)
  })

  it('resets to all configured initial values', async () => {
    const store = new MemorySessionStore<TestState>()
    const session = new ChatSession<TestState>({
      sessionId: 'sid',
      store,
      initialAgentId: 'agent-a',
      initialState: { step: 1 },
      initialMessages: [{ text: 'Welcome!' }],
      provider: mockProvider,
    })
    await store.save('sid', makeStoredSession({ state: { step: 99 }, messages: [{ text: 'old' }], activeAgentId: 'agent-z' }))

    const fresh = await session.restart()

    expect(fresh.state.step).toBe(1)
    expect(fresh.messages).toHaveLength(1)
    expect(fresh.messages[0].text).toBe('Welcome!')
    expect(fresh.activeAgentId).toBe('agent-a')
  })

  it('works when the store does not implement delete', async () => {
    const store = new MemorySessionStore<TestState>()
    const storeWithoutDelete = { load: store.load.bind(store), save: store.save.bind(store) }
    const session = new ChatSession<TestState>({
      sessionId: 'sid',
      store: storeWithoutDelete,
      initialAgentId: 'agent-a',
      provider: mockProvider,
    })

    const fresh = await session.restart()

    expect(fresh.sessionId).toBe('sid')
    expect(fresh.activeAgentId).toBe('agent-a')
  })
})
