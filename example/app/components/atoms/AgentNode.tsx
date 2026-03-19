'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Box, Typography } from '@mui/material'

function AgentNodeComponent({ data }: NodeProps) {
  const { label, isActive } = data as { label: string; isActive: boolean; description: string }

  return (
    <>
      <Handle type="target" id="target-top" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" id="target-right" position={Position.Right} style={{ opacity: 0 }} />
      <Box
        sx={{
          px: 2,
          py: 1,
          borderRadius: '10px',
          bgcolor: isActive ? '#2563eb' : '#e2e8f0',
          border: '1.5px solid',
          borderColor: isActive ? '#1d4ed8' : '#cbd5e1',
          boxShadow: isActive ? '0 0 8px rgba(37, 99, 235, 0.5)' : 'none',
          animation: isActive ? 'agentPulse 2s ease-in-out infinite' : 'none',
          '@keyframes agentPulse': {
            '0%, 100%': { boxShadow: '0 0 4px rgba(37, 99, 235, 0.3)' },
            '50%': { boxShadow: '0 0 12px rgba(37, 99, 235, 0.6)' },
          },
          minWidth: 100,
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? '#ffffff' : '#1e293b',
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
      </Box>
      {isActive && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22c55e' }} />
          <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#2563eb' }}>Active</Typography>
        </Box>
      )}
      <Handle type="source" id="source-bottom" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" id="source-right" position={Position.Right} style={{ opacity: 0 }} />
    </>
  )
}

export const AgentNode = memo(AgentNodeComponent)
