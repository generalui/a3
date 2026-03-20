'use server'

import { getChatSessionInstance } from '@agents'
import { initRegistry } from '@agents/registry'

export async function restartSession(sessionId: string) {
  initRegistry()
  const session = getChatSessionInstance({ sessionId })
  return await session.restart()
}
