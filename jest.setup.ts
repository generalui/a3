import { faker } from '@faker-js/faker'
import '@testing-library/jest-dom'
// Polyfills for Next.js web APIs in Jest environment
import { TextEncoder, TextDecoder } from 'util'
// Add web APIs to global scope
global.TextEncoder = TextEncoder as typeof global.TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Polyfill for structuredClone (Node.js 17+ feature, not available in jsdom)
if (!global.structuredClone) {
  global.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj))
}
import '@jest/globals'

export const MOCK_UUID = faker.string.uuid()

// Mock eventLogger / logEvent(...)
jest.mock('@utils/eventLogger', () => ({
  logEvent: jest.fn(),
  eventLogger: {
    logEvent: jest.fn(),
  },
}))

// Mock logger
jest.mock('@utils/logger', () => {
  let requestTraceId: string | undefined

  return {
    log: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    },
    withTraceId: jest.fn((traceId, fn) => fn()),
    withTraceIdAsync: jest.fn(async (traceId, fn) => await fn()),
    withTraceIdFromToken: jest.fn(async (fn) => await fn()),
    getCurrentTraceId: jest.fn(() => Promise.resolve(requestTraceId)),
    getCurrentTraceIdAsync: jest.fn(() => Promise.resolve(requestTraceId)),
  }
})

// Mock uuid utilities with default mocks that can be overridden
jest.mock('@utils/uuid', () => ({
  getUUID: jest.fn().mockReturnValue(MOCK_UUID),
  validateId: jest.fn(),
}))

// Setup window.__env__ for client-side environment testing
if (typeof globalThis !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = (globalThis as any).window
  if (win) {
    Object.defineProperty(win, '__env__', {
      value: undefined, // Will be set by individual tests as needed
      writable: true,
      configurable: true,
    })
  }
}

export const mockStoreData: { current: Record<string, unknown> } = { current: {} }

export const mockGetAsyncLocalStore = jest.fn(() => {
  if (Object.keys(mockStoreData.current).length === 0) {
    throw new Error('No async local store')
  }
  return mockStoreData.current
})

export const mockWithAsyncLocalStore = jest.fn(<T>(fn: () => T, store: Record<string, unknown>) => {
  const previousStore = mockStoreData.current
  mockStoreData.current = store
  try {
    return fn()
  } finally {
    mockStoreData.current = previousStore
  }
})

// Mock the asyncLocalStore module globally
jest.mock('@utils/asyncLocalStore', () => ({
  getAsyncLocalStore: mockGetAsyncLocalStore,
  withAsyncLocalStore: mockWithAsyncLocalStore,
}))
