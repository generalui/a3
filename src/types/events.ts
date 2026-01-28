// This should be extendable and dynamically created.
export enum Events {
  // Chat
  ChatOpened = 'chat.opened',

  // Document
  DocumentMessageSent = 'document.message_sent',
  DocumentMessageReceived = 'document.message_received',
  DocumentViewed = 'document.viewed',
  DocumentViewFailed = 'document.view_failed',
  DocumentDownloadClicked = 'document.download_clicked',
  DocumentDownloadFailed = 'document.download_failed',

  // SMS
  SMSFailed = 'sms.failed',
  SMSOther = 'sms.other',
  SMSSent = 'sms.sent',
  SMSSentToService = 'sms.sent_to_service',
  SMSSuccess = 'sms.success',

  // Request New Link
  SMSRequestNewLinkInitiated = 'sms.request_new_link_initiated',
  SMSRequestNewLinkSuccess = 'sms.request_new_link_success',
  SMSRequestNewLinkFailed = 'sms.request_new_link_failed',

  // VerifyIdentityStarted = 'verify_identity.started',
  VerifyIdentityAttempted = 'verify_identity.attempted',
  VerifyIdentitySucceeded = 'verify_identity.succeeded',
  VerifyIdentityFailed = 'verify_identity.failed',

  // Agent
  AgentChanged = 'agent.changed',
  AgentResponse = 'agent.response',
  AgentError = 'agent.error',

  // Session
  SessionError = 'session.error',
  SessionAccessed = 'session.accessed',

  // More here
}
