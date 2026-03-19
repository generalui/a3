import { getChatSessionInstance } from '@agents'
import { getAgentGraphData } from '@lib/getAgentGraphData'
import { initRegistry } from '@agents/registry'
import { SESSION_IDS } from '@constants/chat'
import { PAGE_BLOCKING_TITLE, PAGE_BLOCKING_DESCRIPTION } from '@constants/ui'
import { ExamplePageLayout } from '@organisms'

export default async function ChatExample() {
  initRegistry()
  const agents = getAgentGraphData()
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.BLOCKING })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title={PAGE_BLOCKING_TITLE}
      description={PAGE_BLOCKING_DESCRIPTION}
      sessionId={SESSION_IDS.EXAMPLES.BLOCKING}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="blocking"
      agents={agents}
    />
  )
}
