import { BaseState } from '@genui/a3'

/**
 * Consumer defines their GLOBAL state extending BaseState.
 * This state is shared across ALL agents in the session.
 */
export interface State extends BaseState {
  userName?: string
  userAge?: string
}
