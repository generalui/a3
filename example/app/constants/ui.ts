// --- Metadata ---
export const APP_TITLE = 'A3 Core Example'
export const APP_DESCRIPTION = 'Example application for @genui/a3'

// --- Navigation (Sidebar) ---
export const NAV_HEADER = 'A3'
export const NAV_HOME = 'Home'
export const NAV_ONBOARDING = 'Onboarding'
export const NAV_EXAMPLES = 'Examples'
export const NAV_HELLO_WORLD = 'Hello World'
export const NAV_PLUMBING = 'Steadfast Plumbing'

// --- Onboarding ---
export const ONBOARDING_TAGLINE =
  '<strong>A3</strong> — Predictable, governable multi-agent orchestration for TypeScript.'

// --- Examples Index ---
export const EXAMPLES_HEADING = 'A3 Examples'
export const EXAMPLES_SUBTITLE =
  'Explore different multi-agent flows built with A3 — from a simple greeting to a full plumbing triage system.'
export const EXAMPLES_CTA = 'Try it out'

export const EXAMPLE_HELLO_WORLD_TITLE = 'Hello World'
export const EXAMPLE_HELLO_WORLD_DESCRIPTION =
  'A simple two-agent flow: a greeting agent learns your name, then hands off to an age agent. Demonstrates deterministic and LLM-driven transitions with blocking (synchronous) communication.'
export const EXAMPLE_PLUMBING_TITLE = 'Steadfast Plumbing'
export const EXAMPLE_PLUMBING_DESCRIPTION =
  'A six-agent plumbing triage system — intake, triage, emergency assessment, troubleshooting, scheduling, and escalation. Demonstrates streaming (SSE) communication with complex agent routing.'

// --- Example Page Titles & Descriptions ---
export const PAGE_HELLO_WORLD_TITLE = 'A3 Example — Hello World'
export const PAGE_HELLO_WORLD_DESCRIPTION =
  "A greeting agent asks for your name. Once it has it, control passes to an age agent that asks for your age. You can ask to change your name at any time and you'll be handed back to the greeting agent. Each response arrives in full once the agent is done thinking."
export const PAGE_PLUMBING_TITLE = 'A3 Example — Steadfast Plumbing'
export const PAGE_PLUMBING_DESCRIPTION =
  "Steadfast Plumbing Co.'s intake agent collects your name and issue. A triage agent classifies severity and routes to emergency assessment, troubleshooting, or scheduling. Responses stream in real-time via SSE."

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
