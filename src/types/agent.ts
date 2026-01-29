import { z } from 'zod'
import { Conversation, MessageMetadata } from 'types/chat'
import { SessionData } from 'types/session'
import { ChatState } from 'types/payloads'

export enum AgentId {}

export type AgentIdOrEmpty = AgentId | ''

export const AGENT_DESCRIPTIONS: Record<AgentId, string> = {}

export interface FlowInput {
  agent: Agent
  sessionData: SessionData
  lastAgentUnsentMessage?: string
}

export type GenerateAgentResponseSpecification = (input: FlowInput) => Promise<{
  newChatState: ChatState
  chatbotMessage: string
  messageMetadata?: MessageMetadata
  goalAchieved: boolean
  nextAgentId: AgentIdOrEmpty
  redirectToAgent?: AgentId | null
}>

export type Agent = {
  id: AgentId
  modelId?: string // LLM Provider Model ID
  name: string
  promptGenerator: (params: FlowInput) => Promise<string>
  responseFormat:
    | z.ZodObject<{
        [key: string]: z.ZodTypeAny
      }>
    | ((sessionData: SessionData) => z.ZodObject<{
        [key: string]: z.ZodTypeAny
      }>)
  generateAgentResponse: GenerateAgentResponseSpecification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitDataInGeneralFormat: (data: any, chatState: ChatState) => ChatState
  nextAgentSelector?: (chatState: ChatState, agentGoalAchieved: boolean) => AgentId | string

  /*
    Strategy to filter conversation history before sending to agent.
    Agent specific filters can be implemented here.
  */
  filterHistoryStrategy?: (messages: Conversation) => Conversation
}
