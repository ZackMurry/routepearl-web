'use client'

import { useMemo } from 'react'
import { TimelineResult } from '../timeline/timeline.types'
import { GANTT_COLORS, getDroneColor } from '../gantt/gantt.types'

export interface RouteDetail {
  id: string               // 'truck' or 'drone-1', 'drone-2', etc.
  type: 'truck' | 'drone'
  name: string             // "Truck Route" or "Sortie 1", etc.
  color: string            // Route color for the card accent
  distance: number         // meters
  duration: number         // seconds
  events: number           // event count for this route
  deliveries: number       // delivery count
  stops: number            // total stop count
  customerIds: number[]    // addressIds of customers served by this route
}

export function useRouteDetails(
  timelineResult: TimelineResult,
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number,
  hasRoute: boolean,
  customerNodes: { addressId?: number; id: string }[]
): RouteDetail[] {
  return useMemo(() => {
    if (!hasRoute) return []

    const { events } = timelineResult
    const details: RouteDetail[] = []

    // Truck route
    if (fleetMode === 'truck-drone' || fleetMode === 'truck-only') {
      const truckEvents = events.filter((e) => e.vehicle === 'truck')
      const truckDeliveries = truckEvents.filter(
        (e) => e.type === 'truck_delivery'
      )
      const truckDistance = truckEvents.reduce((sum, e) => sum + (e.distance || 0), 0)
      const truckDuration = truckEvents.length > 0
        ? Math.max(...truckEvents.map((e) => e.cumulativeTime + e.estimatedDuration)) - Math.min(...truckEvents.map((e) => e.cumulativeTime))
        : 0

      // Match delivery events to customer addressIds
      const truckCustomerIds: number[] = truckDeliveries
        .map((e) => {
          const match = customerNodes.find((c) => c.id === e.id || e.customerName === String(c.addressId))
          return match?.addressId
        })
        .filter((id): id is number => id !== undefined)

      details.push({
        id: 'truck',
        type: 'truck',
        name: 'Truck Route',
        color: GANTT_COLORS.truck,
        distance: truckDistance,
        duration: truckDuration,
        events: truckEvents.length,
        deliveries: truckDeliveries.length,
        stops: truckEvents.filter((e) =>
          ['truck_delivery', 'truck_drone_launch', 'truck_drone_recover', 'truck_charging'].includes(e.type)
        ).length,
        customerIds: truckCustomerIds,
      })
    }

    // Drone routes (one per sortie)
    if (fleetMode === 'truck-drone' || fleetMode === 'drones-only') {
      const droneEvents = events.filter((e) => e.vehicle === 'drone')

      // Group by sortie number
      const sortieMap = new Map<number, typeof droneEvents>()
      droneEvents.forEach((e) => {
        const num = e.sortieNumber || 1
        if (!sortieMap.has(num)) sortieMap.set(num, [])
        sortieMap.get(num)!.push(e)
      })

      const sortieNumbers = Array.from(sortieMap.keys()).sort((a, b) => a - b)

      sortieNumbers.forEach((sortieNum) => {
        const sortieEvents = sortieMap.get(sortieNum) || []
        const sortieDeliveries = sortieEvents.filter((e) => e.type === 'drone_delivery')
        const sortieDistance = sortieEvents.reduce((sum, e) => sum + (e.distance || 0), 0)
        const sortieDuration = sortieEvents.length > 0
          ? Math.max(...sortieEvents.map((e) => e.cumulativeTime + e.estimatedDuration)) - Math.min(...sortieEvents.map((e) => e.cumulativeTime))
          : 0

        const sortieCustomerIds: number[] = sortieDeliveries
          .map((e) => {
            const match = customerNodes.find((c) => c.id === e.id || e.customerName === String(c.addressId))
            return match?.addressId
          })
          .filter((id): id is number => id !== undefined)

        details.push({
          id: `drone-${sortieNum}`,
          type: 'drone',
          name: `Sortie ${sortieNum}`,
          color: getDroneColor(sortieNum),
          distance: sortieDistance,
          duration: sortieDuration,
          events: sortieEvents.length,
          deliveries: sortieDeliveries.length,
          stops: sortieEvents.filter((e) =>
            ['drone_delivery', 'drone_launch', 'drone_return'].includes(e.type)
          ).length,
          customerIds: sortieCustomerIds,
        })
      })
    }

    return details
  }, [timelineResult, fleetMode, droneCount, hasRoute, customerNodes])
}
