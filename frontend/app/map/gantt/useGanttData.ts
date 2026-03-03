'use client'

import { useMemo } from 'react'
import { TimelineEvent, TimelineResult } from '../timeline/timeline.types'
import { MissionSite } from '@/lib/types'
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
  droneCount: number,
  nodes?: MissionSite[]
): GanttData {
  return useMemo(() => {
    const { events, summary } = timelineResult

    // Build nodeId → address lookup map
    const addressMap = new Map<string, string>()
    if (nodes) {
      for (const node of nodes) {
        if (node.address) addressMap.set(node.id, node.address)
      }
    }

    const vehicles: GanttVehicle[] = []
    // Map droneNum → groupId for linking drones to their interacting truck/driver group
    const truckDroneInteractions = new Map<number, number>()

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
      // Include drone_return events in the truck row so the recovery is visible
      const truckEvents = events.filter(
        (e) => e.vehicle === 'truck' || e.type === 'drone_return'
      )

      const truckStops: GanttStop[] = truckEvents.map((event, index) => {
        // For drone launch/return events on the truck row, label which drone
        let label = event.label
        if (event.sortieNumber) {
          const droneNum = ((event.sortieNumber - 1) % droneCount) + 1
          if (event.type === 'drone_return') {
            label = `Drone ${droneNum} Return` + (event.orderName ? ` ← ${event.orderName}` : '')
          } else if (event.type === 'truck_drone_launch') {
            label = `Launch Drone ${droneNum}` + (event.orderName ? ` → ${event.orderName}` : '')
          } else if (event.type === 'truck_drone_recover') {
            label = `Recover Drone ${droneNum}` + (event.orderName ? ` ← ${event.orderName}` : '')
          }
        }
        return {
          id: event.id,
          type: mapEventTypeToStopType(event.type),
          time: event.cumulativeTime,
          duration: event.estimatedDuration,
          label,
          description: event.description,
          orderName: event.orderName,
          orderId: event.orderId,
          sortieNumber: event.sortieNumber,
          distance: event.distance,
          nodeId: event.nodeId,
          address: event.nodeId ? addressMap.get(event.nodeId) : undefined,
        }
      })

      // Compute cumulative distance for truck stops
      let truckCumDist = 0
      truckStops.forEach((stop) => {
        truckCumDist += stop.distance || 0
        stop.cumulativeDistance = truckCumDist
      })

      vehicles.push({
        id: 'truck-1',
        name: 'Truck 1',
        type: 'truck',
        color: GANTT_COLORS.truck,
        stops: truckStops,
        groupId: 1,
      })

      // Build Driver instruction row from the same truck events
      const driverStops: GanttStop[] = truckEvents.map((event) => {
        let label: string
        let description: string | undefined
        const droneNum = event.sortieNumber
          ? ((event.sortieNumber - 1) % droneCount) + 1
          : undefined

        switch (event.type) {
          case 'truck_depart':
            label = 'Depart from depot'
            description = 'Begin mission — pull out of depot and head to first stop'
            break
          case 'truck_travel':
            label = event.distance
              ? `Drive ${(event.distance / 1000).toFixed(1)} km to next stop`
              : 'Drive to next stop'
            description = event.estimatedDuration
              ? `Estimated drive time: ${Math.ceil(event.estimatedDuration / 60)} min`
              : undefined
            break
          case 'truck_delivery':
            label = `Deliver package${event.orderName ? ` to ${event.orderName}` : ''}`
            description = `Park and complete delivery${event.estimatedDuration ? ` — approx ${Math.ceil(event.estimatedDuration / 60)} min` : ''}`
            break
          case 'truck_drone_launch':
            label = `Stop and launch Drone ${droneNum || '?'}${event.orderName ? ` for ${event.orderName}` : ''}`
            description = 'Come to a stop, prepare drone payload, and launch'
            break
          case 'truck_drone_recover':
            label = `Wait for Drone ${droneNum || '?'} to return${event.orderName ? ` from ${event.orderName}` : ''}`
            description = 'Stay at location and recover drone upon arrival'
            break
          case 'drone_return':
            label = `Drone ${droneNum || '?'} returning — prepare for recovery`
            description = `Drone inbound${event.orderName ? ` from ${event.orderName}` : ''} — be ready to receive`
            break
          case 'truck_charging':
            label = 'Stop at charging station'
            description = event.estimatedDuration
              ? `Charge for approx ${Math.ceil(event.estimatedDuration / 60)} min`
              : 'Charge vehicle battery'
            break
          case 'truck_return':
            label = 'Return to depot'
            description = 'Mission complete — head back to depot'
            break
          default:
            label = event.label
            description = event.description
        }

        return {
          id: `driver-${event.id}`,
          type: mapEventTypeToStopType(event.type),
          time: event.cumulativeTime,
          duration: event.estimatedDuration,
          label,
          description,
          orderName: event.orderName,
          orderId: event.orderId,
          sortieNumber: event.sortieNumber,
          distance: event.distance,
          nodeId: event.nodeId,
          address: event.nodeId ? addressMap.get(event.nodeId) : undefined,
        }
      })

      // Compute cumulative distance for driver stops
      let driverCumDist = 0
      driverStops.forEach((stop) => {
        driverCumDist += stop.distance || 0
        stop.cumulativeDistance = driverCumDist
      })

      vehicles.push({
        id: 'driver-1',
        name: 'Driver 1',
        type: 'driver',
        color: GANTT_COLORS.driver,
        stops: driverStops,
        groupId: 1,
      })

      // Determine which drones this truck interacts with (via launch/recover events)
      const interactingDroneNums = new Set<number>()
      truckEvents.forEach((event) => {
        if (event.sortieNumber && (event.type === 'truck_drone_launch' || event.type === 'truck_drone_recover' || event.type === 'drone_return')) {
          interactingDroneNums.add(((event.sortieNumber - 1) % droneCount) + 1)
        }
      })
      // Store for use when building drone vehicles below
      interactingDroneNums.forEach((droneNum) => {
        truckDroneInteractions.set(droneNum, 1) // groupId 1 for truck 1
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
              orderName: event.orderName,
              orderId: event.orderId,
              sortieNumber: event.sortieNumber,
              distance: event.distance,
              nodeId: event.nodeId,
            })
          })
        })

        // Sort stops by time
        droneStops.sort((a, b) => a.time - b.time)

        // Compute cumulative distance for drone stops
        let droneCumDist = 0
        droneStops.forEach((stop) => {
          droneCumDist += stop.distance || 0
          stop.cumulativeDistance = droneCumDist
        })

        vehicles.push({
          id: `drone-${droneNum}`,
          name: `Drone ${droneNum}`,
          type: 'drone',
          color: getDroneColor(droneNum),
          stops: droneStops,
          sortieNumber: droneNum,
          groupId: truckDroneInteractions.get(droneNum),
        })
      }
    }

    // Build the "All" row by merging stops from every vehicle (excluding driver to avoid duplicates),
    // tagging each stop with its source vehicle name and color
    const allStops: GanttStop[] = vehicles
      .filter((v) => v.type !== 'driver')
      .flatMap((v) => v.stops.map((s) => ({ ...s, vehicleName: v.name, vehicleColor: v.color })))
      .sort((a, b) => a.time - b.time)

    // Offset overlapping stops so they sit side-by-side with the same
    // gap between icon borders (4px) as a lone marker has from the track edge.
    // Icon width = 24px, gap = 4px → center-to-center stride = 28px.
    // The first marker keeps the original position; extras fan out to the right.
    const ICON_SIZE = 24
    const BORDER_GAP = 4
    const STRIDE = ICON_SIZE + BORDER_GAP
    let i = 0
    while (i < allStops.length) {
      let j = i + 1
      while (j < allStops.length && allStops[j].time === allStops[i].time) j++
      const groupSize = j - i
      if (groupSize > 1) {
        for (let k = 0; k < groupSize; k++) {
          allStops[i + k].pixelOffset = k * STRIDE
        }
      }
      i = j
    }

    // Recompute cumulative distance across the merged list
    let allCumDist = 0
    allStops.forEach((stop) => {
      allCumDist += stop.distance || 0
      stop.cumulativeDistance = allCumDist
    })

    // Insert "All" row at the top
    vehicles.unshift({
      id: 'all',
      name: 'All',
      type: 'all',
      color: GANTT_COLORS.all,
      stops: allStops,
    })

    // Use serialized event timeline for axis scaling (events are positioned sequentially)
    const lastEvent = events.length > 0 ? events[events.length - 1] : null
    const axisDuration = lastEvent
      ? lastEvent.cumulativeTime + lastEvent.estimatedDuration
      : summary.totalDuration

    return {
      vehicles,
      totalDuration: axisDuration,
      wallClockDuration: summary.totalDuration,
      totalDistance: summary.totalDistance,
      startTime: new Date(),
    }
  }, [timelineResult, fleetMode, droneCount, nodes])
}

/**
 * Generate empty Gantt data for the fleet preview state (no route data)
 */
export function generateEmptyGanttData(
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number
): GanttData {
  const vehicles: GanttVehicle[] = []

  // Add "All" row at the top
  vehicles.push({
    id: 'all',
    name: 'All',
    type: 'all',
    color: GANTT_COLORS.all,
    stops: [],
  })

  // Add truck if in fleet
  if (fleetMode === 'truck-drone' || fleetMode === 'truck-only') {
    vehicles.push({
      id: 'truck-1',
      name: 'Truck 1',
      type: 'truck',
      color: GANTT_COLORS.truck,
      stops: [],
      groupId: 1,
    })
    vehicles.push({
      id: 'driver-1',
      name: 'Driver 1',
      type: 'driver',
      color: GANTT_COLORS.driver,
      stops: [],
      groupId: 1,
    })
  }

  // Add drones if in fleet
  if (fleetMode === 'truck-drone' || fleetMode === 'drones-only') {
    const hasTruck = fleetMode === 'truck-drone'
    for (let i = 1; i <= droneCount; i++) {
      vehicles.push({
        id: `drone-${i}`,
        name: `Drone ${i}`,
        type: 'drone',
        color: getDroneColor(i),
        stops: [],
        sortieNumber: i,
        groupId: hasTruck ? 1 : undefined, // All drones interact with truck 1 by default
      })
    }
  }

  return {
    vehicles,
    totalDuration: 3600, // Default 1 hour timeline
    startTime: new Date(),
  }
}
