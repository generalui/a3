import { AgentRegistry } from '@core/AgentRegistry'
import { Agent } from 'types'
import { z } from 'zod'

jest.unmock('@core/AgentRegistry')

// Mock agent factory for testing
const createMockAgent = (id: string, description: string = `Description for ${id}`): Agent => ({
  id,
  description,
  name: `Agent ${id}`,
  promptGenerator: jest.fn().mockResolvedValue('test prompt'),
  outputSchema: z.object({}),
  generateAgentResponse: jest.fn().mockResolvedValue({
    newChatState: {},
    chatbotMessage: 'test',
    goalAchieved: false,
    nextAgentId: '',
  }),
  setState: jest.fn().mockReturnValue({}),
})

describe('AgentRegistry', () => {
  beforeEach(() => {
    // Reset singleton and clear all agents before each test
    AgentRegistry.resetInstance()
  })

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AgentRegistry.getInstance()
      const instance2 = AgentRegistry.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should create a new instance after reset', () => {
      const instance1 = AgentRegistry.getInstance()
      AgentRegistry.resetInstance()
      const instance2 = AgentRegistry.getInstance()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('register()', () => {
    it('should register an agent successfully', () => {
      const registry = AgentRegistry.getInstance()
      const agent = createMockAgent('test-agent')

      registry.register(agent)

      expect(registry.has('test-agent')).toBe(true)
      expect(registry.count).toBe(1)
    })

    it('should throw error when registering duplicate agent ID', () => {
      const registry = AgentRegistry.getInstance()
      const agent1 = createMockAgent('duplicate-id')
      const agent2 = createMockAgent('duplicate-id')

      registry.register(agent1)

      expect(() => registry.register(agent2)).toThrow(
        "Agent with ID 'duplicate-id' is already registered. Use unregister() first to replace it.",
      )
    })
  })

  describe('register() with array', () => {
    it('should register multiple agents successfully', () => {
      const registry = AgentRegistry.getInstance()
      const agents = [createMockAgent('agent-1'), createMockAgent('agent-2'), createMockAgent('agent-3')]

      registry.register(agents)

      expect(registry.count).toBe(3)
      expect(registry.has('agent-1')).toBe(true)
      expect(registry.has('agent-2')).toBe(true)
      expect(registry.has('agent-3')).toBe(true)
    })
  })

  describe('get()', () => {
    it('should return the agent when it exists', () => {
      const registry = AgentRegistry.getInstance()
      const agent = createMockAgent('my-agent', 'Custom description')

      registry.register(agent)

      const retrieved = registry.get('my-agent')
      expect(retrieved).toBe(agent)
      expect(retrieved?.description).toBe('Custom description')
    })

    it('should return undefined when agent does not exist', () => {
      const registry = AgentRegistry.getInstance()

      expect(registry.get('non-existent')).toBeUndefined()
    })
  })

  describe('getAll()', () => {
    it('should return all registered agents', () => {
      const registry = AgentRegistry.getInstance()
      const agents = [createMockAgent('agent-a'), createMockAgent('agent-b')]

      registry.register(agents)

      const all = registry.getAll()
      expect(all).toHaveLength(2)
      expect(all.map((a) => a.id)).toEqual(expect.arrayContaining(['agent-a', 'agent-b']))
    })

    it('should return empty array when no agents registered', () => {
      const registry = AgentRegistry.getInstance()

      expect(registry.getAll()).toEqual([])
    })
  })

  describe('has()', () => {
    it('should return true when agent exists', () => {
      const registry = AgentRegistry.getInstance()
      registry.register(createMockAgent('check-agent'))

      expect(registry.has('check-agent')).toBe(true)
    })

    it('should return false when agent does not exist', () => {
      const registry = AgentRegistry.getInstance()

      expect(registry.has('missing-agent')).toBe(false)
    })
  })

  describe('unregister()', () => {
    it('should remove an existing agent and return true', () => {
      const registry = AgentRegistry.getInstance()
      registry.register(createMockAgent('remove-me'))

      const result = registry.unregister('remove-me')

      expect(result).toBe(true)
      expect(registry.has('remove-me')).toBe(false)
      expect(registry.count).toBe(0)
    })

    it('should return false when agent does not exist', () => {
      const registry = AgentRegistry.getInstance()

      const result = registry.unregister('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('getDescriptions()', () => {
    it('should return a record of all agent descriptions', () => {
      const registry = AgentRegistry.getInstance()
      registry.register(createMockAgent('scheduler', 'Handles appointment scheduling'))
      registry.register(createMockAgent('payment', 'Processes payments'))

      const descriptions = registry.getDescriptions()

      expect(descriptions).toEqual({
        scheduler: 'Handles appointment scheduling',
        payment: 'Processes payments',
      })
    })

    it('should return empty object when no agents registered', () => {
      const registry = AgentRegistry.getInstance()

      expect(registry.getDescriptions()).toEqual({})
    })
  })

  describe('count', () => {
    it('should return the correct count of registered agents', () => {
      const registry = AgentRegistry.getInstance()

      expect(registry.count).toBe(0)

      registry.register(createMockAgent('a'))
      expect(registry.count).toBe(1)

      registry.register(createMockAgent('b'))
      expect(registry.count).toBe(2)

      registry.unregister('a')
      expect(registry.count).toBe(1)
    })
  })

  describe('clear()', () => {
    it('should remove all registered agents', () => {
      const registry = AgentRegistry.getInstance()
      registry.register([createMockAgent('x'), createMockAgent('y'), createMockAgent('z')])

      registry.clear()

      expect(registry.count).toBe(0)
      expect(registry.getAll()).toEqual([])
    })
  })
})
