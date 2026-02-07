'use client'

import React, { FC } from 'react'
import { Box, Card, Flex, Text, Badge, ScrollArea } from '@radix-ui/themes'
import { Truck, Plane, Route, Clock, Package, MapPin, Zap, ArrowUp, ArrowDown } from 'lucide-react'
import { VehicleDetail } from './useVehicleDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  vehicles: VehicleDetail[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const VehiclesTab: FC<Props> = ({ vehicles, selectedRouteId, onSelectRoute }) => {
  if (vehicles.length === 0) {
    return (
      <Box className="text-center p-6 bg-gray-50 rounded" style={{ margin: '16px' }}>
        <Text size="2" color="gray">
          No vehicles configured. Generate a route to see vehicle details.
        </Text>
      </Box>
    )
  }

  const handleClick = (vehicleId: string) => {
    onSelectRoute(selectedRouteId === vehicleId ? null : vehicleId)
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '8px',
          padding: '16px',
          paddingRight: '24px',
        }}
      >
        {vehicles.map((vehicle) => {
          const isSelected = selectedRouteId === vehicle.id
          const { eventBreakdown } = vehicle

          return (
            <Card
              key={vehicle.id}
              className="p-0"
              style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                backgroundColor: isSelected ? '#eff6ff' : 'white',
                transition: 'all 0.15s ease',
                overflow: 'hidden',
              }}
              onClick={() => handleClick(vehicle.id)}
            >
              <Flex>
                {/* Color accent bar */}
                <div
                  style={{
                    width: '4px',
                    minHeight: '100%',
                    backgroundColor: vehicle.color,
                    flexShrink: 0,
                  }}
                />

                <Box style={{ padding: '10px 12px', flex: 1 }}>
                  {/* Header: name + type badge */}
                  <Flex justify="between" align="center" style={{ marginBottom: '8px' }}>
                    <Flex align="center" gap="2">
                      {vehicle.type === 'truck' ? (
                        <Truck size={14} style={{ color: vehicle.color }} />
                      ) : (
                        <Plane size={14} style={{ color: vehicle.color }} />
                      )}
                      <Text size="2" weight="bold">
                        {vehicle.name}
                      </Text>
                    </Flex>
                    <Flex gap="1">
                      <Badge
                        size="1"
                        color={vehicle.type === 'truck' ? 'gray' : 'blue'}
                        variant="soft"
                      >
                        {vehicle.type === 'truck' ? 'Truck' : 'Drone'}
                      </Badge>
                      {vehicle.sortiesHandled.length > 0 && (
                        <Badge size="1" color="purple" variant="soft">
                          {vehicle.sortiesHandled.length} sortie{vehicle.sortiesHandled.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </Flex>
                  </Flex>

                  {/* Stats grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 12px',
                      marginBottom: '6px',
                    }}
                  >
                    <Flex align="center" gap="1">
                      <Route size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {formatDistance(vehicle.distance)}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Clock size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {formatDuration(vehicle.duration)}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Package size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {eventBreakdown.deliveries} deliveries
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Text size="1" color="gray">
                        {vehicle.totalEvents} total events
                      </Text>
                    </Flex>
                  </div>

                  {/* Event breakdown */}
                  <Flex gap="2" wrap="wrap">
                    {eventBreakdown.launches > 0 && (
                      <Badge size="1" variant="soft" color="orange">
                        <Flex align="center" gap="1">
                          <ArrowUp size={10} />
                          {eventBreakdown.launches} launch{eventBreakdown.launches !== 1 ? 'es' : ''}
                        </Flex>
                      </Badge>
                    )}
                    {eventBreakdown.landings > 0 && (
                      <Badge size="1" variant="soft" color="green">
                        <Flex align="center" gap="1">
                          <ArrowDown size={10} />
                          {eventBreakdown.landings} landing{eventBreakdown.landings !== 1 ? 's' : ''}
                        </Flex>
                      </Badge>
                    )}
                    {eventBreakdown.chargingStops > 0 && (
                      <Badge size="1" variant="soft" color="yellow">
                        <Flex align="center" gap="1">
                          <Zap size={10} />
                          {eventBreakdown.chargingStops} charging
                        </Flex>
                      </Badge>
                    )}
                    {eventBreakdown.travelSegments > 0 && (
                      <Badge size="1" variant="soft" color="gray">
                        {eventBreakdown.travelSegments} travel seg.
                      </Badge>
                    )}
                  </Flex>

                  {/* Customer IDs */}
                  {vehicle.customerIds.length > 0 && (
                    <Flex align="center" gap="1" style={{ marginTop: '6px' }}>
                      <MapPin size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        Customers: {vehicle.customerIds.join(', ')}
                      </Text>
                    </Flex>
                  )}
                </Box>
              </Flex>
            </Card>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export default VehiclesTab
