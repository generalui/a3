import { getChatSessionInstance } from '@agents'
import { getAgentGraphData } from '@lib/getAgentGraphData'
import { initRegistry } from '@agents/registry'
import { SESSION_IDS } from '@constants/chat'
import { PAGE_AGUI_TITLE, PAGE_AGUI_DESCRIPTION } from '@constants/ui'
import { ExamplePageLayout } from '@organisms'

export default async function AguiExample() {
  initRegistry()
  const agents = getAgentGraphData()
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.AGUI })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title={PAGE_AGUI_TITLE}
      description={PAGE_AGUI_DESCRIPTION}
      sessionId={SESSION_IDS.EXAMPLES.AGUI}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="agui"
      agents={agents}
    />
  )
}
