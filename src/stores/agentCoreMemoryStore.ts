import { BedrockAgentCoreClient, CreateEventCommand, ListEventsCommand } from '@aws-sdk/client-bedrock-agentcore'
import { SessionStore, SessionData, BaseState, BaseChatContext } from 'types'

export class AgentCoreMemoryStore<
  TState extends BaseState = BaseState,
  TContext extends BaseChatContext = BaseChatContext,
> implements SessionStore<TState, TContext> {
  private client: BedrockAgentCoreClient
  private memoryId: string

  constructor(config: { region: string; memoryId: string }) {
    this.client = new BedrockAgentCoreClient({ region: config.region })
    this.memoryId = config.memoryId
  }

  async load(sessionId: string): Promise<SessionData<TState, TContext> | null> {
    try {
      const command = new ListEventsCommand({
        memoryId: this.memoryId,
        sessionId,
        actorId: 'user', // Default actor
        maxResults: 10, // Fetch recent events to find latest snapshot
        includePayloads: true,
      })

      const response = await this.client.send(command)

      const events = response.events || []

      for (const event of events) {
        const blobPayload = event.payload?.find((p: { blob?: unknown }) => p.blob)
        if (blobPayload && blobPayload.blob) {
          return JSON.parse(blobPayload.blob as string) as SessionData<TState, TContext>
        }
      }

      return null
    } catch (e) {
      console.error('Failed to load session', e)
      return null
    }
  }

  async save(sessionId: string, data: SessionData<TState, TContext>): Promise<void> {
    const command = new CreateEventCommand({
      memoryId: this.memoryId,
      sessionId,
      actorId: 'user',
      eventTimestamp: new Date(),
      payload: [
        {
          blob: JSON.stringify(data),
        },
      ],
    })

    await this.client.send(command)
  }
}
