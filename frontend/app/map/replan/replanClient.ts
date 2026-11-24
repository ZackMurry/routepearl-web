/**
 * Client side of dynamic re-planning (POST /api/routes/replan).
 *
 * The backend re-plans each truck from the stop it is at now and returns
 * routes that START at that stop. This module
 *   1. builds the request from the routes currently on screen, and
 *   2. splices the executed part of the old routes (legs, stops, finished
 *      sorties) onto the new remaining routes, so the map shows the whole
 *      mission with the executed part greyed out.
 */
import {
  DisruptionInput,
  EnhancedRouteData,
  GeneratedDroneSortie,
  GeneratedTruckRoute,
  ReplanRecord,
  ReplanStrategy,
  ReplanTruckSummary,
  RoadClosure,
  RouteCost,
  RouteRequestNodes,
} from '@/lib/types'
import { apiUrl } from '@/lib/api'
import { ApiRouteResponse, normalizeTruckRoute } from '../routeData'

// ---------------------------------------------------------------------------
// Backend payload types
// ---------------------------------------------------------------------------

interface ApiPlannedSortie {
  drone_id: number
  launch: string
  customer: string
  recovery: string
}

interface ApiTruckPlan {
  truck_id: number
  truck_type: 'gas' | 'electric'
  stops: string[]
  sorties: ApiPlannedSortie[]
  drones: number[]
}

interface ApiReplanTruckMeta {
  truck_id: number
  reoptimized: boolean
  reasons: string[]
  strategy: string
  current_stop: string
  completed_customers: string[]
  remaining_customers: string[]
  reassigned_customers: string[]
  drones_available: number[]
  drones_lost: number[]
  repair_method: string
  initial_cost: RouteCost
  cost: RouteCost
  pareto_size: number
  rerouted_legs: number
  blocked_legs: string[][]
  alns_error: string | null
  runtime_s: number
}

interface ApiReplanResponse extends ApiRouteResponse {
  replan: {
    trucks: ApiReplanTruckMeta[]
    warnings: string[]
    next_plan: ApiTruckPlan[]
    next_progress: { truck_id: number; current_stop_index: number }[]
    runtime_s: number
  }
}

export interface ReplanInput {
  requestNodes: RouteRequestNodes
  routes: GeneratedTruckRoute[]
  // truckId -> index into that truck's stopIds of the stop it is at now
  // (it has delivered there; drones launching there have not left yet).
  progress: Record<number, number>
  // `${truckId}:${droneId}` -> minutes until an airborne drone lands
  minutesUntilLanding?: Record<string, number>
  disruptions: DisruptionInput[]
  closures: RoadClosure[]
  strategy: ReplanStrategy
  maxIterations?: number
}

export interface ReplanOutput {
  routes: EnhancedRouteData
  record: ReplanRecord
}

// ---------------------------------------------------------------------------
// Plan bookkeeping helpers (also used by the panel)
// ---------------------------------------------------------------------------

export function routeSupportsReplan(route: GeneratedTruckRoute): boolean {
  if (!route.stopIds || route.stopIds.length < 2) return false
  return route.droneSorties.every(s => s.launchId && s.customerId && s.recoveryId)
}

/** Drone ids this truck can still dispatch (1..n unless reduced by an earlier re-plan). */
export function dronesCarried(route: GeneratedTruckRoute, fallbackCount = 0): number[] {
  if (route.dronesCarried) return route.dronesCarried
  const fromSorties = route.droneSorties.map(s => s.droneId)
  const n = Math.max(route.dronesAllocated ?? 0, fallbackCount, ...fromSorties, 0)
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** Index of the first occurrence of `id` in `stops` at or after `from`. */
function indexFrom(stops: string[], id: string, from: number): number {
  for (let i = from; i < stops.length; i++) if (stops[i] === id) return i
  return -1
}

export interface SortiePosition {
  sortie: GeneratedDroneSortie
  launchIdx: number
  recoveryIdx: number
}

/** Launch / recovery stop positions of each sortie (the same rule the backend uses). */
export function sortiePositions(route: GeneratedTruckRoute): SortiePosition[] {
  const stops = route.stopIds ?? []
  return route.droneSorties.map(sortie => {
    const launchIdx = indexFrom(stops, sortie.launchId ?? '', 0)
    const recoveryIdx = indexFrom(stops, sortie.recoveryId ?? '', launchIdx + 1)
    return { sortie, launchIdx, recoveryIdx }
  })
}

/** Sorties airborne when the truck is at stop index `c` (launched before c, landing after c). */
export function inFlightAt(route: GeneratedTruckRoute, c: number): SortiePosition[] {
  return sortiePositions(route).filter(p => p.launchIdx < c && c < p.recoveryIdx)
}

function toApiPlan(route: GeneratedTruckRoute, fallbackDrones: number): ApiTruckPlan {
  return {
    truck_id: route.truckId,
    truck_type: route.truckType,
    stops: route.stopIds ?? [],
    sorties: route.droneSorties.map(s => ({
      drone_id: s.droneId,
      launch: s.launchId ?? '',
      customer: s.customerId ?? '',
      recovery: s.recoveryId ?? '',
    })),
    drones: dronesCarried(route, fallbackDrones),
  }
}

export function describeDisruption(d: DisruptionInput, closures: RoadClosure[], truckLabel: (id: number) => string): string {
  if (d.type === 'drone_unavailable') return `Drone ${d.droneId} on ${truckLabel(d.truckId)} unavailable`
  if (d.type === 'trucks_only') return 'Weather: trucks only (all drones grounded)'
  const c = closures.find(z => z.id === d.closureId)
  return c ? `Road blocked near ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} (${Math.round(c.radiusM)} m)` : 'Road blocked'
}

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export async function requestReplan(input: ReplanInput, fallbackDrones = 0): Promise<ApiReplanResponse> {
  const plan = input.routes.map(r => toApiPlan(r, fallbackDrones))
  const in_flight = input.routes.flatMap(route =>
    inFlightAt(route, input.progress[route.truckId] ?? 0).map(p => ({
      truck_id: route.truckId,
      drone_id: p.sortie.droneId,
      minutes_until_landing: Math.max(0, input.minutesUntilLanding?.[`${route.truckId}:${p.sortie.droneId}`] ?? 0),
    })),
  )
  // Lost drones and "trucks only" are carried forward in each plan's `drones`
  // list, so a chained re-plan only needs this round's disruptions. Road
  // closures stay in force, so every active closure is sent every time.
  const disruptions = [
    ...input.disruptions
      .filter(d => d.type !== 'road_blocked')
      .map(d =>
        d.type === 'drone_unavailable' ? { type: d.type, truck_id: d.truckId, drone_id: d.droneId } : { type: d.type },
      ),
    ...input.closures.map(c => ({ type: 'road_blocked', lat: c.lat, lon: c.lng, radius_m: c.radiusM })),
  ]
  const body = {
    ...input.requestNodes,
    plan,
    progress: input.routes.map(r => ({ truck_id: r.truckId, current_stop_index: input.progress[r.truckId] ?? 0 })),
    disruptions,
    in_flight,
    strategy: input.strategy,
    ...(input.maxIterations ? { max_iterations: input.maxIterations } : {}),
  }
  const res = await fetch(apiUrl('/api/routes/replan'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = await res.text()
    try {
      detail = JSON.parse(detail).detail ?? detail
    } catch {
      /* not JSON */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

const sortieKey = (droneId: number, launch: string, customer: string, recovery: string) =>
  `${droneId}|${launch}|${customer}|${recovery}`

/**
 * Splice old route (executed part, up to stop c) + new remaining route (starts at stop c).
 */
function mergeTruck(
  old: GeneratedTruckRoute,
  fresh: GeneratedTruckRoute,
  c: number,
  next: ApiTruckPlan | undefined,
): GeneratedTruckRoute {
  const oldLegs = old.truckLegs ?? []
  const legs = [...oldLegs.slice(0, c), ...(fresh.truckLegs ?? [])]
  const stopIds = next?.stops ?? [...(old.stopIds ?? []).slice(0, c), ...(fresh.stopIds ?? [])]
  const truckStops = [...old.truckStops.slice(0, c), ...fresh.truckStops]

  // Sorties that already finished or are airborne come from the old plan (they
  // keep their geometry); the new remaining sorties come from the response.
  const oldByKey = new Map<string, GeneratedDroneSortie>()
  old.droneSorties.forEach(s =>
    oldByKey.set(sortieKey(s.droneId, s.launchId ?? '', s.customerId ?? '', s.recoveryId ?? ''), s),
  )
  const freshKeys = new Set(
    fresh.droneSorties.map(s => sortieKey(s.droneId, s.launchId ?? '', s.customerId ?? '', s.recoveryId ?? '')),
  )
  const carried: GeneratedDroneSortie[] = []
  for (const s of next?.sorties ?? []) {
    const key = sortieKey(s.drone_id, s.launch, s.customer, s.recovery)
    if (freshKeys.has(key)) continue
    const prev = oldByKey.get(key)
    if (prev) carried.push(prev)
  }

  const all = [...carried, ...fresh.droneSorties]
  const droneSorties = all.map((s, i) => {
    const l = indexFrom(stopIds, s.launchId ?? '', 0)
    const r = indexFrom(stopIds, s.recoveryId ?? '', l + 1)
    const status: GeneratedDroneSortie['status'] = r >= 0 && r <= c ? 'done' : l >= 0 && l < c ? 'in_flight' : 'planned'
    return {
      ...s,
      routeId: `${old.routeId}-sortie-${i + 1}`,
      localSortieIndex: i,
      truckRouteId: old.routeId,
      status,
    }
  })

  return {
    ...old,
    truckRoute: legs.flat(),
    truckLegs: legs,
    truckStops,
    stopIds,
    droneSorties,
    droneRoutes: droneSorties.map(s => [s.launch, s.customer, s.recovery]),
    cost: fresh.cost ?? old.cost,
    dronesAllocated: next?.drones.length ?? fresh.dronesAllocated,
    dronesCarried: next?.drones ?? old.dronesCarried,
    executedStopIndex: c,
  }
}

const toSummary = (m: ApiReplanTruckMeta): ReplanTruckSummary => ({
  truckId: m.truck_id,
  reoptimized: m.reoptimized,
  reasons: m.reasons,
  strategy: m.strategy,
  currentStop: m.current_stop,
  completedCustomers: m.completed_customers,
  remainingCustomers: m.remaining_customers,
  reassignedCustomers: m.reassigned_customers,
  dronesAvailable: m.drones_available,
  dronesLost: m.drones_lost,
  repairMethod: m.repair_method,
  initialCost: m.initial_cost,
  cost: m.cost,
  paretoSize: m.pareto_size,
  reroutedLegs: m.rerouted_legs,
  blockedLegs: m.blocked_legs,
  alnsError: m.alns_error,
  runtimeS: m.runtime_s,
})

export function applyReplanResponse(
  previous: EnhancedRouteData,
  oldRoutes: GeneratedTruckRoute[],
  input: ReplanInput,
  response: ApiReplanResponse,
  disruptionLabels: string[],
): ReplanOutput {
  const freshTrucks = response.routes?.trucks ?? []
  let sortieOffset = 0
  const merged = oldRoutes.map(old => {
    const apiTruck = freshTrucks.find(t => t.truck_id === old.truckId)
    if (!apiTruck) return old
    const fresh = normalizeTruckRoute(apiTruck, old.truckId, old.truckType, 0)
    const next = response.replan.next_plan.find(p => p.truck_id === old.truckId)
    const out = mergeTruck(old, fresh, input.progress[old.truckId] ?? 0, next)
    out.droneSorties = out.droneSorties.map((s, i) => ({ ...s, sortieIndex: sortieOffset + i + 1 }))
    sortieOffset += out.droneSorties.length
    return out
  })

  const record: ReplanRecord = {
    at: new Date().toISOString(),
    disruptions: disruptionLabels,
    trucks: response.replan.trucks.map(toSummary),
    warnings: response.replan.warnings,
    runtimeS: response.replan.runtime_s,
    costAfter: response.routes?.cost,
  }

  return {
    routes: {
      ...previous,
      truckRoute: merged.flatMap(r => r.truckRoute),
      droneRoutes: merged.flatMap(r => r.droneRoutes),
      truckStops: merged.flatMap(r => r.truckStops),
      generatedTruckRoutes: merged,
      cost: response.routes?.cost ?? previous.cost,
      isMultiTruck: merged.length > 1,
      replanHistory: [...(previous.replanHistory ?? []), record],
      generatedAt: new Date().toISOString(),
      computedOnBackend: true,
    },
    record,
  }
}
