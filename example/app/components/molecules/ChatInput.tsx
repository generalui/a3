'use client'

import { useState, useCallback } from 'react'
import styled from 'styled-components'
import { TextField, Button, Box } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

type Props = {
  onSubmit: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

const InputContainer = styled(Box)`
  border-top: 1px solid ${({ theme }) => theme.palette.divider};
  background-color: ${({ theme }) => theme.palette.background.paper};
  padding: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
`

const InputForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1.5)};
`

export function ChatInput({ onSubmit, disabled, placeholder = 'Type a message...' }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      onSubmit(trimmed)
      setValue('')
    },
    [value, disabled, onSubmit],
  )

  return (
    <InputContainer>
      <InputForm onSubmit={handleSubmit}>
        <TextField
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          variant="outlined"
          size="small"
          data-testid="chat-input"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !value.trim()}
          startIcon={<SendIcon />}
          data-testid="chat-send"
        >
          Send
        </Button>
      </InputForm>
    </InputContainer>
  )
}
