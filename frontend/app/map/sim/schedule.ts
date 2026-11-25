/**
 * Simple mission simulation: turns a planned route into a timetable so the
 * map can animate the truck and drones, and so a disruption injected at time
 * t can be translated into "where is everybody now" for the re-planner.
 *
 * Model (kept deliberately simple, for visualisation):
 *  - Truck drives each road leg at TRUCK_KMH, spends TRUCK_SERVICE_S at each
 *    order it delivers, and waits at a stop until every drone landing there
 *    has arrived.
 *  - A drone leaves when the truck DEPARTS its launch stop (so while the truck
 *    is parked at stop c, sorties launching at c have not left yet - the same
 *    rule the backend uses), flies its path at DRONE_KMH and hovers
 *    DRONE_SERVICE_S at the customer.
 */
import { GeneratedTruckRoute, Point } from '@/lib/types'
import { sortiePositions } from '../replan/replanClient'

export const TRUCK_KMH = 40
export const DRONE_KMH = 60
export const TRUCK_SERVICE_S = 120
export const DRONE_SERVICE_S = 60

const R = 6371000
const distM = (a: Point, b: Point) => {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

interface Path {
  pts: Point[]
  cum: number[] // cumulative metres
  total: number
}

const makePath = (pts: Point[]): Path => {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distM(pts[i - 1], pts[i]))
  return { pts, cum, total: cum[cum.length - 1] ?? 0 }
}

const pointAt = (p: Path, metres: number): Point => {
  if (p.pts.length === 0) return { lat: 0, lng: 0 }
  if (metres <= 0 || p.total === 0) return p.pts[0]
  if (metres >= p.total) return p.pts[p.pts.length - 1]
  let i = 1
  while (i < p.cum.length && p.cum[i] < metres) i++
  const seg = p.cum[i] - p.cum[i - 1] || 1
  const f = (metres - p.cum[i - 1]) / seg
  const a = p.pts[i - 1]
  const b = p.pts[i]
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }
}

export interface SortieTiming {
  droneId: number
  launchIdx: number
  recoveryIdx: number
  launchT: number
  atCustomerT: number
  leaveCustomerT: number
  landT: number
  outbound: Path
  inbound: Path
  customerId?: string
}

export interface TruckSchedule {
  truckId: number
  arrive: number[] // per stop, seconds from mission start
  depart: number[]
  legs: Path[]
  sorties: SortieTiming[]
  endT: number
}

export function buildSchedule(route: GeneratedTruckRoute): TruckSchedule {
  const stops = route.stopIds ?? []
  const n = stops.length
  const legs: Path[] = (route.truckLegs && route.truckLegs.length === n - 1
    ? route.truckLegs
    : route.truckStops.slice(1).map((p, i) => [route.truckStops[i], p])
  ).map(makePath)

  const positions = sortiePositions(route)
  const sorties: SortieTiming[] = positions
    .filter(p => p.launchIdx >= 0 && p.recoveryIdx > p.launchIdx)
    .map(p => {
      const s = p.sortie
      const path = s.path && s.path.length >= 2 ? s.path : [s.launch, s.customer, s.recovery]
      const ci = s.customerIdx !== undefined && s.customerIdx > 0 && s.customerIdx < path.length ? s.customerIdx : 1
      return {
        droneId: s.droneId,
        launchIdx: p.launchIdx,
        recoveryIdx: p.recoveryIdx,
        launchT: 0,
        atCustomerT: 0,
        leaveCustomerT: 0,
        landT: 0,
        outbound: makePath(path.slice(0, ci + 1)),
        inbound: makePath(path.slice(ci)),
        customerId: s.customerId,
      }
    })

  const truckMps = (TRUCK_KMH * 1000) / 3600
  const droneMps = (DRONE_KMH * 1000) / 3600
  const arrive: number[] = new Array(n).fill(0)
  const depart: number[] = new Array(n).fill(0)
  const customerStop = (i: number) => i > 0 && i < n - 1

  for (let i = 0; i < n; i++) {
    arrive[i] = i === 0 ? 0 : depart[i - 1] + (legs[i - 1]?.total ?? 0) / truckMps
    let d = arrive[i] + (customerStop(i) ? TRUCK_SERVICE_S : 0)
    for (const s of sorties) if (s.recoveryIdx === i) d = Math.max(d, s.landT)
    depart[i] = d
    // Drones launching here leave when the truck departs.
    for (const s of sorties) {
      if (s.launchIdx !== i) continue
      s.launchT = depart[i]
      s.atCustomerT = s.launchT + s.outbound.total / droneMps
      s.leaveCustomerT = s.atCustomerT + DRONE_SERVICE_S
      s.landT = s.leaveCustomerT + s.inbound.total / droneMps
    }
  }
  // Recovery waits were computed with landT before launches at later stops were
  // known only for earlier launches, which is always the case (launch < recovery).
  return { truckId: route.truckId, arrive, depart, legs, sorties, endT: depart[n - 1] ?? 0 }
}

const stopPoint = (s: TruckSchedule, i: number): Point | null => {
  if (i < s.legs.length) return s.legs[i].pts[0] ?? null
  const prev = s.legs[i - 1]
  return prev ? prev.pts[prev.pts.length - 1] : null
}

export function truckPositionAt(s: TruckSchedule, t: number): Point | null {
  const n = s.arrive.length
  if (n === 0) return null
  for (let i = 0; i < n; i++) {
    if (i > 0 && t < s.arrive[i]) {
      // driving leg i-1 -> i
      const leg = s.legs[i - 1]
      const span = s.arrive[i] - s.depart[i - 1] || 1
      return pointAt(leg, ((t - s.depart[i - 1]) / span) * leg.total)
    }
    if (t <= s.depart[i]) return stopPoint(s, i) // parked at stop i
  }
  return stopPoint(s, n - 1)
}

export interface DroneState {
  droneId: number
  pos: Point
  phase: 'outbound' | 'delivering' | 'inbound'
  landsInS: number
  customerId?: string
}

export function airborneDronesAt(s: TruckSchedule, t: number): DroneState[] {
  const out: DroneState[] = []
  for (const so of s.sorties) {
    if (t < so.launchT || t >= so.landT) continue
    if (t < so.atCustomerT) {
      const f = (t - so.launchT) / (so.atCustomerT - so.launchT || 1)
      out.push({ droneId: so.droneId, pos: pointAt(so.outbound, f * so.outbound.total), phase: 'outbound', landsInS: so.landT - t, customerId: so.customerId })
    } else if (t < so.leaveCustomerT) {
      out.push({ droneId: so.droneId, pos: so.outbound.pts[so.outbound.pts.length - 1], phase: 'delivering', landsInS: so.landT - t, customerId: so.customerId })
    } else {
      const f = (t - so.leaveCustomerT) / (so.landT - so.leaveCustomerT || 1)
      out.push({ droneId: so.droneId, pos: pointAt(so.inbound, f * so.inbound.total), phase: 'inbound', landsInS: so.landT - t, customerId: so.customerId })
    }
  }
  return out
}

/**
 * Stop index to report to the re-planner at time t: the stop the truck is
 * parked at, or - while driving - the stop it is driving to (it will finish
 * the leg). Returns null when the truck is on its way back to the depot or done.
 */
export function currentStopAt(s: TruckSchedule, t: number, executed = 0): number | null {
  const n = s.arrive.length
  let c = 0
  for (let i = 0; i < n; i++) {
    if (t >= s.arrive[i]) c = t <= s.depart[i] ? i : i + 1
  }
  c = Math.max(c, executed)
  return c >= n - 1 ? null : c
}

/** Minutes until each airborne drone lands, keyed `${truckId}:${droneId}`. */
export function landingMinutesAt(s: TruckSchedule, t: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of airborneDronesAt(s, t)) out[`${s.truckId}:${d.droneId}`] = Math.max(0, d.landsInS / 60)
  return out
}

/** Customers delivered by time t (truck stops departed + drones that left the customer). */
export function deliveredBy(s: TruckSchedule, stopIds: string[], t: number): Set<string> {
  const done = new Set<string>()
  for (let i = 1; i < stopIds.length - 1; i++) if (t >= s.arrive[i] + TRUCK_SERVICE_S) done.add(stopIds[i])
  for (const so of s.sorties) if (so.customerId && t >= so.leaveCustomerT) done.add(so.customerId)
  return done
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`
}
