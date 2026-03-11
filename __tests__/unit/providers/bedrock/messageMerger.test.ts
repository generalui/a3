import { mergeSequentialMessages } from '../../../../providers/bedrock/messageMerger'
import type { ProviderMessage } from '../../../../src/types/provider'

jest.unmock('../../../../providers/bedrock/messageMerger')

describe('mergeSequentialMessages', () => {
  it('should return empty array for empty input', () => {
    expect(mergeSequentialMessages([])).toEqual([])
  })

  it('should pass through alternating messages unchanged', () => {
    const messages: ProviderMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'How are you?' },
    ]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(3)
    expect(result[0].role).toBe('user')
    expect(result[0].content).toEqual([{ text: 'Hello' }])
    expect(result[1].role).toBe('assistant')
    expect(result[1].content).toEqual([{ text: 'Hi there' }])
    expect(result[2].role).toBe('user')
    expect(result[2].content).toEqual([{ text: 'How are you?' }])
  })

  it('should merge consecutive same-role messages into one with multiple content blocks', () => {
    const messages: ProviderMessage[] = [
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' },
      { role: 'user', content: 'Third' },
    ]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
    expect(result[0].content).toEqual([{ text: 'First' }, { text: 'Second' }, { text: 'Third' }])
  })

  it('should merge consecutive assistant messages', () => {
    const messages: ProviderMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Part 1' },
      { role: 'assistant', content: 'Part 2' },
    ]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[1].role).toBe('assistant')
    expect(result[1].content).toEqual([{ text: 'Part 1' }, { text: 'Part 2' }])
  })

  it('should skip messages with empty content', () => {
    const messages: ProviderMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: '' },
      { role: 'assistant', content: 'Response' },
    ]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0].content).toEqual([{ text: 'Hello' }])
    expect(result[1].content).toEqual([{ text: 'Response' }])
  })

  it('should handle single message', () => {
    const messages: ProviderMessage[] = [{ role: 'user', content: 'Only message' }]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
    expect(result[0].content).toEqual([{ text: 'Only message' }])
  })

  it('should handle complex alternating pattern with merges', () => {
    const messages: ProviderMessage[] = [
      { role: 'user', content: 'U1' },
      { role: 'user', content: 'U2' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'U3' },
      { role: 'user', content: 'U4' },
      { role: 'assistant', content: 'A2' },
      { role: 'assistant', content: 'A3' },
    ]

    const result = mergeSequentialMessages(messages)

    expect(result).toHaveLength(4)
    expect(result[0].content).toEqual([{ text: 'U1' }, { text: 'U2' }])
    expect(result[1].content).toEqual([{ text: 'A1' }])
    expect(result[2].content).toEqual([{ text: 'U3' }, { text: 'U4' }])
    expect(result[3].content).toEqual([{ text: 'A2' }, { text: 'A3' }])
  })
})
