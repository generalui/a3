'use client'

import { useState } from 'react'
import { Paper, Typography, Box, List, ListItemButton, ListItemText, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { STATE_HEADING, STATE_EMPTY } from '@constants/ui'

interface StateViewerProps {
  state: Record<string, unknown>
}

const VALUE_COLORS = {
  string: '#16a34a',
  number: '#2563eb',
  boolean: '#ea580c',
  null: '#9ca3af',
} as const

function ValueDisplay({ value }: { value: unknown }) {
  const isNullish = value === null || value === undefined
  const typeKey = isNullish ? 'null' : typeof value
  const color = typeKey in VALUE_COLORS ? VALUE_COLORS[typeKey as keyof typeof VALUE_COLORS] : '#64748b'

  const getContent = () => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'function') return `[Function${value.name ? `: ${value.name}` : ''}]`
    if (typeof value === 'symbol') return value.toString()
    return String(value as number | boolean | bigint)
  }

  return (
    <Typography
      component="span"
      sx={{ color, fontFamily: 'monospace', fontSize: 13, fontStyle: isNullish ? 'italic' : 'normal' }}
    >
      {getContent()}
    </Typography>
  )
}

function StateNode({ label, value, defaultOpen = false, depth = 0 }: { label: string; value: unknown; defaultOpen?: boolean; depth?: number }) {
  const [open, setOpen] = useState(defaultOpen)

  const isExpandable = value !== null && typeof value === 'object'

  if (!isExpandable) {
    return (
      <ListItemButton sx={{ pl: 2 + depth * 2, py: 0.25 }} disableRipple>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#475569' }}>
                {label}:
              </Typography>
              <ValueDisplay value={value} />
            </Box>
          }
        />
      </ListItemButton>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>)

  return (
    <>
      <ListItemButton onClick={() => setOpen(!open)} sx={{ pl: 2 + depth * 2, py: 0.25 }}>
        {open ? <ExpandMoreIcon sx={{ fontSize: 18, color: '#94a3b8' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: '#94a3b8' }} />}
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 0.5 }}>
              <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#475569' }}>
                {label}
              </Typography>
              <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                {Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`}
              </Typography>
            </Box>
          }
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List disablePadding>
          {entries.map(([key, val]) => (
            <StateNode key={key} label={key} value={val} depth={depth + 1} />
          ))}
        </List>
      </Collapse>
    </>
  )
}

export function StateViewer({ state }: StateViewerProps) {
  const entries = Object.entries(state)
  const hasData = entries.length > 0

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        {STATE_HEADING}
      </Typography>
      <Box sx={{ overflowY: 'auto', maxHeight: 300 }}>
        {hasData ? (
          <List disablePadding dense>
            {entries.map(([key, value]) => (
              <StateNode key={key} label={key} value={value} defaultOpen depth={0} />
            ))}
          </List>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center', fontStyle: 'italic' }}>
            {STATE_EMPTY}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
