'use client'

import React, { FC } from 'react'
import { Badge, Flex, ScrollArea } from '@radix-ui/themes'
import { MapPin, Plane, Truck } from 'lucide-react'
import { FlightNode } from '@/lib/types'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  orders: FlightNode[]
  orderDeliveryMap: Map<string, 'drone' | 'truck' | 'unrouted'>
  orderEtaMap: Map<string, { eta: number; distance: number }>
  displayMode: 'coords' | 'address'
  geocodingLoading: Map<string, boolean>
}

const OrdersTable: FC<Props> = ({ orders, orderDeliveryMap, orderEtaMap, displayMode, geocodingLoading }) => {
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
            const location = displayMode === 'coords'
              ? `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
              : isLoading ? 'Loading...' : order.address || `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`

            return (
              <tr key={order.id}>
                <td className="accent-cell" style={{ '--accent-color': accentColor } as React.CSSProperties}>
                  <Flex align="center" gap="1">
                    <MapPin size={12} style={{ color: accentColor === '#d1d5db' ? '#9ca3af' : accentColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{order.orderId || '?'}</span>
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
                      <Flex align="center" gap="1"><Plane size={10} /> Drone</Flex>
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
