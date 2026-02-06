'use client'

import { useMemo } from 'react'
import { TimelineEvent, TimelineResult } from '../timeline/timeline.types'
import {
  GanttData,
  GanttVehicle,
  GanttStop,
  GanttStopType,
  GANTT_COLORS,
  getDroneColor,
} from './gantt.types'

/**
 * Hook to transform timeline events into Gantt chart data
 */
export function useGanttData(
  timelineResult: TimelineResult,
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number
): GanttData {
  return useMemo(() => {
    const { events, summary } = timelineResult

    const vehicles: GanttVehicle[] = []

    // Helper to map timeline event type to Gantt stop type
    const mapEventTypeToStopType = (eventType: string): GanttStopType => {
      switch (eventType) {
        case 'truck_depart':
        case 'truck_return':
          return 'depot'
        case 'truck_delivery':
        case 'drone_delivery':
          return 'delivery'
        case 'truck_drone_launch':
        case 'drone_launch':
          return 'launch'
        case 'truck_drone_recover':
        case 'drone_return':
          return 'return'
        case 'truck_charging':
          return 'charging'
        case 'truck_travel':
          return 'travel'
        default:
          return 'delivery'
      }
    }

    // Process truck events (if truck is in fleet)
    if (fleetMode === 'truck-drone' || fleetMode === 'truck-only') {
      const truckEvents = events.filter((e) => e.vehicle === 'truck')

      const truckStops: GanttStop[] = truckEvents.map((event, index) => ({
        id: event.id,
        type: mapEventTypeToStopType(event.type),
        time: event.cumulativeTime,
        duration: event.estimatedDuration,
        label: event.label,
        description: event.description,
        customerName: event.customerName,
        sortieNumber: event.sortieNumber,
      }))

      vehicles.push({
        id: 'truck-1',
        name: 'Truck',
        type: 'truck',
        color: GANTT_COLORS.truck,
        stops: truckStops,
      })
    }

    // Process drone events (if drones are in fleet)
    if (fleetMode === 'truck-drone' || fleetMode === 'drones-only') {
      const droneEvents = events.filter((e) => e.vehicle === 'drone')

      // Group drone events by sortie number
      const sortieMap = new Map<number, TimelineEvent[]>()

      droneEvents.forEach((event) => {
        const sortieNum = event.sortieNumber || 1
        if (!sortieMap.has(sortieNum)) {
          sortieMap.set(sortieNum, [])
        }
        sortieMap.get(sortieNum)!.push(event)
      })

      // Create a vehicle row for each drone (based on droneCount)
      // Distribute sorties across available drones
      const sortieNumbers = Array.from(sortieMap.keys()).sort((a, b) => a - b)

      for (let droneIndex = 0; droneIndex < droneCount; droneIndex++) {
        const droneNum = droneIndex + 1

        // Get sorties assigned to this drone
        // Simple round-robin assignment: sortie N goes to drone (N-1) % droneCount + 1
        const assignedSorties = sortieNumbers.filter(
          (sortieNum) => ((sortieNum - 1) % droneCount) === droneIndex
        )

        const droneStops: GanttStop[] = []

        assignedSorties.forEach((sortieNum) => {
          const sortieEvents = sortieMap.get(sortieNum) || []
          sortieEvents.forEach((event) => {
            droneStops.push({
              id: event.id,
              type: mapEventTypeToStopType(event.type),
              time: event.cumulativeTime,
              duration: event.estimatedDuration,
              label: event.label,
              description: event.description,
              customerName: event.customerName,
              sortieNumber: event.sortieNumber,
            })
          })
        })

        // Sort stops by time
        droneStops.sort((a, b) => a.time - b.time)

        vehicles.push({
          id: `drone-${droneNum}`,
          name: `Drone ${droneNum}`,
          type: 'drone',
          color: getDroneColor(droneNum),
          stops: droneStops,
          sortieNumber: droneNum,
        })
      }
    }

    return {
      vehicles,
      totalDuration: summary.totalDuration,
      startTime: new Date(),
    }
  }, [timelineResult, fleetMode, droneCount])
}

/**
 * Generate empty Gantt data for the fleet preview state (no route data)
 */
export function generateEmptyGanttData(
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number
): GanttData {
  const vehicles: GanttVehicle[] = []

  // Add truck if in fleet
  if (fleetMode === 'truck-drone' || fleetMode === 'truck-only') {
    vehicles.push({
      id: 'truck-1',
      name: 'Truck',
      type: 'truck',
      color: GANTT_COLORS.truck,
      stops: [],
    })
  }

  // Add drones if in fleet
  if (fleetMode === 'truck-drone' || fleetMode === 'drones-only') {
    for (let i = 1; i <= droneCount; i++) {
      vehicles.push({
        id: `drone-${i}`,
        name: `Drone ${i}`,
        type: 'drone',
        color: getDroneColor(i),
        stops: [],
        sortieNumber: i,
      })
    }
  }

  return {
    vehicles,
    totalDuration: 3600, // Default 1 hour timeline
    startTime: new Date(),
  }
}
