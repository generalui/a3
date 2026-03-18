jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}))

jest.mock('node:os', () => ({
  homedir: jest.fn(),
}))

import fs from 'node:fs'
import os from 'node:os'
import { detectAwsProfiles, detectAwsProfileRegion } from '@create-utils/aws'

const mockReadFileSync = fs.readFileSync as jest.Mock
const mockHomedir = os.homedir as jest.Mock

const CREDENTIALS_WITH_PROFILES = `
[default]
aws_access_key_id=AKIADEFAULT
aws_secret_access_key=defaultsecret

[work]
aws_access_key_id=AKIAWORK
aws_secret_access_key=worksecret
region=us-west-2

[personal]
aws_access_key_id=AKIAPERSONAL
aws_secret_access_key=personalsecret
`.trim()

const CONFIG_WITH_REGIONS = `
[default]
region=ap-southeast-1
output=json

[profile work]
region=eu-central-1
output=json
`.trim()

beforeEach(() => {
  jest.resetAllMocks()
  mockHomedir.mockReturnValue('/home/testuser')
  delete process.env.AWS_SHARED_CREDENTIALS_FILE
  delete process.env.AWS_CONFIG_FILE
})

// ── detectAwsProfiles ─────────────────────────────────────────────────────────

describe('detectAwsProfiles', () => {
  it('returns empty array when the credentials file does not exist', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    expect(detectAwsProfiles()).toEqual([])
  })

  it('returns profile names parsed from the credentials file', () => {
    mockReadFileSync.mockReturnValue(CREDENTIALS_WITH_PROFILES)
    expect(detectAwsProfiles()).toEqual(['default', 'work', 'personal'])
  })

  it('returns empty array when the file has no profile headers', () => {
    mockReadFileSync.mockReturnValue('aws_access_key_id=AKIA...\naws_secret_access_key=secret')
    expect(detectAwsProfiles()).toEqual([])
  })

  it('reads from the default credentials path when env var is not set', () => {
    mockReadFileSync.mockReturnValue('')
    detectAwsProfiles()
    expect(mockReadFileSync).toHaveBeenCalledWith('/home/testuser/.aws/credentials', 'utf-8')
  })

  it('reads from AWS_SHARED_CREDENTIALS_FILE when set', () => {
    process.env.AWS_SHARED_CREDENTIALS_FILE = '/custom/path/credentials'
    mockReadFileSync.mockReturnValue('[myprofile]\n')
    detectAwsProfiles()
    expect(mockReadFileSync).toHaveBeenCalledWith('/custom/path/credentials', 'utf-8')
  })
})

// ── detectAwsProfileRegion ────────────────────────────────────────────────────

describe('detectAwsProfileRegion', () => {
  it('returns the region from the credentials file when present and does not read the config file', () => {
    mockReadFileSync.mockReturnValueOnce(CREDENTIALS_WITH_PROFILES)
    expect(detectAwsProfileRegion('work')).toBe('us-west-2')
    expect(mockReadFileSync).toHaveBeenCalledTimes(1)
  })

  it('falls back to the config file when the credentials file has no region for the profile', () => {
    // credentials file has no region for 'default'; config file does
    mockReadFileSync
      .mockReturnValueOnce('[default]\naws_access_key_id=AKIA...')
      .mockReturnValueOnce(CONFIG_WITH_REGIONS)
    expect(detectAwsProfileRegion('default')).toBe('ap-southeast-1')
  })

  it('looks up [profile <name>] in the config file for non-default profiles and reads the default config path', () => {
    mockReadFileSync
      .mockReturnValueOnce('[work]\naws_access_key_id=AKIA...') // no region in credentials
      .mockReturnValueOnce(CONFIG_WITH_REGIONS)
    expect(detectAwsProfileRegion('work')).toBe('eu-central-1')
    expect(mockReadFileSync).toHaveBeenNthCalledWith(2, '/home/testuser/.aws/config', 'utf-8')
  })

  it('looks up [default] — not [profile default] — in the config file for the default profile', () => {
    // Config file only has [profile default], not [default] — proves the source uses the bare section name
    const configWithProfileDefault = '[profile default]\nregion=us-east-1'
    mockReadFileSync
      .mockReturnValueOnce('[default]\naws_access_key_id=AKIA...') // no region in credentials
      .mockReturnValueOnce(configWithProfileDefault)
    expect(detectAwsProfileRegion('default')).toBeUndefined()
  })

  it('returns undefined when the profile has no region in either file', () => {
    mockReadFileSync
      .mockReturnValueOnce('[personal]\naws_access_key_id=AKIA...')
      .mockReturnValueOnce('[profile personal]\noutput=json')
    expect(detectAwsProfileRegion('personal')).toBeUndefined()
  })

  it('returns undefined when both files are unreadable', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(detectAwsProfileRegion('default')).toBeUndefined()
  })

  it('reads the default credentials path first, then AWS_CONFIG_FILE when set', () => {
    process.env.AWS_CONFIG_FILE = '/custom/path/config'
    mockReadFileSync
      .mockReturnValueOnce('[default]\n') // credentials, no region
      .mockReturnValueOnce('[default]\nregion=us-east-1') // config
    detectAwsProfileRegion('default')
    expect(mockReadFileSync).toHaveBeenNthCalledWith(1, '/home/testuser/.aws/credentials', 'utf-8')
    expect(mockReadFileSync).toHaveBeenNthCalledWith(2, '/custom/path/config', 'utf-8')
  })

  it('uses AWS_SHARED_CREDENTIALS_FILE for the credentials path when set', () => {
    process.env.AWS_SHARED_CREDENTIALS_FILE = '/custom/credentials'
    mockReadFileSync.mockReturnValueOnce('[default]\nregion=us-west-1')
    expect(detectAwsProfileRegion('default')).toBe('us-west-1')
    expect(mockReadFileSync).toHaveBeenCalledWith('/custom/credentials', 'utf-8')
  })

  it('falls back to the config file when the credentials file throws', () => {
    mockReadFileSync
      .mockImplementationOnce(() => { throw new Error('ENOENT') })
      .mockReturnValueOnce(CONFIG_WITH_REGIONS)
    expect(detectAwsProfileRegion('default')).toBe('ap-southeast-1')
  })

  it('reads the default config path when AWS_CONFIG_FILE is not set', () => {
    mockReadFileSync
      .mockReturnValueOnce('[work]\naws_access_key_id=AKIA...') // no region in credentials
      .mockReturnValueOnce(CONFIG_WITH_REGIONS)
    detectAwsProfileRegion('work')
    expect(mockReadFileSync).toHaveBeenNthCalledWith(2, '/home/testuser/.aws/config', 'utf-8')
  })

  it('handles INI files with extra whitespace around the region value', () => {
    mockReadFileSync.mockReturnValue('[default]\nregion  =  us-east-2  ')
    expect(detectAwsProfileRegion('default')).toBe('us-east-2')
  })
})
