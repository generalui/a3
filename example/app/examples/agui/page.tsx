import { getChatSessionInstance } from '@agents'
import { SESSION_IDS } from '@constants/chat'
import { ExamplePageLayout } from '@organisms'

export default async function AguiExample() {
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.AGUI })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title="A3 Example — AG-UI Protocol"
      description="A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Communication uses the AG-UI protocol, streaming structured events for text, transitions, and run lifecycle."
      sessionId={SESSION_IDS.EXAMPLES.AGUI}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="agui"
    />
  )
}
