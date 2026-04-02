// Gantt Chart Type Definitions

// Stop type enum
export type GanttStopType = 'depot' | 'delivery' | 'launch' | 'return' | 'charging' | 'travel'

// Vehicle type
export type GanttVehicleType = 'all' | 'truck' | 'drone' | 'driver'

// Axis mode for toggling between duration and distance
export type GanttAxisMode = 'duration' | 'distance'

// Location display mode
export type GanttLocationMode = 'street' | 'coordinates'

// Individual stop on the Gantt chart
export interface GanttStop {
  id: string
  type: GanttStopType
  time: number // Time in seconds from mission start
  duration: number // Duration at this stop in seconds
  label: string
  description?: string
  orderName?: string
  orderId?: number // Map marker order ID (displayed number)
  sortieNumber?: number
  distance?: number // Distance of this segment in meters
  cumulativeDistance?: number // Cumulative distance from mission start in meters
  address?: string // Street address of the stop location
  lat?: number // Latitude of the stop
  lng?: number // Longitude of the stop
  nodeId?: string // Original MissionSite node ID for map selection
  pixelOffset?: number // Horizontal pixel nudge for overlapping stops in the "All" row
  vehicleName?: string // Source vehicle name (set on "All" row stops)
  vehicleColor?: string // Source vehicle color (set on "All" row stops)
  stopGroup?: number // Physical stop group index (0 = Start, 1 = Stop 1, etc.)
  stopGroupLabel?: string // Display label for the stop group (e.g. "Start", "Stop 1")
}

// Vehicle row data
export interface GanttVehicle {
  id: string
  name: string
  type: GanttVehicleType
  color: string
  stops: GanttStop[]
  sortieNumber?: number // For drones, which sortie they represent
  groupId?: number // Links truck+driver pairs (1, 2, 3...)
}

// Gantt chart data
export interface GanttData {
  vehicles: GanttVehicle[]
  totalDuration: number // Serialized timeline duration in seconds (for axis scaling)
  wallClockDuration?: number // Wall-clock mission duration in seconds (for display)
  totalDistance?: number // Total mission distance in meters
  startTime: Date
}

// Gantt chart state
export type GanttChartState = 'no-plan' | 'empty-fleet' | 'loaded'

// Color constants - matching route colors from SortieFlightPath.tsx
export const GANTT_COLORS = {
  all: '#4b5563', // gray-600 for combined "All" row
  truck: '#1e3a8a', // Dark blue for truck
  driver: '#065f46', // Dark green (emerald-800) for driver instructions
  sortieColors: [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#ef4444', // red
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#d946ef', // magenta
  ],
  // Stop type colors
  depot: '#374151', // gray-700
  delivery: '#3b82f6', // blue
  launch: '#f97316', // orange
  return: '#10b981', // green
  charging: '#eab308', // yellow
  travel: '#9ca3af', // gray-400
} as const

// Get color for a drone based on sortie number
export function getDroneColor(sortieNumber: number): string {
  const index = (sortieNumber - 1) % GANTT_COLORS.sortieColors.length
  return GANTT_COLORS.sortieColors[index]
}

// Get color for a stop type
export function getStopColor(type: GanttStopType): string {
  return GANTT_COLORS[type] || GANTT_COLORS.delivery
}

// Format time in seconds to HH:MM:SS or MM:SS
export function formatGanttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format coordinates as a compact string
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Get display location based on mode: street address or coordinates (with fallback)
export function getStopLocation(stop: GanttStop, mode: GanttLocationMode): string | undefined {
  if (mode === 'coordinates') {
    if (stop.lat != null && stop.lng != null) return formatCoordinates(stop.lat, stop.lng)
    return stop.address || undefined
  }
  // street mode: prefer address, fall back to coordinates with note
  if (stop.address) return stop.address
  if (stop.lat != null && stop.lng != null) return `${formatCoordinates(stop.lat, stop.lng)} — Street address not available`
  return undefined
}

// Format distance in meters to human readable (e.g. "500 m", "1.2 km")
export function formatGanttDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}
