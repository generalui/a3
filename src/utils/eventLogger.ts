// This should be hook the some one can add their own event handler. This should be a extensible system.
import { Events } from 'types/events'

export async function logEvent(_event: Events, _data: unknown): Promise<void> {
  // Implement the event logging system here.
  return Promise.resolve()
}
