import { AgentId } from './agent'

export type DischargePayload = {
  documentsSent: boolean
}

export type LabResultsPayload = {
  labResultsConsent: boolean | null
  followUpOffered?: boolean
  followUpAccepted?: boolean
  followUpReady?: boolean
}

export type AuthPayload = {
  authenticationPassed: boolean | null
  requestingAgent: AgentId | null
  authAttemptCount: number
  nonAuthAttemptCount: number
  LastNameToValidate: string | null
  DobToValidate: string | null
  isLockedOut: boolean
}

export interface WrapUpPayload {
  appointmentAction: 'newAppointment' | 'reschedule' | 'cancel' | 'noAction' | null
  skipWrapUpApptConfirmation?: boolean
}

export type PrescriptionFlowStep =
  | 'awaiting_pharmacy_selection' // Path 1: User choosing CVS vs Amazon
  | 'awaiting_chronic_medication_interest' // Asked "Yes, show me" / "No thanks"
  | 'awaiting_chronic_medication_decision' // Showing Metformin details, awaiting final decision
  | 'awaiting_initial_amazon_confirmation' // Path 2/3: Confirming Amazon for Amoxicillin
  | 'goal_achieved' // Goal achieved, no further action needed

export interface PrescriptionFlowPayload {
  prescriptionFlowStep?: PrescriptionFlowStep
}

export type ChatState = { goalAchieved: boolean } & WrapUpPayload &
  DischargePayload &
  LabResultsPayload &
  AuthPayload &
  PrescriptionFlowPayload
