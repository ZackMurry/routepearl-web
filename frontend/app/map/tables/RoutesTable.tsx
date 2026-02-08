'use client'

import React, { FC } from 'react'
import { Badge, Flex, ScrollArea } from '@radix-ui/themes'
import { Truck, Plane } from 'lucide-react'
import { RouteDetail } from '../routes/useRouteDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  routes: RouteDetail[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const RoutesTable: FC<Props> = ({ routes, selectedRouteId, onSelectRoute }) => {
  if (routes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No routes generated. Generate a route to see route details.
      </div>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <table className="data-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-flex">Name</th>
            <th className="col-type">Type</th>
            <th className="col-stat">Distance</th>
            <th className="col-stat">Duration</th>
            <th className="col-stat-sm">Deliv.</th>
            <th className="col-flex">Orders</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const isSelected = selectedRouteId === route.id
            return (
              <tr
                key={route.id}
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectRoute(isSelected ? null : route.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="accent-cell" style={{ '--accent-color': route.color } as React.CSSProperties}>
                  <Flex align="center" gap="2">
                    {route.type === 'truck' ? (
                      <Truck size={13} style={{ color: route.color, flexShrink: 0 }} />
                    ) : (
                      <Plane size={13} style={{ color: route.color, flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.name}</span>
                  </Flex>
                </td>
                <td>
                  <Badge size="1" color={route.type === 'truck' ? 'gray' : 'blue'} variant="soft">
                    {route.type === 'truck' ? 'Truck' : 'Drone'}
                  </Badge>
                </td>
                <td style={{ fontWeight: 500 }}>{formatDistance(route.distance)}</td>
                <td style={{ fontWeight: 500 }}>{formatDuration(route.duration)}</td>
                <td style={{ textAlign: 'center', fontWeight: 500 }}>{route.deliveries}</td>
                <td className="cell-truncate" style={{ color: '#64748b' }}>
                  {route.orderIds.length > 0 ? route.orderIds.join(', ') : '--'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export default RoutesTable
