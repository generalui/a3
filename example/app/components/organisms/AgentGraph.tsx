'use client'

import { useState, useEffect } from 'react'
import { Paper, Typography, Box, Stack } from '@mui/material'

type AgentInfo = {
  id: string
  description: string
  transition: { type: 'deterministic' | 'dynamic' | 'none'; targets: string[] }
}

interface AgentGraphProps {
  activeAgentId: string | null
}

const NODE_WIDTH = 110
const NODE_HEIGHT = 38
const NODE_GAP = 80
const PADDING_X = 30
const PADDING_TOP = 20
const ARROW_ABOVE_Y = 14
const ARROW_BELOW_Y = 28

export function AgentGraph({ activeAgentId }: AgentGraphProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([])

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data: { agents: AgentInfo[] }) => setAgents(data.agents))
      .catch(console.error)
  }, [])

  if (agents.length === 0) return null

  const resolvedActiveId = activeAgentId ?? agents[0]?.id ?? null

  const svgWidth = PADDING_X * 2 + agents.length * NODE_WIDTH + (agents.length - 1) * NODE_GAP
  const svgHeight = PADDING_TOP + ARROW_ABOVE_Y + NODE_HEIGHT + ARROW_BELOW_Y + PADDING_TOP

  const agentIndex = new Map(agents.map((a, i) => [a.id, i]))

  function nodeX(index: number) {
    return PADDING_X + index * (NODE_WIDTH + NODE_GAP)
  }

  const nodeY = PADDING_TOP + ARROW_ABOVE_Y

  // Collect edges with offset tracking for overlapping pairs
  type Edge = { fromId: string; toId: string; fromIdx: number; toIdx: number; isDashed: boolean }
  const edges: Edge[] = []
  for (const agent of agents) {
    const fromIdx = agentIndex.get(agent.id)!
    for (const targetId of agent.transition.targets) {
      const toIdx = agentIndex.get(targetId)
      if (toIdx === undefined) continue
      edges.push({
        fromId: agent.id,
        toId: targetId,
        fromIdx,
        toIdx,
        isDashed: agent.transition.type === 'dynamic',
      })
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" fontWeight="bold">
          Agent Graph
        </Typography>
        <Stack direction="row" gap={2} alignItems="center">
          <Stack direction="row" gap={0.5} alignItems="center">
            <Box sx={{ width: 20, height: 0, borderTop: '2px solid #64748b' }} />
            <Typography variant="caption" color="text.secondary">
              Deterministic
            </Typography>
          </Stack>
          <Stack direction="row" gap={0.5} alignItems="center">
            <Box sx={{ width: 20, height: 0, borderTop: '2px dashed #94a3b8' }} />
            <Typography variant="caption" color="text.secondary">
              LLM-driven
            </Typography>
          </Stack>
        </Stack>
      </Stack>
      <Box sx={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <marker id="arrow-solid" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
            <marker id="arrow-dashed" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const isDashed = edge.isDashed
            const stroke = isDashed ? '#94a3b8' : '#64748b'
            const marker = `url(#arrow-${isDashed ? 'dashed' : 'solid'})`

            // Self-loop: arc above the node
            if (edge.fromIdx === edge.toIdx) {
              const cx = nodeX(edge.fromIdx) + NODE_WIDTH / 2
              const top = nodeY
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M ${cx - 18} ${top} C ${cx - 18} ${top - ARROW_ABOVE_Y}, ${cx + 18} ${top - ARROW_ABOVE_Y}, ${cx + 18} ${top}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={isDashed ? '5,3' : undefined}
                  markerEnd={marker}
                />
              )
            }

            const goingRight = edge.toIdx > edge.fromIdx

            if (goingRight) {
              // Arrow above: from right edge of source to left edge of target
              const x1 = nodeX(edge.fromIdx) + NODE_WIDTH
              const x2 = nodeX(edge.toIdx)
              const y = nodeY + NODE_HEIGHT * 0.35
              const cpOffset = (x2 - x1) * 0.15
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M ${x1} ${y} C ${x1 + cpOffset} ${y - 16}, ${x2 - cpOffset} ${y - 16}, ${x2} ${y}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={isDashed ? '5,3' : undefined}
                  markerEnd={marker}
                />
              )
            } else {
              // Arrow below: from left edge of source to right edge of target
              const x1 = nodeX(edge.fromIdx)
              const x2 = nodeX(edge.toIdx) + NODE_WIDTH
              const y = nodeY + NODE_HEIGHT * 0.65
              const cpOffset = Math.abs(x2 - x1) * 0.15
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M ${x1} ${y} C ${x1 - cpOffset} ${y + ARROW_BELOW_Y}, ${x2 + cpOffset} ${y + ARROW_BELOW_Y}, ${x2} ${y}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={isDashed ? '5,3' : undefined}
                  markerEnd={marker}
                />
              )
            }
          })}

          {/* Nodes */}
          {agents.map((agent, i) => {
            const x = nodeX(i)
            const y = nodeY
            const isActive = agent.id === resolvedActiveId

            return (
              <g key={agent.id}>
                {isActive && (
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={NODE_WIDTH + 6}
                    height={NODE_HEIGHT + 6}
                    rx={14}
                    ry={14}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2}
                    opacity={0.4}
                  >
                    <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                  </rect>
                )}
                <rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={10}
                  ry={10}
                  fill={isActive ? '#2563eb' : '#e2e8f0'}
                  stroke={isActive ? '#1d4ed8' : '#cbd5e1'}
                  strokeWidth={1.5}
                />
                <text
                  x={x + NODE_WIDTH / 2}
                  y={y + NODE_HEIGHT / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isActive ? '#ffffff' : '#1e293b'}
                  fontSize={12}
                  fontWeight={isActive ? 700 : 500}
                  fontFamily="system-ui, sans-serif"
                >
                  {agent.id}
                </text>
              </g>
            )
          })}
        </svg>
      </Box>
    </Paper>
  )
}
