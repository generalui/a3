const mockReaddirSync = jest.fn()
const mockReadFileSync = jest.fn()

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}))

jest.mock('path', () => ({
  ...jest.requireActual<typeof import('path')>('path'),
  join: jest.fn((...parts: string[]) => parts.join('/')),
}))

interface TransitionTargetModule {
  getTransitionTargetMap: () => Map<string, string[]>
}

function makeDirent(name: string, isFile = true) {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '',
    parentPath: '',
  }
}

function loadModule(): TransitionTargetModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../../example/app/lib/parseTransitionTargets') as TransitionTargetModule
}

describe('getTransitionTargetMap', () => {
  beforeEach(() => {
    jest.resetModules()
    mockReaddirSync.mockReset()
    mockReadFileSync.mockReset()
  })

  it('extracts targets from array transitions', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts'), makeDirent('b.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.ts')) {
        return `const agent = { id: 'agent-a', transition: ['agent-b'] }`
      }
      return `const agent = { id: 'agent-b' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.get('agent-a')).toEqual(['agent-b'])
    expect(map.has('agent-b')).toBe(false)
  })

  it('extracts targets from function with return statement', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts'), makeDirent('b.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.ts')) {
        return `const agent = { id: 'agent-a', transition: function(s) { return 'agent-b' } }`
      }
      return `const agent = { id: 'agent-b' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.get('agent-a')).toEqual(['agent-b'])
  })

  it('extracts both branches from ternary in function transition', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts'), makeDirent('b.ts'), makeDirent('c.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.ts')) {
        return `const agent = { id: 'agent-a', transition: (s) => { return s.x ? 'agent-b' : 'agent-c' } }`
      }
      if (filePath.includes('b.ts')) return `const agent = { id: 'agent-b' }`
      return `const agent = { id: 'agent-c' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.get('agent-a')).toEqual(expect.arrayContaining(['agent-b', 'agent-c']))
    expect(map.get('agent-a')).toHaveLength(2)
  })

  it('extracts target from arrow function expression body', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts'), makeDirent('b.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.ts')) {
        return `const agent = { id: 'agent-a', transition: () => 'agent-b' }`
      }
      return `const agent = { id: 'agent-b' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.get('agent-a')).toEqual(['agent-b'])
  })

  it('returns empty map when agents dir does not exist', () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.size).toBe(0)
  })

  it('skips state.ts, registry.ts, and index.ts files', () => {
    mockReaddirSync.mockReturnValue([
      makeDirent('state.ts'),
      makeDirent('registry.ts'),
      makeDirent('index.ts'),
      makeDirent('agent.ts'),
    ])

    mockReadFileSync.mockReturnValue(`const agent = { id: 'agent-a' }`)

    const { getTransitionTargetMap } = loadModule()
    getTransitionTargetMap()

    expect(mockReadFileSync).toHaveBeenCalledTimes(1)
    expect(String((mockReadFileSync.mock.calls as string[][])[0][0])).toContain('agent.ts')
  })

  it('returns cached result on second call without re-reading files', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts')])
    mockReadFileSync.mockReturnValue(`const agent = { id: 'agent-a' }`)

    const { getTransitionTargetMap } = loadModule()
    const first = getTransitionTargetMap()
    const second = getTransitionTargetMap()

    expect(first).toBe(second)
    expect(mockReaddirSync).toHaveBeenCalledTimes(1)
  })

  it('skips files with no id property', () => {
    mockReaddirSync.mockReturnValue([makeDirent('noId.ts'), makeDirent('valid.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('noId.ts')) {
        return `const config = { name: 'not-an-agent' }`
      }
      return `const agent = { id: 'valid-agent' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.has('not-an-agent')).toBe(false)
  })

  it('skips directories', () => {
    mockReaddirSync.mockReturnValue([makeDirent('subdir', false), makeDirent('a.ts')])

    mockReadFileSync.mockReturnValue(`const agent = { id: 'agent-a' }`)

    const { getTransitionTargetMap } = loadModule()
    getTransitionTargetMap()

    expect(mockReadFileSync).toHaveBeenCalledTimes(1)
  })

  it('filters out string literals that are not known agent IDs', () => {
    mockReaddirSync.mockReturnValue([makeDirent('a.ts'), makeDirent('b.ts')])

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.ts')) {
        return `const agent = { id: 'agent-a', transition: () => { return 'not-an-agent' } }`
      }
      return `const agent = { id: 'agent-b' }`
    })

    const { getTransitionTargetMap } = loadModule()
    const map = getTransitionTargetMap()

    expect(map.has('agent-a')).toBe(false)
  })
})
