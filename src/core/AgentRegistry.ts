import { Agent, AgentId } from 'types'

/**
 * AgentRegistry - A centralized singleton registry for managing agents.
 *
 * This allows consumers of the library to dynamically register their own agents
 * at runtime, enabling modular and extensible agent architectures.
 *
 * @example
 * ```typescript
 * import { AgentRegistry } from '@genui-a3/core'
 *
 * // Register a single agent
 * AgentRegistry.getInstance().register(myAgent)
 *
 * // Register multiple agents
 * AgentRegistry.getInstance().register([agent1, agent2])
 *
 * // Retrieve an agent
 * const agent = AgentRegistry.getInstance().get('my-agent-id')
 * ```
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null
  private agents: Map<AgentId, Agent> = new Map()

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry()
    }
    return AgentRegistry.instance
  }

  /**
   * Resets the singleton instance. Primarily useful for testing.
   */
  static resetInstance(): void {
    AgentRegistry.instance = null
  }

  /**
   * Registers one or more agents with the registry.
   *
   * @param agents - A single agent or array of agents to register
   * @throws Error if any agent ID is already registered
   */
  register(agents: Agent | Agent[]): void {
    const agentList = Array.isArray(agents) ? agents : [agents]

    // Validate all agents first before registering any
    for (const agent of agentList) {
      if (this.agents.has(agent.id)) {
        throw new Error(`Agent with ID '${agent.id}' is already registered. Use unregister() first to replace it.`)
      }
    }

    // Register all agents
    for (const agent of agentList) {
      this.agents.set(agent.id, agent)
    }
  }

  /**
   * Retrieves an agent by its ID.
   *
   * @param id - The agent ID to look up
   * @returns The agent if found, undefined otherwise
   */
  get(id: AgentId): Agent | undefined {
    return this.agents.get(id)
  }

  /**
   * Returns all registered agents.
   *
   * @returns Array of all registered agents
   */
  getAll(): Agent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Checks if an agent with the given ID is registered.
   *
   * @param id - The agent ID to check
   * @returns true if the agent is registered, false otherwise
   */
  has(id: AgentId): boolean {
    return this.agents.has(id)
  }

  /**
   * Unregisters an agent by its ID.
   *
   * @param id - The agent ID to unregister
   * @returns true if the agent was found and removed, false otherwise
   */
  unregister(id: AgentId): boolean {
    return this.agents.delete(id)
  }

  /**
   * Returns a record of all agent IDs to their descriptions.
   * Useful for generating agent pool documentation.
   *
   * @returns Record mapping agent IDs to descriptions
   */
  getDescriptions(): Record<AgentId, string> {
    const descriptions: Record<AgentId, string> = {}
    for (const [id, agent] of this.agents) {
      descriptions[id] = agent.description
    }
    return descriptions
  }

  /**
   * Returns the count of registered agents.
   *
   * @returns Number of registered agents
   */
  get count(): number {
    return this.agents.size
  }

  /**
   * Clears all registered agents from the registry.
   * Primarily useful for testing.
   */
  clear(): void {
    this.agents.clear()
  }
}
