import { type ILogLayer, LogLayer } from 'loglayer'
import { TsLogTransport } from '@loglayer/transport-tslog'
import { Logger } from 'tslog'

export type { ILogLayer }

/**
 * Maps A3_LOG_LEVEL env var string to tslog numeric level.
 * tslog levels: 0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal
 *
 * Exported for unit testing. Not part of the public package API.
 * @internal
 */
export function resolveMinLevel(): number {
  const level = (process.env.A3_LOG_LEVEL ?? 'info').toLowerCase()
  const levels: Record<string, number> = {
    silly: 0,
    trace: 1,
    debug: 2,
    info: 3,
    warn: 4,
    error: 5,
    fatal: 6,
  }
  return levels[level] ?? 3
}

/**
 * Creates the default LogLayer instance backed by tslog.
 * - Pretty output in development (NODE_ENV !== 'production')
 * - JSON output in production
 * - Log level controlled by A3_LOG_LEVEL env var (default: 'info')
 */
function createDefaultLogger(): ILogLayer {
  const tslogInstance = new Logger({
    type: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    minLevel: resolveMinLevel(),
  })

  return new LogLayer({
    transport: new TsLogTransport({ logger: tslogInstance }),
  })
}

let _logger: ILogLayer | null = null

/**
 * Resets the active logger back to uninitialised.
 * The next call to `getLogger()` will create a fresh default logger.
 *
 * @internal For use in tests only.
 */
export function _resetLogger(): void {
  _logger = null
}

/**
 * Override the default A3 logger with a custom LogLayer instance.
 *
 * Call this once during application startup, before creating any ChatSession.
 * The provided logger will be used for all internal A3 logging.
 *
 * @example
 * ```typescript
 * import { configureLogger } from '@genui-a3/core'
 * import { LogLayer } from 'loglayer'
 * import { PinoTransport } from '@loglayer/transport-pino'
 * import { pino } from 'pino'
 *
 * configureLogger(new LogLayer({
 *   transport: new PinoTransport({ logger: pino() }),
 * }))
 * ```
 */
export function configureLogger(logger: ILogLayer): void {
  _logger = logger
}

/**
 * Returns the active A3 logger.
 * Lazily initialises the default tslog-backed logger on first call if not configured.
 */
export function getLogger(): ILogLayer {
  if (!_logger) {
    _logger = createDefaultLogger()
  }
  return _logger
}

/**
 * Module-level logger for use within the A3 package internals.
 *
 * Always routes through the currently configured logger, so a
 * `configureLogger()` call made before the first log statement takes effect
 * even though this reference is captured at import time.
 *
 * Uses the LogLayer API:
 * @example
 * ```typescript
 * import { log } from '@utils/logger'
 *
 * // Basic logging
 * log.info('Hello world!')
 *
 * // Logging with metadata
 * log.withMetadata({ agentId: 'greeting' }).info('Agent selected')
 *
 * // Logging with persistent context
 * log.withContext({ sessionId: '123' })
 * log.info('Processing request')
 *
 * // Logging errors
 * log.withError(new Error('Something went wrong')).error('Failed to process request')
 * ```
 */
export const log: ILogLayer = new Proxy({} as ILogLayer, {
  get(_target, prop: string | symbol) {
    const logger = getLogger()
    const value = (logger as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(logger)
    }
    return value
  },
})
