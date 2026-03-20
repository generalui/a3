jest.mock('@aws-sdk/client-bedrock', () => ({
  BedrockClient: jest.fn(),
  ListFoundationModelsCommand: jest.fn(),
}))

jest.mock('@aws-sdk/credential-provider-ini', () => ({
  fromIni: jest.fn().mockReturnValue({ type: 'ini-credentials' }),
}))

import { BedrockClient } from '@aws-sdk/client-bedrock'
import { fromIni } from '@aws-sdk/credential-provider-ini'
import { normalizeKey, validateOpenAIKey, validateAnthropicKey, validateAwsCredentials } from '@create-utils/validation'

const MockBedrockClient = BedrockClient as jest.Mock
const mockFromIni = fromIni as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
  global.fetch = jest.fn()
})

// ── normalizeKey ──────────────────────────────────────────────────────────────

describe('normalizeKey', () => {
  it('strips all whitespace characters (spaces, tabs, newlines, carriage returns)', () => {
    expect(normalizeKey('  sk-proj- abc \t123\r\n')).toBe('sk-proj-abc123')
  })

  it('leaves an already-clean key unchanged', () => {
    expect(normalizeKey('sk-proj-abc123xyz')).toBe('sk-proj-abc123xyz')
  })
})

// ── validateOpenAIKey ─────────────────────────────────────────────────────────

describe('validateOpenAIKey', () => {
  it('rejects a key that does not start with sk-proj-', async () => {
    const result = await validateOpenAIKey('sk-old-abc123')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('must start with sk-proj-')
  })

  it('does not call fetch for an invalid-format key', async () => {
    await validateOpenAIKey('invalid')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns valid true when the API responds 200 OK', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response)
    const result = await validateOpenAIKey('sk-proj-validkey')
    expect(result.valid).toBe(true)
    expect(result.message).toBe('OpenAI API key verified — completions working.')
  })

  it('sends a minimal completion request with the key as Bearer auth', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response)
    await validateOpenAIKey('sk-proj-testkey')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-proj-testkey',
          'Content-Type': 'application/json',
        }) as Record<string, string>,
        body: expect.any(String) as string,
      }),
    )
    const body = JSON.parse((jest.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string) as Record<
      string,
      unknown
    >
    expect(body).toEqual({
      model: 'gpt-4o-mini',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
  })

  it('passes through the API error message with hints on 401', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: { message: 'Invalid auth' } }),
    } as unknown as Response)
    const result = await validateOpenAIKey('sk-proj-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('OpenAI API key error: Invalid auth')
    expect(result.message).toContain('Make sure')
  })

  it('passes through the API error message with hints on 429', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ error: { message: 'Rate limit exceeded' } }),
    } as unknown as Response)
    const result = await validateOpenAIKey('sk-proj-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('OpenAI API key error: Rate limit exceeded')
    expect(result.message).toContain('Make sure')
  })

  it('falls back to the HTTP status code when the response body has no error message', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(null),
    } as unknown as Response)
    const result = await validateOpenAIKey('sk-proj-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('OpenAI API key error: HTTP 403')
    expect(result.message).toContain('Make sure')
  })

  it('returns a network error message when fetch throws', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('Failed to fetch'))
    const result = await validateOpenAIKey('sk-proj-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Network error')
    expect(result.message).toContain('Failed to fetch')
  })
})

// ── validateAnthropicKey ──────────────────────────────────────────────────────

describe('validateAnthropicKey', () => {
  it('rejects a key that does not start with sk-ant-', async () => {
    const result = await validateAnthropicKey('sk-other-abc')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('must start with sk-ant-')
  })

  it('does not call fetch for an invalid-format key', async () => {
    await validateAnthropicKey('bad-key')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns valid true when the API responds 200 OK', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response)
    const result = await validateAnthropicKey('sk-ant-validkey')
    expect(result.valid).toBe(true)
    expect(result.message).toBe('Anthropic API key verified — completions working.')
  })

  it('sends a minimal completion request with x-api-key and anthropic-version', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as Response)
    await validateAnthropicKey('sk-ant-testkey')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-testkey',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }) as Record<string, string>,
        body: expect.any(String) as string,
      }),
    )
    const body = JSON.parse((jest.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string) as Record<
      string,
      unknown
    >
    expect(body).toEqual({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
  })

  it('passes through the API error message with hints on 401', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: { message: 'Unauthorized' } }),
    } as unknown as Response)
    const result = await validateAnthropicKey('sk-ant-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Anthropic API key error: Unauthorized')
    expect(result.message).toContain('Make sure')
    expect(result.message).toContain('console.anthropic.com')
  })

  it('passes through the API error message with hints on 429', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ error: { message: 'Rate limit exceeded' } }),
    } as unknown as Response)
    const result = await validateAnthropicKey('sk-ant-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Anthropic API key error: Rate limit exceeded')
    expect(result.message).toContain('Make sure')
  })

  it('falls back to the HTTP status code when the response body has no error message', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(null),
    } as unknown as Response)
    const result = await validateAnthropicKey('sk-ant-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Anthropic API key error: HTTP 403')
    expect(result.message).toContain('Make sure')
  })

  it('returns a network error message when fetch throws', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('ENOTFOUND'))
    const result = await validateAnthropicKey('sk-ant-key')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Network error')
  })
})

// ── validateAwsCredentials ────────────────────────────────────────────────────

describe('validateAwsCredentials', () => {
  describe('keys mode — format validation (no API call)', () => {
    it('rejects an access key ID that does not match AKIA[0-9A-Z]{16} format', async () => {
      const result = await validateAwsCredentials({
        mode: 'keys',
        accessKeyId: 'BADKEYID',
        secretAccessKey: 'a'.repeat(40),
        region: 'us-east-1',
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('Access Key ID must start with AKIA')
    })

    it('rejects a secret access key shorter than 40 characters', async () => {
      const result = await validateAwsCredentials({
        mode: 'keys',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'tooshort',
        region: 'us-east-1',
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('too short')
    })

    it('does not call the AWS SDK for an invalid-format key', async () => {
      await validateAwsCredentials({
        mode: 'keys',
        accessKeyId: 'BAD',
        secretAccessKey: 'x',
        region: 'us-east-1',
      })
      expect(MockBedrockClient).not.toHaveBeenCalled()
    })
  })

  describe('keys mode — AWS API validation', () => {
    const validKeys = {
      mode: 'keys' as const,
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    }

    it('returns valid true when the Bedrock call succeeds', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(validKeys)
      expect(result.valid).toBe(true)
      expect(result.message).toBe('AWS credentials verified with Bedrock access.')
    })

    it('passes credentials directly (not via profile) to BedrockClient', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      await validateAwsCredentials(validKeys)
      expect(MockBedrockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          credentials: {
            accessKeyId: validKeys.accessKeyId,
            secretAccessKey: validKeys.secretAccessKey,
          },
        }),
      )
      expect(mockFromIni).not.toHaveBeenCalled()
    })

    it('returns a signature-mismatch message for InvalidSignatureException', async () => {
      const mockSend = jest
        .fn()
        .mockRejectedValue(new Error('InvalidSignatureException: The request signature is invalid'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(validKeys)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('signature mismatch')
    })

    it('returns a permissions message for UnauthorizedOperation', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('UnauthorizedOperation'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(validKeys)
      expect(result.valid).toBe(false)
      expect(result.message).toContain("don't have permission to access Bedrock")
    })

    it('returns "unknown" as the profile name in credential-not-found message for keys mode', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Could not resolve credentials'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(validKeys)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('"unknown"')
    })

    it('returns a generic AWS validation failed message for unrecognized errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('SomeOtherAwsError'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(validKeys)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('AWS validation failed')
    })
  })

  describe('profile mode', () => {
    const profileInput = {
      mode: 'profile' as const,
      profile: 'my-profile',
      region: 'eu-west-1',
    }

    it('returns valid true when the Bedrock call succeeds', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(profileInput)
      expect(result.valid).toBe(true)
      expect(result.message).toBe('AWS credentials verified with Bedrock access.')
    })

    it('uses fromIni with the given profile name and passes it to BedrockClient', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      await validateAwsCredentials(profileInput)
      expect(mockFromIni).toHaveBeenCalledWith({ profile: 'my-profile' })
      expect(MockBedrockClient).toHaveBeenCalledWith(expect.objectContaining({ region: 'eu-west-1' }))
    })

    it('includes the profile name in the credential-not-found message', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Could not resolve credentials'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(profileInput)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('"my-profile"')
    })

    it('returns a permissions message for UnauthorizedOperation', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('UnauthorizedOperation'))
      MockBedrockClient.mockImplementation(() => ({ send: mockSend }))

      const result = await validateAwsCredentials(profileInput)
      expect(result.valid).toBe(false)
      expect(result.message).toContain("don't have permission to access Bedrock")
    })
  })
})
