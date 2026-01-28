import { log } from '@utils/logger'

export enum Environment {
  Local = 'local',
  LocalSandbox = 'local-sandbox',
  Test = 'test',
  Sandbox = 'sandbox',
  Dev = 'dev',
  Staging = 'stage',
  Production = 'prod',
}

export function isTest(): boolean {
  return getEnvStage() === Environment.Test
}

export function isLocal(): boolean {
  return [Environment.Local, Environment.Sandbox].includes(getEnvStage())
}

export function getEnvStage(): Environment {
  let stage: string | Environment = Environment.Sandbox // default
  let environment = stage

  // Check if window is available (client-side) and has env object
  if (typeof window !== 'undefined' && window.__env__?.stage) {
    stage = window.__env__.stage
  } else {
    // Fallback to process.env for server-side or when window.__env__ is not available
    stage = process.env.NEXT_PUBLIC_STAGE || Environment.Sandbox
  }

  if (!stage) {
    log.warn(`NEXT_PUBLIC_STAGE environment variable is not set, defaulting to ${environment}`)
  } else if (!Object.values(Environment).includes(stage as Environment)) {
    log.warn(`Invalid NEXT_PUBLIC_STAGE environment variable: ${stage}. Defaulting to ${environment}`)
  } else {
    environment = stage as Environment
  }

  if ((environment as Environment) === Environment.LocalSandbox) {
    environment = Environment.Sandbox
  }

  return environment as Environment
}
