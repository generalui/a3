'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import styled from 'styled-components'
import { TextField, Button, Box } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import SendIcon from '@mui/icons-material/Send'
import { CHAT_PLACEHOLDER, CHAT_SEND } from '@constants/ui'

type Props = {
  onSubmit: (text: string) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
}

const InputContainer = styled(Box)`
  border-top: 1px solid ${({ theme }) => (theme as Theme).palette.divider};
  background-color: ${({ theme }) => (theme as Theme).palette.background.paper};
  padding: ${({ theme }) => (theme as Theme).spacing(2)};
  flex-shrink: 0;
`

const InputForm = styled.form`
  display: flex;
  gap: ${({ theme }) => (theme as Theme).spacing(1.5)};
`

export function ChatInput({ onSubmit, disabled, placeholder = CHAT_PLACEHOLDER }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevDisabled = useRef(disabled)

  useEffect(() => {
    // When transitioning from disabled (true) back to enabled (false), restore focus
    if (prevDisabled.current && !disabled) {
      // Small timeout to ensure the clear-disabled DOM update finishes
      const timer = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(timer)
    }
    prevDisabled.current = disabled
  }, [disabled])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      void onSubmit(trimmed)
      setValue('')
    },
    [value, disabled, onSubmit],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit],
  )

  return (
    <InputContainer>
      <InputForm onSubmit={handleSubmit}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          variant="outlined"
          size="small"
          autoComplete="off"
          data-testid="chat-input"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !value.trim()}
          startIcon={<SendIcon />}
          data-testid="chat-send"
        >
          {CHAT_SEND}
        </Button>
      </InputForm>
    </InputContainer>
  )
}
