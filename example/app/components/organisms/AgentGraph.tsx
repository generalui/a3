'use client'

import { useMemo } from 'react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { Paper, Typography, Box, Stack } from '@mui/material'
import { AgentNode } from '@atoms/AgentNode'
import { DeterministicEdge, DynamicEdge, SelfLoopEdge } from '@atoms/TransitionEdge'
import { getGraphLayout } from '@lib/getGraphLayout'
import type { AgentInfo } from '@lib/getAgentGraphData'
import '@xyflow/react/dist/style.css'

interface AgentGraphProps {
  agents: AgentInfo[]
  activeAgentId: string | null
}

const nodeTypes = { agent: AgentNode }
const edgeTypes = {
  deterministic: DeterministicEdge,
  dynamic: DynamicEdge,
  selfLoop: SelfLoopEdge,
}

export function AgentGraph({ agents, activeAgentId }: AgentGraphProps) {
  const { nodes, edges } = useMemo(() => getGraphLayout(agents, activeAgentId), [agents, activeAgentId])

  if (agents.length === 0) return null

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
      <Box sx={{ height: 350 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.4 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            panOnDrag={false}
            panOnScroll={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </Box>
    </Paper>
  )
}
