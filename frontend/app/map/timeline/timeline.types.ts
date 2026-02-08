import { Point, MissionSite } from '@/lib/types'

// Event type discriminators
export type DroneEventType = 'drone_launch' | 'drone_delivery' | 'drone_return'
export type TruckEventType =
  | 'truck_depart'
  | 'truck_travel'        // Aggregated travel segment (replaces individual waypoints)
  | 'truck_delivery'
  | 'truck_drone_launch'  // Truck stops to launch drone
  | 'truck_drone_recover' // Truck stops to recover drone
  | 'truck_charging'      // Truck stops at charging station
  | 'truck_return'
export type TimelineEventType = DroneEventType | TruckEventType

// Vehicle type
export type VehicleType = 'drone' | 'truck'

// Event status
export type EventStatus = 'pending' | 'in_progress' | 'completed'

// Timeline view filter
export type TimelineViewFilter = 'all' | 'drones' | 'trucks'

// Main timeline event interface
export interface TimelineEvent {
  id: string
  type: TimelineEventType
  vehicle: VehicleType
  sortieNumber?: number // For drone events (1-indexed)
  waypointIndex?: number // For truck events (0-indexed)
  location: Point
  label: string
  description?: string
  estimatedDuration: number // Duration of this segment in seconds
  cumulativeTime: number // Total time from mission start in seconds
  status: EventStatus
  orderName?: string // For delivery events
  distance?: number // Distance of this segment in meters
}

// Timeline summary statistics
export interface TimelineSummary {
  totalEvents: number
  completedEvents: number
  droneEvents: number
  truckEvents: number
  totalDuration: number // Total mission duration in seconds
  totalDistance: number // Total distance in meters
  droneDistance: number // Drone-only distance in meters
  truckDistance: number // Truck-only distance in meters
  deliveryCount: number // Number of deliveries
  droneDeliveries: number
  truckDeliveries: number
}

// Configuration for timeline generation
// Parameters aligned with backend algorithm (truck-drone-time-risk-optimization)
export interface TimelineConfig {
  droneSpeedKmh: number // Backend: 60 (alpha_kmh)
  truckSpeedKmh: number // Backend: 40 (truck_speed_kmh)
  droneLoadTimeSeconds: number // Time to load drone before launch
  droneUnloadTimeSeconds: number // Service time at order - Backend: S = 0.10 hr = 6 min
  truckDeliveryTimeSeconds: number // Service time at order - Backend: S = 0.10 hr = 6 min
}

// Default configuration - aligned with backend parameters
// Source: truck-drone-time-risk-optimization/config.yml
export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  droneSpeedKmh: 60, // Backend: vehicle.alpha_kmh = 60
  truckSpeedKmh: 40, // Backend: vehicle.truck_speed_kmh = 40
  droneLoadTimeSeconds: 30, // Reasonable estimate for drone prep
  droneUnloadTimeSeconds: 360, // Backend: service.S = 0.10 hr = 6 min = 360s
  truckDeliveryTimeSeconds: 360, // Backend: service.S = 0.10 hr = 6 min = 360s
}

// Data source indicator for timeline results
export type TimelineDataSource = 'backend' | 'frontend_estimate'

// Result interface for timeline generation
export interface TimelineResult {
  events: TimelineEvent[]
  summary: TimelineSummary
  dataSource: TimelineDataSource
}

// Format seconds to human readable duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Format meters to human readable distance
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}
