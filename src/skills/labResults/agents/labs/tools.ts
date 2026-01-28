import { UI } from '@constants/ui'
import { MessageSender, ToolResult } from 'types'
import { MessageMetadata } from 'types/chat'
import { SessionData } from 'types/SessionService'
import { Widget, WidgetType } from 'types/Widgets/common'
import { log } from '@utils/logger'

export const documentsTool = async (
  sessionData: SessionData,
): Promise<ToolResult<MessageMetadata | string | undefined>> => {
  try {
    const documents = sessionData.chatContext.documents.filter(Boolean) // keep only valid string values

    if (documents.length === 0) {
      throw new Error('No documents found')
    }

    const labResultsWidget: Widget = {
      type: WidgetType.LAB_RESULTS,
      displayText: UI.LABS_WIDGET_BUTTON,
    }

    const metadata: MessageMetadata = {
      source: MessageSender.ASSISTANT,
      widget: labResultsWidget,
    }

    return await Promise.resolve({
      content: metadata,
      status: 'success',
    })
  } catch (error) {
    log.error('[labResultsTool] Error sending document', error)
    return {
      content: error instanceof Error ? error.message : '',
      status: 'error',
    }
  }
}
