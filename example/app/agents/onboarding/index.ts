import { z } from 'zod'
import { Agent, AgentRegistry, BaseState } from '@genui/a3'
import { createChatSession, createInitialMessage } from '@agents/sessionStore'
import { prompt } from './prompt'

export const SESSION_ID = 'onboarding'

const INITIAL_MESSAGE_TEXT = `Hi! I'm an A3 agent; one of potentially many that can be orchestrated together to build reliable, predictable applications.

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

/**
 * Agent that knows everything there is to know about A3 framework, answers questions about it and guides users
 * through the process of using it.
 */
export const onboardingAgent: Agent<BaseState> = {
  id: 'onboarding',
  description: 'Onboards users to the A3 framework.',
  prompt,
  outputSchema: z.object({}),
}

/**
 * Registers the onboarding agent.
 */
export function initRegistry() {
  const registry = AgentRegistry.getInstance<BaseState>()
  registry.clear()
  registry.register(onboardingAgent)
}

/**
 * Get a ChatSession instance for onboarding.
 */
export function getChatSessionInstance(sessionId: string) {
  return createChatSession<BaseState>({
    sessionId,
    initialAgentId: 'onboarding',
    initialMessages: [createInitialMessage(INITIAL_MESSAGE_TEXT)],
  })
}
