import chroma from 'chroma-js'
import { EnhancedRouteData, GeneratedDroneSortie, GeneratedTruckRoute, Point, RouteCost, TruckPowerType } from '@/lib/types'

type ApiCoord = [number, number]

interface ApiDroneSortie {
  drone_id?: number
  launch?: ApiCoord
  customer?: ApiCoord
  recovery?: ApiCoord
  customer_idx?: number
  path?: ApiCoord[]
}

interface ApiTruckRouteEntry {
  truck_id?: number
  truck_type?: TruckPowerType
  truck_route?: ApiCoord[][]
  truck_stops?: ApiCoord[]
  drone_route?: ApiCoord[][]
  drone_sorties?: ApiDroneSortie[]
  sync_points?: {
    truck_route?: number[][]
    drone_route?: number[][]
  }
}

interface ApiRoutesPayload {
  truck_route?: ApiCoord[][]
  truck_stops?: ApiCoord[]
  drone_route?: ApiCoord[][]
  drone_sorties?: ApiDroneSortie[]
  sync_points?: {
    truck_route?: number[][]
    drone_route?: number[][]
  }
  trucks?: ApiTruckRouteEntry[]
  cost?: RouteCost
}

interface ApiRouteResponse {
  routes?: ApiRoutesPayload
}

// Hue-coherent palettes per truck type. Gas reads warm-amber, electric reads
// green; the chroma scale keeps a strong lightness gap between adjacent entries
// so two trucks of the same type are always visibly distinct.
const GAS_BASE = '#b45309'
const ELECTRIC_BASE = '#10b981'

function buildPalette(base: string, n: number): string[] {
  const size = Math.max(n, 4)
  return chroma
    .scale([chroma(base).darken(1.2), chroma(base).brighten(1.2)])
    .mode('hsl')
    .colors(size)
}

// Cached palettes for common K values; regenerated on demand for larger fleets.
const GAS_TRUCK_COLORS = buildPalette(GAS_BASE, 4)
const ELECTRIC_TRUCK_COLORS = buildPalette(ELECTRIC_BASE, 4)

const toPoint = (coord: ApiCoord): Point => ({ lat: coord[0], lng: coord[1] })

const flattenTruckRoute = (segments?: ApiCoord[][]): Point[] =>
  Array.isArray(segments) ? segments.flatMap(segment => segment.map(toPoint)) : []

const toDronePath = (entry: ApiCoord[]): Point[] => entry.map(toPoint)

const buildDroneSorties = (
  source: ApiTruckRouteEntry,
  truckRouteId: string,
  truckId: number,
  truckType: TruckPowerType,
  globalSortieOffset: number,
): { droneRoutes: Point[][]; droneSorties: GeneratedDroneSortie[] } => {
  const explicitSorties = Array.isArray(source.drone_sorties) ? source.drone_sorties : []
  const fallbackRoutes = Array.isArray(source.drone_route) ? source.drone_route : []

  if (explicitSorties.length > 0) {
    const droneSorties: GeneratedDroneSortie[] = []

    explicitSorties.forEach((sortie, localSortieIndex) => {
      if (!sortie.launch || !sortie.customer || !sortie.recovery) {
        return
      }

      const sortieIndex = globalSortieOffset + localSortieIndex + 1
      const droneId = sortie.drone_id ?? 1

      droneSorties.push({
        routeId: `${truckRouteId}-sortie-${localSortieIndex + 1}`,
        vehicleId: `${truckRouteId}-drone-${droneId}`,
        truckRouteId,
        truckId,
        truckType,
        sortieIndex,
        localSortieIndex,
        droneId,
        launch: toPoint(sortie.launch),
        customer: toPoint(sortie.customer),
        recovery: toPoint(sortie.recovery),
        customerIdx: sortie.customer_idx,
        path:
          Array.isArray(sortie.path) && sortie.path.length > 0
            ? sortie.path.map(toPoint)
            : [toPoint(sortie.launch), toPoint(sortie.customer), toPoint(sortie.recovery)],
      })
    })

    return {
      droneRoutes: droneSorties.map(sortie => [sortie.launch, sortie.customer, sortie.recovery]),
      droneSorties,
    }
  }

  const droneSorties: GeneratedDroneSortie[] = []

  fallbackRoutes.forEach((route, localSortieIndex) => {
    if (!Array.isArray(route) || route.length < 3) {
      return
    }

    const sortieIndex = globalSortieOffset + localSortieIndex + 1
    const launch = toPoint(route[0])
    const customer = toPoint(route[1])
    const recovery = toPoint(route[2])

    droneSorties.push({
      routeId: `${truckRouteId}-sortie-${localSortieIndex + 1}`,
      vehicleId: `${truckRouteId}-drone-1`,
      truckRouteId,
      truckId,
      truckType,
      sortieIndex,
      localSortieIndex,
      droneId: 1,
      launch,
      customer,
      recovery,
      path: route.map(toPoint),
    })
  })

  return {
    droneRoutes: fallbackRoutes.map(toDronePath),
    droneSorties,
  }
}

const normalizeTruckRoute = (
  source: ApiTruckRouteEntry,
  fallbackTruckId: number,
  fallbackTruckType: TruckPowerType,
  globalSortieOffset: number,
): GeneratedTruckRoute => {
  const truckId = source.truck_id ?? fallbackTruckId
  const truckType = source.truck_type ?? fallbackTruckType
  const routeId = `truck-${truckId}`
  const truckRoute = flattenTruckRoute(source.truck_route)
  const truckStops = Array.isArray(source.truck_stops) ? source.truck_stops.map(toPoint) : []
  const { droneRoutes, droneSorties } = buildDroneSorties(source, routeId, truckId, truckType, globalSortieOffset)

  return {
    routeId,
    truckId,
    truckType,
    truckRoute,
    truckStops,
    droneRoutes,
    droneSorties,
    syncPoints: source.sync_points,
  }
}

export function normalizeRouteResponse(
  data: ApiRouteResponse,
  fallbackTruckType: TruckPowerType = 'gas',
): EnhancedRouteData {
  const routes = data?.routes ?? {}
  let sortieOffset = 0

  const generatedTruckRoutes = Array.isArray(routes.trucks) && routes.trucks.length > 0
    ? routes.trucks.map((truck, index) => {
        const normalized = normalizeTruckRoute(truck, index, fallbackTruckType, sortieOffset)
        sortieOffset += normalized.droneSorties.length
        return normalized
      })
    : [
        normalizeTruckRoute(
          {
            truck_id: 0,
            truck_type: fallbackTruckType,
            truck_route: routes.truck_route,
            truck_stops: routes.truck_stops,
            drone_route: routes.drone_route,
            drone_sorties: routes.drone_sorties,
            sync_points: routes.sync_points,
          },
          0,
          fallbackTruckType,
          0,
        ),
      ]

  const truckRoute = generatedTruckRoutes.flatMap(route => route.truckRoute)
  const droneRoutes = generatedTruckRoutes.flatMap(route => route.droneRoutes)
  const truckStops = generatedTruckRoutes.flatMap(route => route.truckStops)

  return {
    truckRoute,
    droneRoutes,
    truckStops,
    generatedTruckRoutes,
    cost: routes.cost,
    isMultiTruck: generatedTruckRoutes.length > 1,
    generatedAt: new Date().toISOString(),
    computedOnBackend: true,
  }
}

export function getGeneratedTruckRoutes(routeData?: EnhancedRouteData | MissionLegacyRoutes): GeneratedTruckRoute[] {
  if (!routeData) {
    return []
  }

  if (Array.isArray(routeData.generatedTruckRoutes) && routeData.generatedTruckRoutes.length > 0) {
    return routeData.generatedTruckRoutes
  }

  const truckRoute = Array.isArray(routeData.truckRoute) ? routeData.truckRoute : []
  const droneRoutes = Array.isArray(routeData.droneRoutes) ? routeData.droneRoutes : []
  const truckStops = Array.isArray(routeData.truckStops) ? routeData.truckStops : []

  if (truckRoute.length === 0 && droneRoutes.length === 0) {
    return []
  }

  return [
    {
      routeId: 'truck-0',
      truckId: 0,
      truckType: 'gas',
      truckRoute,
      truckStops,
      droneRoutes,
      droneSorties: droneRoutes
        .filter(sortie => sortie.length >= 3)
        .map((sortie, index) => ({
          routeId: `truck-0-sortie-${index + 1}`,
          vehicleId: 'truck-0-drone-1',
          truckRouteId: 'truck-0',
          truckId: 0,
          truckType: 'gas',
          sortieIndex: index + 1,
          localSortieIndex: index,
          droneId: 1,
          launch: sortie[0],
          customer: sortie[1],
          recovery: sortie[2],
          path: sortie,
        })),
    },
  ]
}

interface MissionLegacyRoutes {
  truckRoute: Point[]
  droneRoutes: Point[][]
  truckStops?: Point[]
  generatedTruckRoutes?: GeneratedTruckRoute[]
}

export function getTruckRouteColor(truckType: TruckPowerType, truckId: number): string {
  const palette = truckType === 'electric' ? ELECTRIC_TRUCK_COLORS : GAS_TRUCK_COLORS
  return palette[Math.abs(truckId) % palette.length]
}

// Sortie color is derived from the parent truck's color so each sortie reads
// as a child of its truck. Lighter shade per local sortie index keeps multiple
// sorties from one truck visually distinct without breaking the family.
export function getDroneColor(truckColor: string, localSortieIndex: number): string {
  return chroma(truckColor)
    .brighten(0.4 + (localSortieIndex % 4) * 0.3)
    .hex()
}

export function estimatePolylineDistance(points: Point[]): number {
  if (points.length < 2) {
    return 0
  }

  let distance = 0

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const toRad = (degrees: number) => (degrees * Math.PI) / 180
    const earthRadiusMeters = 6371000
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const haversine =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

    distance += 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  }

  return distance
}
