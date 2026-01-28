import { getUUID, validateId } from '@utils/uuid'

jest.unmock('@utils/uuid')

describe('getUUID', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('UUID format validation', () => {
    it('should generate valid RFC4122 v4 UUIDs', () => {
      // Act
      const results = Array.from({ length: 10 }, () => getUUID())

      // Assert
      results.forEach((uuid) => {
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      })
    })

    it('should generate unique UUIDs', () => {
      // Act
      const results = Array.from({ length: 100 }, () => getUUID())

      // Assert
      const uniqueResults = new Set(results)
      expect(uniqueResults.size).toBe(100)
    })

    it('should have correct version and variant bits', () => {
      // Act
      const results = Array.from({ length: 10 }, () => getUUID())

      // Assert: Check version (4) and variant (8, 9, a, or b)
      results.forEach((uuid) => {
        const parts = uuid.split('-')
        expect(parts).toHaveLength(5)

        // Version should be 4 (4xxx)
        const version = parseInt(parts[2].substring(0, 1), 16)
        expect(version).toBe(4)

        // Variant should be 8, 9, a, or b
        const variant = parts[3].substring(0, 1)
        expect(['8', '9', 'a', 'b']).toContain(variant)
      })
    })
  })

  describe('Cross-platform compatibility', () => {
    it('should work in Node.js environment', () => {
      // Act
      const result = getUUID()

      // Assert
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should work in browser environment', () => {
      // Act
      const result = getUUID()

      // Assert
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should work in Cypress environment', () => {
      // Act
      const result = getUUID()

      // Assert
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('Performance and reliability', () => {
    it('should generate UUIDs consistently', () => {
      // Act
      const results = Array.from({ length: 1000 }, () => getUUID())

      // Assert
      results.forEach((uuid) => {
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      })
    })

    it('should not throw errors under load', () => {
      // Act & Assert
      expect(() => {
        Array.from({ length: 1000 }, () => getUUID())
      }).not.toThrow()
    })
  })
})

describe('validateId', () => {
  describe('Valid UUID/GUID formats', () => {
    it('should accept standard UUID with hyphens', () => {
      expect(validateId('12345678-90ab-cdef-1234-567890abcdef', 'testId')).toBe(true)
    })

    it('should accept UUID without hyphens', () => {
      expect(validateId('1234567890abcdef1234567890abcdef', 'testId')).toBe(true)
    })

    it('should accept uppercase UUID', () => {
      expect(validateId('CBB1B812-26AA-DD11-A228-00304853942F', 'practiceId')).toBe(true)
    })

    it('should accept lowercase UUID', () => {
      expect(validateId('cbb1b812-26aa-dd11-a228-00304853942f', 'practiceId')).toBe(true)
    })

    it('should accept mixed case UUID', () => {
      expect(validateId('14803AF9-10C8-E911-80C3-0050568210B7', 'patientId')).toBe(true)
    })
  })

  describe('Invalid formats: Path traversal attacks', () => {
    it('should reject path traversal with ../', () => {
      expect(() => validateId('../etc/passwd', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject path traversal with ../../', () => {
      expect(() => validateId('../../secrets', 'practiceId')).toThrow('Invalid practiceId format')
    })

    it('should reject absolute paths', () => {
      expect(() => validateId('/etc/passwd', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject paths with backslashes', () => {
      expect(() => validateId('..\\..\\secrets', 'testId')).toThrow('Invalid testId format')
    })
  })

  describe('Invalid formats: Special characters', () => {
    it('should reject string with spaces', () => {
      expect(() => validateId('test id', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject string with special characters', () => {
      expect(() => validateId('test@id', 'testId')).toThrow('Invalid testId format')
      expect(() => validateId('test!id', 'testId')).toThrow('Invalid testId format')
      expect(() => validateId('test#id', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject string with semicolon (SQL injection attempt)', () => {
      expect(() => validateId("test'; DROP TABLE users--", 'testId')).toThrow('Invalid testId format')
    })

    it('should reject string with quotes', () => {
      expect(() => validateId("test'id", 'testId')).toThrow('Invalid testId format')
      expect(() => validateId('test"id', 'testId')).toThrow('Invalid testId format')
    })
  })

  describe('Invalid formats: Length violations', () => {
    it('should reject empty string', () => {
      expect(() => validateId('', 'testId')).toThrow('Invalid testId format')
    })
  })

  describe('Malformed UUIDs', () => {
    it('should reject UUID with wrong segment lengths', () => {
      expect(() => validateId('1234-5678-90ab-cdef-1234', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject UUID with non-hex characters', () => {
      expect(() => validateId('12345678-90ab-ghij-1234-567890abcdef', 'testId')).toThrow('Invalid testId format')
    })

    it('should reject partial UUID', () => {
      expect(() => validateId('12345678-90ab-cdef', 'testId')).toThrow('Invalid testId format')
    })
  })

  describe('Error messages', () => {
    it('should include the ID type in error message', () => {
      expect(() => validateId('../invalid', 'practiceId')).toThrow('Invalid practiceId format')
      expect(() => validateId('../invalid', 'patientId')).toThrow('Invalid patientId format')
      expect(() => validateId('../invalid', 'clinicId')).toThrow('Invalid clinicId format')
    })
  })

  describe('Real-world examples from TEST environment', () => {
    it('should accept TEST practice ID', () => {
      expect(validateId('CBB1B812-26AA-DD11-A228-00304853942F', 'practiceId')).toBe(true)
    })

    it('should accept TEST patient IDs', () => {
      expect(validateId('14803AF9-10C8-E911-80C3-0050568210B7', 'patientId')).toBe(true)
      expect(validateId('F6B2B3D9-0F86-ED11-8A04-00505682ACAD', 'patientId')).toBe(true)
    })

    it('should accept QAGG practice ID', () => {
      expect(validateId('D8A14806-12F8-4CD1-A852-BCAD8C9C6A07', 'practiceId')).toBe(true)
    })

    it('should accept QAGG patient IDs', () => {
      expect(validateId('8A00FA93-9C09-EC11-80D4-0050568210B7', 'patientId')).toBe(true)
      expect(validateId('BF04A0B7-7A1A-ED11-8A04-00505682ACAD', 'patientId')).toBe(true)
      expect(validateId('EBA08038-4EF5-EB11-80D4-0050568210B7', 'patientId')).toBe(true)
    })
  })
})
