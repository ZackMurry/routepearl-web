'use client'

import { useMemo } from 'react'
import { GeneratedTruckRoute } from '@/lib/types'
import { DEFAULT_TIMELINE_CONFIG, TimelineResult } from '../timeline/timeline.types'
import { estimatePolylineDistance, getDroneColor, getTruckRouteColor } from '../routeData'

const matchesPoint = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001

export interface RouteDetail {
  id: string
  type: 'truck' | 'drone'
  name: string
  color: string
  distance: number
  duration: number
  events: number
  deliveries: number
  stops: number
  orderIds: number[]
}

export function useRouteDetails(
  generatedTruckRoutes: GeneratedTruckRoute[],
  timelineResult: TimelineResult,
  hasRoute: boolean,
  orderNodes: { orderId?: number; id: string; lat: number; lng: number }[],
): RouteDetail[] {
  return useMemo(() => {
    if (!hasRoute) {
      return []
    }

    if (generatedTruckRoutes.length === 0) {
      const { events } = timelineResult
      const truckEvents = events.filter(event => event.vehicle === 'truck')
      const droneEvents = events.filter(event => event.vehicle === 'drone')

      const details: RouteDetail[] = []

      if (truckEvents.length > 0) {
        details.push({
          id: 'truck-0',
          type: 'truck',
          name: 'Truck Route',
          color: getTruckRouteColor('gas', 0),
          distance: truckEvents.reduce((sum, event) => sum + (event.distance || 0), 0),
          duration:
            Math.max(...truckEvents.map(event => event.cumulativeTime + event.estimatedDuration)) -
            Math.min(...truckEvents.map(event => event.cumulativeTime)),
          events: truckEvents.length,
          deliveries: truckEvents.filter(event => event.type === 'truck_delivery').length,
          stops: truckEvents.filter(event =>
            ['truck_delivery', 'truck_drone_launch', 'truck_drone_recover', 'truck_charging'].includes(event.type),
          ).length,
          orderIds: truckEvents
            .filter(event => event.type === 'truck_delivery')
            .map(event => {
              const match = orderNodes.find(node => node.id === event.nodeId || event.orderName === String(node.orderId))
              return match?.orderId
            })
            .filter((id): id is number => id !== undefined),
        })
      }

      const sortieNumbers = Array.from(new Set(droneEvents.map(event => event.sortieNumber).filter(Boolean))).sort(
        (a, b) => (a || 0) - (b || 0),
      )

      sortieNumbers.forEach((sortieNumber, index) => {
        const sortieEvents = droneEvents.filter(event => event.sortieNumber === sortieNumber)
        details.push({
          id: `truck-0-sortie-${sortieNumber}`,
          type: 'drone',
          name: `Sortie ${sortieNumber}`,
          color: getDroneColor(index),
          distance: sortieEvents.reduce((sum, event) => sum + (event.distance || 0), 0),
          duration:
            Math.max(...sortieEvents.map(event => event.cumulativeTime + event.estimatedDuration)) -
            Math.min(...sortieEvents.map(event => event.cumulativeTime)),
          events: sortieEvents.length,
          deliveries: sortieEvents.filter(event => event.type === 'drone_delivery').length,
          stops: sortieEvents.filter(event => ['drone_delivery', 'drone_launch', 'drone_return'].includes(event.type)).length,
          orderIds: sortieEvents
            .filter(event => event.type === 'drone_delivery')
            .map(event => {
              const match = orderNodes.find(node => node.id === event.nodeId || event.orderName === String(node.orderId))
              return match?.orderId
            })
            .filter((id): id is number => id !== undefined),
        })
      })

      return details
    }

    const truckSpeedMs = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
    const droneSpeedMs = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600

    const details: RouteDetail[] = []

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
        name: `Truck ${truckRoute.truckId + 1} Route`,
        color: getTruckRouteColor(truckRoute.truckType, truckRoute.truckId),
        distance: truckDistance,
        duration: truckDistance / truckSpeedMs,
        events:
          truckRoute.truckRoute.length +
          truckRoute.droneSorties.length * 2,
        deliveries: truckOrderIds.length,
        stops: truckMatchPoints.length,
        orderIds: truckOrderIds,
      })

      truckRoute.droneSorties.forEach(sortie => {
        const orderIds = orderNodes
          .filter(order => matchesPoint(sortie.customer, order))
          .map(order => order.orderId)
          .filter((id): id is number => id !== undefined)
        const distance = estimatePolylineDistance(sortie.path)

        details.push({
          id: sortie.routeId,
          type: 'drone',
          name: `Truck ${truckRoute.truckId + 1} Sortie ${sortie.localSortieIndex + 1}`,
          color: getDroneColor(sortie.sortieIndex - 1),
          distance,
          duration:
            distance / droneSpeedMs +
            DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds +
            DEFAULT_TIMELINE_CONFIG.droneUnloadTimeSeconds,
          events: 3,
          deliveries: orderIds.length,
          stops: 3,
          orderIds,
        })
      })
    })

    return details
  }, [generatedTruckRoutes, hasRoute, orderNodes, timelineResult])
}
