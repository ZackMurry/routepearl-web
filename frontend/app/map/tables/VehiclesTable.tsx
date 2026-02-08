'use client'

import React, { FC } from 'react'
import { Badge, Flex, ScrollArea } from '@radix-ui/themes'
import { Truck, Plane } from 'lucide-react'
import { VehicleDetail } from '../routes/useVehicleDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  vehicles: VehicleDetail[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const VehiclesTable: FC<Props> = ({ vehicles, selectedRouteId, onSelectRoute }) => {
  if (vehicles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No vehicles configured. Generate a route to see vehicle details.
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
            <th className="col-stat-sm">Events</th>
            <th className="col-flex">Orders</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => {
            const isSelected = selectedRouteId === vehicle.id
            return (
              <tr
                key={vehicle.id}
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectRoute(isSelected ? null : vehicle.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="accent-cell" style={{ '--accent-color': vehicle.color } as React.CSSProperties}>
                  <Flex align="center" gap="2">
                    {vehicle.type === 'truck' ? (
                      <Truck size={13} style={{ color: vehicle.color, flexShrink: 0 }} />
                    ) : (
                      <Plane size={13} style={{ color: vehicle.color, flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.name}</span>
                  </Flex>
                </td>
                <td>
                  <Badge size="1" color={vehicle.type === 'truck' ? 'gray' : 'blue'} variant="soft">
                    {vehicle.type === 'truck' ? 'Truck' : 'Drone'}
                  </Badge>
                </td>
                <td style={{ fontWeight: 500 }}>{formatDistance(vehicle.distance)}</td>
                <td style={{ fontWeight: 500 }}>{formatDuration(vehicle.duration)}</td>
                <td style={{ textAlign: 'center', fontWeight: 500 }}>{vehicle.eventBreakdown.deliveries}</td>
                <td style={{ textAlign: 'center', fontWeight: 500 }}>{vehicle.totalEvents}</td>
                <td className="cell-truncate" style={{ color: '#64748b' }}>
                  {vehicle.orderIds.length > 0 ? vehicle.orderIds.join(', ') : '--'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export default VehiclesTable
