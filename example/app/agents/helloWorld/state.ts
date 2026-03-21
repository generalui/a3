import { BaseState } from '@genui/a3'

/**
 * State for the Hello World example.
 * Shared across the greeting and age agents.
 */
export interface HelloWorldState extends BaseState {
  userName?: string
  userAge?: string
}
