import { MessageSender, ToolResult } from 'types'
import { MessageMetadata } from 'types/chat'
import { SessionData } from 'types/session'
import { Widget, WidgetType } from 'types/widget'
import { log } from '@utils/logger'

export const documentsTool = async (sessionData: SessionData): Promise<ToolResult<MessageMetadata | undefined>> => {
  try {
    if ((sessionData.chatContext as unknown as { documents: string[] }).documents.length === 0) {
      throw new Error('No documents found')
    }

    const downloadWidget: Widget = {
      type: WidgetType.WIDGET_1,
    }

    const metadata: MessageMetadata = {
      source: MessageSender.ASSISTANT,
      widget: downloadWidget,
    }

    return await Promise.resolve({
      content: metadata,
      status: 'success',
    })
  } catch (error) {
    log.error('[documentsTool] Error sending document', error)
    return {
      content: undefined,
      status: 'error',
    }
  }
}
