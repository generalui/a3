// TODO: Remove once traceId is removed from logger
import { AsyncLocalStorage } from 'node:async_hooks'

type RequestStore = Record<string, unknown>

const asyncLocalStorage = new AsyncLocalStorage<RequestStore>()

export function withAsyncLocalStore<T>(fn: () => Promise<T> | T, store: RequestStore) {
  return asyncLocalStorage.run(store, fn)
}

export function getAsyncLocalStore(): RequestStore {
  const store = asyncLocalStorage.getStore()
  if (!store) throw new Error('No async local store')
  return store
}
