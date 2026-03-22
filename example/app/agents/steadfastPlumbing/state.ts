import { BaseState } from '@genui/a3'

/**
 * State for the Steadfast Plumbing example.
 * Shared across all plumbing agents in the session.
 */
export interface PlumbingState extends BaseState {
  customerName?: string
  issueDescription?: string
  issueType?: string
  severity?: string
  isEmergency?: boolean
  issueResolved?: boolean
  needsNewTriage?: boolean
  preferredSchedule?: string
  phoneNumber?: string
  address?: string
}
