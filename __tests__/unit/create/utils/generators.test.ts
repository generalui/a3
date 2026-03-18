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
import type { ProviderConfig } from '@create-utils/providers'

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
    mockFs.readJsonSync.mockReturnValue({
      dependencies: {
        '@genui-a3/a3-anthropic': '^0.1.0',
        '@genui-a3/a3-bedrock': '^0.1.0',
        '@genui-a3/a3-openai': '^0.1.0',
      },
    })
  })

  it('removes unselected provider files', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('bedrock.ts'))
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('anthropic.ts'))
    expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('openai.ts'))
  })

  it('does not call unlinkSync when an unselected file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })

  it('generates an index.ts that re-exports the selected provider', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain("export { getOpenAIProvider } from './openai'")
  })

  it('aliases the primary provider as getProvider in the index', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain("export { getOpenAIProvider as getProvider } from './openai'")
  })

  it('generates index.ts with all selected providers when multiple are chosen', () => {
    const config: ProviderConfig = {
      providers: ['openai', 'anthropic'],
      primaryProvider: 'anthropic',
    }
    generateProviderFiles('/target', config)
    const content = mockFs.outputFileSync.mock.calls[0][1] as string
    expect(content).toContain("export { getOpenAIProvider } from './openai'")
    expect(content).toContain("export { getAnthropicProvider } from './anthropic'")
    expect(content).toContain("export { getAnthropicProvider as getProvider } from './anthropic'")
  })

  it('writes the index to <targetDir>/app/lib/providers/index.ts', () => {
    const config: ProviderConfig = { providers: ['bedrock'], primaryProvider: 'bedrock' }
    generateProviderFiles('/my/project', config)
    expect(mockFs.outputFileSync).toHaveBeenCalledWith(
      expect.stringContaining('/my/project/app/lib/providers/index.ts'),
      expect.any(String),
    )
  })

  it('removes unselected provider packages from package.json dependencies', () => {
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    const written = mockFs.writeJsonSync.mock.calls[0][1] as { dependencies: Record<string, string> }
    expect(written.dependencies['@genui-a3/a3-openai']).toBeDefined()
    expect(written.dependencies['@genui-a3/a3-anthropic']).toBeUndefined()
    expect(written.dependencies['@genui-a3/a3-bedrock']).toBeUndefined()
  })

  it('skips package.json dependency pruning when package.json does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const config: ProviderConfig = { providers: ['openai'], primaryProvider: 'openai' }
    generateProviderFiles('/target', config)
    expect(mockFs.readJsonSync).not.toHaveBeenCalled()
    expect(mockFs.writeJsonSync).not.toHaveBeenCalled()
  })
})
