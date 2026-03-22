jest.mock('@clack/prompts', () => ({
  text: jest.fn(),
  password: jest.fn(),
  select: jest.fn(),
  multiselect: jest.fn(),
  spinner: jest.fn(),
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    step: jest.fn(),
  },
  cancel: jest.fn(),
  isCancel: jest.fn(),
}))

jest.mock('@create-utils/validation', () => ({
  maskKey: jest.fn((key: string) => `masked(${key})`),
  normalizeKey: jest.fn((key: string) => key),
  validateOpenAIKey: jest.fn(),
  validateAnthropicKey: jest.fn(),
  validateAwsCredentials: jest.fn(),
}))

jest.mock('@create-utils/maskedInput', () => ({
  maskedInput: jest.fn(),
}))

jest.mock('@create-utils/aws', () => ({
  detectAwsProfiles: jest.fn(),
  detectAwsProfileRegion: jest.fn(),
}))

import * as p from '@clack/prompts'
import { detectAwsProfileRegion, detectAwsProfiles } from '@create-utils/aws'
import { maskedInput } from '@create-utils/maskedInput'
import {
  normalizeKey,
  validateAnthropicKey,
  validateAwsCredentials,
  validateOpenAIKey,
} from '@create-utils/validation'
import { promptProjectName, promptProviders } from '@create-utils/prompts'

const mockText = p.text as jest.Mock
const mockMaskedInput = maskedInput as jest.Mock
const mockSelect = p.select as jest.Mock
const mockMultiselect = p.multiselect as jest.Mock
const mockIsCancel = p.isCancel as unknown as jest.Mock
const mockSpinner = p.spinner as jest.Mock
const mockNormalizeKey = normalizeKey as jest.Mock
const mockDetectAwsProfiles = detectAwsProfiles as jest.Mock
const mockDetectAwsProfileRegion = detectAwsProfileRegion as jest.Mock
const mockValidateOpenAIKey = validateOpenAIKey as jest.Mock
const mockValidateAnthropicKey = validateAnthropicKey as jest.Mock
const mockValidateAwsCredentials = validateAwsCredentials as jest.Mock

const CANCEL = Symbol('cancel')

beforeEach(() => {
  jest.resetAllMocks()
  // Ensure no env-detected keys interfere with tests
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  // normalizeKey is called on every key input — restore pass-through after reset
  mockNormalizeKey.mockImplementation((key: string) => key)
  mockIsCancel.mockReturnValue(false)
  mockSpinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() })
  mockDetectAwsProfiles.mockReturnValue([])
  mockDetectAwsProfileRegion.mockReturnValue(undefined)
})

// ── promptProjectName ─────────────────────────────────────────────────────────

describe('promptProjectName', () => {
  let originalArgv: string[]

  beforeEach(() => {
    originalArgv = process.argv
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  it('returns process.argv[2] directly without prompting when set', async () => {
    process.argv = ['node', 'create', 'my-project']
    await expect(promptProjectName()).resolves.toBe('my-project')
    expect(mockText).not.toHaveBeenCalled()
  })

  it('prompts for the project name and returns the trimmed result when argv[2] is absent', async () => {
    process.argv = ['node', 'create']
    mockText.mockResolvedValue('  my-a3-app  ')
    await expect(promptProjectName()).resolves.toBe('my-a3-app')
  })

  it('calls p.cancel and process.exit(1) when the prompt is cancelled', async () => {
    process.argv = ['node', 'create']
    mockText.mockResolvedValue(CANCEL)
    mockIsCancel.mockImplementation((val) => val === CANCEL)
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    await expect(promptProjectName()).rejects.toThrow('process.exit')
    expect(p.cancel).toHaveBeenCalledWith('Setup cancelled.')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})

// ── promptProviders ───────────────────────────────────────────────────────────

describe('promptProviders', () => {
  describe('provider selection', () => {
    it('calls process.exit(1) when the provider multiselect is cancelled', async () => {
      mockMultiselect.mockResolvedValue(CANCEL)
      mockIsCancel.mockImplementation((val) => val === CANCEL)
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      await expect(promptProviders()).rejects.toThrow('process.exit')
      expect(exitSpy).toHaveBeenCalledWith(1)
      exitSpy.mockRestore()
    })

    it('does not prompt for a primary provider when only one provider is selected', async () => {
      mockMultiselect.mockResolvedValue(['openai'])
      mockMaskedInput.mockResolvedValue('sk-proj-key')
      mockValidateOpenAIKey.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.primaryProvider).toBe('openai')
      expect(mockSelect).not.toHaveBeenCalled()
    })

    it('prompts for a primary provider and uses the selection when multiple providers are chosen', async () => {
      mockMultiselect.mockResolvedValue(['openai', 'anthropic'])
      mockMaskedInput
        .mockResolvedValueOnce('sk-openai-key')
        .mockResolvedValueOnce('sk-ant-key')
      mockValidateOpenAIKey.mockResolvedValue({ valid: true })
      mockValidateAnthropicKey.mockResolvedValue({ valid: true })
      mockSelect.mockResolvedValue('anthropic')

      const config = await promptProviders()

      expect(mockSelect).toHaveBeenCalledTimes(1)
      expect(config.primaryProvider).toBe('anthropic')
    })
  })

  describe('OpenAI provider', () => {
    it('sets openaiApiKey on the config', async () => {
      mockMultiselect.mockResolvedValue(['openai'])
      mockMaskedInput.mockResolvedValue('sk-proj-testkey123')
      mockValidateOpenAIKey.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.providers).toEqual(['openai'])
      expect(config.openaiApiKey).toBe('sk-proj-testkey123')
    })

    it('retries the key prompt when validation fails and stops once a valid key is entered', async () => {
      mockMultiselect.mockResolvedValue(['openai'])
      mockMaskedInput
        .mockResolvedValueOnce('sk-bad-key')
        .mockResolvedValueOnce('sk-good-key')
      mockValidateOpenAIKey
        .mockResolvedValueOnce({ valid: false, message: 'Invalid API key' })
        .mockResolvedValueOnce({ valid: true })

      const config = await promptProviders()

      expect(mockMaskedInput).toHaveBeenCalledTimes(2)
      expect(p.log.warn).toHaveBeenCalledWith('Invalid API key')
      expect(config.openaiApiKey).toBe('sk-good-key')
    })
  })

  describe('Anthropic provider', () => {
    it('sets anthropicApiKey on the config', async () => {
      mockMultiselect.mockResolvedValue(['anthropic'])
      mockMaskedInput.mockResolvedValue('sk-ant-api-testkey')
      mockValidateAnthropicKey.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.anthropicApiKey).toBe('sk-ant-api-testkey')
    })

    it('retries the key prompt when validation fails and stops once a valid key is entered', async () => {
      mockMultiselect.mockResolvedValue(['anthropic'])
      mockMaskedInput
        .mockResolvedValueOnce('sk-ant-bad-key')
        .mockResolvedValueOnce('sk-ant-good-key')
      mockValidateAnthropicKey
        .mockResolvedValueOnce({ valid: false, message: 'Invalid Anthropic key' })
        .mockResolvedValueOnce({ valid: true })

      const config = await promptProviders()

      expect(mockMaskedInput).toHaveBeenCalledTimes(2)
      expect(p.log.warn).toHaveBeenCalledWith('Invalid Anthropic key')
      expect(config.anthropicApiKey).toBe('sk-ant-good-key')
    })
  })

  describe('Bedrock provider — profile mode', () => {
    it('sets bedrockAuthMode, awsProfile, and awsRegion on the config', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile') // auth mode
        .mockResolvedValueOnce('work') // profile selection
      mockDetectAwsProfiles.mockReturnValue(['default', 'work'])
      mockDetectAwsProfileRegion.mockReturnValue('eu-west-1')
      mockText.mockResolvedValue('eu-west-1')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.bedrockAuthMode).toBe('profile')
      expect(config.awsProfile).toBe('work')
      expect(config.awsRegion).toBe('eu-west-1')
    })

    it('pre-fills the region prompt with the detected region for the selected profile', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile')
        .mockResolvedValueOnce('staging')
      mockDetectAwsProfiles.mockReturnValue(['staging'])
      mockDetectAwsProfileRegion.mockReturnValue('ap-southeast-2')
      mockText.mockResolvedValue('ap-southeast-2')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      await promptProviders()

      expect(mockDetectAwsProfileRegion).toHaveBeenCalledWith('staging')
      expect(mockText).toHaveBeenCalledWith(
        expect.objectContaining({ initialValue: 'ap-southeast-2' }),
      )
    })

    it('uses a placeholder when no region is detected for the selected profile', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile')
        .mockResolvedValueOnce('default')
      mockDetectAwsProfiles.mockReturnValue(['default'])
      // mockDetectAwsProfileRegion returns undefined by default (set in beforeEach)
      mockText.mockResolvedValue('us-east-1')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      await promptProviders()

      const calls = mockText.mock.calls.flat() as Array<Record<string, unknown>>
      const hasInitialValue = calls.some(
        (arg) => typeof arg === 'object' && arg !== null && 'initialValue' in arg,
      )
      expect(hasInitialValue).toBe(false)
      expect(mockText).toHaveBeenCalledWith(
        expect.objectContaining({ placeholder: 'us-east-1' }),
      )
    })

    it('retries with a different profile when validation fails and user chooses to retry', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile')   // auth mode
        .mockResolvedValueOnce('default')   // first profile selection
        .mockResolvedValueOnce('profile')   // retry action: try a different profile
        .mockResolvedValueOnce('work')      // second profile selection
      mockDetectAwsProfiles.mockReturnValue(['default', 'work'])
      mockText
        .mockResolvedValueOnce('us-east-1') // region attempt 1
        .mockResolvedValueOnce('us-west-2') // region attempt 2
      mockValidateAwsCredentials
        .mockResolvedValueOnce({ valid: false, message: 'Profile credentials invalid' })
        .mockResolvedValueOnce({ valid: true })

      const config = await promptProviders()

      expect(p.log.warn).toHaveBeenCalledWith('Profile credentials invalid')
      expect(config.awsProfile).toBe('work')
      expect(config.awsRegion).toBe('us-west-2')
    })

    it('switches to keys mode mid-retry when user selects "Switch to access keys"', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile')  // auth mode
        .mockResolvedValueOnce('default')  // first profile selection
        .mockResolvedValueOnce('keys')     // retry action: switch to keys
      mockDetectAwsProfiles.mockReturnValue(['default'])
      mockText
        .mockResolvedValueOnce('us-east-1')   // region attempt 1
        .mockResolvedValueOnce('AKIA_RETRY')  // access key ID after switch
        .mockResolvedValueOnce('us-east-1')   // region attempt 2
      mockMaskedInput.mockResolvedValueOnce('retrysecret')
      mockValidateAwsCredentials
        .mockResolvedValueOnce({ valid: false, message: 'Profile not found' })
        .mockResolvedValueOnce({ valid: true })

      const config = await promptProviders()

      expect(p.log.warn).toHaveBeenCalledWith('Profile not found')
      expect(config.bedrockAuthMode).toBe('keys')
    })
  })

  describe('Bedrock provider — keys mode', () => {
    it('sets bedrockAuthMode, awsAccessKeyId, awsSecretAccessKey, and awsRegion on the config', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect.mockResolvedValueOnce('keys')
      mockText
        .mockResolvedValueOnce('AKIATESTKEY12345678') // access key ID
        .mockResolvedValueOnce('us-east-1') // region
      mockMaskedInput.mockResolvedValueOnce('supersecretaccesskey12345')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.bedrockAuthMode).toBe('keys')
      expect(config.awsAccessKeyId).toBe('AKIATESTKEY12345678')
      expect(config.awsSecretAccessKey).toBe('supersecretaccesskey12345')
      expect(config.awsRegion).toBe('us-east-1')
    })

    it('re-prompts for access keys when validation fails', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect.mockResolvedValueOnce('keys')
      mockText
        .mockResolvedValueOnce('AKIA_INITIAL') // first access key ID
        .mockResolvedValueOnce('us-east-1')    // region attempt 1
        .mockResolvedValueOnce('AKIA_GOOD')    // retry access key ID
        .mockResolvedValueOnce('us-east-1')    // region attempt 2
      mockMaskedInput
        .mockResolvedValueOnce('initialsecret')
        .mockResolvedValueOnce('goodsecret')
      mockValidateAwsCredentials
        .mockResolvedValueOnce({ valid: false, message: 'Signature mismatch' })
        .mockResolvedValueOnce({ valid: true })

      const config = await promptProviders()

      expect(p.log.warn).toHaveBeenCalledWith('Signature mismatch')
      expect(mockMaskedInput).toHaveBeenCalledTimes(2)
      expect(config.awsAccessKeyId).toBe('AKIA_GOOD')
      expect(config.awsSecretAccessKey).toBe('goodsecret')
    })
  })

  describe('Bedrock provider — no profiles found', () => {
    it('shows a warning and succeeds once profiles appear on retry', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile') // auth mode
        .mockResolvedValueOnce('retry')   // no-profiles action: retry
        .mockResolvedValueOnce('default') // profile selection after retry
      mockDetectAwsProfiles
        .mockReturnValueOnce([])           // first check: no profiles
        .mockReturnValueOnce(['default'])  // after retry: profiles found
      mockText.mockResolvedValue('us-east-1')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(p.log.warn).toHaveBeenCalledWith('No AWS profiles found in ~/.aws/credentials')
      expect(config.bedrockAuthMode).toBe('profile')
      expect(config.awsProfile).toBe('default')
    })

    it('falls back to keys mode when user selects "Use access keys" from the no-profiles prompt', async () => {
      mockMultiselect.mockResolvedValue(['bedrock'])
      mockSelect
        .mockResolvedValueOnce('profile') // auth mode
        .mockResolvedValueOnce('keys')    // no-profiles action: use access keys
      mockDetectAwsProfiles.mockReturnValue([])
      mockText
        .mockResolvedValueOnce('AKIA_FALLBACK') // access key ID
        .mockResolvedValueOnce('us-east-1')     // region
      mockMaskedInput.mockResolvedValueOnce('fallbacksecret')
      mockValidateAwsCredentials.mockResolvedValue({ valid: true })

      const config = await promptProviders()

      expect(config.bedrockAuthMode).toBe('keys')
      expect(config.awsAccessKeyId).toBe('AKIA_FALLBACK')
    })
  })
})
