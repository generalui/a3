import { AgentRegistry } from '@genui-a3/a3'

import type { State } from '@agents/state'
import { greetingAgent } from '@agents/greeting'
import { ageAgent } from '@agents/age'

/**
 * Shared agent registry all API routes.
 */
const registry = AgentRegistry.getInstance<State>()

export function initRegistry() {
  registry.clear()
  registry.register([greetingAgent, ageAgent])
}

export const agentRegistry = registry
