import { PasswordPrompt } from '@clack/core'
import { S_BAR, S_PASSWORD_MASK, symbol } from '@clack/prompts'
import { styleText } from 'node:util'

import { maskKey } from '@create-utils/validation'

interface MaskedInputOptions {
  message: string
  edge?: number
  validate?: (value: string | undefined) => string | Error | undefined
}

/**
 * A drop-in replacement for `p.password()` that partially masks input,
 * revealing the first and last `edge` characters while masking the middle.
 * Uses {@link maskKey} for consistent masking across display and input.
 * @param opts.message - Prompt label
 * @param opts.edge - Characters to reveal per side (default 8; use 4 for shorter AWS keys)
 * @param opts.validate - Optional validation function
 */
export function maskedInput(opts: MaskedInputOptions): Promise<string | symbol> {
  const edge = opts.edge ?? 8

  return new PasswordPrompt({
    mask: S_PASSWORD_MASK,
    validate: opts.validate,
    render() {
      const title = `${symbol(this.state)}  ${opts.message}\n`
      const masked = this.userInput.length > 0 ? maskKey(this.userInput, edge) : ''

      switch (this.state) {
        case 'submit':
          return `${title}${S_BAR}  ${styleText('dim', masked)}`
        case 'cancel':
          return `${title}${S_BAR}  ${styleText(['strikethrough', 'dim'], masked)}`
        case 'error':
          return `${title}${S_BAR}  ${masked}\n${S_BAR}  ${styleText('yellow', this.error)}`
        default:
          return `${title}${S_BAR}  ${masked || styleText('dim', 'Paste your key')}\n${S_BAR}`
      }
    },
  }).prompt()
}
