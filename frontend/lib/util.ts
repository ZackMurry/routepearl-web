import { FlightNode, Point } from './types'

export function getOrDefault<T>(map: { [key: string]: T }, key?: string, defaultKey = 'default'): T {
  if (key in map) {
    return map[key]
  }
  return map[defaultKey]
}

// Helper function: Check if a point matches a node (within 0.0001 degrees ~11m)
export const pointMatchesNode = (point: Point, node: FlightNode): boolean => {
  const latDiff = Math.abs(point.lat - node.lat)
  const lngDiff = Math.abs(point.lng - node.lng)
  return latDiff < 0.0001 && lngDiff < 0.0001
}
