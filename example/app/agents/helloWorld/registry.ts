import { AgentRegistry } from '@genui/a3'

import type { HelloWorldState } from './state'
import { greetingAgent } from './greeting'
import { ageAgent } from './age'

/**
 * Registers Hello World agents (greeting + age).
 */
export function initRegistry() {
  const registry = AgentRegistry.getInstance<HelloWorldState>()
  registry.clear()
  registry.register([greetingAgent, ageAgent])
}
