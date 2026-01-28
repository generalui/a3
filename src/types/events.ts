// This should be extendable and dynamically created.
export enum Events {
  // Chat
  ChatOpened = 'chat.opened',

  // VerifyIdentityStarted = 'verify_identity.started',
  VerifyIdentityAttempted = 'verify_identity.attempted',
  VerifyIdentitySucceeded = 'verify_identity.succeeded',
  VerifyIdentityFailed = 'verify_identity.failed',

  // Agent
  AgentChanged = 'agent.changed',
  AgentResponse = 'agent.response',
  AgentError = 'agent.error',

  // More here
}
