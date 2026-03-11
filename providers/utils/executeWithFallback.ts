/**
 * Executes an action with model fallback support.
 * Tries each model in order; if one fails, falls back to the next.
 * Throws the last error if all models fail.
 *
 * @param models - Model identifiers in priority order
 * @param action - Async action to attempt with each model
 * @returns The result from the first successful model
 * @throws The error from the last model if all fail
 *
 * @example
 * ```typescript
 * const result = await executeWithFallback(
 *   ['model-primary', 'model-fallback'],
 *   (model) => provider.call(model, params),
 * )
 * ```
 */
export async function executeWithFallback<T>(models: string[], action: (model: string) => Promise<T>): Promise<T> {
  const errors: Array<{ model: string; error: Error }> = []

  for (let i = 0; i < models.length; i++) {
    const model = models[i]

    try {
      // eslint-disable-next-line no-await-in-loop
      return await action(model)
    } catch (error) {
      const errorObj = error as Error
      errors.push({ model, error: errorObj })

      if (i === models.length - 1) {
        throw errorObj
      }
    }
  }

  throw new Error('All models failed')
}
