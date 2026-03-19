export const WELCOME_MESSAGE_TEXT = `Welcome to A3! I can help you understand multi-agent orchestration — ask me anything about agents, transitions, providers, or getting started.

**Vibe coding?** Just paste this into your AI coding assistant:
\`\`\`
Ensure you carefully analyze and understand the instructions in @CLAUDE.md.
I want to create a new project using A3 leveraging this initial "quick start" framework.
\`\`\``

export const SESSION_IDS = {
  ONBOARDING: 'onboarding',
  EXAMPLES: {
    BLOCKING: 'blocking',
    STREAMING: 'streaming',
    AGUI: 'agui',
  },
}

const EXAMPLE_GREETING = `Hi there! I'm the **greeting agent**. What's your name?`

export const SESSION_INITIAL_MESSAGES: Record<string, string> = {
  [SESSION_IDS.ONBOARDING]: WELCOME_MESSAGE_TEXT,
  [SESSION_IDS.EXAMPLES.BLOCKING]: EXAMPLE_GREETING,
  [SESSION_IDS.EXAMPLES.STREAMING]: EXAMPLE_GREETING,
  [SESSION_IDS.EXAMPLES.AGUI]: EXAMPLE_GREETING,
}
