export const AUTH_MESSAGES = {
  ATTEMPT_FAILED: 'Authentication failed. Please check your details and try again.',
  ONE_ATTEMPT_REMAINING: 'One attempt remaining.',
  INVALID_DOB: 'Invalid date of birth. Please provide a valid date of birth in the format MM/DD/YYYY.',
  FAILED_TO_AUTH: (clinicName: string, clinicPhone: string) =>
    `I'm sorry, I'm unable to verify the patient's information. Please call ${clinicName} at ${clinicPhone} for assistance.`,
  NEEDS_AUTH_DETAILS: (firstName: string, type?: string) =>
    `To access ${firstName}'s ${type ?? 'information'}, please provide their last name and date of birth`,
} as const

export const DISCHARGE_MESSAGES = {
  HERE_IS_DOCUMENT: (firstName: string) => `Thanks! Here are ${firstName}'s Discharge Documents.`,
  ERROR_SENDING_DOCUMENT: 'Error sending document',
} as const

export const IDENTITY_MESSAGES = {
  IDENTITY_CONFIRMATION: (fullName: string) => `I can only provide ${fullName}'s documents. Is that you?`,
  IDENTITY_CONFIRMATION_FOLLOW_UP: (firstName: string) => `Just to confirm, are you ${firstName}?`,
  IDENTITY_DENIED: (firstName: string) => `Sorry, I can only provide ${firstName}'s documents.`,
} as const

export const LAB_RESULTS_MESSAGES = {
  HERE_IS_DOCUMENT: (firstName: string) => `Thanks! Here are ${firstName}'s Lab Results.`,
  ERROR_SENDING_DOCUMENT: 'Error sending document',
} as const
