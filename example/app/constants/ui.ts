// --- Metadata ---
export const APP_TITLE = 'A3 Core Example'
export const APP_DESCRIPTION = 'Example application for @genui/a3'

// --- Navigation (Sidebar) ---
export const NAV_HEADER = 'A3'
export const NAV_HOME = 'Home'
export const NAV_ONBOARDING = 'Onboarding'
export const NAV_EXAMPLES = 'Examples'
export const NAV_CHAT = 'Chat'
export const NAV_STREAMING = 'Streaming'
export const NAV_AGUI = 'AG-UI'

// --- Onboarding ---
export const ONBOARDING_TAGLINE =
  '<strong>A3</strong> — Predictable, governable multi-agent orchestration for TypeScript.'

// --- Examples Index ---
export const EXAMPLES_HEADING = 'A3 Examples'
export const EXAMPLES_SUBTITLE =
  'Explore the different communication protocols and frontend implementations available in the A3 architecture.'
export const EXAMPLES_CTA = 'Try it out'

export const EXAMPLE_BLOCKING_TITLE = 'Blocking Chat'
export const EXAMPLE_BLOCKING_DESCRIPTION =
  "A synchronous (unary) chat implementation. The client waits for the agent to finish processing completely before rendering the response."
export const EXAMPLE_STREAMING_TITLE = 'Streaming Chat'
export const EXAMPLE_STREAMING_DESCRIPTION =
  "A streaming response implementation using Server-Sent Events (SSE). The client renders the agent's response incrementally as it's being generated."
export const EXAMPLE_AGUI_TITLE = 'AG-UI Protocol'
export const EXAMPLE_AGUI_DESCRIPTION =
  'Agentic UI implementation using the AG-UI protocol. The agent returns structured semantic events driving the client interface in real-time.'

// --- Example Page Titles & Descriptions ---
export const PAGE_BLOCKING_TITLE = 'A3 Example — Blocking Chat'
export const PAGE_BLOCKING_DESCRIPTION =
  "A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Each response arrives in full once the agent is done thinking."
export const PAGE_STREAMING_TITLE = 'A3 Example — Streaming'
export const PAGE_STREAMING_DESCRIPTION =
  "A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent."
export const PAGE_AGUI_TITLE = 'A3 Example — AG-UI Protocol'
export const PAGE_AGUI_DESCRIPTION =
  "A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Communication uses the AG-UI protocol, streaming structured events for text, transitions, and run lifecycle."

// --- Chat UI ---
export const CHAT_PLACEHOLDER = 'Type a message...'
export const CHAT_SEND = 'Send'
export const CHAT_RESTART = 'Restart session'
export const CHAT_ERROR = 'Sorry, something went wrong. Please try again.'
export const CHAT_ERROR_SHORT = 'Sorry, something went wrong.'
export const CHAT_TRANSITION = 'Agent transition in progress...'

// --- State Viewer ---
export const STATE_HEADING = 'Session State'
export const STATE_EMPTY = 'No state properties'

// --- Agent Graph ---
export const GRAPH_HEADING = 'Agent Graph'
export const GRAPH_LEGEND_DETERMINISTIC = 'Deterministic'
export const GRAPH_LEGEND_LLM = 'LLM-driven'
export const GRAPH_ACTIVE_BADGE = 'Active'
