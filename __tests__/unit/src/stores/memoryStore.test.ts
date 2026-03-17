import { MemorySessionStore } from '@stores/memoryStore'
import { SessionData, BaseState, BaseChatContext } from 'types'

jest.unmock('@stores/memoryStore')

// ── helpers ───────────────────────────────────────────────────────────────────

interface TestState extends BaseState {
  step?: number
}

const makeSession = (
  sessionId: string,
  overrides?: Partial<SessionData<TestState, BaseChatContext>>,
): SessionData<TestState, BaseChatContext> => ({
  sessionId,
  activeAgentId: 'agent-a',
  state: { step: 1 },
  messages: [],
  chatContext: {},
  ...overrides,
})

// ── load() ────────────────────────────────────────────────────────────────────

describe('load()', () => {
  it('returns null for an unknown session', async () => {
    const store = new MemorySessionStore<TestState>()
    expect(await store.load('missing')).toBeNull()
  })

  it('returns the session that was previously saved', async () => {
    const store = new MemorySessionStore<TestState>()
    const session = makeSession('s1')
    await store.save('s1', session)
    expect(await store.load('s1')).toBe(session)
  })

  it('returns the most recent version after multiple saves to the same id', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('s1', makeSession('s1', { state: { step: 1 } }))
    await store.save('s1', makeSession('s1', { state: { step: 2 } }))
    expect((await store.load('s1'))?.state.step).toBe(2)
  })

  it('does not bleed data between different session ids', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('a', makeSession('a', { state: { step: 10 } }))
    await store.save('b', makeSession('b', { state: { step: 20 } }))
    expect((await store.load('a'))?.state.step).toBe(10)
    expect((await store.load('b'))?.state.step).toBe(20)
  })
})

// ── delete() ──────────────────────────────────────────────────────────────────

describe('delete()', () => {
  it('removes the session so load() returns null afterwards', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('s1', makeSession('s1'))
    await store.delete('s1')
    expect(await store.load('s1')).toBeNull()
  })

  it('resolves without throwing when the session does not exist', async () => {
    const store = new MemorySessionStore<TestState>()
    await expect(store.delete('never-existed')).resolves.toBeUndefined()
  })

  it('does not affect other sessions when one is deleted', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('keep', makeSession('keep'))
    await store.save('remove', makeSession('remove'))
    await store.delete('remove')
    expect(await store.load('keep')).not.toBeNull()
    expect(await store.load('remove')).toBeNull()
  })
})

// ── clear() ───────────────────────────────────────────────────────────────────

describe('clear()', () => {
  it('removes all sessions and resets size to 0', async () => {
    const store = new MemorySessionStore<TestState>()
    await store.save('a', makeSession('a'))
    await store.save('b', makeSession('b'))
    store.clear()
    expect(await store.load('a')).toBeNull()
    expect(await store.load('b')).toBeNull()
    expect(store.size).toBe(0)
  })
})

// ── size ──────────────────────────────────────────────────────────────────────

describe('size', () => {
  it('is 0 for a new store', () => {
    expect(new MemorySessionStore().size).toBe(0)
  })
})
