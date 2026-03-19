import { getChatSessionInstance } from '@agents'
import { getAgentGraphData } from '@lib/getAgentGraphData'
import { initRegistry } from '@agents/registry'
import { SESSION_IDS } from '@constants/chat'
import { PAGE_STREAMING_TITLE, PAGE_STREAMING_DESCRIPTION } from '@constants/ui'
import { ExamplePageLayout } from '@organisms'

export default async function StreamExample() {
  initRegistry()
  const agents = getAgentGraphData()
  const session = getChatSessionInstance({ sessionId: SESSION_IDS.EXAMPLES.STREAMING })
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title={PAGE_STREAMING_TITLE}
      description={PAGE_STREAMING_DESCRIPTION}
      sessionId={SESSION_IDS.EXAMPLES.STREAMING}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="stream"
      agents={agents}
    />
  )
}
