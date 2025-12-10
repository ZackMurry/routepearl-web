'use client'

import React, { useState, useMemo } from 'react'
import { Box, Text, Flex, ScrollArea } from '@radix-ui/themes'
import { Route, Plane, Truck, Info, AlertCircle } from 'lucide-react'
import { useFlightPlanner } from '../FlightPlannerContext'
import { useTimelineGenerator } from './useTimelineGenerator'
import { TimelineSummary as TimelineSummaryComponent } from './TimelineSummary'
import { TimelineViewToggle } from './TimelineViewToggle'
import { TimelineEventComponent } from './TimelineEvent'
import { TimelineViewFilter, TimelineDataSource } from './timeline.types'

/**
 * Data Source Indicator Component
 * Shows whether timeline data comes from backend or frontend estimation
 */
function DataSourceIndicator({ dataSource }: { dataSource: TimelineDataSource }) {
  if (dataSource === 'backend') {
    return (
      <Box className="bg-green-50 p-2 rounded border border-green-200 mb-4">
        <Flex align="center" gap="2">
          <Info size={14} className="text-green-600" />
          <Text size="1" className="text-green-700">
            Timing from route algorithm
          </Text>
        </Flex>
      </Box>
    )
  }

  return (
    <Box className="bg-amber-50 p-2 rounded border border-amber-200 mb-4">
      <Flex align="center" gap="2">
        <AlertCircle size={14} className="text-amber-600" />
        <Text size="1" className="text-amber-700">
          Estimated timing (backend data pending)
        </Text>
      </Flex>
    </Box>
  )
}

export function TimelineTab() {
  const { truckRoute, droneRoutes, missionConfig } = useFlightPlanner()
  const [viewFilter, setViewFilter] = useState<TimelineViewFilter>('all')

  const { events, summary, dataSource } = useTimelineGenerator(
    truckRoute,
    droneRoutes,
    missionConfig.nodes
  )

  const filteredEvents = useMemo(() => {
    if (viewFilter === 'all') return events
    if (viewFilter === 'drones') return events.filter((e) => e.vehicle === 'drone')
    return events.filter((e) => e.vehicle === 'truck')
  }, [events, viewFilter])

  const counts = useMemo(
    () => ({
      all: summary.totalEvents,
      drones: summary.droneEvents,
      trucks: summary.truckEvents,
    }),
    [summary]
  )

  // Empty state - no routes generated
  if (truckRoute.length === 0 && droneRoutes.length === 0) {
    return (
      <ScrollArea style={{ height: '100%' }}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Route size={48} className="text-gray-300 mb-4" />
          <Text size="3" weight="medium" color="gray" className="mb-2">
            No Route Generated
          </Text>
          <Text size="2" color="gray" align="center">
            Generate a route to see the mission timeline.
          </Text>
        </div>
      </ScrollArea>
    )
  }

  // Filtered empty state
  if (filteredEvents.length === 0 && events.length > 0) {
    const icon = viewFilter === 'drones' ? Plane : Truck
    const IconComponent = icon
    const vehicleName = viewFilter === 'drones' ? 'Drone' : 'Truck'

    return (
      <ScrollArea style={{ height: '100%' }}>
        <div className="space-y-4 pr-2">
          <DataSourceIndicator dataSource={dataSource} />
          <TimelineSummaryComponent summary={summary} viewFilter={viewFilter} />
          <TimelineViewToggle value={viewFilter} onChange={setViewFilter} counts={counts} />

          <div className="flex flex-col items-center justify-center py-8 px-4">
            <IconComponent size={40} className="text-gray-300 mb-3" />
            <Text size="2" weight="medium" color="gray" className="mb-1">
              No {vehicleName} Events
            </Text>
            <Text size="1" color="gray" align="center">
              This route has no {vehicleName.toLowerCase()} operations.
            </Text>
            <button
              onClick={() => setViewFilter('all')}
              className="mt-3 text-sm text-blue-500 hover:text-blue-600 underline"
            >
              View All Events
            </button>
          </div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div className="space-y-4 pr-2">
        <DataSourceIndicator dataSource={dataSource} />
        <TimelineSummaryComponent summary={summary} viewFilter={viewFilter} />
        <TimelineViewToggle value={viewFilter} onChange={setViewFilter} counts={counts} />

        {/* Timeline events */}
        <Box>
          <Flex align="center" gap="2" className="mb-3">
            <Route size={16} className="text-gray-500" />
            <Text size="2" weight="medium" color="gray">
              {viewFilter === 'all'
                ? 'All Events'
                : viewFilter === 'drones'
                  ? 'Drone Events'
                  : 'Truck Events'}
            </Text>
          </Flex>

          <div className="pl-1">
            {filteredEvents.map((event, index) => (
              <TimelineEventComponent
                key={event.id}
                event={event}
                isFirst={index === 0}
                isLast={index === filteredEvents.length - 1}
                showConnector={index < filteredEvents.length - 1}
              />
            ))}
          </div>
        </Box>
      </div>
    </ScrollArea>
  )
}
