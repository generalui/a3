import { faker } from '@faker-js/faker'
import { getFallbackTraceId } from '@utils/logger/traceId'
import * as uuidModule from '@utils/uuid'
import { MOCK_UUID } from 'jest.setup'

describe('traceId utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getFallbackTraceId', () => {
    it('should generate session-based fallback when sessionId is provided', () => {
      const sessionId = faker.string.uuid()
      const result = getFallbackTraceId(sessionId)

      expect(result).toBe(`FALLBACK_SESSION_${sessionId}`)
    })

    it('should generate orphan-based fallback using UUID when sessionId is undefined', () => {
      const result = getFallbackTraceId(undefined)

      expect(uuidModule.getUUID).toHaveBeenCalledTimes(1)
      expect(result).toBe(`FALLBACK_ORPHAN_${MOCK_UUID}`)
    })

    it('should generate orphan-based fallback using UUID when sessionId is empty', () => {
      const result = getFallbackTraceId('')

      expect(uuidModule.getUUID).toHaveBeenCalledTimes(1)
      expect(result).toBe(`FALLBACK_ORPHAN_${MOCK_UUID}`)
    })
  })

  // getTraceIdWithFallback is integration-tested via EventLogger tests
  // since it depends on getCurrentTraceId from logger module
})
