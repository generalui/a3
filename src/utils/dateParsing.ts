import * as chrono from 'chrono-node'
import { isValid } from 'date-fns'

// Helper to handle 2-digit years
const normalizeYear = (y: string) => {
  let year = parseInt(y)
  if (y.length === 2) {
    year += year < 50 ? 2000 : 1900
  }
  return year
}

// Helper to validate date parts
const isValidDate = (day: number, month: number, year: number): boolean => {
  if (day < 1 || day > 31 || month < 1 || month > 12) return false

  // Check specific month constraints
  if (month === 2) {
    // February - leap year check
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return day <= (isLeapYear ? 29 : 28)
  } else if ([4, 6, 9, 11].includes(month)) {
    // April, June, September, November have 30 days
    return day <= 30
  }

  return true
}

// Helper to parse D, M, Y from regex match and return Date
const dateFromParts = (d: string, m: string, y: string) => {
  const year = normalizeYear(y)
  const month = parseInt(m)
  const day = parseInt(d)

  if (!isValidDate(day, month, year)) return null

  // Use UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toString() === 'Invalid Date' ? null : date
}

// YYYYMMDD
export const parseYYYYMMDD = (dateStr: string): Date | null => {
  if (!/^\d{8}$/.test(dateStr)) return null
  return dateFromParts(dateStr.substring(6, 8), dateStr.substring(4, 6), dateStr.substring(0, 4))
}

// YYYYMMDDHHMMSS
export const parseYYYYMMDDHHMMSS = (dateStr: string): Date | null => {
  if (!/^\d{14}$/.test(dateStr)) return null

  try {
    const date = new Date(
      Date.UTC(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8)),
        parseInt(dateStr.substring(8, 10)),
        parseInt(dateStr.substring(10, 12)),
        parseInt(dateStr.substring(12, 14)),
      ),
    )

    return isValid(date) ? date : null
  } catch {
    return null
  }
}

/**
 * Helper to pad single-digit components in dot-separated dates
 * @param dateStr - The date string to pad in the format of MM.DD.YY or YY.M.D
 * @returns The padded date string in the format of MM/DD/YYYY or YYYY/M/D
 */
export function padDateForChrono(dateStr: string): string {
  if (!/^\d{1,4}\.\d{1,2}\.\d{1,4}$/.test(dateStr)) return dateStr

  const parts = dateStr.split('.').map(Number)
  const yearIndex = parts.findIndex((p) => p > 31 || p > 999)

  const expandYear = (y: number) => (y < 100 ? (y < 50 ? 2000 + y : 1900 + y) : y)

  return parts.map((p, i) => (i === yearIndex ? expandYear(p).toString() : p.toString().padStart(2, '0'))).join('/')
}

export const parseDate = (dateStr: string): Date | null => {
  const dateParsers = [
    // Exact format parsers first (timezone-aware)
    parseYYYYMMDDHHMMSS,
    parseYYYYMMDD,

    // Generic parser last (may not handle timezones correctly)
    (date: string) => {
      const normalized = padDateForChrono(date)
      return chrono.en.parseDate(normalized)
    },
  ]

  for (const parser of dateParsers) {
    const result = parser(dateStr)
    if (result) return result
  }
  return null
}
