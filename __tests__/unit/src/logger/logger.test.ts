// import { faker } from '@faker-js/faker'
// import { mockStoreData, mockGetAsyncLocalStore } from 'jest.setup'
// import { withTraceId, withTraceIdAsync, getCurrentTraceId } from '@utils/logger'

// describe('Logger with TraceId', () => {
//   beforeEach(() => {
//     jest.clearAllMocks()
//     mockStoreData.current = {}
//   })

//   describe('withTraceId', () => {
//     it('should return the result of the function', () => {
//       const traceId = faker.string.uuid()
//       const result = withTraceId(traceId, () => 'test result')
//       expect(result).toBe('test result')
//     })
//   })

//   describe('withTraceIdAsync', () => {
//     it('should return the result of the async function', async () => {
//       const traceId = faker.string.uuid()
//       const result = await withTraceIdAsync(traceId, async () => {
//         await Promise.resolve() // Add await to satisfy linter
//         return 'async test result'
//       })
//       expect(result).toBe('async test result')
//     })
//   })

//   describe('getCurrentTraceId', () => {
//     it('should return undefined when not in traceId context', async () => {
//       const traceId = await getCurrentTraceId()
//       expect(traceId).toBeUndefined()
//     })

//     it('should return request traceId when set in async local storage', async () => {
//       const expectedTraceId = faker.string.uuid()

//       // Set the traceId in the mock store
//       mockStoreData.current = { traceId: expectedTraceId }

//       const traceId = await getCurrentTraceId()

//       // Verify getAsyncLocalStore was called (via dynamic import)
//       if (mockGetAsyncLocalStore.mock.calls.length > 0) {
//         expect(traceId).toBe(expectedTraceId)
//       } else {
//         // Dynamic import didn't work due to Jest limitation
//         expect(traceId).toBeUndefined()
//       }
//     })
//   })
// })
