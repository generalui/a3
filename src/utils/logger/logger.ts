import loglevel, { LogLevel, LogLevelDesc } from 'loglevel'
import { CoreLogger } from './CoreLogger'

/**
 * Levels:
 *
 * 0. trace ("log.trace" - a log with verbose stack traces)
 * 1. debug ("log.debug" - alias of "log.log")
 * 2. info ("log.info")
 * 3. warn ("log.warn")
 * 4. error ("log.error")
 * 5. silent (no logs)
 */

function getLevel(): LogLevelDesc {
  const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || 'info'
  return logLevel.toLowerCase() as LogLevelDesc
}

const isClient = typeof window !== 'undefined'

// Use method factory to ensure loglevel only runs on client side. Server side is handled by WinstonServerLogger.
const originalFactory = loglevel.methodFactory
loglevel.methodFactory = function (methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName)

  return function (...args: unknown[]) {
    // Only execute logging on client side
    if (isClient) {
      rawMethod(...args)
    }
  }
}

loglevel.setLevel(getLevel())
loglevel.rebuild() // Apply the method factory

function isLogLevelEnabled(requestedLevel: LogLevel[keyof LogLevel]): boolean {
  const globalLevel = loglevel.getLevel()
  return requestedLevel >= globalLevel
}

// Helper function to convert numeric log level to string
function getLevelName(level: LogLevel[keyof LogLevel]): string {
  const levelName = Object.keys(loglevel.levels).find(
    (key) => loglevel.levels[key as keyof typeof loglevel.levels] === level,
  ) as string
  return levelName
}

// Helper function to get traceId from token payload (works on both client and server)
async function getTraceIdFromToken(): Promise<string | undefined> {
  // Server-side: get from token payload
  if (!isClient) {
    try {
      const { getAsyncLocalStore } = await import('@utils/asyncLocalStore') // TODO: Remove once traceId is removed from logger
      const asyncStorage = getAsyncLocalStore()
      const existingTraceId = asyncStorage.traceId as string | undefined

      if (existingTraceId) {
        return existingTraceId
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

// Create a wrapper that includes traceId in all log messages
function createTraceLogger() {
  const traceLogger = {} as typeof loglevel
  const { TRACE, DEBUG, INFO, WARN, ERROR } = loglevel.levels

  const logWithTraceId = (
    requestedLevel: LogLevel[keyof LogLevel],
    logMethod: (...args: unknown[]) => void,
    args: unknown[],
  ): void => {
    // Get traceId asynchronously but don't wait for it
    void (async () => {
      const traceId = await getTraceIdFromToken()
      const logArgs = args
      try {
        if (traceId) {
          const formattedArgs = [...args]
          if (typeof formattedArgs[0] === 'string') {
            formattedArgs[0] = `[${traceId}] ${formattedArgs[0]}`
          } else {
            formattedArgs.unshift(`[${traceId}]`)
          }
          logMethod(...formattedArgs)
        } else {
          logMethod(...args)
        }
      } catch {
        // If traceId retrieval fails, log without it
        logMethod(...args)
      } finally {
        if (isLogLevelEnabled(requestedLevel)) {
          const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
          const levelName = getLevelName(requestedLevel)
          const text = `${timestamp} | ${levelName.toUpperCase()} | ${logArgs[0] as string}`
          CoreLogger.getInstance().log(levelName.toLowerCase(), text, {
            record: {
              extra: {
                trace_id: traceId,
                args: logArgs.slice(1),
              },
            },
          })
        }
      }
    })()
  }

  traceLogger.trace = (...args: unknown[]): void => {
    logWithTraceId(
      TRACE,
      (...logArgs: unknown[]) => {
        loglevel.trace(...logArgs)
      },
      args,
    )
  }

  traceLogger.debug = (...args: unknown[]): void => {
    logWithTraceId(
      DEBUG,
      (...logArgs: unknown[]) => {
        loglevel.debug(...logArgs)
      },
      args,
    )
  }

  traceLogger.info = (...args: unknown[]): void => {
    logWithTraceId(
      INFO,
      (...logArgs: unknown[]) => {
        loglevel.info(...logArgs)
      },
      args,
    )
  }

  traceLogger.warn = (...args: unknown[]): void => {
    logWithTraceId(
      WARN,
      (...logArgs: unknown[]) => {
        loglevel.warn(...logArgs)
      },
      args,
    )
  }

  traceLogger.error = (...args: unknown[]): void => {
    logWithTraceId(
      ERROR,
      (...logArgs: unknown[]) => {
        loglevel.error(...logArgs)
      },
      args,
    )
  }

  // Add the log method (alias for debug in loglevel)
  traceLogger.log = (...args: unknown[]): void => {
    logWithTraceId(
      DEBUG,
      (...logArgs: unknown[]) => {
        loglevel.log(...logArgs)
      },
      args,
    )
  }

  return traceLogger
}

const traceLogger = createTraceLogger()

// Helper function to run code with traceId context
export function withTraceId<T>(traceId: string, fn: () => T): T {
  // For now, just run the function since we can't easily get traceId from token synchronously
  return fn()
}

// Helper function to run async code with traceId context
export async function withTraceIdAsync<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
  // For now, just run the function since we can't easily get traceId from token synchronously
  return await fn()
}

// Helper function to set traceId context from token payload (for server actions and API routes)
export async function withTraceIdFromToken<T>(fn: () => Promise<T>): Promise<T> {
  return await fn()
}

// Get current traceId from context
export async function getCurrentTraceId(): Promise<string | undefined> {
  return await getTraceIdFromToken()
}

// Alias for backward compatibility
export const getCurrentTraceIdAsync = getCurrentTraceId

export { traceLogger as log }
