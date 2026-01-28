import { ToolResult } from 'types'
import { parseDate } from '@utils/dateParsing'

export const compareDates = (date1: string, date2: string): boolean => {
  const parsedDate1 = parseDate(date1)
  const parsedDate2 = parseDate(date2)

  if (!parsedDate1 || !parsedDate2) return false

  return parsedDate1.toISOString().split('T')[0] === parsedDate2.toISOString().split('T')[0]
}

export const compareLastNames = (name1: string, name2: string): boolean => {
  return name1.toLowerCase() === name2.toLowerCase()
}

export enum AuthFieldStatus {
  Valid = 'valid',
  Invalid = 'invalid',
  Missing = 'missing',
}

export type AuthDetails = {
  authenticationPassed: boolean
  lastNameStatus: AuthFieldStatus
  dobStatus: AuthFieldStatus
}

export const validateAuthTool = ({
  LastNameToValidate,
  lastName,
  DobToValidate,
  Dob,
}: {
  LastNameToValidate: string | null
  DobToValidate: string | null
  Dob: string
  lastName: string
}): ToolResult<AuthDetails> => {
  const lastNameComparison = LastNameToValidate ? compareLastNames(LastNameToValidate, lastName) : null
  const dobComparison = DobToValidate ? compareDates(DobToValidate, Dob) : null

  const lastNameStatus =
    lastNameComparison === null
      ? AuthFieldStatus.Missing
      : lastNameComparison
        ? AuthFieldStatus.Valid
        : AuthFieldStatus.Invalid

  const dobStatus =
    dobComparison === null ? AuthFieldStatus.Missing : dobComparison ? AuthFieldStatus.Valid : AuthFieldStatus.Invalid

  const authenticated = lastNameStatus === AuthFieldStatus.Valid && dobStatus === AuthFieldStatus.Valid

  return {
    content: {
      authenticationPassed: authenticated,
      lastNameStatus,
      dobStatus,
    },
    status: 'success',
  }
}
