/**
 * Global type declarations for browser environment
 */

interface WindowEnv {
  stage?: string
}

declare global {
  interface Window {
    __env__?: WindowEnv
  }

  // Make window available in this module
  var window: Window | undefined
}

export {}
