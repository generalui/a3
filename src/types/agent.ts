import { z } from 'zod'
import { Conversation, MessageMetadata } from 'types/chat'
import { SessionData } from 'types/session'
import { BaseState } from 'types/state'

/**
 * Agent IDs are string-based to support dynamic registration.
 * Consumers can define their own agent IDs without modifying the core library.
 */
export type AgentId = string

export interface FlowInput<TState extends BaseState = BaseState> {
  agent: Agent<TState>
  sessionData: SessionData<TState>
  lastAgentUnsentMessage?: string
}

export type GenerateAgentResponseSpecification<TState extends BaseState = BaseState> = (
  input: FlowInput<TState>,
) => Promise<{
  newState: TState
  chatbotMessage: string
  messageMetadata?: MessageMetadata
  goalAchieved: boolean
  nextAgentId: AgentId | null
  redirectToAgent?: AgentId | null
}>

/**
 * Output schema for an agent.
 * Base fields (chatbotMessage, goalAchieved, redirectToAgent) are added automatically.
 */
export type AgentOutputSchema<TState extends BaseState = BaseState> =
  | z.ZodObject<{ [key: string]: z.ZodTypeAny }>
  | ((sessionData: SessionData<TState>) => z.ZodObject<{ [key: string]: z.ZodTypeAny }>)

export type Agent<TState extends BaseState = BaseState> = {
  id: AgentId
  /** Description of the agent's purpose, used for agent pool discovery */
  description: string
  modelId?: string // LLM Provider Model ID
  name: string
  promptGenerator: (params: FlowInput<TState>) => Promise<string>
  outputSchema: AgentOutputSchema<TState>
  generateAgentResponse: GenerateAgentResponseSpecification<TState>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitDataInGeneralFormat: (data: any, state: TState) => TState
  nextAgentSelector?: (state: TState, agentGoalAchieved: boolean) => AgentId
  /** Agent IDs this agent can transition to. Used to constrain redirectToAgent in the schema. */
  transitionsTo?: AgentId[]

  /*
    Strategy to filter conversation history before sending to agent.
    Agent specific filters can be implemented here.
  */
  filterHistoryStrategy?: (messages: Conversation) => Conversation
}
