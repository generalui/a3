import { LoggerFacade } from './loggerFacade'

// Lazy load Winston to avoid bundling it in client code
// Module-level variables are scoped to the Node.js process (safe for Kubernetes pods)
// Each pod/process has its own module cache, so this singleton pattern works correctly
let winstonLoggerInstance: LoggerFacade | undefined
let winstonLoggerPromise: Promise<LoggerFacade | undefined> | undefined

async function getWinstonServerLogger(): Promise<LoggerFacade | undefined> {
  if (typeof window !== 'undefined') return undefined

  // Return cached instance if available
  if (winstonLoggerInstance) return winstonLoggerInstance

  // Return existing promise if initialization is in progress
  if (winstonLoggerPromise) return winstonLoggerPromise

  // Initialize Winston logger (only runs once per process)
  winstonLoggerPromise = (async () => {
    try {
      const { WinstonServerLogger } = await import('./winstonServerLogger')
      const instance = WinstonServerLogger.getInstance()
      winstonLoggerInstance = instance
      return instance
    } catch (error) {
      console.error('Failed to initialize Winston logger:', error)
      // Clear promise on error so retry is possible
      winstonLoggerPromise = undefined
      return undefined
    }
  })()

  return winstonLoggerPromise
}

export class CoreLogger {
  private static instance: CoreLogger | undefined
  private logger: LoggerFacade | undefined
  private loggerPromise: Promise<LoggerFacade | undefined> | undefined

  private constructor() {
    if (typeof window === 'undefined') {
      // Server side - use Winston (lazy load to avoid client bundling)
      this.loggerPromise = getWinstonServerLogger().then((logger) => {
        this.logger = logger
        return logger
      })
    } else {
      // Client side - use Datadog
      // this.logger = DatadogBrowserLogger.getInstance()
    }
  }

  public static getInstance(): CoreLogger {
    if (!CoreLogger.instance) {
      CoreLogger.instance = new CoreLogger()
    }
    return CoreLogger.instance
  }

  public log(level: string, message: string, meta?: object): void {
    if (this.logger) {
      this.logger.log(level, message, meta)
    } else if (this.loggerPromise) {
      // If logger is still initializing, queue the log call
      void this.loggerPromise.then((logger) => {
        logger?.log(level, message, meta)
      })
    }
  }
}
