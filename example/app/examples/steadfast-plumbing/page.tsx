import { initRegistry, getChatSessionInstance, SESSION_ID } from '@agents/steadfastPlumbing'
import { getAgentGraphData } from '@lib/getAgentGraphData'
import { PAGE_PLUMBING_TITLE, PAGE_PLUMBING_DESCRIPTION } from '@constants/ui'
import { ExamplePageLayout } from '@organisms'

export default async function SteadfastPlumbingExample() {
  initRegistry()
  const agents = getAgentGraphData('steadfastPlumbing')
  const session = getChatSessionInstance(SESSION_ID)
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title={PAGE_PLUMBING_TITLE}
      description={PAGE_PLUMBING_DESCRIPTION}
      sessionId={SESSION_ID}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="stream"
      agents={agents}
    />
  )
}
