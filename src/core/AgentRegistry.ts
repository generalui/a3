import { Agent, AgentId, BaseState, BaseChatContext } from 'types'

/**
 * AgentRegistry - A centralized singleton registry for managing agents.
 *
 * This allows consumers of the library to dynamically register their own agents
 * at runtime, enabling modular and extensible agent architectures.
 *
 * The registry is generic over TState - all agents share the same state type.
 *
 * @example
 * ```typescript
 * import { AgentRegistry } from '@genui/a3'
 *
 * interface State extends BaseState {
 *   userName?: string
 * }
 *
 * // Get a typed registry instance
 * const registry = AgentRegistry.getInstance<State>()
 *
 * // Register a single agent
 * registry.register(myAgent)
 *
 * // Register multiple agents at once
 * registry.register([agent1, agent2, agent3])
 *
 * const agent = registry.get('my-agent-id')
 * ```
 */
export class AgentRegistry<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> {
  // Use 'any' for static storage to allow different TState instantiations
  // The type safety is enforced through getInstance<TState>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static instance: AgentRegistry<any, any> | null = null
  private agents: Map<AgentId, Agent<TState, TContext>> = new Map()

  private constructor() {}

  static getInstance<
    TState extends BaseState = BaseState,
    TContext extends BaseChatContext = BaseChatContext,
  >(): AgentRegistry<TState, TContext> {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry<TState, TContext>()
    }
    return AgentRegistry.instance as AgentRegistry<TState, TContext>
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
  register(agents: Agent<TState, TContext> | Agent<TState, TContext>[]): void {
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
  get(id: AgentId): Agent<TState, TContext> | undefined {
    return this.agents.get(id)
  }

  /**
   * Returns all registered agents.
   *
   * @returns Array of all registered agents
   */
  getAll(): Agent<TState, TContext>[] {
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
   * Unregisters an agent by its ID or agent instance.
   *
   * @param agentOrId - The agent ID or agent instance to unregister
   * @returns true if the agent was found and removed, false otherwise
   */
  unregister(agentOrId: AgentId | Agent<TState, TContext>): boolean {
    const id = typeof agentOrId === 'string' ? agentOrId : agentOrId.id
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
      if (agent.description) {
        descriptions[id] = agent.description
      }
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
