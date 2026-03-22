import { AgentRegistry } from '@genui/a3'

import type { PlumbingState } from './state'
import { intakeAgent } from './intake'
import { triageAgent } from './triage'
import { emergencyAssessmentAgent } from './emergencyAssessment'
import { troubleshootingAgent } from './troubleshooting'
import { schedulingAgent } from './scheduling'
import { escalationAgent } from './escalation'

/**
 * Registers Steadfast Plumbing agents.
 */
export function initRegistry() {
  const registry = AgentRegistry.getInstance<PlumbingState>()
  registry.clear()
  registry.register([
    intakeAgent,
    triageAgent,
    emergencyAssessmentAgent,
    troubleshootingAgent,
    schedulingAgent,
    escalationAgent,
  ])
}
