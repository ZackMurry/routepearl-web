'use client'

import { useMemo } from 'react'
import { TimelineResult, TimelineEvent } from '../timeline/timeline.types'
import { GANTT_COLORS, getDroneColor } from '../gantt/gantt.types'

export interface VehicleEventBreakdown {
  launches: number
  landings: number
  deliveries: number
  chargingStops: number
  travelSegments: number
}

export interface VehicleDetail {
  id: string               // 'truck' or 'drone-1', 'drone-2', etc.
  type: 'truck' | 'drone'
  name: string             // "Truck" or "Drone 1", etc.
  color: string
  distance: number         // total meters
  duration: number         // total seconds
  totalEvents: number
  eventBreakdown: VehicleEventBreakdown
  sortiesHandled: number[] // sortie numbers this vehicle handled (drones only)
  customerIds: number[]    // addressIds served
}

export function useVehicleDetails(
  timelineResult: TimelineResult,
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number,
  hasRoute: boolean,
  customerNodes: { addressId?: number; id: string }[]
): VehicleDetail[] {
  return useMemo(() => {
    if (!hasRoute) return []

    const { events } = timelineResult
    const details: VehicleDetail[] = []

    // --- Truck ---
    if (fleetMode === 'truck-drone' || fleetMode === 'truck-only') {
      const truckEvents = events.filter((e) => e.vehicle === 'truck')

      const breakdown: VehicleEventBreakdown = {
        launches: truckEvents.filter((e) => e.type === 'truck_drone_launch').length,
        landings: truckEvents.filter((e) => e.type === 'truck_drone_recover').length,
        deliveries: truckEvents.filter((e) => e.type === 'truck_delivery').length,
        chargingStops: truckEvents.filter((e) => e.type === 'truck_charging').length,
        travelSegments: truckEvents.filter((e) => e.type === 'truck_travel').length,
      }

      const truckDistance = truckEvents.reduce((sum, e) => sum + (e.distance || 0), 0)
      const truckDuration = truckEvents.length > 0
        ? Math.max(...truckEvents.map((e) => e.cumulativeTime + e.estimatedDuration)) -
          Math.min(...truckEvents.map((e) => e.cumulativeTime))
        : 0

      const truckDeliveryEvents = truckEvents.filter((e) => e.type === 'truck_delivery')
      const customerIds: number[] = truckDeliveryEvents
        .map((e) => {
          const match = customerNodes.find((c) => c.id === e.id || e.customerName === String(c.addressId))
          return match?.addressId
        })
        .filter((id): id is number => id !== undefined)

      details.push({
        id: 'truck',
        type: 'truck',
        name: 'Truck',
        color: GANTT_COLORS.truck,
        distance: truckDistance,
        duration: truckDuration,
        totalEvents: truckEvents.length,
        eventBreakdown: breakdown,
        sortiesHandled: [],
        customerIds,
      })
    }

    // --- Drones ---
    if (fleetMode === 'truck-drone' || fleetMode === 'drones-only') {
      const droneEvents = events.filter((e) => e.vehicle === 'drone')

      // Group by sortie number
      const sortieMap = new Map<number, TimelineEvent[]>()
      droneEvents.forEach((e) => {
        const num = e.sortieNumber || 1
        if (!sortieMap.has(num)) sortieMap.set(num, [])
        sortieMap.get(num)!.push(e)
      })

      const sortieNumbers = Array.from(sortieMap.keys()).sort((a, b) => a - b)

      // Round-robin: sortie N goes to drone ((N-1) % droneCount)
      for (let droneIndex = 0; droneIndex < droneCount; droneIndex++) {
        const droneNum = droneIndex + 1
        const assignedSorties = sortieNumbers.filter(
          (sn) => ((sn - 1) % droneCount) === droneIndex
        )

        // Collect all events for this drone's assigned sorties
        const vehicleEvents: TimelineEvent[] = []
        assignedSorties.forEach((sn) => {
          const se = sortieMap.get(sn) || []
          vehicleEvents.push(...se)
        })
        vehicleEvents.sort((a, b) => a.cumulativeTime - b.cumulativeTime)

        const breakdown: VehicleEventBreakdown = {
          launches: vehicleEvents.filter((e) => e.type === 'drone_launch').length,
          landings: vehicleEvents.filter((e) => e.type === 'drone_return').length,
          deliveries: vehicleEvents.filter((e) => e.type === 'drone_delivery').length,
          chargingStops: 0, // Drones don't have charging stops in current model
          travelSegments: 0,
        }

        const droneDistance = vehicleEvents.reduce((sum, e) => sum + (e.distance || 0), 0)
        const droneDuration = vehicleEvents.length > 0
          ? Math.max(...vehicleEvents.map((e) => e.cumulativeTime + e.estimatedDuration)) -
            Math.min(...vehicleEvents.map((e) => e.cumulativeTime))
          : 0

        const deliveryEvents = vehicleEvents.filter((e) => e.type === 'drone_delivery')
        const customerIds: number[] = deliveryEvents
          .map((e) => {
            const match = customerNodes.find((c) => c.id === e.id || e.customerName === String(c.addressId))
            return match?.addressId
          })
          .filter((id): id is number => id !== undefined)

        details.push({
          id: `drone-${droneNum}`,
          type: 'drone',
          name: `Drone ${droneNum}`,
          color: getDroneColor(droneNum),
          distance: droneDistance,
          duration: droneDuration,
          totalEvents: vehicleEvents.length,
          eventBreakdown: breakdown,
          sortiesHandled: assignedSorties,
          customerIds,
        })
      }
    }

    return details
  }, [timelineResult, fleetMode, droneCount, hasRoute, customerNodes])
}
