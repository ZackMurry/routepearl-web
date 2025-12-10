'use client'

import React from 'react'
import { Box, Card, Text, Flex, Progress } from '@radix-ui/themes'
import { Clock, Route, Package, Plane, Truck } from 'lucide-react'
import { TimelineSummary as TimelineSummaryType, TimelineViewFilter, formatDuration, formatDistance } from './timeline.types'

interface TimelineSummaryProps {
  summary: TimelineSummaryType
  viewFilter: TimelineViewFilter
}

export function TimelineSummary({ summary, viewFilter }: TimelineSummaryProps) {
  const progressPercent =
    summary.totalEvents > 0
      ? (summary.completedEvents / summary.totalEvents) * 100
      : 0

  // Adjust displayed stats based on filter
  const displayedEvents =
    viewFilter === 'all'
      ? summary.totalEvents
      : viewFilter === 'drones'
        ? summary.droneEvents
        : summary.truckEvents

  const displayedDistance =
    viewFilter === 'all'
      ? summary.totalDistance
      : viewFilter === 'drones'
        ? summary.droneDistance
        : summary.truckDistance

  const displayedDeliveries =
    viewFilter === 'all'
      ? summary.deliveryCount
      : viewFilter === 'drones'
        ? summary.droneDeliveries
        : summary.truckDeliveries

  return (
    <Box>
      <Flex align="center" gap="2" className="mb-3">
        <Clock size={18} className="text-blue-500" />
        <Text size="3" weight="bold">
          Mission Timeline
        </Text>
      </Flex>

      <Card className="p-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Duration */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Flex align="center" gap="2" className="mb-1">
              <Clock size={14} className="text-gray-500" />
              <Text size="1" color="gray">
                Duration
              </Text>
            </Flex>
            <Text size="3" weight="bold">
              {formatDuration(summary.totalDuration)}
            </Text>
            <Text size="1" color="gray">
              estimated
            </Text>
          </div>

          {/* Distance */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Flex align="center" gap="2" className="mb-1">
              <Route size={14} className="text-gray-500" />
              <Text size="1" color="gray">
                Distance
              </Text>
            </Flex>
            <Text size="3" weight="bold">
              {formatDistance(displayedDistance)}
            </Text>
            <Text size="1" color="gray">
              total
            </Text>
          </div>

          {/* Events */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Flex align="center" gap="2" className="mb-1">
              <Clock size={14} className="text-gray-500" />
              <Text size="1" color="gray">
                Events
              </Text>
            </Flex>
            <Text size="3" weight="bold">
              {displayedEvents}
            </Text>
            <Text size="1" color="gray">
              {summary.completedEvents} completed
            </Text>
          </div>

          {/* Deliveries */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Flex align="center" gap="2" className="mb-1">
              <Package size={14} className="text-gray-500" />
              <Text size="1" color="gray">
                Deliveries
              </Text>
            </Flex>
            <Text size="3" weight="bold">
              {displayedDeliveries}
            </Text>
            {viewFilter === 'all' && (
              <Flex gap="2">
                <Flex align="center" gap="1">
                  <Plane size={10} className="text-blue-500" />
                  <Text size="1" color="gray">
                    {summary.droneDeliveries}
                  </Text>
                </Flex>
                <Flex align="center" gap="1">
                  <Truck size={10} className="text-purple-500" />
                  <Text size="1" color="gray">
                    {summary.truckDeliveries}
                  </Text>
                </Flex>
              </Flex>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <Flex justify="between" className="mb-1">
            <Text size="1" color="gray">
              Mission Progress
            </Text>
            <Text size="1" weight="medium">
              {Math.round(progressPercent)}%
            </Text>
          </Flex>
          <Progress value={progressPercent} size="2" color="blue" />
        </div>
      </Card>
    </Box>
  )
}
