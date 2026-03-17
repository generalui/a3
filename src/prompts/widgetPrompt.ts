import { toJSONSchema } from 'zod'
import { Agent, BaseState, BaseChatContext } from 'types'

export function widgetPrompt<TState extends BaseState, TContext extends BaseChatContext = BaseChatContext>(
  agent: Agent<TState, TContext>,
) {
  if (!agent.widgets || Object.keys(agent.widgets).length === 0) {
    return ''
  }

  const widgetsDescription = Object.entries(agent.widgets)
    .map(([name, schema]) => {
      const jsonSchema = toJSONSchema(schema)
      return `Widget: ${name}
Schema:
${JSON.stringify(jsonSchema, null, 2)}`
    })
    .join('\n\n')

  return `
# AVAILABLE WIDGETS

The following UI widgets are available to you. You can trigger them by including them in your response.
These widgets are used to provide structured information or interactive forms to the user.

${widgetsDescription}

# WIDGET USAGE INSTRUCTIONS

- You may fill their properties as necessary or by following provided instructions.
- Only return a widget if it is relevant to the current conversation state.
- Ensure the 'data' object strictly follows the provided schema for the selected widget.
- You can only return one widget at a time in the 'widget' field.
`
}
