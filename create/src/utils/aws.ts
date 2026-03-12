import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function detectAwsProfiles(): string[] {
  try {
    const credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE
      || path.join(os.homedir(), '.aws', 'credentials')
    const content = fs.readFileSync(credentialsPath, 'utf-8')
    const profiles: string[] = []
    const regex = /^\[([^\]]+)\]$/gm
    let match
    while ((match = regex.exec(content)) !== null) {
      profiles.push(match[1])
    }
    return profiles
  } catch {
    return []
  }
}

export function detectAwsProfileRegion(profileName: string): string | undefined {
  // Check ~/.aws/credentials first
  try {
    const credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE
      || path.join(os.homedir(), '.aws', 'credentials')
    const content = fs.readFileSync(credentialsPath, 'utf-8')
    const region = extractRegionFromIni(content, profileName)
    if (region) return region
  } catch {
    // file doesn't exist or isn't readable
  }

  // Check ~/.aws/config — handles [default] and [profile <name>] syntax
  try {
    const configPath = process.env.AWS_CONFIG_FILE
      || path.join(os.homedir(), '.aws', 'config')
    const content = fs.readFileSync(configPath, 'utf-8')
    // In config file, default uses [default], others use [profile <name>]
    const sectionName = profileName === 'default' ? profileName : `profile ${profileName}`
    const region = extractRegionFromIni(content, sectionName)
    if (region) return region
  } catch {
    // file doesn't exist or isn't readable
  }

  return undefined
}

function extractRegionFromIni(content: string, sectionName: string): string | undefined {
  const lines = content.split('\n')
  let inSection = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[')) {
      const name = trimmed.slice(1, -1)
      inSection = name === sectionName
      continue
    }
    if (inSection && trimmed.startsWith('region')) {
      const match = /^region\s*=\s*(.+)$/.exec(trimmed)
      if (match) return match[1].trim()
    }
  }

  return undefined
}
