// Precompiled regex pattern for ID validation (performance optimization)
const UUID_REGEX = /^[A-Fa-f0-9]{8}-?[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{12}$/

// Helper to safely access window in cross-environment code
function getWindow(): { crypto?: { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => void } } | undefined {
  return typeof globalThis !== 'undefined' && 'window' in globalThis
    ? (globalThis as { window?: { crypto?: { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => void } } }).window
    : undefined
}

/**
 * Validates that an ID is in a safe UUID/GUID format.
 * This prevents path traversal and injection attacks.
 *
 * @param id - The ID to validate
 * @param idType - The type of ID (for error messages), e.g., 'practiceId', 'patientId'
 * @returns true if valid
 * @throws Error if invalid
 */
export function validateId(id: string, idType: string): boolean {
  if (!UUID_REGEX.test(id)) {
    throw new Error(`Invalid ${idType} format`)
  }

  return true
}

/**
 * Generates a UUID v4 that works across different environments:
 * - Node.js: Uses crypto.randomUUID() if available
 * - Browser: Uses window.crypto.randomUUID() if available
 * - Fallback: Uses RFC4122 v4 compliant implementation
 */
export function getUUID(): string {
  // Try globalThis.crypto (works in both Node.js 20+ and browsers)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  // Browser environment fallback
  const win = getWindow()
  if (win?.crypto?.randomUUID) {
    return win.crypto.randomUUID()
  }

  try {
    // Node.js crypto module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as { randomUUID?: () => string }
    if (crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch {
    // crypto module not available
  }

  // Fallback: RFC4122 v4 compliant UUID using cryptographically secure random bytes
  // Set version (4) and variant (8, 9, a, or b) bits explicitly
  const getRandomBytes = (count: number): Uint8Array => {
    // Try globalThis.crypto first (works in both environments)
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const array = new Uint8Array(count)
      globalThis.crypto.getRandomValues(array)
      return array
    }
    
    // Browser environment fallback
    const win = getWindow()
    if (win?.crypto?.getRandomValues) {
      const array = new Uint8Array(count)
      win.crypto.getRandomValues(array)
      return array
    }
    
    {
      // Node.js environment
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto') as { randomBytes: (count: number) => Buffer }
      return new Uint8Array(crypto.randomBytes(count))
    }
  }

  const randomBytes = getRandomBytes(16)
  const hex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0'))

  // Set version (4) and variant (8, 9, a, or b) bits explicitly
  hex[6] = ((parseInt(hex[6], 16) & 0x0f) | 0x40).toString(16) // version 4
  hex[8] = ((parseInt(hex[8], 16) & 0x3f) | 0x80).toString(16) // variant
  return (
    hex.slice(0, 4).join('') +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 12).join('') +
    '-' +
    hex.slice(12, 16).join('')
  )
}
