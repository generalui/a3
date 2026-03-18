# Architecture

## Architecture at a Glance

```text
┌──────────────────────────────────────────────────────────────┐
│                      Your Application                        │
└─────────────────────────┬────────────────────────────────────┘
                          │                          ▲
                .send(message)              ChatResponse
                          │              { responseMessage,
                          │                state, goalAchieved }
                          ▼                          │
┌──────────────────────────────────────────────────────────────┐
│                       ChatSession                            │
│                                                              │
│  1. Load session from store          6. Save updated session │
│  2. Append user message              5. Append bot message   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ manageFlow({ agent,              │ { responseMessage,
            │   sessionData })                 │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                        ChatFlow                              │
│                                                              │
│  Looks up active agent, delegates, checks routing            │
│                                                              │
│  If nextAgent ≠ activeAgent:                                 │
│    ┌──────────────────────────────────────────────────────┐  │
│    │  Recursive call to manageFlow                        │  │
│    │  with new agent + updated state                      │  │
│    └──────────────────────────────────────────────────────┘  │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ generateResponse            │ { chatbotMessage,
            │   ({ agent, sessionData })       │   newState,
            │                                  │   nextAgentId }
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                      Active Agent                            │
│                                                              │
│  • Builds system prompt (prompt)                             │
│  • Defines output schema (Zod)                               │
│  • Determines next agent (transition)                        │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ prompt + schema                  │ structured JSON
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                       Provider                               │
│             (Bedrock, OpenAI, Anthropic)                     │
│                                                              │
│  • Converts Zod → JSON Schema                                │
│  • Merges message history                                    │
│  • Model fallback on error                                   │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │                                  ▲
            │ API request                      │ API response
            ▼                                  │
┌──────────────────────────────────────────────────────────────┐
│                         LLM                                  │
└──────────────────────────────────────────────────────────────┘
```

## How It Flows

1. Your app calls `session.send(message)` with the user's input.
1. **ChatSession** loads session data (history, state) from the configured store and appends the user message.
1. **ChatFlow** looks up the active agent and calls `generateResponse`.
1. The **Agent** builds a system prompt, defines its Zod output schema, and delegates to the provider.
1. The **Provider** sends the request to the LLM and returns structured JSON.
1. The **Agent** extracts state updates and a routing decision (`nextAgentId`) from the response.
1. If the next agent differs from the active agent, ChatFlow **recursively calls `manageFlow`** with the new agent and updated state.
1. **ChatSession** appends the bot message, saves the updated session, and returns a `ChatResponse` to your app.

Agents route dynamically.
There is no fixed graph.
Each agent decides whether to continue or hand off based on the conversation.
