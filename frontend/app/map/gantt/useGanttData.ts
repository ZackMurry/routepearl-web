'use client'

import { useMemo } from 'react'
import { DEFAULT_TIMELINE_CONFIG, TimelineEvent, TimelineResult } from '../timeline/timeline.types'
import { GeneratedTruckRoute, MissionSite, Point } from '@/lib/types'
import { estimatePolylineDistance, getDroneColor as getRouteDroneColor, getTruckRouteColor } from '../routeData'
import {
  GanttData,
  GanttVehicle,
  GanttStop,
  GanttStopType,
  GANTT_COLORS,
  getDroneColor,
} from './gantt.types'

/**
 * Synthesize Gantt data directly from per-truck route data (multi-truck path).
 *
 * Each truck runs in parallel with its own clock starting at t=0; we don't
 * try to extract per-truck timing from the legacy concatenated timeline
 * events (which would serialize trucks). Coarser than the single-truck path
 * intentionally — one stop bar per significant point, no charging-stop
 * detail — but correctness > fidelity for this first multi-truck pass.
 */
function synthesizeMultiTruckGanttData(generatedTruckRoutes: GeneratedTruckRoute[]): GanttData {
  const truckSpeedMs = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
  const droneSpeedMs = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600
  const serviceSec = DEFAULT_TIMELINE_CONFIG.truckDeliveryTimeSeconds
  const droneServiceSec = DEFAULT_TIMELINE_CONFIG.droneUnloadTimeSeconds

  const vehicles: GanttVehicle[] = []
  let elec = 0
  let gas = 0
  let fleetMaxDuration = 0

  vehicles.push({
    id: 'all',
    name: 'All',
    type: 'all',
    color: GANTT_COLORS.all,
    stops: [],
  })

  generatedTruckRoutes.forEach(route => {
    const typeIndex = route.truckType === 'electric' ? ++elec : ++gas
    const typeLabel = route.truckType === 'electric' ? 'Electric Truck' : 'Gas Truck'
    const truckColor = getTruckRouteColor(route.truckType, route.truckId)
    // groupId mirrors the existing truck/driver pairing convention so the
    // collapse-by-truck affordance can hide all rows sharing this id.
    const groupId = route.truckId + 1
    const baseLabel = `${typeLabel} #${typeIndex}`

    // Per-truck stop synthesis: depot start, one bar per stop along the
    // route at cumulative-distance-derived times, depot return at the end.
    const stopPoints = route.truckStops.length > 0 ? route.truckStops : route.truckRoute
    const truckStops: GanttStop[] = []
    let cumTime = 0
    let prev: Point | null = null

    stopPoints.forEach((point, idx) => {
      if (prev) {
        const segDist = estimatePolylineDistance([prev, point])
        cumTime += segDist / truckSpeedMs
      }
      const isFirst = idx === 0
      const isLast = idx === stopPoints.length - 1
      const stopType: GanttStopType = isFirst || isLast ? 'depot' : 'delivery'
      truckStops.push({
        id: `${route.routeId}-stop-${idx}`,
        type: stopType,
        time: cumTime,
        duration: isFirst || isLast ? 0 : serviceSec,
        label: isFirst ? 'Depot (start)' : isLast ? 'Return to Depot' : `Stop ${idx}`,
        lat: point.lat,
        lng: point.lng,
        stopGroup: idx,
        stopGroupLabel: isFirst ? 'Start' : isLast ? 'Return' : `Stop ${idx}`,
      })
      if (!isFirst && !isLast) {
        cumTime += serviceSec
      }
      prev = point
    })

    const truckDuration = truckStops.length > 0 ? truckStops[truckStops.length - 1].time : 0
    fleetMaxDuration = Math.max(fleetMaxDuration, truckDuration)

    vehicles.push({
      id: route.routeId,
      name: `${baseLabel} Route`,
      type: 'truck',
      color: truckColor,
      stops: truckStops,
      groupId,
    })

    vehicles.push({
      id: `${route.routeId}-driver`,
      name: `${baseLabel} Driver`,
      type: 'driver',
      // Driver rows mirror the truck's color family — keeps multi-truck
      // identity consistent across truck and driver rows of the same group.
      color: truckColor,
      stops: truckStops.map(stop => ({ ...stop, id: `${stop.id}-driver` })),
      groupId,
    })

    // Group sorties by physical drone, then build one row per (truck, droneId).
    const sortiesByDrone = new Map<number, typeof route.droneSorties>()
    route.droneSorties.forEach(sortie => {
      const list = sortiesByDrone.get(sortie.droneId) ?? []
      list.push(sortie)
      sortiesByDrone.set(sortie.droneId, list)
    })

    Array.from(sortiesByDrone.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([droneId, sorties], droneIndex) => {
        const droneColor = getRouteDroneColor(truckColor, droneIndex)
        const droneStops: GanttStop[] = []
        sorties.forEach(sortie => {
          const launchToCustomer = estimatePolylineDistance([sortie.launch, sortie.customer])
          const customerToRecovery = estimatePolylineDistance([sortie.customer, sortie.recovery])
          // Drone "starts" at the truck's time-of-arrival at the launch point.
          // We approximate that as cumulative travel distance to the launch
          // point — close enough for a coarse Gantt; exact timing arrives
          // when the timeline generator becomes truck-aware.
          const launchTime = (() => {
            const idx = stopPoints.findIndex(
              p => Math.abs(p.lat - sortie.launch.lat) < 0.0001 && Math.abs(p.lng - sortie.launch.lng) < 0.0001,
            )
            if (idx <= 0) return 0
            return truckStops[idx]?.time ?? 0
          })()

          droneStops.push({
            id: `${sortie.routeId}-launch`,
            type: 'launch',
            time: launchTime,
            duration: DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds,
            label: `Sortie ${sortie.localSortieIndex + 1}: Launch`,
            sortieNumber: sortie.sortieIndex,
            lat: sortie.launch.lat,
            lng: sortie.launch.lng,
          })
          const deliveryTime = launchTime + DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds + launchToCustomer / droneSpeedMs
          droneStops.push({
            id: `${sortie.routeId}-delivery`,
            type: 'delivery',
            time: deliveryTime,
            duration: droneServiceSec,
            label: `Sortie ${sortie.localSortieIndex + 1}: Delivery`,
            sortieNumber: sortie.sortieIndex,
            lat: sortie.customer.lat,
            lng: sortie.customer.lng,
          })
          const returnTime = deliveryTime + droneServiceSec + customerToRecovery / droneSpeedMs
          droneStops.push({
            id: `${sortie.routeId}-return`,
            type: 'return',
            time: returnTime,
            duration: 0,
            label: `Sortie ${sortie.localSortieIndex + 1}: Recovery`,
            sortieNumber: sortie.sortieIndex,
            lat: sortie.recovery.lat,
            lng: sortie.recovery.lng,
          })
          fleetMaxDuration = Math.max(fleetMaxDuration, returnTime)
        })

        vehicles.push({
          id: `${route.routeId}-drone-${droneId}`,
          name: `${baseLabel} Drone ${droneId}`,
          type: 'drone',
          color: droneColor,
          stops: droneStops,
          groupId,
        })
      })
  })

  // Populate the "All" row with every vehicle's stops, color-tagged for
  // visual disambiguation in the merged view.
  const allStops: GanttStop[] = []
  vehicles.slice(1).forEach(v => {
    v.stops.forEach(s => {
      allStops.push({ ...s, vehicleName: v.name, vehicleColor: v.color })
    })
  })
  allStops.sort((a, b) => a.time - b.time)
  vehicles[0].stops = allStops

  return {
    vehicles,
    totalDuration: fleetMaxDuration > 0 ? fleetMaxDuration : 3600,
    startTime: new Date(),
  }
}

/**
 * Hook to transform timeline events into Gantt chart data
 */
export function useGanttData(
  timelineResult: TimelineResult,
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number,
  nodes?: MissionSite[],
  generatedTruckRoutes?: GeneratedTruckRoute[]
): GanttData {
  return useMemo(() => {
    // Multi-truck path: bypass the legacy timeline-event aggregation and
    // synthesize per-truck rows directly from the response. Each truck
    // runs in parallel from t=0; the legacy single-truck logic below stays
    // in place for K=0/K=1 to avoid regressions (per design doc MC2).
    if (generatedTruckRoutes && generatedTruckRoutes.length > 1) {
      return synthesizeMultiTruckGanttData(generatedTruckRoutes)
    }

    const { events, summary } = timelineResult

    // Build nodeId → address and nodeId → coordinates lookup maps
    const addressMap = new Map<string, string>()
    const coordMap = new Map<string, { lat: number; lng: number }>()
    if (nodes) {
      for (const node of nodes) {
        if (node.address) addressMap.set(node.id, node.address)
        coordMap.set(node.id, { lat: node.lat, lng: node.lng })
      }
    }

    const vehicles: GanttVehicle[] = []
    // Map droneNum → groupId for linking drones to their interacting truck/driver group
    const truckDroneInteractions = new Map<number, number>()

    // Upper time bound for the truck's active route — the moment the truck_return event ends
    // (truck arrives back at depot). drone_return events and drone transit events beyond this
    // time are excluded from the truck row because the truck is no longer on the road.
    const truckReturnEvent = events.find((e) => e.vehicle === 'truck' && e.type === 'truck_return')
    const truckRouteEndTime = truckReturnEvent
      ? truckReturnEvent.cumulativeTime + truckReturnEvent.estimatedDuration
      : Infinity

    // Helpers for location badges on launch/return stop icons.
    // Given a lat/lng, find the matching mission node.
    // Uses an exact match within 0.0001° (~11 m), then a tight 100 m fallback.
    // The fallback is intentionally small so OSRM-snapped road points near end-of-route
    // order nodes don't accidentally resolve to already-delivered stops.
    const findPhysicalNode = (location: { lat: number; lng: number } | undefined): MissionSite | undefined => {
      if (!location || !nodes) return undefined
      const tol = 0.0001
      const exact = nodes.find(
        (n) => Math.abs(n.lat - location.lat) < tol && Math.abs(n.lng - location.lng) < tol
      )
      if (exact) return exact
      let closest: MissionSite | undefined
      let closestDist = 100 // tight 100 m radius — avoids false positives from nearby old nodes
      for (const node of nodes) {
        const dLat = (node.lat - location.lat) * 111000
        const dLng = (node.lng - location.lng) * 111000 * Math.cos((location.lat * Math.PI) / 180)
        const d = Math.sqrt(dLat * dLat + dLng * dLng)
        if (d < closestDist) { closestDist = d; closest = node }
      }
      return closest
    }
    // Return the short badge text for the physical node at a given location:
    // order node → its orderId string, depot → "D", others → siteId or undefined.
    const getLocationBadge = (location: { lat: number; lng: number } | undefined): string | undefined => {
      const node = findPhysicalNode(location)
      if (!node) return undefined
      if (node.type === 'depot') return 'D'
      if (node.type === 'order' && node.orderId != null) return String(node.orderId)
      if (node.siteId != null) return String(node.siteId)
      return undefined
    }

    // truck_drone_launch and truck_drone_recover events carry an OSRM-snapped road point
    // as their location, which may not match any order node within the tight radius above.
    // Build a sortie-number → raw drone coordinates map from the drone events, which
    // preserve the pre-snapping coordinates that match order nodes exactly.
    const sortieRawLocations = new Map<number, { launch?: { lat: number; lng: number }; recovery?: { lat: number; lng: number } }>()
    events.filter((e) => e.vehicle === 'drone' && e.sortieNumber != null && e.location != null).forEach((e) => {
      if (!sortieRawLocations.has(e.sortieNumber!)) sortieRawLocations.set(e.sortieNumber!, {})
      const entry = sortieRawLocations.get(e.sortieNumber!)!
      if (e.type === 'drone_launch') entry.launch = e.location!
      if (e.type === 'drone_return') entry.recovery = e.location!
    })

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
          return 'recover' // truck catching the drone — distinct from the drone's own return flight
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
      // Include drone_return events alongside truck events so the truck row shows both
      // the moment the drone physically lands (drone_return) and the recovery preparations
      // (truck_drone_recover). Only include drone_return events that occur while the truck is
      // still on its active route (before it finishes returning to depot).
      const truckEvents = events.filter(
        (e) =>
          (e.vehicle === 'truck' && e.type !== 'truck_drone_recover') ||
          (e.type === 'drone_return' && e.cumulativeTime <= truckRouteEndTime)
      )

      // Compute stop group indices first — used by both truck and driver rows.
      // Walk all truck events and increment a group counter each time a travel
      // segment is crossed. truck_return always gets its own "Return to Depot" group.
      const stopGroupMap = new Map<string, { group: number; label: string }>()
      let currentStopGroup = 0
      let stopCounter = 0
      let lastWasTravel = false
      for (const event of truckEvents) {
        if (event.type === 'truck_travel') {
          lastWasTravel = true
          continue
        }
        if (event.type === 'truck_return') {
          currentStopGroup++
          stopGroupMap.set(event.id, { group: currentStopGroup, label: 'Return to Depot' })
          lastWasTravel = false
          continue
        }
        if (lastWasTravel) {
          currentStopGroup++
          stopCounter++
          stopGroupMap.set(event.id, { group: currentStopGroup, label: `Stop ${stopCounter}` })
          lastWasTravel = false
        } else {
          stopGroupMap.set(event.id, { group: currentStopGroup, label: currentStopGroup === 0 ? 'Start' : `Stop ${stopCounter}` })
        }
      }

      // Deduplicate: the sequential timeline can place multiple sorties from the same drone
      // at the same truck stop group (e.g. sortie 1 and sortie 5 both mapped to stop 3).
      // Keep only the first launch/recover/return per drone per stop group.
      const seenGroupDroneType = new Set<string>()
      const dedupedTruckEvents = truckEvents.filter((event) => {
        const isLaunchOrRecovery =
          event.type === 'truck_drone_launch' ||
          event.type === 'truck_drone_recover' ||
          event.type === 'drone_return'
        if (!isLaunchOrRecovery || event.sortieNumber == null) return true
        const groupInfo = stopGroupMap.get(event.id)
        if (!groupInfo) return true
        const droneNum = ((event.sortieNumber - 1) % droneCount) + 1
        const key = `${groupInfo.group}-drone${droneNum}-${event.type}`
        if (seenGroupDroneType.has(key)) return false
        seenGroupDroneType.add(key)
        return true
      })

      const truckStops: GanttStop[] = dedupedTruckEvents.map((event) => {
        // For drone launch/return events on the truck row, label which drone
        let label = event.label
        if (event.sortieNumber) {
          const droneNum = ((event.sortieNumber - 1) % droneCount) + 1
          if (event.type === 'truck_drone_launch') {
            label = `Launch Drone ${droneNum}` + (event.orderName ? ` → ${event.orderName}` : '')
          } else if (event.type === 'truck_drone_recover') {
            label = `Drone ${droneNum} Recovery Preparations` + (event.orderName ? ` ← ${event.orderName}` : '')
          } else if (event.type === 'drone_return') {
            label = `Drone ${droneNum} Recovery` + (event.orderName ? ` ← ${event.orderName}` : '')
          }
        }
        const groupInfo = stopGroupMap.get(event.id)
        // For launch/recover events the timeline generator sets nodeId = delivery order node.
        // Override with the physical node at the truck's actual position so clicks/selection
        // highlight the correct map marker.
        // truck_drone_launch/recover carry OSRM-snapped locations — use the raw drone sortie
        // coordinates instead, which match order nodes exactly.
        const isLaunchOrReturn = event.type === 'truck_drone_launch' || event.type === 'truck_drone_recover' || event.type === 'drone_return'
        let physicalLookupLoc = event.location
        if (isLaunchOrReturn && event.sortieNumber != null) {
          const raw = sortieRawLocations.get(event.sortieNumber)
          if (event.type === 'truck_drone_launch' && raw?.launch) physicalLookupLoc = raw.launch
          else if (event.type === 'truck_drone_recover' && raw?.recovery) physicalLookupLoc = raw.recovery
          else if (event.type === 'drone_return' && raw?.recovery) physicalLookupLoc = raw.recovery
        }
        const physicalNode = isLaunchOrReturn ? findPhysicalNode(physicalLookupLoc) : undefined
        const effectiveNodeId = physicalNode?.id ?? event.nodeId
        const coords = effectiveNodeId ? coordMap.get(effectiveNodeId) : undefined
        const locationBadge = isLaunchOrReturn ? getLocationBadge(physicalLookupLoc) : undefined
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
          nodeId: effectiveNodeId,
          address: effectiveNodeId ? addressMap.get(effectiveNodeId) : undefined,
          lat: coords?.lat ?? event.location?.lat,
          lng: coords?.lng ?? event.location?.lng,
          stopGroup: groupInfo?.group,
          stopGroupLabel: groupInfo?.label,
          locationBadge,
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

      const driverEvents = dedupedTruckEvents.filter(
        (e) => e.type !== 'truck_travel'
      )
      const driverStops: GanttStop[] = driverEvents.map((event) => {
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
          case 'truck_delivery':
            label = `Deliver package${event.orderId != null ? ` at Order Point ${event.orderId}` : ''}${event.orderName ? ` (${event.orderName})` : ''}`
            description = `Park and complete delivery${event.estimatedDuration ? ` — approx ${Math.ceil(event.estimatedDuration / 60)} min` : ''}`
            break
          case 'truck_drone_launch':
            label = `Stop and launch Drone ${droneNum || '?'}${event.orderName ? ` for ${event.orderName}` : ''}`
            description = 'Come to a stop, prepare drone payload, and launch'
            break
          case 'truck_drone_recover':
            label = `Drone ${droneNum || '?'} Recovery Preparations${event.orderName ? ` ← ${event.orderName}` : ''}`
            description = 'Stage at location and prepare to receive the returning drone'
            break
          case 'drone_return':
            label = `Drone ${droneNum || '?'} Recovery${event.orderName ? ` ← ${event.orderName}` : ''}`
            description = `Drone lands${event.orderName ? ` after delivering to ${event.orderName}` : ''} — secure and stow`
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

        const groupInfo = stopGroupMap.get(event.id)
        const isDriverLaunchOrReturn = event.type === 'truck_drone_launch' || event.type === 'truck_drone_recover' || event.type === 'drone_return'
        let driverPhysicalLookupLoc = event.location
        if (isDriverLaunchOrReturn && event.sortieNumber != null) {
          const raw = sortieRawLocations.get(event.sortieNumber)
          if (event.type === 'truck_drone_launch' && raw?.launch) driverPhysicalLookupLoc = raw.launch
          else if (event.type === 'truck_drone_recover' && raw?.recovery) driverPhysicalLookupLoc = raw.recovery
          else if (event.type === 'drone_return' && raw?.recovery) driverPhysicalLookupLoc = raw.recovery
        }
        const driverPhysicalNode = isDriverLaunchOrReturn ? findPhysicalNode(driverPhysicalLookupLoc) : undefined
        const driverEffectiveNodeId = driverPhysicalNode?.id ?? event.nodeId
        const driverCoords = driverEffectiveNodeId ? coordMap.get(driverEffectiveNodeId) : undefined
        const driverLocationBadge = isDriverLaunchOrReturn ? getLocationBadge(event.location) : undefined
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
          nodeId: driverEffectiveNodeId,
          address: driverEffectiveNodeId ? addressMap.get(driverEffectiveNodeId) : undefined,
          lat: driverCoords?.lat ?? event.location?.lat,
          lng: driverCoords?.lng ?? event.location?.lng,
          stopGroup: groupInfo?.group,
          stopGroupLabel: groupInfo?.label,
          locationBadge: driverLocationBadge,
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
      dedupedTruckEvents.forEach((event) => {
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

        // Build a flat ordered list of all events for this drone to determine
        // first/last launch and which return is the final one
        const allDroneEvents: TimelineEvent[] = []
        assignedSorties.forEach((sortieNum) => {
          const sortieEvents = sortieMap.get(sortieNum) || []
          sortieEvents.forEach((e) => allDroneEvents.push(e))
        })
        allDroneEvents.sort((a, b) => a.cumulativeTime - b.cumulativeTime)

        const firstEventId = allDroneEvents[0]?.id
        const lastEventId = allDroneEvents[allDroneEvents.length - 1]?.id

        assignedSorties.forEach((sortieNum) => {
          const sortieEvents = sortieMap.get(sortieNum) || []
          sortieEvents.forEach((event, evtIdx) => {
            const isFirst = event.id === firstEventId
            const isLast = event.id === lastEventId

            // Assign a sequential stop group — each drone event is a distinct physical location
            const stopGroup = allDroneEvents.findIndex((e) => e.id === event.id)

            let stopGroupLabel: string
            if (event.type === 'drone_launch') {
              stopGroupLabel = isFirst ? 'Start' : 'Re-Launch'
            } else if (event.type === 'drone_delivery') {
              stopGroupLabel = event.orderName
                ? `Order: ${event.orderName}`
                : event.orderId != null
                  ? `Order ${event.orderId}`
                  : 'Delivery'
            } else if (event.type === 'drone_return') {
              stopGroupLabel = isLast ? 'Return to Depot' : 'Rendezvous'
            } else {
              stopGroupLabel = event.label
            }

            // For drone launch/return events the timeline generator sets nodeId = delivery order.
            // Override with the physical node at the actual launch/return coordinates so that
            // clicking the stop highlights the correct map marker (not the delivery destination).
            // IMPORTANT: do NOT fall back to the delivery order nodeId if no physical node is
            // found — that would link the event to the wrong location entirely.
            const isDroneLaunchOrReturn = event.type === 'drone_launch' || event.type === 'drone_return'
            const dronePhysicalNode = isDroneLaunchOrReturn ? findPhysicalNode(event.location) : undefined
            const droneEffectiveNodeId = isDroneLaunchOrReturn
              ? dronePhysicalNode?.id   // undefined if no node found — don't select delivery order
              : event.nodeId
            const droneCoords = droneEffectiveNodeId ? coordMap.get(droneEffectiveNodeId) : undefined
            const droneLBadge = isDroneLaunchOrReturn ? getLocationBadge(event.location) : undefined

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
              nodeId: droneEffectiveNodeId,
              address: droneEffectiveNodeId ? addressMap.get(droneEffectiveNodeId) : undefined,
              // For launch/return: always use the physical lat/lng from event.location,
              // not coords from the delivery order node.
              lat: isDroneLaunchOrReturn ? (dronePhysicalNode?.lat ?? event.location?.lat) : (droneCoords?.lat ?? event.location?.lat),
              lng: isDroneLaunchOrReturn ? (dronePhysicalNode?.lng ?? event.location?.lng) : (droneCoords?.lng ?? event.location?.lng),
              stopGroup,
              stopGroupLabel,
              locationBadge: droneLBadge,
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

        // Insert "on truck" transit markers between sorties.
        // Between a drone_return and the next drone_launch there is a gap where the drone
        // is physically aboard the truck being driven to the next launch point.
        // Inserting a travel-type stop makes this visible in both the chart and list view.
        const transitInserts: GanttStop[] = []
        for (let ti = 0; ti < droneStops.length - 1; ti++) {
          const curr = droneStops[ti]
          const next = droneStops[ti + 1]
          if (curr.type === 'return' && next.type === 'launch') {
            const gapStart = curr.time + curr.duration
            const gapEnd = next.time
            if (gapEnd - gapStart > 30 && gapStart < truckRouteEndTime) { // only if gap is meaningful (> 30 s) and truck is still active
              transitInserts.push({
                id: `drone-transit-${droneNum}-${ti}`,
                type: 'travel',
                time: (gapStart + gapEnd) / 2, // midpoint of gap for icon placement
                duration: gapEnd - gapStart,
                label: 'On truck — transit to next launch',
                description: 'Drone is aboard the truck being driven to the next launch point',
                // Point toward the upcoming launch location so clicking highlights the right node
                nodeId: next.nodeId,
                address: next.address,
                lat: next.lat,
                lng: next.lng,
                cumulativeDistance: curr.cumulativeDistance, // drone distance doesn't advance on truck
                stopGroupLabel: 'On Truck',
              })
            }
          }
        }
        if (transitInserts.length > 0) {
          droneStops.push(...transitInserts)
          droneStops.sort((a, b) => a.time - b.time)
        }

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
    // tagging each stop with its source vehicle name and color.
    // Deduplication rules applied here (but NOT in individual vehicle rows):
    //   - Truck: omit 'launch' stops — the drone row already shows drone_launch at the same point.
    //            omit 'return' stops — the drone row already shows drone_return at the same point.
    //            Keep 'recover' (distinct: truck staging to catch drone) and all other truck stops.
    //   - Drone: omit 'On Truck' transit stops — the truck's travel segments cover the same period.
    const allStops: GanttStop[] = vehicles
      .filter((v) => v.type !== 'driver')
      .flatMap((v) => {
        if (v.type === 'truck') {
          // Exclude from the All row anything already represented by drone row stops:
          //   launch  → drone row has drone_launch at the same point
          //   return  → drone row has drone_return at the same point
          //   recover → truck row already shows "Drone Recovery Preparations"; showing it
          //             again in All duplicates it (same sortie, same time, same icon)
          // Keep: depot, delivery, charging, travel — these are truck-only events.
          return v.stops
            .filter((s) => s.type !== 'launch' && s.type !== 'return' && s.type !== 'recover')
            .map((s) => ({ ...s, vehicleName: v.name, vehicleColor: v.color }))
        }
        if (v.type === 'drone') {
          return v.stops
            .filter((s) => s.stopGroupLabel !== 'On Truck')
            .map((s) => ({ ...s, vehicleName: v.name, vehicleColor: v.color }))
        }
        return v.stops.map((s) => ({ ...s, vehicleName: v.name, vehicleColor: v.color }))
      })
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
 * Generate empty Gantt data for the fleet preview state (no route data).
 *
 * When `fleetTrucks` is provided AND has 2+ trucks, generates K placeholder
 * truck/driver/drone groups labeled by per-type display index — matching
 * the multi-truck Gantt layout (so users see the right shape before
 * generating). Falls back to the legacy single-truck preview otherwise.
 */
export function generateEmptyGanttData(
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only',
  droneCount: number,
  fleetTrucks?: { powerType: 'gas' | 'electric'; drones: number }[]
): GanttData {
  const vehicles: GanttVehicle[] = []

  vehicles.push({
    id: 'all',
    name: 'All',
    type: 'all',
    color: GANTT_COLORS.all,
    stops: [],
  })

  // Multi-truck preview: produce K (truck + driver + per-drone) groups.
  if (fleetTrucks && fleetTrucks.length > 1) {
    let elec = 0
    let gas = 0
    fleetTrucks.forEach((truck, truckIndex) => {
      const typeIndex = truck.powerType === 'electric' ? ++elec : ++gas
      const typeLabel = truck.powerType === 'electric' ? 'Electric Truck' : 'Gas Truck'
      const truckColor = getTruckRouteColor(truck.powerType, truckIndex)
      const groupId = truckIndex + 1
      const baseLabel = `${typeLabel} #${typeIndex}`

      vehicles.push({
        id: `truck-${truckIndex}`,
        name: `${baseLabel} Route`,
        type: 'truck',
        color: truckColor,
        stops: [],
        groupId,
      })
      vehicles.push({
        id: `truck-${truckIndex}-driver`,
        name: `${baseLabel} Driver`,
        type: 'driver',
        color: truckColor,
        stops: [],
        groupId,
      })
      for (let d = 1; d <= truck.drones; d++) {
        vehicles.push({
          id: `truck-${truckIndex}-drone-${d}`,
          name: `${baseLabel} Drone ${d}`,
          type: 'drone',
          color: getRouteDroneColor(truckColor, d - 1),
          stops: [],
          sortieNumber: d,
          groupId,
        })
      }
    })
    return {
      vehicles,
      totalDuration: 3600,
      startTime: new Date(),
    }
  }

  // Legacy single-truck preview path.
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
