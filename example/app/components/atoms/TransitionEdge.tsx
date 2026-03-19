'use client'

import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

function DeterministicEdgeComponent(props: EdgeProps) {
  const [edgePath] = getBezierPath(props)
  return (
    <BaseEdge
      path={edgePath}
      markerEnd={props.markerEnd}
      style={{ stroke: '#64748b', strokeWidth: 1.5 }}
    />
  )
}

function DynamicEdgeComponent(props: EdgeProps) {
  const [edgePath] = getBezierPath(props)
  return (
    <BaseEdge
      path={edgePath}
      markerEnd={props.markerEnd}
      style={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5,3' }}
    />
  )
}

function SelfLoopEdgeComponent({ targetX, targetY, markerEnd, data }: EdgeProps) {
  const isDynamic = (data as Record<string, unknown>)?.isDynamic
  const stroke = isDynamic ? '#94a3b8' : '#64748b'

  // Small arc above the node's target handle (top center)
  const d = `M ${targetX - 12} ${targetY} C ${targetX - 12} ${targetY - 25}, ${targetX + 12} ${targetY - 25}, ${targetX + 12} ${targetY}`

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeDasharray={isDynamic ? '5,3' : undefined}
      markerEnd={markerEnd}
    />
  )
}

export const DeterministicEdge = memo(DeterministicEdgeComponent)
export const DynamicEdge = memo(DynamicEdgeComponent)
export const SelfLoopEdge = memo(SelfLoopEdgeComponent)
