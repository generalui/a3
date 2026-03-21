import { initRegistry, getChatSessionInstance, SESSION_ID } from '@agents/helloWorld'
import { getAgentGraphData } from '@lib/getAgentGraphData'
import { PAGE_HELLO_WORLD_TITLE, PAGE_HELLO_WORLD_DESCRIPTION } from '@constants/ui'
import { ExamplePageLayout } from '@organisms'

export default async function HelloWorldExample() {
  initRegistry()
  const agents = getAgentGraphData('helloWorld')
  const session = getChatSessionInstance(SESSION_ID)
  const sessionData = await session.getOrCreateSessionData()

  return (
    <ExamplePageLayout
      title={PAGE_HELLO_WORLD_TITLE}
      description={PAGE_HELLO_WORLD_DESCRIPTION}
      sessionId={SESSION_ID}
      initialMessages={sessionData.messages}
      initialActiveAgentId={sessionData.activeAgentId}
      initialState={sessionData.state}
      variant="blocking"
      agents={agents}
    />
  )
}
