'use client'

import React, { FC, useMemo } from 'react'
import { Flex, ScrollArea } from '@radix-ui/themes'
import { House, Zap, AlertTriangle, MapPin } from 'lucide-react'
import { FlightNode } from '@/lib/types'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

const NODE_TYPE_CONFIG: Record<string, { color: 'blue' | 'orange' | 'red' | 'purple'; icon: typeof House; accentColor: string }> = {
  depot: { color: 'blue', icon: House, accentColor: '#3b82f6' },
  station: { color: 'orange', icon: Zap, accentColor: '#f97316' },
  hazard: { color: 'red', icon: AlertTriangle, accentColor: '#ef4444' },
  waypoint: { color: 'purple', icon: MapPin, accentColor: '#8b5cf6' },
}

interface Props {
  nodes: FlightNode[]
  displayMode: 'coords' | 'address'
  geocodingLoading: Map<string, boolean>
  nodeEtaMap?: Map<string, { eta: number; distance: number }>
  nodeEventCountMap?: Map<string, number>
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
}

const FlightNodesTable: FC<Props> = ({ nodes, displayMode, geocodingLoading, nodeEtaMap, nodeEventCountMap, selectedNodeId, onSelectNode }) => {
  // Compute per-type numbering
  const typeNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    const counters: Record<string, number> = {}
    for (const node of nodes) {
      counters[node.type] = (counters[node.type] || 0) + 1
      map.set(node.id, counters[node.type])
    }
    return map
  }, [nodes])

  if (nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No flight nodes added yet.
      </div>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <table className="data-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-id">#</th>
            <th className="col-flex">Name</th>
            <th className="col-flex">Location</th>
            <th className="col-stat">Dist.</th>
            <th className="col-stat">ETA</th>
            <th className="col-stat-sm">Events</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.waypoint
            const Icon = config.icon
            const isLoading = geocodingLoading.get(node.id) || false
            const location = displayMode === 'coords'
              ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
              : isLoading ? 'Loading...' : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
            const etaInfo = nodeEtaMap?.get(node.id)
            const eventCount = nodeEventCountMap?.get(node.id) || 0
            const typeNum = typeNumberMap.get(node.id) || ''

            const isSelected = selectedNodeId === node.id

            return (
              <tr key={node.id} className={isSelected ? 'selected' : ''} onClick={() => onSelectNode?.(isSelected ? null : node.id)} style={{ cursor: 'pointer' }}>
                <td className="accent-cell" style={{ '--accent-color': config.accentColor } as React.CSSProperties}>
                  <Flex align="center" gap="1">
                    <Icon size={12} style={{ color: config.accentColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{node.flightNodeId || '?'}</span>
                  </Flex>
                </td>
                <td>
                  <span style={{ fontWeight: 600 }}>Flight Node {node.flightNodeId || '?'}</span>
                  <span style={{ color: config.accentColor, fontWeight: 500 }}> — {node.type.charAt(0).toUpperCase() + node.type.slice(1)} {typeNum}</span>
                </td>
                <td className="cell-truncate" style={{ color: '#374151' }}>
                  {location}
                </td>
                <td style={{ fontWeight: 500 }}>
                  {etaInfo ? formatDistance(etaInfo.distance) : '--'}
                </td>
                <td style={{ fontWeight: 500 }}>
                  {etaInfo ? formatDuration(etaInfo.eta) : '--'}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 500 }}>
                  {eventCount > 0 ? eventCount : '--'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export default FlightNodesTable
