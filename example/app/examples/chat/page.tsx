import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'
import { ExamplePageLayout } from '@organisms'

export default async function ChatExample() {
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.BLOCKING })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title="A3 Example — Blocking Chat"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Each response arrives in full once the agent is done thinking."
      sessionId={SESSION_IDS.EXAMPLES.BLOCKING}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="blocking"
    />
  )
}
