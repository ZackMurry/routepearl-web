// Gantt Chart Type Definitions

// Stop type enum
export type GanttStopType = 'depot' | 'delivery' | 'launch' | 'return' | 'charging' | 'travel'

// Vehicle type
export type GanttVehicleType = 'truck' | 'drone'

// Individual stop on the Gantt chart
export interface GanttStop {
  id: string
  type: GanttStopType
  time: number // Time in seconds from mission start
  duration: number // Duration at this stop in seconds
  label: string
  description?: string
  customerName?: string
  sortieNumber?: number
  distance?: number // Distance of this segment in meters
}

// Vehicle row data
export interface GanttVehicle {
  id: string
  name: string
  type: GanttVehicleType
  color: string
  stops: GanttStop[]
  sortieNumber?: number // For drones, which sortie they represent
}

// Gantt chart data
export interface GanttData {
  vehicles: GanttVehicle[]
  totalDuration: number // Total mission duration in seconds
  startTime: Date
}

// Gantt chart state
export type GanttChartState = 'no-plan' | 'empty-fleet' | 'loaded'

// Color constants - matching route colors from SortieFlightPath.tsx
export const GANTT_COLORS = {
  truck: '#000000', // Black for truck
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
