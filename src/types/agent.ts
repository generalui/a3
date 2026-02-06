import { z } from 'zod'
import { Conversation, MessageMetadata } from 'types/chat'
import { SessionData, BaseChatContext, BaseState } from 'types/session'

/**
 * Agent IDs are string-based to support dynamic registration.
 * Consumers can define their own agent IDs without modifying the core library.
 */
export type AgentId = string

export interface FlowInput<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> {
  agent: Agent<TState, TContext>
  sessionData: SessionData<TState, TContext>
  lastAgentUnsentMessage?: string
}

export type GenerateAgentResponseSpecification<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> = (input: FlowInput<TState, TContext>) => Promise<{
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
export type AgentOutputSchema<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> =
  | z.ZodObject<{ [key: string]: z.ZodTypeAny }>
  | ((sessionData: SessionData<TState, TContext>) => z.ZodObject<{ [key: string]: z.ZodTypeAny }>)

export type Agent<TState extends BaseState = BaseState, TContext extends BaseChatContext = BaseChatContext> = {
  id: AgentId
  /** Description of the agent's purpose, used for agent pool discovery */
  description: string
  modelId?: string // LLM Provider Model ID
  name: string
  promptGenerator: (params: FlowInput<TState, TContext>) => Promise<string>
  outputSchema: AgentOutputSchema<TState, TContext>
  generateAgentResponse: GenerateAgentResponseSpecification<TState, TContext>
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
