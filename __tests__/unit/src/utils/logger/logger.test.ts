// Unmock before imports so the real module is loaded, not the global jest.setup.ts mock.
jest.unmock('@utils/logger')

import type { ILogLayer } from 'loglayer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LoggerModule = {
  getLogger: () => ILogLayer
  configureLogger: (logger: ILogLayer) => void
  log: ILogLayer
}

/**
 * Returns a fresh logger module instance with clean state.
 * jest.resetModules() clears the module registry so the next require()
 * re-executes the module, resetting the _logger singleton.
 */
function freshModule(): LoggerModule {
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@utils/logger') as unknown as LoggerModule
}

/** Creates a minimal ILogLayer mock with only the methods needed for each test. */
function createMockLogger(): ILogLayer {
  const fn = () => jest.fn<ILogLayer, unknown[]>()
  return {
    info: fn(),
    debug: fn(),
    warn: fn(),
    error: fn(),
    trace: fn(),
    withMetadata: fn().mockReturnThis(),
    withContext: fn().mockReturnThis(),
    withError: fn().mockReturnThis(),
    withPrefix: fn().mockReturnThis(),
  } as unknown as ILogLayer
}

// ---------------------------------------------------------------------------
// getLogger()
// ---------------------------------------------------------------------------

describe('getLogger()', () => {
  it('returns the same instance on repeated calls (lazy singleton)', () => {
    const { getLogger } = freshModule()
    expect(getLogger()).toBe(getLogger())
  })
})

// ---------------------------------------------------------------------------
// configureLogger()
// ---------------------------------------------------------------------------

describe('configureLogger()', () => {
  it('replaces the active logger so getLogger() returns the configured instance', () => {
    const { configureLogger, getLogger } = freshModule()
    const custom = createMockLogger()
    configureLogger(custom)
    expect(getLogger()).toBe(custom)
  })

  it('can be called multiple times, each call replacing the previous logger', () => {
    const { configureLogger, getLogger } = freshModule()
    const first = createMockLogger()
    const second = createMockLogger()
    configureLogger(first)
    configureLogger(second)
    expect(getLogger()).toBe(second)
  })
})

// ---------------------------------------------------------------------------
// log proxy
// ---------------------------------------------------------------------------

describe('log proxy', () => {
  it('routes to the default logger when configureLogger() has not been called', () => {
    const { getLogger, log } = freshModule()
    const spy = jest.spyOn(getLogger(), 'info')
    log.info('default routing')
    expect(spy).toHaveBeenCalledWith('default routing')
  })

  it('routes method calls through to the currently configured logger', () => {
    const { configureLogger, log } = freshModule()
    const mock = createMockLogger()
    configureLogger(mock)
    log.info('hello from proxy')
    expect(mock.info).toHaveBeenCalledWith('hello from proxy')
  })

  it('correctly binds this so chained calls (withMetadata, withError) reach the underlying logger', () => {
    const { configureLogger, log } = freshModule()
    const mock = createMockLogger()
    configureLogger(mock)
    log.withMetadata({ key: 'val' }).info('chained call')
    expect(mock.withMetadata).toHaveBeenCalledWith({ key: 'val' })
    expect(mock.info).toHaveBeenCalledWith('chained call')
  })

  it('reflects a logger replacement mid-run after configureLogger() is called', () => {
    const { configureLogger, log } = freshModule()
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
})

// ---------------------------------------------------------------------------
// Default logger configuration (resolveMinLevel behaviour)
//
// Tested indirectly by mocking tslog's Logger constructor and verifying
// that the correct minLevel is passed based on A3_LOG_LEVEL.
// ---------------------------------------------------------------------------

describe('default logger log level', () => {
  afterEach(() => {
    delete process.env.A3_LOG_LEVEL
    jest.resetModules()
  })

  function loadWithMockedTslog(): { MockLogger: jest.Mock; getLogger: () => ILogLayer } {
    const MockLogger = jest.fn().mockImplementation(() => ({}))
    jest.doMock('tslog', () => ({ Logger: MockLogger }))
    jest.doMock('@loglayer/transport-tslog', () => ({
      TsLogTransport: jest.fn().mockImplementation(() => ({})),
    }))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLogger } = require('@utils/logger') as LoggerModule
    return { MockLogger, getLogger }
  }

  it.each([
    ['silly', 0],
    ['trace', 1],
    ['debug', 2],
    ['info', 3],
    ['warn', 4],
    ['error', 5],
    ['fatal', 6],
  ])('maps A3_LOG_LEVEL="%s" to tslog minLevel %d', (level, expected) => {
    process.env.A3_LOG_LEVEL = level
    jest.resetModules()
    const { MockLogger, getLogger } = loadWithMockedTslog()
    getLogger()
    expect(MockLogger).toHaveBeenCalledWith(expect.objectContaining({ minLevel: expected }))
  })

  it('is case-insensitive (A3_LOG_LEVEL="DEBUG" maps to minLevel 2)', () => {
    process.env.A3_LOG_LEVEL = 'DEBUG'
    jest.resetModules()
    const { MockLogger, getLogger } = loadWithMockedTslog()
    getLogger()
    expect(MockLogger).toHaveBeenCalledWith(expect.objectContaining({ minLevel: 2 }))
  })

  it('defaults to minLevel 3 (info) when A3_LOG_LEVEL is not set', () => {
    jest.resetModules()
    const { MockLogger, getLogger } = loadWithMockedTslog()
    getLogger()
    expect(MockLogger).toHaveBeenCalledWith(expect.objectContaining({ minLevel: 3 }))
  })

  it('defaults to minLevel 3 (info) for an unrecognised A3_LOG_LEVEL value', () => {
    process.env.A3_LOG_LEVEL = 'verbose'
    jest.resetModules()
    const { MockLogger, getLogger } = loadWithMockedTslog()
    getLogger()
    expect(MockLogger).toHaveBeenCalledWith(expect.objectContaining({ minLevel: 3 }))
  })
})
