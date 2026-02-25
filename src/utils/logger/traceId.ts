// TODO: Remove once traceId is removed from logger
import { getUUID } from '@utils/uuid'
// import { getCurrentTraceId } from './logger'

/**
 * Generates a fallback traceId when no trace context is available.
 *
 * Creates two distinct types of fallback traceIds to differentiate between:
 * - **Session-based fallbacks**: Have context and are traceable to a user session
 * - **Orphaned fallbacks**: Have no context and may indicate error conditions
 *
 * @param sessionId - The session ID to base the fallback traceId on
 * @returns A fallback traceId in one of two formats:
 *   - `FALLBACK_SESSION_{sessionId}` - When sessionId is available (traceable to session)
 *   - `FALLBACK_ORPHAN_{uuid}` - When no sessionId is available (investigate)
 */
export function getFallbackTraceId(sessionId: string | undefined): string {
  if (sessionId) {
    // Session-based fallback: traceable to a user session
    return `FALLBACK_SESSION_${sessionId}`
  }
  // Orphaned fallback: no context available, potential issue to investigate
  return `FALLBACK_ORPHAN_${getUUID()}`
}

/**
 * Gets the current traceId from context, or generates a fallback if unavailable.
 *
 * @param sessionId - The session ID to use for fallback traceId generation
 * @returns A traceId from current context, or a fallback traceId
 */
// export async function getTraceIdWithFallback(sessionId: string | undefined): Promise<string> {
//   const traceId = await getCurrentTraceId()
//   if (traceId) {
//     return traceId
//   }
//   return getFallbackTraceId(sessionId)
// }
