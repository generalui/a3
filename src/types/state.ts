/**
 * BaseState defines the minimum required fields for state.
 * Consumers extend this interface with their own properties.
 *
 * Note: State is GLOBAL across all agents in a session. All agents
 * share the same state object, enabling cross-agent data flow.
 *
 * @example
 * ```typescript
 * interface State extends BaseState {
 *   userName?: string
 *   isAuthenticated: boolean
 * }
 * ```
 */
export interface BaseState {
  [key: string]: unknown // Allow extension
}
