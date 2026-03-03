import { z } from 'zod'
import { Conversation, MessageMetadata } from 'types/chat'
import { SessionData, BaseChatContext, BaseState } from 'types/session'
import { StreamEvent } from 'types/stream'

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

export type AgentResponseResult<TState extends BaseState = BaseState> = {
  newState: TState
  chatbotMessage: string
  messageMetadata?: MessageMetadata
  goalAchieved: boolean
  nextAgentId: AgentId | null
  redirectToAgent?: AgentId | null
  widgets?: object
}

export type GenerateResponseSpecification<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> = (input: FlowInput<TState, TContext>) => Promise<AgentResponseResult<TState>>

export type GenerateResponseStreamSpecification<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> = (input: FlowInput<TState, TContext>) => AsyncGenerator<StreamEvent<TState>, AgentResponseResult<TState>>

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
  description?: string
  modelId?: string // LLM Provider Model ID
  name?: string
  prompt: string | ((params: FlowInput<TState, TContext>) => Promise<string>)
  outputSchema: AgentOutputSchema<TState, TContext>
  generateResponse?: GenerateResponseSpecification<TState, TContext>
  /** Optional streaming response generator. Falls back to simpleAgentResponseStream. */
  generateResponseStream?: GenerateResponseStreamSpecification<TState, TContext>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setState?: (data: any, state: TState) => TState
  /**
   * Defines how this agent transitions to the next agent.
   *
   * **Array (non-deterministic):** Provide an array of `AgentId` strings.
   * The LLM decides which agent to hand off to via the `redirectToAgent` schema field,
   * constrained to the listed agent IDs.
   *
   * **Function (deterministic):** Provide a function `(state, goalAchieved) => AgentId`.
   * Your code decides the next agent after each turn. When a function is provided,
   * `redirectToAgent` is not exposed to the LLM — routing is fully code-controlled.
   *
   * @example
   * // Non-deterministic: LLM chooses from candidates
   * transition: ['billing', 'support', 'account']
   *
   * @example
   * // Deterministic: code decides
   * transition: (state, goalAchieved) => goalAchieved ? 'next-agent' : 'current-agent'
   */
  transition?: AgentId[] | ((state: TState, agentGoalAchieved: boolean) => AgentId)

  /*
    Strategy to filter conversation history before sending to agent.
    Agent specific filters can be implemented here.
  */
  filterHistoryStrategy?: (messages: Conversation) => Conversation
  /** Zod schemas defining the usage of widgets available to the agent */
  widgets?: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, z.ZodObject<any>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((sessionData: SessionData<TState, TContext>) => Record<string, z.ZodObject<any>>)
}
