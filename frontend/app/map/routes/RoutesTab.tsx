'use client'

import React, { FC, useEffect, useState } from 'react'
import { Box, Card, Flex, Text, Badge, ScrollArea, IconButton } from '@radix-ui/themes'
import { Truck, Drone, Route, Clock, Package, MapPin, Zap, Fuel, ChevronDown, ChevronRight } from 'lucide-react'
import { RouteDetail, RouteDetailGroup } from './useRouteDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  groups: RouteDetailGroup[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const RouteCard: FC<{
  route: RouteDetail
  isSelected: boolean
  onClick: () => void
  isSubItem?: boolean
}> = ({ route, isSelected, onClick, isSubItem = false }) => {
  const isUnused = route.isUnused === true
  return (
  <Card
    className='p-0'
    style={{
      cursor: 'pointer',
      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
      backgroundColor: isSelected ? '#eff6ff' : 'white',
      transition: 'all 0.15s ease',
      overflow: 'hidden',
      marginLeft: isSubItem ? 16 : 0,
      opacity: isUnused ? 0.55 : 1,
    }}
    title={isUnused ? 'The optimizer did not need this vehicle for the generated route.' : undefined}
    onClick={onClick}
  >
    <Flex>
      <div
        style={{
          width: '4px',
          minHeight: '100%',
          backgroundColor: route.color,
          flexShrink: 0,
        }}
      />
      <Box style={{ padding: '10px 12px', flex: 1 }}>
        <Flex justify='between' align='center' style={{ marginBottom: '8px' }}>
          <Flex align='center' gap='2'>
            {route.type === 'truck' ? (
              <Truck size={14} style={{ color: route.color }} />
            ) : (
              <Drone size={14} style={{ color: route.color }} />
            )}
            <Text size='2' weight='bold'>
              {route.name}
            </Text>
          </Flex>
          <Flex gap='1' wrap='wrap'>
            {isUnused && (
              <Badge size='1' color='gray' variant='soft' title='Allocated but not used by the optimizer'>
                Not deployed
              </Badge>
            )}
            {route.type === 'truck' && route.truckType === 'electric' ? (
              <Badge size='1' color='green' variant='soft'>
                <Flex align='center' gap='1'>
                  <Zap size={10} /> Electric
                </Flex>
              </Badge>
            ) : route.type === 'truck' && route.truckType === 'gas' ? (
              <Badge size='1' color='amber' variant='soft'>
                <Flex align='center' gap='1'>
                  <Fuel size={10} /> Gas
                </Flex>
              </Badge>
            ) : (
              <Badge size='1' color={route.type === 'truck' ? 'gray' : 'blue'} variant='soft'>
                {route.type === 'truck' ? 'Truck' : 'Drone'}
              </Badge>
            )}
          </Flex>
        </Flex>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          <Flex align='center' gap='1'>
            <Route size={12} className='text-gray-400' />
            <Text size='1' color='gray'>
              {formatDistance(route.distance)}
            </Text>
          </Flex>
          <Flex align='center' gap='1'>
            <Clock size={12} className='text-gray-400' />
            <Text size='1' color='gray'>
              {formatDuration(route.duration)}
            </Text>
          </Flex>
          <Flex align='center' gap='1'>
            <Zap size={12} className='text-gray-400' />
            <Text size='1' color='gray'>
              {route.events} events
            </Text>
          </Flex>
          <Flex align='center' gap='1'>
            <Package size={12} className='text-gray-400' />
            <Text size='1' color='gray'>
              {route.deliveries} deliveries
            </Text>
          </Flex>
        </div>
        {route.orderIds.length > 0 && (
          <Flex align='center' gap='1' style={{ marginTop: '6px' }}>
            <MapPin size={12} className='text-gray-400' />
            <Text size='1' color='gray'>
              Orders: {route.orderIds.join(', ')}
            </Text>
          </Flex>
        )}
      </Box>
    </Flex>
  </Card>
  )
}

const RoutesTab: FC<Props> = ({ groups, selectedRouteId, onSelectRoute }) => {
  // Default-collapsed when there are 3+ truck groups; expanded otherwise.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (groups.length >= 3) {
      setCollapsed(new Set(groups.map(g => g.truck.id)))
    } else {
      setCollapsed(new Set())
    }
  }, [groups.length, groups.map(g => g.truck.id).join(',')])

  if (groups.length === 0) {
    return (
      <Box className='text-center p-6 bg-gray-50 rounded' style={{ margin: '16px' }}>
        <Text size='2' color='gray'>
          No routes generated. Generate a route to see route details.
        </Text>
      </Box>
    )
  }

  const handleClick = (routeId: string) => {
    onSelectRoute(selectedRouteId === routeId ? null : routeId)
  }

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: '16px', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => {
          const isCollapsed = collapsed.has(group.truck.id)
          return (
            <div key={group.truck.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Flex align='center' gap='2'>
                <IconButton
                  size='1'
                  variant='ghost'
                  color='gray'
                  onClick={() => toggleCollapse(group.truck.id)}
                  style={{ cursor: 'pointer' }}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </IconButton>
                <div style={{ flex: 1 }}>
                  <RouteCard
                    route={group.truck}
                    isSelected={selectedRouteId === group.truck.id}
                    onClick={() => handleClick(group.truck.id)}
                  />
                </div>
              </Flex>
              {!isCollapsed && group.sorties.length > 0 && (
                <Flex direction='column' gap='2'>
                  {group.sorties.map(sortie => (
                    <RouteCard
                      key={sortie.id}
                      route={sortie}
                      isSelected={selectedRouteId === sortie.id}
                      onClick={() => handleClick(sortie.id)}
                      isSubItem
                    />
                  ))}
                </Flex>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export default RoutesTab
