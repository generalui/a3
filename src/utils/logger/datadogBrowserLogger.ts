/* eslint-disable */
'use client'

import { Logger, StatusType } from '@datadog/browser-logs'
import { getEnvStage } from '@utils/environments'
import { LoggerFacade } from './loggerFacade'

export class DatadogBrowserLogger implements LoggerFacade {
  private static instance: DatadogBrowserLogger | undefined
  private datadogLogger: Logger | undefined
  private initialized = false

  private constructor() {
    if (typeof window !== 'undefined') {
      void this.init()
    }
  }

  private async init(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') {
      return
    }

    try {
      const { datadogLogs } = await import('@datadog/browser-logs')

      const env = window.__env__?.stage || getEnvStage()
      const clientToken = window.__env__?.ddClientToken || 'unknown'
      const service = window.__env__?.ddService || 'unknown'

      datadogLogs.init({
        clientToken,
        site: 'datadoghq.com',
        forwardErrorsToLogs: true,
        service,
        sessionSampleRate: 100,
        env,
      })

      this.datadogLogger = datadogLogs.logger
      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize Datadog Browser Logger:', error) // can't use logger here as it will try to log to datadog
    }
  }

  public static getInstance(): DatadogBrowserLogger | undefined {
    if (typeof window === 'undefined') return undefined
    if (!DatadogBrowserLogger.instance) {
      DatadogBrowserLogger.instance = new DatadogBrowserLogger()
    }
    return DatadogBrowserLogger.instance
  }

  public log(level: StatusType, message: string, args?: object): void {
    if (this.datadogLogger) {
      this.datadogLogger[level](message, args)
    }
  }
}
