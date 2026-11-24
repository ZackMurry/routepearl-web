export type Point = { lat: number; lng: number }
export type TruckPowerType = 'gas' | 'electric'

// Flight Planner Types
export type NodeType = 'depot' | 'order' | 'station' | 'waypoint' | 'hazard'

export interface MissionSite extends Point {
  id: string
  type: NodeType
  label?: string
  action?: string
  priority?: number
  radius?: number // For hazard nodes (meters)
  severity?: 'low' | 'medium' | 'high' // For hazard nodes
  description?: string // For hazard nodes
  orderId?: number // For order nodes - auto-assigned, reused when deleted (displayed as Order ID)
  siteId?: number // For non-order nodes - auto-assigned, reused when deleted
  address?: string // Cached reverse-geocoded street address
}

export type RoutingAlgorithm = 'negar' | 'negar_multi' | 'custom' | 'least_time' | 'least_risk' | 'fstsp'

export interface HazardZone {
  id: string
  center: Point
  radius: number
  severity: 'low' | 'medium' | 'high'
  description?: string
}

// ============================================================================
// Route Timing Types (for backend-computed timing data)
// ============================================================================

/**
 * Timing data for a travel segment between two nodes
 */
export interface RouteTimingSegment {
  segmentIndex: number
  fromNodeId: string
  toNodeId: string
  travelTimeMinutes: number
  distanceKm: number
}

/**
 * Timing data for a truck stop at a node
 */
export interface TruckNodeTiming {
  nodeId: string
  nodeType: 'depot' | 'order' | 'station' | 'waypoint'
  arrivalTimeMinutes: number // Minutes from mission start
  departureTimeMinutes: number // Minutes from mission start
  serviceTimeMinutes: number // Time spent at node
  chargingTimeMinutes?: number // If charging station
  waitingTimeMinutes?: number // If waiting for drone
  segmentFromPrevious?: RouteTimingSegment
}

/**
 * Timing data for a drone sortie (launch -> order -> recovery)
 */
export interface DroneSortieTiming {
  sortieNumber: number
  droneId: number
  launchNodeId: string
  orderNodeId: string
  recoveryNodeId: string
  departureFromLaunchMinutes: number
  arrivalAtOrderMinutes: number
  serviceAtOrderMinutes: number
  departureFromOrderMinutes: number
  arrivalAtRecoveryMinutes: number
  totalSortieDurationMinutes: number
  launchToOrderDistanceKm: number
  orderToRecoveryDistanceKm: number
}

/**
 * Complete timing data for a route, as computed by the backend algorithm
 */
export interface RouteTiming {
  totalCompletionTimeMinutes: number
  totalCompletionTimeFormatted: string // e.g., "1h 45m"
  truckTotalDistanceKm: number
  droneTotalDistanceKm: number
  totalDistanceKm: number
  truckNodes: TruckNodeTiming[]
  droneSorties: DroneSortieTiming[]
  parameters: {
    droneSpeedKmh: number
    truckSpeedKmh: number
    serviceTimeMinutes: number
    chargingSetupTimeMinutes: number
  }
}

/**
 * Enhanced route data structure that includes timing information
 * Used for saving/loading missions with full timing data
 */
export interface EnhancedRouteData {
  // Core route geometry
  truckRoute: Point[]
  droneRoutes: Point[][]

  // Original (un-snapped) truck stop coordinates for reliable delivery matching
  truckStops?: Point[]

  // Normalized per-truck route data for multi-truck responses
  generatedTruckRoutes?: GeneratedTruckRoute[]
  cost?: RouteCost
  isMultiTruck?: boolean

  // Backend-computed timing data (optional - may be absent for legacy data)
  timing?: RouteTiming

  // Re-planning: the request the plan was generated from, and the history of re-plans applied to it.
  requestNodes?: RouteRequestNodes
  replanHistory?: ReplanRecord[]

  // Metadata
  generatedAt: string // ISO timestamp
  algorithmVersion?: string
  computedOnBackend: boolean
}

export interface RouteCost {
  time: number
  risk: number
}

export interface GeneratedDroneSortie {
  routeId: string
  vehicleId: string
  truckRouteId: string
  truckId: number
  truckType: TruckPowerType
  sortieIndex: number
  localSortieIndex: number
  droneId: number
  launch: Point
  customer: Point
  recovery: Point
  customerIdx?: number
  path: Point[]
  // Mission-site ids of the launch / customer / recovery stops (from the
  // backend's *_id fields). Needed to send the plan back for re-planning.
  launchId?: string
  customerId?: string
  recoveryId?: string
  // Execution status after a re-plan. Undefined = planned (not started).
  status?: SortieStatus
}

export type SortieStatus = 'done' | 'in_flight' | 'planned'

export interface GeneratedTruckRoute {
  routeId: string
  truckId: number
  truckType: TruckPowerType
  truckRoute: Point[]
  truckStops: Point[]
  droneRoutes: Point[][]
  droneSorties: GeneratedDroneSortie[]
  // Per-truck cost from the backend's per-cluster optimizer output.
  // Drives Mission Control's per-truck ETA / risk chips (design doc MC1).
  cost?: RouteCost
  // Drones the optimizer was allowed to use on this truck (per the user's
  // electric_drones / gas_drones config). Compared against droneSorties to
  // detect over-allocation — surfaced as "Not deployed" badges on idle drones.
  dronesAllocated?: number
  syncPoints?: {
    truck_route?: number[][]
    drone_route?: number[][]
  }
  // --- Re-planning support ---
  // Mission-site ids of the truck stops in visiting order (depot first and last).
  stopIds?: string[]
  // Road geometry per leg (truckLegs[i] runs from stop i to stop i+1).
  truckLegs?: Point[][]
  // Drone ids this truck can still dispatch (1-based; shrinks when a drone is lost).
  dronesCarried?: number[]
  // Index (into stopIds) of the stop the truck had reached at the last re-plan.
  // Legs before it and stops up to it are already executed. 0 / undefined = not started.
  executedStopIndex?: number
}

export interface RoadClosure {
  id: string
  lat: number
  lng: number
  radiusM: number
}

export type ReplanStrategy = 'warm_start' | 'from_scratch' | 'repair_only'

export type DisruptionInput =
  | { type: 'drone_unavailable'; truckId: number; droneId: number }
  | { type: 'trucks_only' }
  | { type: 'road_blocked'; closureId: string }

export interface ReplanTruckSummary {
  truckId: number
  reoptimized: boolean
  reasons: string[]
  strategy: string
  currentStop: string
  completedCustomers: string[]
  remainingCustomers: string[]
  reassignedCustomers: string[]
  dronesAvailable: number[]
  dronesLost: number[]
  repairMethod: string
  initialCost: RouteCost
  cost: RouteCost
  paretoSize: number
  reroutedLegs: number
  blockedLegs: string[][]
  alnsError: string | null
  runtimeS: number
}

export interface ReplanRecord {
  at: string // ISO timestamp
  disruptions: string[] // human-readable descriptions
  trucks: ReplanTruckSummary[]
  warnings: string[]
  runtimeS: number
  costAfter?: RouteCost // cost of the remaining plan (from the current stops to the depot)
}

/** The /generate request body, kept so re-plans use exactly the same node set. */
export interface RouteRequestNodes {
  depots: { id: string; lat: number; lon: number }[]
  customers: { id: string; lat: number; lon: number }[]
  stations: { id: string; lat: number; lon: number }[]
  hazards: { id: string; lat: number; lon: number; radius: number }[]
  provider: 'OSRM-Online' | 'pgRouting'
  risk_tolerance?: number
}

export interface MissionConfig {
  // High-level parameters
  missionName: string
  missionGoal: string
  estimatedDuration?: number // Display-only, computed from backend

  // Mid-level parameters
  nodes: MissionSite[]

  // Low-level parameters
  algorithm: RoutingAlgorithm
  hazardZones: HazardZone[]

  // Generated routes (from optimization algorithm)
  // Uses EnhancedRouteData for full timing support, or legacy format for backwards compatibility
  routes?:
    | EnhancedRouteData
    | {
        truckRoute: Point[]
        droneRoutes: Point[][]
        truckStops?: Point[]
        generatedTruckRoutes?: GeneratedTruckRoute[]
        cost?: RouteCost
        isMultiTruck?: boolean
      }
}

export type MissionStatus = 'idle' | 'planning' | 'ready' | 'active' | 'paused' | 'completed' | 'failed'

export interface Mission {
  id: string
  config: MissionConfig
  status: MissionStatus
  createdAt: Date
  updatedAt: Date
}
