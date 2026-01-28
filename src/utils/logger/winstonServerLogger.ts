import { LoggerFacade } from './loggerFacade'

export class WinstonServerLogger implements LoggerFacade {
  private static instance: WinstonServerLogger | undefined
  private winstonLogger: { log: (level: string, message: string, meta?: object) => void } | undefined

  private constructor() {
    // Only initialize on server side
    if (typeof window === 'undefined') {
      void this.initializeWinston()
    }
  }

  private async initializeWinston(): Promise<void> {
    try {
      // Dynamic import to avoid client-side bundling
      const winston = await import('winston')
      this.winstonLogger = winston.default.createLogger({
        level: 'debug', // actual level is set at logger.ts
        format: winston.default.format.combine(winston.default.format.timestamp(), winston.default.format.json()),
        transports: [new winston.default.transports.Console()],
      })
    } catch (error) {
      console.error('Failed to initialize Winston logger:', error)
    }
  }

  public static getInstance(): WinstonServerLogger | undefined {
    if (typeof window !== 'undefined') return undefined
    if (!WinstonServerLogger.instance) {
      WinstonServerLogger.instance = new WinstonServerLogger()
    }
    return WinstonServerLogger.instance
  }

  public log(level: string, message: string, meta?: object): void {
    if (this.winstonLogger) {
      this.winstonLogger.log(level, message, meta)
    }
  }
}
