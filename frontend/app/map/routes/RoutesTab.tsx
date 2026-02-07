'use client'

import React, { FC } from 'react'
import { Box, Card, Flex, Text, Badge, ScrollArea } from '@radix-ui/themes'
import { Truck, Plane, Route, Clock, Package, MapPin, Zap } from 'lucide-react'
import { RouteDetail } from './useRouteDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  routes: RouteDetail[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const RoutesTab: FC<Props> = ({ routes, selectedRouteId, onSelectRoute }) => {
  if (routes.length === 0) {
    return (
      <Box className="text-center p-6 bg-gray-50 rounded" style={{ margin: '16px' }}>
        <Text size="2" color="gray">
          No routes generated. Generate a route to see route details.
        </Text>
      </Box>
    )
  }

  const handleClick = (routeId: string) => {
    onSelectRoute(selectedRouteId === routeId ? null : routeId)
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '8px',
          padding: '16px',
          paddingRight: '24px',
        }}
      >
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.id
          return (
            <Card
              key={route.id}
              className="p-0"
              style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                backgroundColor: isSelected ? '#eff6ff' : 'white',
                transition: 'all 0.15s ease',
                overflow: 'hidden',
              }}
              onClick={() => handleClick(route.id)}
            >
              <Flex>
                {/* Color accent bar */}
                <div
                  style={{
                    width: '4px',
                    minHeight: '100%',
                    backgroundColor: route.color,
                    flexShrink: 0,
                  }}
                />

                <Box style={{ padding: '10px 12px', flex: 1 }}>
                  {/* Header: name + type badge */}
                  <Flex justify="between" align="center" style={{ marginBottom: '8px' }}>
                    <Flex align="center" gap="2">
                      {route.type === 'truck' ? (
                        <Truck size={14} style={{ color: route.color }} />
                      ) : (
                        <Plane size={14} style={{ color: route.color }} />
                      )}
                      <Text size="2" weight="bold">
                        {route.name}
                      </Text>
                    </Flex>
                    <Badge
                      size="1"
                      color={route.type === 'truck' ? 'gray' : 'blue'}
                      variant="soft"
                    >
                      {route.type === 'truck' ? 'Truck' : 'Drone'}
                    </Badge>
                  </Flex>

                  {/* Stats grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 12px',
                    }}
                  >
                    <Flex align="center" gap="1">
                      <Route size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {formatDistance(route.distance)}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Clock size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {formatDuration(route.duration)}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Zap size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {route.events} events
                      </Text>
                    </Flex>
                    <Flex align="center" gap="1">
                      <Package size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        {route.deliveries} deliveries
                      </Text>
                    </Flex>
                  </div>

                  {/* Customer IDs */}
                  {route.customerIds.length > 0 && (
                    <Flex align="center" gap="1" style={{ marginTop: '6px' }}>
                      <MapPin size={12} className="text-gray-400" />
                      <Text size="1" color="gray">
                        Customers: {route.customerIds.join(', ')}
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

export default RoutesTab
