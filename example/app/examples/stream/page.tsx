import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'
import { ExamplePageLayout } from '@organisms'

export default async function StreamExample() {
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.STREAMING })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title="A3 Example — Streaming"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent."
      sessionId={SESSION_IDS.EXAMPLES.STREAMING}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="stream"
    />
  )
}
