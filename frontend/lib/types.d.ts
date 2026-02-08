export type Point = { lat: number; lng: number }

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

export type RoutingAlgorithm = 'alns' | 'custom'

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

  // Backend-computed timing data (optional - may be absent for legacy data)
  timing?: RouteTiming

  // Metadata
  generatedAt: string // ISO timestamp
  algorithmVersion?: string
  computedOnBackend: boolean
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
  routes?: EnhancedRouteData | {
    truckRoute: Point[]
    droneRoutes: Point[][]
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
