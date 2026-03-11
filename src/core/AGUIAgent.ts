import { AbstractAgent, RunAgentInput, BaseEvent, EventType } from '@ag-ui/client'
import { Observable } from 'rxjs'
import { ChatSession } from './chatSession'
import { BaseState, BaseChatContext, StreamEvent } from 'types'

export interface AGUIAgentConfig {
  agentId?: string
  description?: string
  createSession: (input: RunAgentInput) => ChatSession<BaseState, BaseChatContext>
}

export class AGUIAgent extends AbstractAgent {
  private createSession: (input: RunAgentInput) => ChatSession<BaseState, BaseChatContext>

  constructor(config: AGUIAgentConfig) {
    super({ agentId: config.agentId, description: config.description ?? 'A3 Agent' })
    this.createSession = config.createSession
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      const session = this.createSession(input)
      const message = this.extractMessage(input)
      ;(async () => {
        subscriber.next({
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent)

        const stream: AsyncGenerator<StreamEvent<BaseState>> = session.send({ message, stream: true })
        for await (const event of stream) {
          subscriber.next(event as BaseEvent)
        }
        subscriber.complete()
      })().catch((err: unknown) => subscriber.error(err))
    })
  }

  private extractMessage(input: RunAgentInput): string {
    const lastUserMsg = [...input.messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg || lastUserMsg.role !== 'user') return ''
    return typeof lastUserMsg.content === 'string' ? lastUserMsg.content : ''
  }
}
