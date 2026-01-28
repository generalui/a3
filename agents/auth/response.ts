/* eslint-disable complexity */
import { AuthResponse } from '.'
import { AUTH_MESSAGES, MAX_ATTEMPTS } from '@constants'
import { ROUTES } from '@constants/paths'
import { getAgentResponse } from '@core/agent'
import { AgentIdOrEmpty, GenerateAgentResponseSpecification, FlowInput, AgentId, MessageSender } from 'types'
import { Events } from 'types/events'
import { logEvent } from '@utils/eventLogger'
import { log } from '@utils/logger'
import { parseDate } from '@utils/dateParsing'
import { compareLastNames, compareDates, validateAuthTool } from './tools'

// Helpers
const isLockout = (attempts: number) => attempts > MAX_ATTEMPTS

const failureMessage = (attempts: number, clinic: string, phone: string) => {
  if (isLockout(attempts)) return AUTH_MESSAGES.FAILED_TO_AUTH(clinic, phone)
  if (attempts === MAX_ATTEMPTS) {
    return `${AUTH_MESSAGES.ATTEMPT_FAILED} ${AUTH_MESSAGES.ONE_ATTEMPT_REMAINING}`
  }
  return AUTH_MESSAGES.ATTEMPT_FAILED
}

export const generateAgentResponse: GenerateAgentResponseSpecification = async ({
  agent,
  sessionData,
  lastAgentUnsentMessage,
}: FlowInput) => {
  const { patientLastName, patientDateOfBirth, clinic, clinicPhone } = sessionData.chatContext
  const state = sessionData.chatState
  const currentAuthAttempts = state.authAttemptCount || 0
  const currentNonAuthAttempts = state.nonAuthAttemptCount || 0

  // Hard lockout - No agent call needed
  if (isLockout(currentAuthAttempts) || isLockout(currentNonAuthAttempts))
    return {
      newChatState: { ...state, isLockedOut: true },
      chatbotMessage: AUTH_MESSAGES.FAILED_TO_AUTH(clinic, clinicPhone),
      goalAchieved: false,
      nextAgentId: AgentId.AUTH,
      messageMetadata: { source: MessageSender.ASSISTANT, redirectTo: ROUTES.REQUEST_NEW_LINK },
    }

  const res = (await getAgentResponse({
    agent,
    sessionData,
    lastAgentUnsentMessage,
  })) as AuthResponse

  const { LastNameToValidate, DobToValidate } = res.conversationPayload

  if (DobToValidate && !parseDate(DobToValidate)) {
    return {
      newChatState: state,
      chatbotMessage: AUTH_MESSAGES.INVALID_DOB,
      goalAchieved: false,
      nextAgentId: AgentId.AUTH,
    }
  }

  // Carry forward validated pieces from previous turns
  let savedLastName = state.LastNameToValidate || null
  let savedDob = state.DobToValidate || null

  // Track failed attempts
  let authAttemptFailed = false
  let nonAuthAttemptFailed = false

  if (!LastNameToValidate && !DobToValidate) {
    // When a user ask a question, tries to strike up a conversation, etc., no authentication information is provided. This counts towards non-auth attempts.
    nonAuthAttemptFailed = true
  }

  // Track if user provided both fields in this turn (full authentication attempt)
  const isFullAuthAttempt = !!LastNameToValidate && !!DobToValidate

  // step 1: per‑field validation
  if (LastNameToValidate) {
    if (compareLastNames(LastNameToValidate, patientLastName)) {
      savedLastName = LastNameToValidate
    } else {
      // Only mark as failed if this is a full authentication attempt
      if (isFullAuthAttempt) {
        authAttemptFailed = true
      }
    }
  }

  if (DobToValidate) {
    if (compareDates(DobToValidate, patientDateOfBirth)) {
      savedDob = DobToValidate
    } else {
      // Only mark as failed if this is a full authentication attempt
      if (isFullAuthAttempt) {
        authAttemptFailed = true
      }
    }
  }

  // step 2: final authentication when both pieces present (either from current turn or accumulated)
  // Determine if we have both pieces to validate (from saved state or current turn)
  const hasLastName = savedLastName || LastNameToValidate
  const hasDob = savedDob || DobToValidate
  const shouldValidate = hasLastName && hasDob

  const authResultDetails = shouldValidate
    ? validateAuthTool({
        LastNameToValidate: savedLastName || LastNameToValidate,
        lastName: patientLastName,
        DobToValidate: savedDob || DobToValidate,
        Dob: patientDateOfBirth,
      })
    : null
  const authResult = authResultDetails?.content.authenticationPassed ?? false

  if (savedLastName && savedDob && !authResult) {
    authAttemptFailed = true
  }

  // step 3: attempt counter and messages
  const authAttemptCount = authAttemptFailed ? currentAuthAttempts + 1 : currentAuthAttempts
  const nonAuthAttemptCount = nonAuthAttemptFailed ? currentNonAuthAttempts + 1 : currentNonAuthAttempts
  const chatbotMessage = authAttemptFailed ? failureMessage(authAttemptCount, clinic, clinicPhone) : res.chatbotMessage

  // step 4: logging
  log.debug(`generateAgentResponse: Logging ${Events.VerifyIdentityAttempted} event`, {
    attemptNumber: currentAuthAttempts,
  })
  void logEvent(Events.VerifyIdentityAttempted, {
    attemptNumber: currentAuthAttempts,
    authDetails: authResultDetails?.content ?? null,
  })
  if (authResult) {
    log.debug(`generateAgentResponse: Logging ${Events.VerifyIdentitySucceeded} event`, {
      attemptNumber: currentAuthAttempts,
    })
    void logEvent(Events.VerifyIdentitySucceeded, {
      attemptNumber: currentAuthAttempts,
    })
  } else if (authAttemptFailed && isLockout(authAttemptCount)) {
    log.debug(`generateAgentResponse: Logging ${Events.VerifyIdentityFailed} event`, {
      attemptNumber: authAttemptCount,
      maxAttempts: MAX_ATTEMPTS,
    })
    void logEvent(Events.VerifyIdentityFailed, {
      attemptNumber: authAttemptCount,
      maxAttempts: MAX_ATTEMPTS,
      authDetails: authResultDetails?.content ?? null,
    })
    return {
      newChatState: { ...state, authAttemptCount, nonAuthAttemptCount, isLockedOut: true },
      chatbotMessage: AUTH_MESSAGES.FAILED_TO_AUTH(clinic, clinicPhone),
      goalAchieved: false,
      nextAgentId: AgentId.AUTH,
      messageMetadata: { source: MessageSender.ASSISTANT, redirectTo: ROUTES.REQUEST_NEW_LINK },
    }
  }

  // step 5: return new state
  const newChatState = {
    ...state,
    authAttemptCount,
    nonAuthAttemptCount,
    LastNameToValidate: savedLastName,
    DobToValidate: savedDob,
    authenticationPassed: authResult,
  }

  return {
    newChatState,
    chatbotMessage,
    goalAchieved: authResult,
    nextAgentId: (agent.nextAgentSelector?.(newChatState, authResult) || '') as AgentIdOrEmpty,
  }
}
