export const WELCOME_MESSAGE_TEXT = `Hi! I'm an A3 agent; one of potentially many that can be orchestrated together to build reliable, predictable applications.

**Using an AI Coding Assistant?** Just paste this into your Ai prompt:

\`\`\`text
Ensure you carefully analyze and understand the instructions in @CLAUDE.md.
I want to create a new project using A3 leveraging this initial "quick start" framework.
\`\`\`

**A3** is a TypeScript framework for building multi-agent (agentic) applications. It's not an autonomous tool or a computer-use assistant, it's a developer framework for orchestrating specialized agents that handle structured data, hand off to each other deterministically, and integrate with any LLM provider (AWS Bedrock, OpenAI, Anthropic, etc).

Here's how A3 has been used in production:

### Healthcare — Patient Intake & Booking

A3 orchestrates a complex patient intake, triage, and booking flow using **16 specialized agents** that handle strictly validated, typed data payloads — gracefully handing off to one another without the confusion or hallucination of a single massive prompt, all backed securely by AWS DynamoDB:

- **Pre-Triage Intake** → Verifies identity, routes to Illness or Injury Triage
- **Illness / Injury Triage** → Assesses symptoms or injury details
- **Visit Review** → Confirms clinic location
- **Patient Review** → Validates demographic and clinical records
- **Insurance Review** → Verifies medical coverage
- **Payment** → Handles copays and balances
- **Pick A Time** → Presents available scheduling slots
- **Book Visit** → Commits the appointment
- **Pharmacy Method** → Confirms prescription routing
- **Summary & Wrap-Up** → Final instructions and session close

Plus edge-case agents: Rejection Handler (ER reroutes), Urgent Care Guide (FAQs), Find User By Phone (SMS matching), and Survey (post-visit feedback).

---

Ask me anything about building with A3 — agents, transitions, providers, or getting started!
`

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
