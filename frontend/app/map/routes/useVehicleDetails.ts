'use client'

import { useMemo } from 'react'
import { GeneratedTruckRoute, TruckPowerType } from '@/lib/types'
import { DEFAULT_TIMELINE_CONFIG, TimelineEvent, TimelineResult } from '../timeline/timeline.types'
import { estimatePolylineDistance, getDroneColor, getTruckRouteColor } from '../routeData'

const matchesPoint = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001

export interface VehicleEventBreakdown {
  launches: number
  landings: number
  deliveries: number
  chargingStops: number
  travelSegments: number
}

export interface VehicleDetail {
  id: string
  type: 'truck' | 'drone'
  name: string
  color: string
  distance: number
  duration: number
  totalEvents: number
  eventBreakdown: VehicleEventBreakdown
  sortiesHandled: number[]
  orderIds: number[]
  // Anonymous fleet labeling (per design doc §2.5): trucks and their drones
  // carry a per-type 1-based index derived from the backend response order.
  truckType?: TruckPowerType
  typeIndex?: number
  // Optimizer didn't use this vehicle — fleet over-allocation indicator.
  // Trucks: no deliveries AND no drone sorties launched.
  // Drones: allocated to a truck but never flew a sortie.
  isUnused?: boolean
}

export interface VehicleDetailGroup {
  truck: VehicleDetail
  drones: VehicleDetail[]
}

export function useVehicleDetails(
  generatedTruckRoutes: GeneratedTruckRoute[],
  timelineResult: TimelineResult,
  droneCount: number,
  hasRoute: boolean,
  orderNodes: { orderId?: number; id: string; lat: number; lng: number }[],
): VehicleDetailGroup[] {
  return useMemo(() => {
    if (!hasRoute) {
      return []
    }

    if (generatedTruckRoutes.length === 0) {
      // Legacy single-truck path: synthesize one group from raw timeline events.
      const { events } = timelineResult
      const truckEvents = events.filter(event => event.vehicle === 'truck')
      if (truckEvents.length === 0) {
        // Drones-only or empty fleet — Vehicles tab degrades gracefully.
        return []
      }

      const truck = buildFallbackTruckDetail(truckEvents, orderNodes)

      const droneEvents = events.filter(event => event.vehicle === 'drone')
      const sortieMap = new Map<number, TimelineEvent[]>()
      droneEvents.forEach(event => {
        const sortieNumber = event.sortieNumber || 1
        if (!sortieMap.has(sortieNumber)) {
          sortieMap.set(sortieNumber, [])
        }
        sortieMap.get(sortieNumber)?.push(event)
      })

      const sortieNumbers = Array.from(sortieMap.keys()).sort((a, b) => a - b)
      const fallbackTruckColor = getTruckRouteColor('gas', 0)
      const drones: VehicleDetail[] = []
      for (let droneIndex = 0; droneIndex < droneCount; droneIndex++) {
        const droneNumber = droneIndex + 1
        const assignedSorties = sortieNumbers.filter(sortieNumber => ((sortieNumber - 1) % droneCount) === droneIndex)
        const vehicleEvents = assignedSorties.flatMap(sortieNumber => sortieMap.get(sortieNumber) || [])

        if (vehicleEvents.length === 0) {
          continue
        }

        drones.push({
          id: `truck-0-drone-${droneNumber}`,
          type: 'drone',
          name: `Drone ${droneNumber}`,
          color: getDroneColor(fallbackTruckColor, droneIndex),
          distance: vehicleEvents.reduce((sum, event) => sum + (event.distance || 0), 0),
          duration:
            Math.max(...vehicleEvents.map(event => event.cumulativeTime + event.estimatedDuration)) -
            Math.min(...vehicleEvents.map(event => event.cumulativeTime)),
          totalEvents: vehicleEvents.length,
          eventBreakdown: {
            launches: vehicleEvents.filter(event => event.type === 'drone_launch').length,
            landings: vehicleEvents.filter(event => event.type === 'drone_return').length,
            deliveries: vehicleEvents.filter(event => event.type === 'drone_delivery').length,
            chargingStops: 0,
            travelSegments: 0,
          },
          sortiesHandled: assignedSorties,
          orderIds: vehicleEvents
            .filter(event => event.type === 'drone_delivery')
            .map(event => {
              const match = orderNodes.find(node => node.id === event.nodeId || event.orderName === String(node.orderId))
              return match?.orderId
            })
            .filter((id): id is number => id !== undefined),
        })
      }

      return [{ truck, drones }]
    }

    const truckSpeedMs = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
    const droneSpeedMs = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600

    // Per-type 1-based display index (anonymous fleet model, design doc §2.5).
    let electricCount = 0
    let gasCount = 0

    const groups: VehicleDetailGroup[] = []

    generatedTruckRoutes.forEach(truckRoute => {
      const truckColor = getTruckRouteColor(truckRoute.truckType, truckRoute.truckId)
      const typeIndex = truckRoute.truckType === 'electric' ? ++electricCount : ++gasCount
      const typeLabel = truckRoute.truckType === 'electric' ? 'Electric Truck' : 'Gas Truck'
      const truckMatchPoints = truckRoute.truckStops.length > 0 ? truckRoute.truckStops : truckRoute.truckRoute
      const truckOrderIds = orderNodes
        .filter(order => truckMatchPoints.some(point => matchesPoint(point, order)))
        .map(order => order.orderId)
        .filter((id): id is number => id !== undefined)
      const truckDistance = estimatePolylineDistance(truckRoute.truckRoute)

      // A truck is "unused" if the optimizer assigned it nothing meaningful:
      // no customer deliveries AND no drone sorties launched. Surfaces fleet
      // over-allocation (e.g. user requested 100 trucks for 1 customer).
      const truckIsUnused = truckOrderIds.length === 0 && truckRoute.droneSorties.length === 0

      const truck: VehicleDetail = {
        id: truckRoute.routeId,
        type: 'truck',
        name: `${typeLabel} #${typeIndex}`,
        color: truckColor,
        distance: truckDistance,
        duration: truckDistance / truckSpeedMs,
        totalEvents: truckRoute.truckRoute.length + truckRoute.droneSorties.length * 2,
        eventBreakdown: {
          launches: truckRoute.droneSorties.length,
          landings: truckRoute.droneSorties.length,
          deliveries: truckOrderIds.length,
          chargingStops: truckMatchPoints.filter(point =>
            orderNodes.every(order => !matchesPoint(point, order)),
          ).length,
          travelSegments: Math.max(0, truckRoute.truckRoute.length - 1),
        },
        sortiesHandled: [],
        orderIds: truckOrderIds,
        truckType: truckRoute.truckType,
        typeIndex,
        isUnused: truckIsUnused,
      }

      const droneVehicleMap = new Map<number, typeof truckRoute.droneSorties>()
      truckRoute.droneSorties.forEach(sortie => {
        if (!droneVehicleMap.has(sortie.droneId)) {
          droneVehicleMap.set(sortie.droneId, [])
        }
        droneVehicleMap.get(sortie.droneId)?.push(sortie)
      })

      const drones: VehicleDetail[] = Array.from(droneVehicleMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([droneId, sorties], index) => {
          const orderIds = sorties
            .flatMap(sortie =>
              orderNodes
                .filter(order => matchesPoint(sortie.customer, order))
                .map(order => order.orderId)
                .filter((id): id is number => id !== undefined),
            )

          const distance = sorties.reduce((sum, sortie) => sum + estimatePolylineDistance(sortie.path), 0)
          const duration = sorties.reduce(
            (sum, sortie) =>
              sum +
              estimatePolylineDistance(sortie.path) / droneSpeedMs +
              DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds +
              DEFAULT_TIMELINE_CONFIG.droneUnloadTimeSeconds,
            0,
          )

          return {
            id: `${truckRoute.routeId}-drone-${droneId}`,
            type: 'drone',
            name: `${typeLabel} #${typeIndex} Drone ${droneId}`,
            color: getDroneColor(truckColor, index),
            distance,
            duration,
            totalEvents: sorties.length * 3,
            eventBreakdown: {
              launches: sorties.length,
              landings: sorties.length,
              deliveries: orderIds.length,
              chargingStops: 0,
              travelSegments: 0,
            },
            sortiesHandled: sorties.map(sortie => sortie.sortieIndex),
            orderIds,
          }
        })

      // Append placeholder cards for drones the user allocated to this truck
      // that the optimizer never launched. Backend reports the allocation count
      // via `dronesAllocated`; missing droneIds (1..allocated not seen in
      // sorties) get a visible "Not deployed" card so the user knows their
      // drone slot wasn't needed.
      const allocated = truckRoute.dronesAllocated ?? 0
      const usedIds = new Set(droneVehicleMap.keys())
      for (let droneId = 1; droneId <= allocated; droneId++) {
        if (usedIds.has(droneId)) continue
        drones.push({
          id: `${truckRoute.routeId}-drone-${droneId}-unused`,
          type: 'drone',
          name: `${typeLabel} #${typeIndex} Drone ${droneId}`,
          color: getDroneColor(truckColor, droneId - 1),
          distance: 0,
          duration: 0,
          totalEvents: 0,
          eventBreakdown: { launches: 0, landings: 0, deliveries: 0, chargingStops: 0, travelSegments: 0 },
          sortiesHandled: [],
          orderIds: [],
          isUnused: true,
        })
      }

      groups.push({ truck, drones })
    })

    return groups
  }, [generatedTruckRoutes, timelineResult, droneCount, hasRoute, orderNodes])
}

function buildFallbackTruckDetail(
  truckEvents: TimelineEvent[],
  orderNodes: { orderId?: number; id: string }[],
): VehicleDetail {
  const eventBreakdown: VehicleEventBreakdown = {
    launches: truckEvents.filter(event => event.type === 'truck_drone_launch').length,
    landings: truckEvents.filter(event => event.type === 'truck_drone_recover').length,
    deliveries: truckEvents.filter(event => event.type === 'truck_delivery').length,
    chargingStops: truckEvents.filter(event => event.type === 'truck_charging').length,
    travelSegments: truckEvents.filter(event => event.type === 'truck_travel').length,
  }

  return {
    id: 'truck-0',
    type: 'truck',
    name: 'Truck',
    color: getTruckRouteColor('gas', 0),
    distance: truckEvents.reduce((sum, event) => sum + (event.distance || 0), 0),
    duration:
      Math.max(...truckEvents.map(event => event.cumulativeTime + event.estimatedDuration)) -
      Math.min(...truckEvents.map(event => event.cumulativeTime)),
    totalEvents: truckEvents.length,
    eventBreakdown,
    sortiesHandled: [],
    orderIds: truckEvents
      .filter(event => event.type === 'truck_delivery')
      .map(event => {
        const match = orderNodes.find(node => node.id === event.nodeId || event.orderName === String(node.orderId))
        return match?.orderId
      })
      .filter((id): id is number => id !== undefined),
  }
}
