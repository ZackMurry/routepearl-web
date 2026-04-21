'use client'

import { useMemo } from 'react'
import { GeneratedTruckRoute } from '@/lib/types'
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
}

export function useVehicleDetails(
  generatedTruckRoutes: GeneratedTruckRoute[],
  timelineResult: TimelineResult,
  droneCount: number,
  hasRoute: boolean,
  orderNodes: { orderId?: number; id: string; lat: number; lng: number }[],
): VehicleDetail[] {
  return useMemo(() => {
    if (!hasRoute) {
      return []
    }

    if (generatedTruckRoutes.length === 0) {
      const { events } = timelineResult
      const details: VehicleDetail[] = []
      const truckEvents = events.filter(event => event.vehicle === 'truck')

      if (truckEvents.length > 0) {
        details.push(buildFallbackTruckDetail(truckEvents, orderNodes))
      }

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

      for (let droneIndex = 0; droneIndex < droneCount; droneIndex++) {
        const droneNumber = droneIndex + 1
        const assignedSorties = sortieNumbers.filter(sortieNumber => ((sortieNumber - 1) % droneCount) === droneIndex)
        const vehicleEvents = assignedSorties.flatMap(sortieNumber => sortieMap.get(sortieNumber) || [])

        if (vehicleEvents.length === 0) {
          continue
        }

        details.push({
          id: `truck-0-drone-${droneNumber}`,
          type: 'drone',
          name: `Drone ${droneNumber}`,
          color: getDroneColor(droneIndex),
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

      return details
    }

    const truckSpeedMs = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
    const droneSpeedMs = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600

    const details: VehicleDetail[] = []

    generatedTruckRoutes.forEach(truckRoute => {
      const truckMatchPoints = truckRoute.truckStops.length > 0 ? truckRoute.truckStops : truckRoute.truckRoute
      const truckOrderIds = orderNodes
        .filter(order => truckMatchPoints.some(point => matchesPoint(point, order)))
        .map(order => order.orderId)
        .filter((id): id is number => id !== undefined)
      const truckDistance = estimatePolylineDistance(truckRoute.truckRoute)

      details.push({
        id: truckRoute.routeId,
        type: 'truck',
        name: `Truck ${truckRoute.truckId + 1}${truckRoute.truckType === 'electric' ? ' (Electric)' : ' (Gas)'}`,
        color: getTruckRouteColor(truckRoute.truckType, truckRoute.truckId),
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
      })

      const droneVehicleMap = new Map<number, typeof truckRoute.droneSorties>()
      truckRoute.droneSorties.forEach(sortie => {
        if (!droneVehicleMap.has(sortie.droneId)) {
          droneVehicleMap.set(sortie.droneId, [])
        }
        droneVehicleMap.get(sortie.droneId)?.push(sortie)
      })

      Array.from(droneVehicleMap.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([droneId, sorties], index) => {
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

          details.push({
            id: `${truckRoute.routeId}-drone-${droneId}`,
            type: 'drone',
            name: `Truck ${truckRoute.truckId + 1} Drone ${droneId}`,
            color: getDroneColor(sorties[0]?.sortieIndex ? sorties[0].sortieIndex - 1 : index),
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
          })
        })
    })

    return details
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
