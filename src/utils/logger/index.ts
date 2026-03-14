import { type ILogLayer, LogLayer } from 'loglayer'
import { TsLogTransport } from '@loglayer/transport-tslog'
import { Logger } from 'tslog'

// ── Types ─────────────────────────────────────────────────────────────────

export type { ILogLayer }

// ── State ─────────────────────────────────────────────────────────────────

let _logger: ILogLayer | null = null

// ── Internal log proxy ────────────────────────────────────────────────────
//
// Module-level logger for use within the A3 package internals.
//
// Delegates every property access to getLogger() at call time rather than
// at import time. This means a configureLogger() call made at app startup
// takes effect even though this reference was captured when the module
// was first imported.
//
// Uses the LogLayer API — see docs/LOGGING.md for usage examples.
//
// ⚠️  Use withMetadata() for per-request data (agentId, sessionId, etc.).
//    withContext() persists across calls on the shared instance and will
//    leak data between requests in a long-running server process.

export const log: ILogLayer = new Proxy({} as ILogLayer, {
  get(_target, prop: string | symbol) {
    const logger = getLogger()
    const value = Reflect.get(logger, prop)
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(logger)
    }
    return value
  },
})

// ── Functions (alphabetical) ──────────────────────────────────────────────

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

function createDefaultLogger(): ILogLayer {
  const tslogInstance = new Logger({
    type: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    minLevel: resolveMinLevel(),
  })

  return new LogLayer({
    transport: new TsLogTransport({ logger: tslogInstance }),
  })
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

function resolveMinLevel(): number {
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
