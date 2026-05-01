'use client'

import React, { FC, useEffect, useState } from 'react'
import { Box, Card, Flex, Text, Badge, ScrollArea, IconButton } from '@radix-ui/themes'
import { Truck, Drone, Route, Clock, Package, MapPin, Zap, Fuel, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react'
import { VehicleDetail, VehicleDetailGroup } from './useVehicleDetails'
import { formatDistance, formatDuration } from '../timeline/timeline.types'

interface Props {
  groups: VehicleDetailGroup[]
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
}

const VehicleCard: FC<{
  vehicle: VehicleDetail
  isSelected: boolean
  onClick: () => void
  isSubItem?: boolean
}> = ({ vehicle, isSelected, onClick, isSubItem = false }) => {
  const { eventBreakdown } = vehicle
  const isUnused = vehicle.isUnused === true
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
            backgroundColor: vehicle.color,
            flexShrink: 0,
          }}
        />
        <Box style={{ padding: '10px 12px', flex: 1 }}>
          <Flex justify='between' align='center' style={{ marginBottom: '8px' }}>
            <Flex align='center' gap='2'>
              {vehicle.type === 'truck' ? (
                <Truck size={14} style={{ color: vehicle.color }} />
              ) : (
                <Drone size={14} style={{ color: vehicle.color }} />
              )}
              <Text size='2' weight='bold'>
                {vehicle.name}
              </Text>
            </Flex>
            <Flex gap='1'>
              {isUnused && (
                <Badge size='1' color='gray' variant='soft' title='Allocated but not used by the optimizer'>
                  Not deployed
                </Badge>
              )}
              {vehicle.type === 'truck' && vehicle.truckType === 'electric' ? (
                <Badge size='1' color='green' variant='soft'>
                  <Flex align='center' gap='1'>
                    <Zap size={10} /> Electric
                  </Flex>
                </Badge>
              ) : vehicle.type === 'truck' && vehicle.truckType === 'gas' ? (
                <Badge size='1' color='amber' variant='soft'>
                  <Flex align='center' gap='1'>
                    <Fuel size={10} /> Gas
                  </Flex>
                </Badge>
              ) : (
                <Badge size='1' color={vehicle.type === 'truck' ? 'gray' : 'blue'} variant='soft'>
                  {vehicle.type === 'truck' ? 'Truck' : 'Drone'}
                </Badge>
              )}
              {vehicle.sortiesHandled.length > 0 && (
                <Badge size='1' color='purple' variant='soft'>
                  {vehicle.sortiesHandled.length} sortie{vehicle.sortiesHandled.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </Flex>
          </Flex>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 12px',
              marginBottom: '6px',
            }}
          >
            <Flex align='center' gap='1'>
              <Route size={12} className='text-gray-400' />
              <Text size='1' color='gray'>
                {formatDistance(vehicle.distance)}
              </Text>
            </Flex>
            <Flex align='center' gap='1'>
              <Clock size={12} className='text-gray-400' />
              <Text size='1' color='gray'>
                {formatDuration(vehicle.duration)}
              </Text>
            </Flex>
            <Flex align='center' gap='1'>
              <Package size={12} className='text-gray-400' />
              <Text size='1' color='gray'>
                {eventBreakdown.deliveries} deliveries
              </Text>
            </Flex>
            <Flex align='center' gap='1'>
              <Text size='1' color='gray'>
                {vehicle.totalEvents} total events
              </Text>
            </Flex>
          </div>
          <Flex gap='2' wrap='wrap'>
            {eventBreakdown.launches > 0 && (
              <Badge size='1' variant='soft' color='orange'>
                <Flex align='center' gap='1'>
                  <ArrowUp size={10} />
                  {eventBreakdown.launches} launch{eventBreakdown.launches !== 1 ? 'es' : ''}
                </Flex>
              </Badge>
            )}
            {eventBreakdown.landings > 0 && (
              <Badge size='1' variant='soft' color='green'>
                <Flex align='center' gap='1'>
                  <ArrowDown size={10} />
                  {eventBreakdown.landings} landing{eventBreakdown.landings !== 1 ? 's' : ''}
                </Flex>
              </Badge>
            )}
            {eventBreakdown.chargingStops > 0 && vehicle.truckType !== 'gas' && (
              <Badge size='1' variant='soft' color='yellow'>
                <Flex align='center' gap='1'>
                  <Zap size={10} />
                  {eventBreakdown.chargingStops} charging
                </Flex>
              </Badge>
            )}
            {eventBreakdown.travelSegments > 0 && (
              <Badge size='1' variant='soft' color='gray'>
                {eventBreakdown.travelSegments} travel seg.
              </Badge>
            )}
          </Flex>
          {vehicle.orderIds.length > 0 && (
            <Flex align='center' gap='1' style={{ marginTop: '6px' }}>
              <MapPin size={12} className='text-gray-400' />
              <Text size='1' color='gray'>
                Orders: {vehicle.orderIds.join(', ')}
              </Text>
            </Flex>
          )}
        </Box>
      </Flex>
    </Card>
  )
}

const VehiclesTab: FC<Props> = ({ groups, selectedRouteId, onSelectRoute }) => {
  // Default-collapsed when there are 3+ truck groups; expanded otherwise.
  // Same convention as RoutesTab so the two tabs feel consistent.
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
          No vehicles configured. Generate a route to see vehicle details.
        </Text>
      </Box>
    )
  }

  const handleClick = (vehicleId: string) => {
    onSelectRoute(selectedRouteId === vehicleId ? null : vehicleId)
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
                  title={isCollapsed ? 'Expand drones' : 'Collapse drones'}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </IconButton>
                <div style={{ flex: 1 }}>
                  <VehicleCard
                    vehicle={group.truck}
                    isSelected={selectedRouteId === group.truck.id}
                    onClick={() => handleClick(group.truck.id)}
                  />
                </div>
              </Flex>
              {!isCollapsed && group.drones.length > 0 && (
                <Flex direction='column' gap='2'>
                  {group.drones.map(drone => (
                    <VehicleCard
                      key={drone.id}
                      vehicle={drone}
                      isSelected={selectedRouteId === drone.id}
                      onClick={() => handleClick(drone.id)}
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

export default VehiclesTab
