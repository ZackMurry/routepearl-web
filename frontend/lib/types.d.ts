declare module 'react-leaflet-arrowheads'

export type Point = { lat: number; lng: number }

// Flight Planner Types
export type NodeType = 'depot' | 'customer' | 'station' | 'waypoint' | 'hazard'

export interface FlightNode extends Point {
  id: string
  type: NodeType
  label?: string
  action?: string
  priority?: number
  radius?: number // For hazard nodes (meters)
  severity?: 'low' | 'medium' | 'high' // For hazard nodes
  description?: string // For hazard nodes
}

export type RoutingAlgorithm = 'alns' | 'custom'

export interface HazardZone {
  id: string
  center: Point
  radius: number
  severity: 'low' | 'medium' | 'high'
  description?: string
}

export interface MissionConfig {
  // High-level parameters
  missionName: string
  missionGoal: string
  estimatedDuration?: number // Display-only, computed from backend

  // Mid-level parameters
  nodes: FlightNode[]

  // Low-level parameters
  algorithm: RoutingAlgorithm
  hazardZones: HazardZone[]

  // Generated routes (from optimization algorithm)
  routes?: {
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
