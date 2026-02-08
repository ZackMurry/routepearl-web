'use client'

import { useMemo } from 'react'
import { Point, MissionSite } from '@/lib/types'
import {
  TimelineEvent,
  TimelineSummary,
  TimelineConfig,
  TimelineResult,
  DEFAULT_TIMELINE_CONFIG,
} from './timeline.types'

// Haversine distance calculation (returns meters)
function calculateDistance(a: Point, b: Point): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// Calculate travel time in seconds
function calculateTravelTime(distance: number, speedKmh: number): number {
  const speedMs = (speedKmh * 1000) / 3600 // Convert km/h to m/s
  return distance / speedMs
}

// Find node at location by type
function findNodeAtLocation(
  location: Point,
  nodes: MissionSite[],
  tolerance: number = 0.0001
): MissionSite | undefined {
  return nodes.find(
    (node) =>
      Math.abs(node.lat - location.lat) < tolerance &&
      Math.abs(node.lng - location.lng) < tolerance
  )
}

// Find order node at location
function findOrderAtLocation(
  location: Point,
  nodes: MissionSite[],
  tolerance: number = 0.0001
): MissionSite | undefined {
  return nodes.find(
    (node) =>
      node.type === 'order' &&
      Math.abs(node.lat - location.lat) < tolerance &&
      Math.abs(node.lng - location.lng) < tolerance
  )
}

// Check if a point matches any point in a set (with tolerance)
function pointMatchesAny(
  point: Point,
  pointSet: Set<string>,
  tolerance: number = 0.0001
): boolean {
  // Check exact match first
  if (pointSet.has(`${point.lat},${point.lng}`)) return true

  // Check with tolerance
  for (const key of pointSet) {
    const [lat, lng] = key.split(',').map(Number)
    if (
      Math.abs(point.lat - lat) < tolerance &&
      Math.abs(point.lng - lng) < tolerance
    ) {
      return true
    }
  }
  return false
}

// Identify significant points along truck route
interface SignificantPoint {
  index: number
  point: Point
  type: 'depot' | 'order' | 'station' | 'drone_launch' | 'drone_recover'
  node?: MissionSite
  sortieNumber?: number
  orderNode?: MissionSite // The order being delivered (for drone launch/recover)
}

/**
 * Timeline Generator Hook
 *
 * Generates timeline events from route data. Currently uses frontend estimation
 * based on Haversine distance and configured vehicle speeds.
 *
 * Future: Will accept optional backend timing data as primary source,
 * falling back to frontend estimation when backend data unavailable.
 *
 * @param truckRoute - Array of truck route points
 * @param droneRoutes - Array of drone sorties (each sortie: [launch, delivery, return])
 * @param nodes - Mission sites with order/depot information
 * @param config - Timeline configuration (speeds, service times)
 * @returns TimelineResult with events, summary, and data source indicator
 */
export function useTimelineGenerator(
  truckRoute: Point[],
  droneRoutes: Point[][],
  nodes: MissionSite[],
  config: TimelineConfig = DEFAULT_TIMELINE_CONFIG
): TimelineResult {
  return useMemo(() => {
    // Currently using frontend estimation
    // TODO: Phase 4 will add backend timing support here
    const dataSource = 'frontend_estimate' as const

    const events: TimelineEvent[] = []
    let cumulativeTime = 0
    let totalDistance = 0
    let droneDistance = 0
    let truckDistance = 0
    let eventId = 0

    // Helper to generate unique ID
    const nextId = () => `event-${++eventId}`

    // Find depot (first node of type 'depot' or first truck route point)
    const depot =
      nodes.find((n) => n.type === 'depot') ||
      (truckRoute.length > 0 ? { lat: truckRoute[0].lat, lng: truckRoute[0].lng } : null)

    if (!depot || truckRoute.length === 0) {
      return {
        events: [],
        summary: {
          totalEvents: 0,
          completedEvents: 0,
          droneEvents: 0,
          truckEvents: 0,
          totalDuration: 0,
          totalDistance: 0,
          droneDistance: 0,
          truckDistance: 0,
          deliveryCount: 0,
          droneDeliveries: 0,
          truckDeliveries: 0,
        },
        dataSource,
      }
    }

    // 1. Add truck departure event
    events.push({
      id: nextId(),
      type: 'truck_depart',
      vehicle: 'truck',
      waypointIndex: 0,
      location: truckRoute[0],
      label: 'Truck Departs Depot',
      estimatedDuration: 0,
      cumulativeTime: 0,
      status: 'pending',
    })

    // 2. Process drone sorties - add all drone events
    const droneEvents: TimelineEvent[] = []
    let droneCumulativeTime = 0

    droneRoutes.forEach((sortie, sortieIndex) => {
      if (sortie.length !== 3) return // Invalid sortie

      const [launchPoint, deliveryPoint, returnPoint] = sortie
      const sortieNum = sortieIndex + 1

      // Find order at delivery point
      const order = findOrderAtLocation(deliveryPoint, nodes)

      // Drone launch
      droneEvents.push({
        id: nextId(),
        type: 'drone_launch',
        vehicle: 'drone',
        sortieNumber: sortieNum,
        location: launchPoint,
        label: `Sortie ${sortieNum}: Drone Launch`,
        description: `Launching for ${order?.label || 'Order'}`,
        estimatedDuration: config.droneLoadTimeSeconds,
        cumulativeTime: droneCumulativeTime,
        status: 'pending',
        distance: 0,
      })
      droneCumulativeTime += config.droneLoadTimeSeconds

      // Drone delivery
      const launchToDeliveryDist = calculateDistance(launchPoint, deliveryPoint)
      const launchToDeliveryTime = calculateTravelTime(
        launchToDeliveryDist,
        config.droneSpeedKmh
      )

      droneEvents.push({
        id: nextId(),
        type: 'drone_delivery',
        vehicle: 'drone',
        sortieNumber: sortieNum,
        location: deliveryPoint,
        label: `Sortie ${sortieNum}: Drone Delivery`,
        orderName: order?.label,
        estimatedDuration: launchToDeliveryTime + config.droneUnloadTimeSeconds,
        cumulativeTime: droneCumulativeTime,
        status: 'pending',
        distance: launchToDeliveryDist,
      })
      droneCumulativeTime += launchToDeliveryTime + config.droneUnloadTimeSeconds
      droneDistance += launchToDeliveryDist

      // Drone return
      const deliveryToReturnDist = calculateDistance(deliveryPoint, returnPoint)
      const deliveryToReturnTime = calculateTravelTime(
        deliveryToReturnDist,
        config.droneSpeedKmh
      )

      droneEvents.push({
        id: nextId(),
        type: 'drone_return',
        vehicle: 'drone',
        sortieNumber: sortieNum,
        location: returnPoint,
        label: `Sortie ${sortieNum}: Drone Return`,
        estimatedDuration: deliveryToReturnTime,
        cumulativeTime: droneCumulativeTime,
        status: 'pending',
        distance: deliveryToReturnDist,
      })
      droneCumulativeTime += deliveryToReturnTime
      droneDistance += deliveryToReturnDist
    })

    // 3. Process truck route - identify significant points only
    // Build sets of drone launch and recovery points
    const droneLaunchPoints = new Set<string>()
    const droneRecoverPoints = new Set<string>()
    const droneDeliveryPoints = new Set<string>()

    droneRoutes.forEach((sortie, idx) => {
      if (sortie.length === 3) {
        droneLaunchPoints.add(`${sortie[0].lat},${sortie[0].lng}`)
        droneDeliveryPoints.add(`${sortie[1].lat},${sortie[1].lng}`)
        droneRecoverPoints.add(`${sortie[2].lat},${sortie[2].lng}`)
      }
    })

    // Find all significant points along the truck route
    const significantPoints: SignificantPoint[] = []

    // Track which sortie launches/recovers have already been matched
    // to avoid duplicates from consecutive close route points
    const matchedLaunches = new Set<number>()
    const matchedRecovers = new Set<number>()

    // First point is always depot/start
    significantPoints.push({
      index: 0,
      point: truckRoute[0],
      type: 'depot',
      node: findNodeAtLocation(truckRoute[0], nodes),
    })

    // Scan route for significant points
    for (let i = 1; i < truckRoute.length; i++) {
      const point = truckRoute[i]
      const node = findNodeAtLocation(point, nodes)

      // Check if this is a drone launch point
      if (pointMatchesAny(point, droneLaunchPoints)) {
        // Find the first unmatched sortie that launches from this point
        const sortieIdx = droneRoutes.findIndex(
          (s, idx) =>
            !matchedLaunches.has(idx) &&
            s.length === 3 &&
            Math.abs(s[0].lat - point.lat) < 0.0001 &&
            Math.abs(s[0].lng - point.lng) < 0.0001
        )
        if (sortieIdx >= 0) {
          matchedLaunches.add(sortieIdx)
          // Look up the order at this sortie's delivery point
          const deliveryPoint = droneRoutes[sortieIdx][1]
          const orderAtDelivery = findOrderAtLocation(deliveryPoint, nodes)
          significantPoints.push({
            index: i,
            point,
            type: 'drone_launch',
            sortieNumber: sortieIdx + 1,
            orderNode: orderAtDelivery,
          })
        }
      }
      // Check if this is a drone recovery point
      else if (pointMatchesAny(point, droneRecoverPoints)) {
        const sortieIdx = droneRoutes.findIndex(
          (s, idx) =>
            !matchedRecovers.has(idx) &&
            s.length === 3 &&
            Math.abs(s[2].lat - point.lat) < 0.0001 &&
            Math.abs(s[2].lng - point.lng) < 0.0001
        )
        if (sortieIdx >= 0) {
          matchedRecovers.add(sortieIdx)
          const deliveryPoint = droneRoutes[sortieIdx][1]
          const orderAtDelivery = findOrderAtLocation(deliveryPoint, nodes)
          significantPoints.push({
            index: i,
            point,
            type: 'drone_recover',
            sortieNumber: sortieIdx + 1,
            orderNode: orderAtDelivery,
          })
        }
      }
      // Check if this is an order (truck delivery)
      else if (node?.type === 'order') {
        const isDroneServed = pointMatchesAny(point, droneDeliveryPoints)
        if (!isDroneServed) {
          significantPoints.push({
            index: i,
            point,
            type: 'order',
            node,
          })
        }
      }
      // Check if this is a charging station
      else if (node?.type === 'station') {
        significantPoints.push({
          index: i,
          point,
          type: 'station',
          node,
        })
      }
      // Check if this is a depot (return)
      else if (node?.type === 'depot') {
        significantPoints.push({
          index: i,
          point,
          type: 'depot',
          node,
        })
      }
    }

    // Ensure all truck-delivered orders are included as significant points.
    // The point-by-point scan above may miss orders whose coordinates don't
    // exactly match a truck route point (e.g. road-snapped routes). For each
    // order that is NOT drone-served and NOT already found, find the closest
    // truck route point and inject it.
    const matchedOrderIds = new Set(
      significantPoints.filter((sp) => sp.type === 'order').map((sp) => sp.node?.id)
    )
    const truckDeliveredOrders = nodes.filter(
      (n) => n.type === 'order' && !pointMatchesAny({ lat: n.lat, lng: n.lng }, droneDeliveryPoints)
    )
    for (const order of truckDeliveredOrders) {
      if (matchedOrderIds.has(order.id)) continue

      // Find the closest truck route point to this order
      let closestIdx = -1
      let closestDist = Infinity
      for (let i = 1; i < truckRoute.length; i++) {
        const d = calculateDistance(truckRoute[i], { lat: order.lat, lng: order.lng })
        if (d < closestDist) {
          closestDist = d
          closestIdx = i
        }
      }

      if (closestIdx >= 0) {
        significantPoints.push({
          index: closestIdx,
          point: truckRoute[closestIdx],
          type: 'order',
          node: order,
        })
      }
    }

    // Re-sort significant points by route index so events are in order
    significantPoints.sort((a, b) => a.index - b.index)

    // Add final point if it's not already included and is significant
    const lastIdx = truckRoute.length - 1
    const lastPoint = truckRoute[lastIdx]
    const lastNode = findNodeAtLocation(lastPoint, nodes)
    const lastSigPoint = significantPoints[significantPoints.length - 1]

    if (lastSigPoint?.index !== lastIdx) {
      // Check if last point is depot (return)
      if (lastNode?.type === 'depot' || calculateDistance(lastPoint, { lat: depot.lat, lng: depot.lng }) < 100) {
        significantPoints.push({
          index: lastIdx,
          point: lastPoint,
          type: 'depot',
          node: lastNode,
        })
      }
    }

    // Generate truck events from significant points
    const truckEvents: TimelineEvent[] = []
    let truckCumulativeTime = 0

    for (let i = 1; i < significantPoints.length; i++) {
      const prevSig = significantPoints[i - 1]
      const currSig = significantPoints[i]

      // Calculate total distance and time from previous significant point
      let segmentDistance = 0
      for (let j = prevSig.index; j < currSig.index; j++) {
        segmentDistance += calculateDistance(truckRoute[j], truckRoute[j + 1])
      }
      const segmentTime = calculateTravelTime(segmentDistance, config.truckSpeedKmh)
      truckDistance += segmentDistance

      // Add travel event if there's meaningful distance
      if (segmentDistance > 50) {
        // More than 50m
        truckEvents.push({
          id: nextId(),
          type: 'truck_travel',
          vehicle: 'truck',
          waypointIndex: currSig.index,
          location: currSig.point,
          label: `Travel to ${getDestinationLabel(currSig)}`,
          estimatedDuration: segmentTime,
          cumulativeTime: truckCumulativeTime,
          status: 'pending',
          distance: segmentDistance,
        })
        truckCumulativeTime += segmentTime
      }

      // Add action event at the significant point
      switch (currSig.type) {
        case 'order':
          truckEvents.push({
            id: nextId(),
            type: 'truck_delivery',
            vehicle: 'truck',
            waypointIndex: currSig.index,
            location: currSig.point,
            label: 'Truck Delivery',
            orderName: currSig.node?.label,
            description: `Delivering to ${currSig.node?.label || 'order'}`,
            estimatedDuration: config.truckDeliveryTimeSeconds,
            cumulativeTime: truckCumulativeTime,
            status: 'pending',
          })
          truckCumulativeTime += config.truckDeliveryTimeSeconds
          break

        case 'drone_launch': {
          const launchOrderName = currSig.orderNode?.label
          truckEvents.push({
            id: nextId(),
            type: 'truck_drone_launch',
            vehicle: 'truck',
            waypointIndex: currSig.index,
            sortieNumber: currSig.sortieNumber,
            location: currSig.point,
            label: `Launch Drone → ${launchOrderName || 'Delivery'}`,
            orderName: launchOrderName,
            description: `Truck stops to launch drone for ${launchOrderName || 'delivery'}`,
            estimatedDuration: config.droneLoadTimeSeconds,
            cumulativeTime: truckCumulativeTime,
            status: 'pending',
          })
          truckCumulativeTime += config.droneLoadTimeSeconds
          break
        }

        case 'drone_recover': {
          const recoverOrderName = currSig.orderNode?.label
          truckEvents.push({
            id: nextId(),
            type: 'truck_drone_recover',
            vehicle: 'truck',
            waypointIndex: currSig.index,
            sortieNumber: currSig.sortieNumber,
            location: currSig.point,
            label: `Recover Drone ← ${recoverOrderName || 'Delivery'}`,
            orderName: recoverOrderName,
            description: `Truck stops to recover drone after ${recoverOrderName || 'delivery'}`,
            estimatedDuration: config.droneLoadTimeSeconds,
            cumulativeTime: truckCumulativeTime,
            status: 'pending',
          })
          truckCumulativeTime += config.droneLoadTimeSeconds
          break
        }

        case 'station':
          truckEvents.push({
            id: nextId(),
            type: 'truck_charging',
            vehicle: 'truck',
            waypointIndex: currSig.index,
            location: currSig.point,
            label: 'Charging Stop',
            description: currSig.node?.label || 'Charging station',
            estimatedDuration: 600, // 10 min charging estimate
            cumulativeTime: truckCumulativeTime,
            status: 'pending',
          })
          truckCumulativeTime += 600
          break

        case 'depot':
          // Only add return event if this is the final depot
          if (i === significantPoints.length - 1 && i > 0) {
            truckEvents.push({
              id: nextId(),
              type: 'truck_return',
              vehicle: 'truck',
              waypointIndex: currSig.index,
              location: currSig.point,
              label: 'Truck Returns to Depot',
              description: 'Mission complete',
              estimatedDuration: 0,
              cumulativeTime: truckCumulativeTime,
              status: 'pending',
            })
          }
          break
      }
    }

    // Helper function to get destination label
    function getDestinationLabel(sig: SignificantPoint): string {
      switch (sig.type) {
        case 'order':
          return sig.node?.label || 'Order'
        case 'drone_launch':
          return sig.orderNode?.label ? `Launch → ${sig.orderNode.label}` : `Launch Point${sig.sortieNumber ? ` #${sig.sortieNumber}` : ''}`
        case 'drone_recover':
          return sig.orderNode?.label ? `Recover ← ${sig.orderNode.label}` : `Recovery Point${sig.sortieNumber ? ` #${sig.sortieNumber}` : ''}`
        case 'station':
          return sig.node?.label || 'Charging Station'
        case 'depot':
          return 'Depot'
        default:
          return 'Next Stop'
      }
    }

    // 5. Merge events and recalculate cumulative times
    // For simplicity, we'll show truck events first, then interleave drone events
    // based on when they would occur during the truck route

    // Add all events to the main list
    events.push(...droneEvents)
    events.push(...truckEvents)

    // Sort by cumulative time to interleave properly
    events.sort((a, b) => a.cumulativeTime - b.cumulativeTime)

    // Recalculate cumulative times sequentially
    cumulativeTime = 0
    for (const event of events) {
      event.cumulativeTime = cumulativeTime
      cumulativeTime += event.estimatedDuration
    }

    totalDistance = droneDistance + truckDistance

    // 6. Calculate summary
    const droneDeliveries = events.filter((e) => e.type === 'drone_delivery').length
    const truckDeliveries = events.filter((e) => e.type === 'truck_delivery').length

    const summary: TimelineSummary = {
      totalEvents: events.length,
      completedEvents: events.filter((e) => e.status === 'completed').length,
      droneEvents: events.filter((e) => e.vehicle === 'drone').length,
      truckEvents: events.filter((e) => e.vehicle === 'truck').length,
      totalDuration: cumulativeTime,
      totalDistance: totalDistance,
      droneDistance: droneDistance,
      truckDistance: truckDistance,
      deliveryCount: droneDeliveries + truckDeliveries,
      droneDeliveries,
      truckDeliveries,
    }

    return { events, summary, dataSource }
  }, [truckRoute, droneRoutes, nodes, config])
}
