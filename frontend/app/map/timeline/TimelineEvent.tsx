'use client'

import React from 'react'
import { Box, Text, Badge, Flex } from '@radix-ui/themes'
import {
  Plane,
  Truck,
  Package,
  MapPin,
  Home,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle,
  Navigation,
  Battery,
  Send,
  Download,
} from 'lucide-react'
import { TimelineEvent as TimelineEventType, formatDuration, formatDistance } from './timeline.types'

interface TimelineEventProps {
  event: TimelineEventType
  isFirst?: boolean
  isLast?: boolean
  showConnector?: boolean
}

// Get icon for event type
function getEventIcon(event: TimelineEventType) {
  const iconSize = 16
  const droneColor = 'text-blue-500'
  const truckColor = 'text-purple-500'

  switch (event.type) {
    // Drone events
    case 'drone_launch':
      return (
        <div className="relative">
          <Plane size={iconSize} className={droneColor} />
          <ArrowUp size={10} className={`absolute -top-1 -right-1 ${droneColor}`} />
        </div>
      )
    case 'drone_delivery':
      return (
        <div className="relative">
          <Package size={iconSize} className={droneColor} />
          <CheckCircle size={10} className="absolute -bottom-1 -right-1 text-green-500" />
        </div>
      )
    case 'drone_return':
      return (
        <div className="relative">
          <Plane size={iconSize} className={droneColor} />
          <ArrowDown size={10} className={`absolute -bottom-1 -right-1 ${droneColor}`} />
        </div>
      )

    // Truck events
    case 'truck_depart':
      return (
        <div className="relative">
          <Truck size={iconSize} className={truckColor} />
          <Play size={10} className={`absolute -bottom-1 -right-1 ${truckColor}`} />
        </div>
      )
    case 'truck_travel':
      return <Navigation size={iconSize} className={truckColor} />
    case 'truck_delivery':
      return (
        <div className="relative">
          <Package size={iconSize} className={truckColor} />
          <CheckCircle size={10} className="absolute -bottom-1 -right-1 text-green-500" />
        </div>
      )
    case 'truck_drone_launch':
      return (
        <div className="relative">
          <Truck size={iconSize} className={truckColor} />
          <Send size={10} className="absolute -top-1 -right-1 text-blue-500" />
        </div>
      )
    case 'truck_drone_recover':
      return (
        <div className="relative">
          <Truck size={iconSize} className={truckColor} />
          <Download size={10} className="absolute -bottom-1 -right-1 text-blue-500" />
        </div>
      )
    case 'truck_charging':
      return (
        <div className="relative">
          <Truck size={iconSize} className={truckColor} />
          <Battery size={10} className="absolute -bottom-1 -right-1 text-green-500" />
        </div>
      )
    case 'truck_return':
      return (
        <div className="relative">
          <Truck size={iconSize} className={truckColor} />
          <Home size={10} className={`absolute -bottom-1 -right-1 ${truckColor}`} />
        </div>
      )
    default:
      return <MapPin size={iconSize} className="text-gray-500" />
  }
}

// Get status badge color
function getStatusBadgeColor(status: TimelineEventType['status']): 'gray' | 'blue' | 'green' {
  switch (status) {
    case 'pending':
      return 'gray'
    case 'in_progress':
      return 'blue'
    case 'completed':
      return 'green'
    default:
      return 'gray'
  }
}

// Get status text
function getStatusText(status: TimelineEventType['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    default:
      return 'Unknown'
  }
}

export function TimelineEventComponent({
  event,
  isFirst = false,
  isLast = false,
  showConnector = true,
}: TimelineEventProps) {
  const isDrone = event.vehicle === 'drone'
  const bgColor = isDrone ? 'bg-blue-50' : 'bg-purple-50'
  const borderColor = isDrone ? 'border-blue-200' : 'border-purple-200'
  const nodeColor = isDrone ? 'bg-blue-500' : 'bg-purple-500'
  const lineStyle = isDrone ? 'border-dashed' : 'border-solid'

  return (
    <div className="flex">
      {/* Timeline spine */}
      <div className="flex flex-col items-center mr-3">
        {/* Top connector */}
        {!isFirst && (
          <div
            className={`w-0 h-3 border-l-2 ${borderColor} ${lineStyle}`}
          />
        )}

        {/* Node marker */}
        <div
          className={`w-3 h-3 rounded-full ${nodeColor} ${
            event.status === 'in_progress' ? 'animate-pulse ring-2 ring-blue-300' : ''
          } ${event.status === 'completed' ? 'ring-2 ring-green-300' : ''}`}
        />

        {/* Bottom connector */}
        {!isLast && showConnector && (
          <div
            className={`w-0 flex-1 border-l-2 ${borderColor} ${lineStyle}`}
            style={{ minHeight: '40px' }}
          />
        )}
      </div>

      {/* Event card */}
      <div
        className={`flex-1 mb-3 p-3 rounded-lg border ${bgColor} ${borderColor} ${
          event.status === 'in_progress' ? 'ring-2 ring-blue-400' : ''
        }`}
      >
        {/* Header row */}
        <Flex justify="between" align="center" className="mb-1">
          <Flex align="center" gap="2">
            {getEventIcon(event)}
            <Text size="2" weight="medium">
              {event.label}
            </Text>
          </Flex>
          <Badge color={getStatusBadgeColor(event.status)} size="1">
            {getStatusText(event.status)}
          </Badge>
        </Flex>

        {/* Order name or description */}
        {(event.orderName || event.description) && (
          <Text size="1" color="gray" className="block mb-2">
            {event.orderName ? `Order: ${event.orderName}` : event.description}
          </Text>
        )}

        {/* Time and distance info */}
        <Flex gap="3" className="mt-2">
          <Text size="1" color="gray">
            Duration: <span className="font-medium text-gray-700">{formatDuration(event.estimatedDuration)}</span>
          </Text>
          <Text size="1" color="gray">
            Cumulative: <span className="font-medium text-gray-700">{formatDuration(event.cumulativeTime)}</span>
          </Text>
          {event.distance !== undefined && event.distance > 0 && (
            <Text size="1" color="gray">
              Distance: <span className="font-medium text-gray-700">{formatDistance(event.distance)}</span>
            </Text>
          )}
        </Flex>
      </div>
    </div>
  )
}
