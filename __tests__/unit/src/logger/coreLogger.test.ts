import { CoreLogger } from '@utils/logger/CoreLogger'

// Mock the underlying loggers
jest.mock('@utils/logger/datadogBrowserLogger', () => ({
  DatadogBrowserLogger: {
    getInstance: jest.fn(() => ({
      log: jest.fn(),
    })),
  },
}))

jest.mock('@utils/logger/winstonServerLogger', () => ({
  WinstonServerLogger: {
    getInstance: jest.fn(() => ({
      log: jest.fn(),
    })),
  },
}))

describe('CoreLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset the singleton instance
    ;(CoreLogger as unknown as { instance: undefined }).instance = undefined
  })

  describe('getInstance', () => {
    it('should return the same instance on subsequent calls', () => {
      const instance1 = CoreLogger.getInstance()
      const instance2 = CoreLogger.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('logging methods', () => {
    it('should log messages without throwing errors', () => {
      const logger = CoreLogger.getInstance()

      expect(() => {
        logger.log('info', 'test message', { key: 'value' })
      }).not.toThrow()
    })
  })
})
