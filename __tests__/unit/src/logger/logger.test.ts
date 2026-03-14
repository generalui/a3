// Unmock before imports so the real module is loaded, not the global jest.setup.ts mock.
jest.unmock('@utils/logger')

import { getLogger, configureLogger, resolveMinLevel, _resetLogger, log } from '@utils/logger'
import type { ILogLayer } from 'loglayer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal ILogLayer mock.
 * Only the methods needed for each test need to be present.
 */
function createMockLogger(overrides: Partial<Record<string, jest.Mock>> = {}): ILogLayer {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn(),
    withMetadata: jest.fn().mockReturnThis(),
    withContext: jest.fn().mockReturnThis(),
    withError: jest.fn().mockReturnThis(),
    withPrefix: jest.fn().mockReturnThis(),
    ...overrides,
  } as unknown as ILogLayer
}

// ---------------------------------------------------------------------------
// getLogger()
// ---------------------------------------------------------------------------

describe('getLogger()', () => {
  beforeEach(() => {
    _resetLogger()
  })

  it('returns a defined logger instance', () => {
    const logger = getLogger()
    expect(logger).toBeDefined()
    expect(logger).not.toBeNull()
  })

  it('returns the same instance on repeated calls (lazy singleton)', () => {
    const first = getLogger()
    const second = getLogger()
    expect(first).toBe(second)
  })

  it('returns the configured logger after configureLogger() is called', () => {
    const mock = createMockLogger()
    configureLogger(mock)
    expect(getLogger()).toBe(mock)
  })
})

// ---------------------------------------------------------------------------
// configureLogger()
// ---------------------------------------------------------------------------

describe('configureLogger()', () => {
  beforeEach(() => {
    _resetLogger()
  })

  it('replaces the default logger', () => {
    const defaultLogger = getLogger()
    const custom = createMockLogger()
    configureLogger(custom)
    expect(getLogger()).not.toBe(defaultLogger)
    expect(getLogger()).toBe(custom)
  })

  it('can be called multiple times, each call replacing the previous logger', () => {
    const first = createMockLogger()
    const second = createMockLogger()
    configureLogger(first)
    expect(getLogger()).toBe(first)
    configureLogger(second)
    expect(getLogger()).toBe(second)
  })
})

// ---------------------------------------------------------------------------
// log proxy
// ---------------------------------------------------------------------------

describe('log proxy', () => {
  beforeEach(() => {
    _resetLogger()
  })

  it('routes method calls through to the currently configured logger', () => {
    const mock = createMockLogger()
    configureLogger(mock)
    log.info('hello from proxy')
    expect(mock.info).toHaveBeenCalledWith('hello from proxy')
  })

  it('passes all arguments through to the underlying logger method', () => {
    const mock = createMockLogger()
    configureLogger(mock)
    log.warn('something happened', { extra: 'data' })
    expect(mock.warn).toHaveBeenCalledWith('something happened', { extra: 'data' })
  })

  it('reflects a logger replacement mid-run after configureLogger() is called', () => {
    const first = createMockLogger()
    const second = createMockLogger()

    configureLogger(first)
    log.info('to first')

    configureLogger(second)
    log.info('to second')

    expect(first.info).toHaveBeenCalledTimes(1)
    expect(first.info).toHaveBeenCalledWith('to first')
    expect(second.info).toHaveBeenCalledTimes(1)
    expect(second.info).toHaveBeenCalledWith('to second')
  })

  it('binds methods to the logger instance so `this` is correct inside the method', () => {
    const mockInfo = jest.fn()
    const mock = { info: mockInfo } as unknown as ILogLayer
    configureLogger(mock)
    log.info('binding test')
    // mock.contexts tracks the `this` value for each call (Jest 28+)
    expect(mockInfo.mock.contexts[0]).toBe(mock)
  })
})

// ---------------------------------------------------------------------------
// resolveMinLevel()
// ---------------------------------------------------------------------------

describe('resolveMinLevel()', () => {
  const originalLevel = process.env.A3_LOG_LEVEL

  afterEach(() => {
    if (originalLevel === undefined) {
      delete process.env.A3_LOG_LEVEL
    } else {
      process.env.A3_LOG_LEVEL = originalLevel
    }
  })

  it.each([
    ['silly', 0],
    ['trace', 1],
    ['debug', 2],
    ['info', 3],
    ['warn', 4],
    ['error', 5],
    ['fatal', 6],
  ])('maps "%s" to tslog level %d', (level, expected) => {
    process.env.A3_LOG_LEVEL = level
    expect(resolveMinLevel()).toBe(expected)
  })

  it('is case-insensitive (uppercase input maps correctly)', () => {
    process.env.A3_LOG_LEVEL = 'DEBUG'
    expect(resolveMinLevel()).toBe(2)
  })

  it('defaults to 3 (info) when A3_LOG_LEVEL is not set', () => {
    delete process.env.A3_LOG_LEVEL
    expect(resolveMinLevel()).toBe(3)
  })

  it('defaults to 3 (info) for an unrecognised value', () => {
    process.env.A3_LOG_LEVEL = 'verbose'
    expect(resolveMinLevel()).toBe(3)
  })
})
