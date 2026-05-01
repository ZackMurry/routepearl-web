'use client'

import { useMemo } from 'react'
import { GeneratedTruckRoute, TruckPowerType } from '@/lib/types'
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
  // Per-type 1-based display index for trucks (anonymous fleet model, design doc §2.5).
  truckType?: TruckPowerType
  typeIndex?: number
  // Optimizer didn't use this vehicle (over-allocation indicator). Mirrors
  // VehicleDetail.isUnused — same definition, separate type so the Routes
  // tab can render the badge without depending on the Vehicles hook.
  isUnused?: boolean
}

export interface RouteDetailGroup {
  truck: RouteDetail
  sorties: RouteDetail[]
}

export function useRouteDetails(
  generatedTruckRoutes: GeneratedTruckRoute[],
  timelineResult: TimelineResult,
  hasRoute: boolean,
  orderNodes: { orderId?: number; id: string; lat: number; lng: number }[],
): RouteDetailGroup[] {
  return useMemo(() => {
    if (!hasRoute) {
      return []
    }

    if (generatedTruckRoutes.length === 0) {
      // Legacy single-truck path: synthesize a single group from raw timeline events.
      const { events } = timelineResult
      const truckEvents = events.filter(event => event.vehicle === 'truck')
      const droneEvents = events.filter(event => event.vehicle === 'drone')
      const fallbackTruckColor = getTruckRouteColor('gas', 0)

      if (truckEvents.length === 0 && droneEvents.length === 0) {
        return []
      }

      const truck: RouteDetail = {
        id: 'truck-0',
        type: 'truck',
        name: 'Truck Route',
        color: fallbackTruckColor,
        distance: truckEvents.reduce((sum, event) => sum + (event.distance || 0), 0),
        duration:
          truckEvents.length > 0
            ? Math.max(...truckEvents.map(event => event.cumulativeTime + event.estimatedDuration)) -
              Math.min(...truckEvents.map(event => event.cumulativeTime))
            : 0,
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
      }

      const sortieNumbers = Array.from(new Set(droneEvents.map(event => event.sortieNumber).filter(Boolean))).sort(
        (a, b) => (a || 0) - (b || 0),
      )

      const sorties: RouteDetail[] = sortieNumbers.map((sortieNumber, index) => {
        const sortieEvents = droneEvents.filter(event => event.sortieNumber === sortieNumber)
        return {
          id: `truck-0-sortie-${sortieNumber}`,
          type: 'drone',
          name: `Sortie ${sortieNumber}`,
          color: getDroneColor(fallbackTruckColor, index),
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
        }
      })

      return [{ truck, sorties }]
    }

    const truckSpeedMs = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
    const droneSpeedMs = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600

    // Per-type 1-based display index — matches M1.a / P4 / M1.b labels.
    let electricCount = 0
    let gasCount = 0

    const groups: RouteDetailGroup[] = []

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

      const isUnused = truckOrderIds.length === 0 && truckRoute.droneSorties.length === 0

      const truck: RouteDetail = {
        id: truckRoute.routeId,
        type: 'truck',
        name: `${typeLabel} #${typeIndex} Route`,
        color: truckColor,
        distance: truckDistance,
        duration: truckDistance / truckSpeedMs,
        events:
          truckRoute.truckRoute.length +
          truckRoute.droneSorties.length * 2,
        deliveries: truckOrderIds.length,
        stops: truckMatchPoints.length,
        orderIds: truckOrderIds,
        truckType: truckRoute.truckType,
        typeIndex,
        isUnused,
      }

      const sorties: RouteDetail[] = truckRoute.droneSorties.map(sortie => {
        const orderIds = orderNodes
          .filter(order => matchesPoint(sortie.customer, order))
          .map(order => order.orderId)
          .filter((id): id is number => id !== undefined)
        const distance = estimatePolylineDistance(sortie.path)

        return {
          id: sortie.routeId,
          type: 'drone',
          name: `${typeLabel} #${typeIndex} Sortie ${sortie.localSortieIndex + 1}`,
          color: getDroneColor(truckColor, sortie.localSortieIndex),
          distance,
          duration:
            distance / droneSpeedMs +
            DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds +
            DEFAULT_TIMELINE_CONFIG.droneUnloadTimeSeconds,
          events: 3,
          deliveries: orderIds.length,
          stops: 3,
          orderIds,
        }
      })

      groups.push({ truck, sorties })
    })

    return groups
  }, [generatedTruckRoutes, hasRoute, orderNodes, timelineResult])
}
