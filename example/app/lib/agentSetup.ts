import { AgentRegistry } from '@genui-a3/a3'
import { greetingAgent, State } from '@agents/greeting'
import { ageAgent } from '@agents/age'

/**
 * Shared agent registry and session stores for all API routes.
 * Import from here instead of duplicating registration logic.
 */
const registry = AgentRegistry.getInstance<State>()
registry.register([greetingAgent, ageAgent])

export const agentRegistry = registry
