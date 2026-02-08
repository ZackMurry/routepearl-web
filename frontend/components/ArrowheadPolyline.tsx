/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'
import { Point } from '@/lib/types'

interface ArrowheadPolylineProps {
  positions: Point[]
  color?: string
  arrowColor?: string // Separate color for arrowheads (defaults to line color)
  arrowSize?: number
  weight?: number // Line weight/thickness
  opacity?: number // Line opacity (0-1)
  arrowRepeat?: string | number // How often arrows appear (e.g., '50px', 100, '10%')
  arrowOffset?: string | number // Starting offset for arrows
  dashArray?: string // Dash pattern (e.g., '10, 10' for dotted lines)
  offset?: number // Pixel offset to the right of travel direction (0 = centered)
}

/**
 * Offset a polyline to the right of its travel direction by `px` pixels.
 * Uses map.project/unproject so the visual offset stays constant across zoom levels.
 */
function offsetPositions(positions: Point[], px: number, map: L.Map): [number, number][] {
  if (px === 0 || positions.length < 2) {
    return positions.map(p => [p.lat, p.lng])
  }

  const zoom = map.getZoom()
  const projected = positions.map(p => map.project([p.lat, p.lng], zoom))

  const result: L.Point[] = []

  for (let i = 0; i < projected.length; i++) {
    // Compute the perpendicular offset direction at each vertex
    // by averaging the normals of adjacent segments
    let nx = 0
    let ny = 0
    let count = 0

    // Normal from segment before this point
    if (i > 0) {
      const dx = projected[i].x - projected[i - 1].x
      const dy = projected[i].y - projected[i - 1].y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        // Right-hand perpendicular: (dy, -dx) in screen coords (y down)
        nx += dy / len
        ny += -dx / len
        count++
      }
    }

    // Normal from segment after this point
    if (i < projected.length - 1) {
      const dx = projected[i + 1].x - projected[i].x
      const dy = projected[i + 1].y - projected[i].y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        nx += dy / len
        ny += -dx / len
        count++
      }
    }

    if (count > 0) {
      nx /= count
      ny /= count
      // Normalize the averaged normal
      const nlen = Math.sqrt(nx * nx + ny * ny)
      if (nlen > 0) {
        nx /= nlen
        ny /= nlen
      }
    }

    result.push(L.point(projected[i].x + nx * px, projected[i].y + ny * px))
  }

  return result.map(pt => {
    const ll = map.unproject(pt, zoom)
    return [ll.lat, ll.lng] as [number, number]
  })
}

export default function ArrowheadPolyline({
  positions,
  color = 'blue',
  arrowColor, // Defaults to line color if not specified
  arrowSize = 10,
  weight = 3,
  opacity = 1,
  arrowRepeat = '80px', // Default: arrow every 80 pixels
  arrowOffset = '50px', // Default: start 50px from beginning
  dashArray, // e.g., '10, 5' for dashed/dotted lines
  offset = 0, // Pixel offset to the right of travel direction
}: ArrowheadPolylineProps) {
  const effectiveArrowColor = arrowColor || color
  const map = useMap()
  const [decoratorLoaded, setDecoratorLoaded] = useState(false)

  // Load the polyline decorator library
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet-polylinedecorator')
        .then(() => {
          setDecoratorLoaded(true)
        })
        .catch(err => {
          console.error('Failed to load leaflet-polylinedecorator:', err)
        })
    }
  }, [])

  // Track zoom to recompute offset
  const [zoomKey, setZoomKey] = useState(0)
  useEffect(() => {
    if (offset === 0) return
    const onZoom = () => setZoomKey(k => k + 1)
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [map, offset])

  const buildLayers = useCallback(() => {
    if (!positions.length || !decoratorLoaded) return null

    const L_extended = (window as any).L
    if (!L_extended?.polylineDecorator || !L_extended?.Symbol) return null

    const latlngs = offset !== 0
      ? offsetPositions(positions, offset, map)
      : positions.map(p => [p.lat, p.lng] as [number, number])

    const polyline = L.polyline(latlngs, { color, weight, opacity, dashArray }).addTo(map)

    let decorator: any = null
    try {
      decorator = L_extended.polylineDecorator(polyline, {
        patterns: [
          {
            offset: arrowOffset,
            repeat: arrowRepeat,
            symbol: L_extended.Symbol.arrowHead({
              pixelSize: arrowSize,
              headAngle: 40,
              polygon: true,
              pathOptions: {
                color: '#000',
                weight: 2,
                fill: true,
                fillColor: '#ffffff',
                fillOpacity: 1.0,
                opacity: 1,
              },
            }),
          },
        ],
      }).addTo(map)
    } catch (err) {
      console.error('Error creating polyline decorator:', err)
    }

    return { polyline, decorator }
  }, [positions, color, arrowColor, effectiveArrowColor, arrowSize, weight, opacity, arrowRepeat, arrowOffset, dashArray, map, decoratorLoaded, offset, zoomKey])

  useEffect(() => {
    const layers = buildLayers()
    if (!layers) return

    return () => {
      try {
        if (layers.polyline) map.removeLayer(layers.polyline)
        if (layers.decorator) map.removeLayer(layers.decorator)
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }, [buildLayers, map])

  return null
}
