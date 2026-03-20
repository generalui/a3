# Widgets

Widgets are optional, schema-driven UI components that agents can include alongside their text responses.
The LLM populates widget data based on Zod schemas; the consuming application renders corresponding UI.

Widgets are not required to use A3.
They are an opt-in pattern for agents that need to surface structured, visual information beyond plain text.

For agent basics, see [Core Concepts](./CORE-CONCEPTS.md#agent).

## How Widgets Work

1. You define a `widgets` property on your agent — a record of Zod schemas keyed by widget name.
1. A3 automatically injects the schema descriptions into the LLM prompt, so the LLM knows what data to produce.
1. The LLM returns structured data including a `widgets` object with populated fields.
1. A3 validates the response against your schemas and strips any empty widget objects.
1. Your application receives `result.widgets` from `ChatSession.send()` and renders the appropriate UI.

You define the schemas.
A3 handles prompt injection, schema merging, validation, and cleanup.
Your application handles rendering.

## Defining Widgets on an Agent

The `widgets` property on an [Agent](./CORE-CONCEPTS.md#agent) accepts either a static record of Zod schemas or a function that returns one.

### Static Widgets

When widget schemas are constant, define `widgets` as a plain object.
Each key becomes a widget name in the LLM response; each value is a Zod schema the LLM fills.

```typescript
import { z } from 'zod'
import { Agent, BaseState } from '@genui/a3'

interface MyState extends BaseState {
  appointmentDate?: string
}

const BookingSchema = z.object({
  date: z.string().describe('Appointment date in human-readable format'),
  time: z.string().describe('Appointment time'),
  location: z.string().describe('Appointment location address'),
})

const reviewAgent: Agent<MyState> = {
  id: 'review',
  name: 'Review Agent',
  description: 'Reviews appointment details with the user',
  prompt: async () => `
    You review appointment details with the user.
    Populate the booking widget with the confirmed details.
  `,
  outputSchema: z.object({
    appointmentDate: z.string().optional(),
  }),
  widgets: {
    booking: BookingSchema,
  },
  transition: ['next-agent'],
}
```

### Dynamic Widgets

When widget configuration depends on runtime state, define `widgets` as a function.
It receives `sessionData` and returns the widget record.

```typescript
import { z } from 'zod'
import { Agent, BaseState, BaseChatContext, SessionData } from '@genui/a3'

interface MyState extends BaseState {
  hasInsurance?: boolean
}

const PatientSchema = z.object({
  name: z.string().describe('Patient full name'),
  dob: z.string().describe('Date of birth'),
})

const InsuranceSchema = z.object({
  provider: z.string().describe('Insurance provider name'),
  policyNumber: z.string().describe('Policy number'),
})

const summaryAgent: Agent<MyState> = {
  id: 'summary',
  name: 'Summary Agent',
  description: 'Displays a summary of collected information',
  prompt: async () => `Summarize the information collected so far.`,
  outputSchema: z.object({}),
  widgets: (sessionData: SessionData<MyState>) => ({
    patient: PatientSchema,
    ...(sessionData.state.hasInsurance && {
      insurance: InsuranceSchema,
    }),
  }),
  transition: (state, goalAchieved) => (goalAchieved ? 'done' : 'summary'),
}
```

Use dynamic widgets to conditionally include or exclude widgets based on state, context, or any runtime condition.

## The `interactive` Pattern

Widgets can be extended with an `interactive` field to signal whether the widget is interactive or readonly.
This is a convention — A3 does not enforce it at the framework level.
The consuming application's widget renderer uses this field to decide how to render.

When `interactive` defaults to `false`, the LLM returns `{ "interactive": false, ...data }`.
The application can strip the `interactive` property and use its value to control rendering behavior — for example, hiding action buttons or disabling form inputs.

This pattern is commonly used with [dynamic widgets](#dynamic-widgets) for summary or recap views:

```typescript
const nonInteractive = { interactive: z.boolean().default(false) }

const wrapUpAgent: Agent<MyState> = {
  id: 'wrap-up',
  // ...other properties
  widgets: (sessionData) => ({
    patient: PatientSchema.extend(nonInteractive),
    booking: BookingSchema.extend(nonInteractive),
  }),
}
```

## Widget Data in the Response

### `ChatResponse.widgets`

`ChatSession.send()` returns a [`ChatResponse`](./CORE-CONCEPTS.md#chat-response) with an optional `widgets?: object` property.
If no widgets were populated (or all widget objects were empty), `widgets` is `undefined`.

### `Message.widgets`

Widget data is also stored on individual messages in the conversation history:

```typescript
type Message = {
  text: string
  widgets?: object
  // ...other properties
}
```

This allows the application to re-render widgets when displaying conversation history.

### Empty Widget Stripping

A3 automatically strips empty widget objects.
If the LLM returns `"widgets": {}`, it becomes `undefined` in the response.
Your application only needs to check `if (result.widgets)` — no need to guard against empty objects.

## Rendering Widgets in Your Application

A3 handles schemas, prompt injection, validation, and cleanup.
Your application handles rendering.
This section covers recommended patterns for building widget components and wiring them into your chat UI.
Examples use React, but the concepts — registry, context, dispatcher — apply to any framework.

### Widget Component Structure

Each widget pairs a Zod schema (defined on the agent) with a UI component that receives `z.infer<typeof Schema>` as props.
Components read `disabled` and `readonly` flags from widget context to control interactivity.

**BookingCard** — a display card with action buttons:

```tsx
function BookingCard({ date, time, location }: z.infer<typeof BookingSchema>) {
  const { disabled, readonly } = useWidgetContext()
  return (
    <div>
      <p>{date} at {time}</p>
      <p>{location}</p>
      {!readonly && (
        <>
          <button disabled={disabled}>Confirm</button>
          <button disabled={disabled}>Update</button>
        </>
      )}
    </div>
  )
}
```

**TimeSlotsCard** — interactive selection where each button sends a message:

```tsx
function TimeSlotsCard({ slots }: z.infer<typeof TimeSlotsSchema>) {
  const { disabled } = useWidgetContext()
  const { sendMessage } = useChatContext()
  return (
    <div>
      {slots.map((slot) => (
        <button key={slot} disabled={disabled} onClick={() => sendMessage(slot)}>
          {slot}
        </button>
      ))}
    </div>
  )
}
```

### Recommended Patterns

Here are patterns that work well for rendering A3 widgets.
Your application can implement these however you like — these are proven patterns from production A3 apps.

**Widget Registry** — a mapping from widget name strings to components.
Keys must match the agent's `widgets` keys.

```typescript
const widgetRegistry: Record<string, ComponentType<any>> = {
  booking: BookingCard,
  time_slots: TimeSlotsCard,
  patient: PatientCard,
}
```

**Widget Dispatcher** — a component that looks up the registry, strips `interactive`, and wraps in context.

```tsx
function Widget({ widget, data, disabled }: { widget: string; data: any; disabled: boolean }) {
  const Component = widgetRegistry[widget]
  if (!Component) return null
  const { interactive, ...props } = data
  return (
    <WidgetContext.Provider value={{ disabled, readonly: interactive === false }}>
      <Component {...props} />
    </WidgetContext.Provider>
  )
}
```

**Widget Context** — a React context providing rendering flags.

```typescript
const WidgetContext = createContext({ disabled: false, readonly: false })
const useWidgetContext = () => useContext(WidgetContext)
```

| Flag | Meaning | Set when |
|------|---------|----------|
| `disabled` | Widget cannot accept input | Message is not the latest |
| `readonly` | Widget hides action buttons | `interactive` is `false` |

### Rendering Widgets from Messages

The message renderer iterates `message.widgets` and passes each entry to the dispatcher:

```tsx
{message.widgets && Object.entries(message.widgets).map(([name, data]) => (
  <Widget key={name} widget={name} data={data} disabled={!isLastMessage} />
))}
```

Key points:
1. Pass `disabled={!isLastMessage}` so only the latest message's widgets accept input.
1. A single message can contain multiple widgets.
1. Guard with `message.widgets &&` since widgets are optional.

### The User Interaction Loop

The pattern that makes widgets interactive:

1. Widget accesses `sendMessage` from chat context.
1. On user action, calls `sendMessage('user choice')`.
1. This triggers another `ChatSession.send()` cycle.
1. The new response arrives with new widgets and/or text.
1. Previous message widgets become `disabled`.

```
User clicks → sendMessage() → ChatSession.send() → new response → new widgets → previous widgets disabled
```

Example — a time slot button that continues the conversation:

```tsx
<button disabled={disabled} onClick={() => sendMessage(slot)}>
  {slot}
</button>
```

When the user clicks, the selected slot is sent as a message.
The agent processes it, updates state, and responds — potentially with a new widget for the next step.

## Best Practices

1. **Use `.describe()` on all schema fields.**
A3 injects schema descriptions into the LLM prompt automatically.
Clear descriptions lead to better-populated widget data.

1. **Keep widget schemas focused.**
One widget per concern.
A booking widget shows booking data; a patient widget shows patient data.
Avoid monolithic schemas that combine unrelated information.

1. **Use dynamic widgets to conditionally show or hide based on state.**
Rather than having the LLM decide whether to populate a widget, use the function form to only include widgets that are relevant to the current state.

1. **Use the `interactive` extension for readonly summary views.**
When re-displaying previously collected data (e.g., during a wrap-up step), extend schemas with `interactive: z.boolean().default(false)` so the application can render them as non-interactive.

1. **Share Zod schemas between agent definitions and component types.**
Use `z.infer<typeof Schema>` for component props so they stay in sync with the LLM output automatically.
If the schema changes, TypeScript catches mismatches at compile time — no manual type maintenance.

1. **Centralize widget mapping in a registry.**
A single `widgetRegistry` record decouples message rendering from component details.
Adding a new widget means one registry entry and one component — no changes to the message renderer.

1. **Consider disabling text input when interactive widgets are active.**
When a message contains interactive widgets, guide users to interact via the widget rather than free-form text.

```typescript
function hasInteractiveWidget(widgets?: object): boolean {
  if (!widgets) return false
  return Object.values(widgets).some(
    (data) => typeof data === 'object' && data !== null && ('interactive' in data ? data.interactive !== false : true)
  )
}
```

Pass the result to your chat input to conditionally disable it:

```tsx
<ChatInput disabled={hasInteractiveWidget(latestMessage?.widgets)} />
```
