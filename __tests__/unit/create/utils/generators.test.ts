jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
  outputFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  copySync: jest.fn(),
  readJsonSync: jest.fn(),
  writeJsonSync: jest.fn(),
  renameSync: jest.fn(),
}))

import fs from 'fs-extra'
import { generateEnvFile, generateProviderFiles, scaffoldProject } from '@create-utils/generators'
import { PROVIDER_META, providerDocName, type ProviderConfig } from '@create-utils/providers'

const mockFs = jest.mocked(fs)

beforeEach(() => {
  jest.resetAllMocks()
})

// ── generateEnvFile ───────────────────────────────────────────────────────────

describe('generateEnvFile', () => {
  it('writes to <targetDir>/.env', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateEnvFile('/my/project', config)
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/my/project/.env', expect.any(String))
  })

  it('writes an OpenAI API key entry and no AWS or Anthropic vars for the openai-only provider', () => {
    const config: ProviderConfig = {
      providers: ['openai'],
      primaryProvider: 'openai',
      openaiApiKey: 'sk-proj-test',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('OPENAI_API_KEY=sk-proj-test')
    expect(content).not.toContain('ANTHROPIC_API_KEY')
    expect(content).not.toContain('AWS_')
  })

  it('writes an Anthropic API key entry and no OpenAI or AWS vars for the anthropic-only provider', () => {
    const config: ProviderConfig = {
      providers: ['anthropic'],
      primaryProvider: 'anthropic',
      anthropicApiKey: 'sk-ant-test',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('ANTHROPIC_API_KEY=sk-ant-test')
    expect(content).not.toContain('OPENAI_API_KEY')
    expect(content).not.toContain('AWS_')
  })

  it('writes AWS_PROFILE and AWS_REGION for Bedrock in profile mode', () => {
    const config: ProviderConfig = {
      providers: ['bedrock'],
      primaryProvider: 'bedrock',
      bedrockAuthMode: 'profile',
      awsProfile: 'my-profile',
      awsRegion: 'us-west-2',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('AWS_PROFILE=my-profile')
    expect(content).toContain('AWS_REGION=us-west-2')
    expect(content).not.toContain('AWS_ACCESS_KEY_ID')
    expect(content).not.toContain('AWS_SECRET_ACCESS_KEY')
  })

  it('writes access key ID, secret, and region for Bedrock in keys mode', () => {
    const config: ProviderConfig = {
      providers: ['bedrock'],
      primaryProvider: 'bedrock',
      bedrockAuthMode: 'keys',
      awsAccessKeyId: 'AKIATEST',
      awsSecretAccessKey: 'mysecret',
      awsRegion: 'eu-west-1',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('AWS_ACCESS_KEY_ID=AKIATEST')
    expect(content).toContain('AWS_SECRET_ACCESS_KEY=mysecret')
    expect(content).toContain('AWS_REGION=eu-west-1')
    expect(content).not.toContain('AWS_PROFILE')
  })

  it('defaults AWS_REGION to us-east-1 when awsRegion is not specified', () => {
    const config: ProviderConfig = {
      providers: ['bedrock'],
      primaryProvider: 'bedrock',
      bedrockAuthMode: 'profile',
      awsProfile: 'default',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('AWS_REGION=us-east-1')
  })

  it('defaults AWS_PROFILE to "default" when awsProfile is not specified in profile mode', () => {
    const config: ProviderConfig = {
      providers: ['bedrock'],
      primaryProvider: 'bedrock',
      bedrockAuthMode: 'profile',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('AWS_PROFILE=default')
  })

  it('includes all provider sections when multiple providers are selected', () => {
    const config: ProviderConfig = {
      providers: ['openai', 'anthropic', 'bedrock'],
      primaryProvider: 'openai',
      openaiApiKey: 'sk-proj-x',
      anthropicApiKey: 'sk-ant-y',
      bedrockAuthMode: 'profile',
      awsProfile: 'default',
      awsRegion: 'us-east-1',
    }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('OPENAI_API_KEY=sk-proj-x')
    expect(content).toContain('ANTHROPIC_API_KEY=sk-ant-y')
    expect(content).toContain('AWS_PROFILE=default')
  })

  it('uses empty string for API key values when they are absent from config', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateEnvFile('/target', config)
    const content = mockFs.writeFileSync.mock.calls[0][1] as string
    expect(content).toContain('OPENAI_API_KEY=')
  })
})

// ── scaffoldProject ───────────────────────────────────────────────────────────

describe('scaffoldProject', () => {
  it('copies the template directory to the target', () => {
    mockFs.existsSync.mockReturnValue(false)
    scaffoldProject('/template', '/target', 'my-app')
    expect(mockFs.copySync).toHaveBeenCalledWith('/template', '/target')
  })

  it('sets the project name in package.json and removes the private field', () => {
    mockFs.existsSync.mockImplementation((p) => String(p).endsWith('package.json'))
    mockFs.readJsonSync.mockReturnValue({ name: 'template-name', version: '0.1.0', private: true })

    scaffoldProject('/template', '/target', 'my-app')

    const written = mockFs.writeJsonSync.mock.calls[0][1] as Record<string, unknown>
    expect(written.name).toBe('my-app')
    expect('private' in written).toBe(false)
  })

  it('writes package.json with 2-space indentation', () => {
    mockFs.existsSync.mockImplementation((p) => String(p).endsWith('package.json'))
    mockFs.readJsonSync.mockReturnValue({ name: 'x' })

    scaffoldProject('/template', '/target', 'my-app')

    expect(mockFs.writeJsonSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      { spaces: 2 },
    )
  })

  it('renames _gitignore to .gitignore when present', () => {
    mockFs.existsSync.mockImplementation((p) => String(p).endsWith('_gitignore'))

    scaffoldProject('/template', '/target', 'my-app')

    expect(mockFs.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('_gitignore'),
      expect.stringContaining('.gitignore'),
    )
  })

  it('skips package.json update and _gitignore rename when neither file is present', () => {
    mockFs.existsSync.mockReturnValue(false)
    expect(() => scaffoldProject('/template', '/target', 'my-app')).not.toThrow()
    expect(mockFs.writeJsonSync).not.toHaveBeenCalled()
    expect(mockFs.renameSync).not.toHaveBeenCalled()
  })
})

// ── generateProviderFiles ─────────────────────────────────────────────────────

describe('generateProviderFiles', () => {
  beforeEach(() => {
    // All provider files exist by default
    mockFs.existsSync.mockReturnValue(true)
    // Simulate a package.json with all provider packages installed
    const allDependencies = Object.fromEntries(
      Object.values(PROVIDER_META).map((meta) => [meta.npmPackage, '^0.1.0']),
    )
    mockFs.readJsonSync.mockReturnValue({ dependencies: allDependencies })
  })

  it('removes unselected provider files', () => {
    const allKeys = Object.keys(PROVIDER_META)
    const [selected, ...unselected] = allKeys
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    for (const key of unselected) {
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(PROVIDER_META[key].file))
    }
    expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining(PROVIDER_META[selected].file))
  })

  it('does not call unlinkSync when an unselected file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })

  it('removes doc files for unselected providers and keeps doc for selected provider', () => {
    const allKeys = Object.keys(PROVIDER_META)
    const [selected, ...unselected] = allKeys
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    for (const key of unselected) {
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(providerDocName(key)))
    }
    expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining(providerDocName(selected)))
  })

  it('removes provider doc files from the docs subdirectory of the target', () => {
    const [selected] = Object.keys(PROVIDER_META)
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/my/project', config)
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('/my/project/docs/'))
  })

  it('does not remove provider doc files when they do not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const [selected] = Object.keys(PROVIDER_META)
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    for (const key of Object.keys(PROVIDER_META)) {
      expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining(providerDocName(key)))
    }
  })

  it('generates an index.ts that re-exports the selected provider', () => {
    const [selected] = Object.keys(PROVIDER_META)
    const meta = PROVIDER_META[selected]
    const baseName = meta.file.replace('.ts', '')
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain(`export { ${meta.exportName} } from './${baseName}'`)
  })

  it('aliases the primary provider as getProvider in the index', () => {
    const [selected] = Object.keys(PROVIDER_META)
    const meta = PROVIDER_META[selected]
    const baseName = meta.file.replace('.ts', '')
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain(`export { ${meta.exportName} as getProvider } from './${baseName}'`)
  })

  it('generates index.ts with all selected providers when multiple are chosen', () => {
    const [first, second] = Object.keys(PROVIDER_META)
    const firstMeta = PROVIDER_META[first]
    const secondMeta = PROVIDER_META[second]
    const config: ProviderConfig = { providers: [first, second], primaryProvider: second }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain(`export { ${firstMeta.exportName} } from './${firstMeta.file.replace('.ts', '')}'`)
    expect(content).toContain(`export { ${secondMeta.exportName} } from './${secondMeta.file.replace('.ts', '')}'`)
    expect(content).toContain(`export { ${secondMeta.exportName} as getProvider } from './${secondMeta.file.replace('.ts', '')}'`)
  })

  it('writes the index to <targetDir>/app/lib/providers/index.ts', () => {
    const [selected] = Object.keys(PROVIDER_META)
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/my/project', config)
    expect(mockFs.outputFileSync).toHaveBeenCalledWith(
      expect.stringContaining('/my/project/app/lib/providers/index.ts'),
      expect.any(String),
    )
  })

  it('removes unselected provider packages from package.json dependencies', () => {
    const allKeys = Object.keys(PROVIDER_META)
    const [selected, ...unselected] = allKeys
    const config: ProviderConfig = { providers: [selected], primaryProvider: selected }
    generateProviderFiles('/target', config)
    const written = mockFs.writeJsonSync.mock.calls[0][1] as { dependencies: Record<string, string> }
    expect(written.dependencies[PROVIDER_META[selected].npmPackage]).toBeDefined()
    for (const key of unselected) {
      expect(written.dependencies[PROVIDER_META[key].npmPackage]).toBeUndefined()
    }
  })

  it('skips package.json dependency pruning when package.json does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    expect(mockFs.readJsonSync).not.toHaveBeenCalled()
    expect(mockFs.writeJsonSync).not.toHaveBeenCalled()
  })
})
