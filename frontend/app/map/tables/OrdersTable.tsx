'use client'

import React, { FC } from 'react'
import { Badge, Flex, IconButton, ScrollArea } from '@radix-ui/themes'
import { MapPin, MapPinned, Hash, Drone, Truck } from 'lucide-react'
import { MissionSite } from '@/lib/types'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  orders: MissionSite[]
  orderDeliveryMap: Map<string, 'drone' | 'truck' | 'unrouted'>
  orderEtaMap: Map<string, { eta: number; distance: number }>
  displayMode: 'coords' | 'address'
  geocodingLoading: Map<string, boolean>
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
  getDisplayMode?: (id: string) => 'coords' | 'address'
  onToggleDisplayMode?: (id: string, node: MissionSite) => void
}

const OrdersTable: FC<Props> = ({ orders, orderDeliveryMap, orderEtaMap, displayMode, geocodingLoading, selectedNodeId, onSelectNode, getDisplayMode, onToggleDisplayMode }) => {
  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No orders added yet.
      </div>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <table className="data-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-id">#</th>
            <th className="col-flex">Location</th>
            <th className="col-stat">ETA</th>
            <th className="col-stat">Distance</th>
            <th className="col-vehicle">Vehicle</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const vehicle = orderDeliveryMap.get(order.id) || 'unrouted'
            const etaInfo = orderEtaMap.get(order.id)
            const accentColor = vehicle === 'drone' ? '#facc15' : vehicle === 'truck' ? '#3b82f6' : '#d1d5db'
            const isLoading = geocodingLoading.get(order.id) || false
            const isSelected = selectedNodeId === order.id
            const rowDisplayMode = getDisplayMode ? getDisplayMode(order.id) : displayMode
            const location = rowDisplayMode === 'coords'
              ? `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
              : isLoading ? 'Loading...' : order.address || `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`

            return (
              <tr
                key={order.id}
                data-node-id={order.id}
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectNode?.(isSelected ? null : order.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="accent-cell" style={{ '--accent-color': accentColor } as React.CSSProperties}>
                  <Flex align="center" gap="1">
                    <MapPin size={12} style={{ color: accentColor === '#d1d5db' ? '#9ca3af' : accentColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{order.orderId || '?'}</span>
                    {onToggleDisplayMode && (
                      <IconButton size="1" variant="ghost" color={rowDisplayMode === 'address' ? 'blue' : 'gray'} onClick={(e) => { e.stopPropagation(); onToggleDisplayMode(order.id, order) }} title={rowDisplayMode === 'coords' ? 'Show address' : 'Show coordinates'} style={{ minWidth: '16px', minHeight: '16px', padding: '1px', marginLeft: '2px' }}>
                        {rowDisplayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                      </IconButton>
                    )}
                  </Flex>
                </td>
                <td className="cell-truncate" style={{ color: '#374151' }}>
                  {location}
                </td>
                <td style={{ color: '#374151', fontWeight: 500 }}>
                  {etaInfo ? formatDuration(etaInfo.eta) : '--'}
                </td>
                <td style={{ color: '#374151', fontWeight: 500 }}>
                  {etaInfo && etaInfo.distance > 0 ? formatDistance(etaInfo.distance) : '--'}
                </td>
                <td>
                  {vehicle === 'drone' ? (
                    <Badge size="1" variant="soft" style={{ backgroundColor: '#fef9c3', color: '#a16207' }}>
                      <Flex align="center" gap="1"><Drone size={10} /> Drone</Flex>
                    </Badge>
                  ) : vehicle === 'truck' ? (
                    <Badge size="1" variant="soft" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                      <Flex align="center" gap="1"><Truck size={10} /> Truck</Flex>
                    </Badge>
                  ) : (
                    <Badge size="1" variant="soft" color="gray">Unrouted</Badge>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export default OrdersTable
