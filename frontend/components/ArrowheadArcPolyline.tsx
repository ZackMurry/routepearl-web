/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'
import { Point } from '@/lib/types'
import TextMarker from './TextMarker'

interface ArrowheadArcPolylineProps {
  positions: Point[] // expected: [start, end]
  color?: string
  arrowSize?: number
  weight?: number
  arrowRepeat?: string | number
  arrowOffset?: string | number

  /**
   * Curvature as a fraction of the segment length in screen-space.
   * Typical: 0.15 - 0.35
   */
  curvature?: number

  /**
   * If true, alternates arc direction (+/-) using `arcDirectionSeed`
   * so outbound/inbound don’t overlap perfectly.
   */
  alternateDirection?: boolean
  arcDirectionSeed?: number // e.g. segment index
  label?: string
}

function quadBezier(p0: L.Point, p1: L.Point, p2: L.Point, t: number): L.Point {
  const u = 1 - t
  const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x
  const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  return new L.Point(x, y)
}

function buildArcLatLngs(map: L.Map, start: L.LatLng, end: L.LatLng, curvature: number, directionSign: 1 | -1): L.LatLng[] {
  const p0 = map.latLngToLayerPoint(start)
  const p2 = map.latLngToLayerPoint(end)

  const dx = p2.x - p0.x
  const dy = p2.y - p0.y
  const dist = Math.hypot(dx, dy)

  // Degenerate / very short segment: return straight.
  if (!isFinite(dist) || dist < 2) return [start, end]

  // Midpoint + perpendicular offset determines the control point.
  const mid = new L.Point((p0.x + p2.x) / 2, (p0.y + p2.y) / 2)

  // Perpendicular unit vector
  const ux = -dy / dist
  const uy = dx / dist

  // Offset proportional to distance (screen-space)
  const offset = dist * curvature * directionSign
  const p1 = new L.Point(mid.x + ux * offset, mid.y + uy * offset)

  // Sample count scales with distance; clamp to sane bounds.
  const samples = Math.max(16, Math.min(96, Math.round(dist / 10)))
  const latlngs: L.LatLng[] = []

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = quadBezier(p0, p1, p2, t)
    latlngs.push(map.layerPointToLatLng(pt))
  }

  return latlngs
}

function pairKey(a: Point, b: Point) {
  // stable ordering so A<->B is same key regardless of direction
  const aKey = `${a.lat.toFixed(6)},${a.lng.toFixed(6)}`
  const bKey = `${b.lat.toFixed(6)},${b.lng.toFixed(6)}`
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
}

function hashSign(s: string): 1 | -1 {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619
  return (h >>> 0) % 2 === 0 ? 1 : -1
}

export default function ArrowheadArcPolyline({
  positions,
  color = 'blue',
  arrowSize = 10,
  weight = 3,
  arrowRepeat = '80px',
  arrowOffset = '50px',
  curvature = 0.25,
  label,
}: ArrowheadArcPolylineProps) {
  const map = useMap()
  const [decoratorLoaded, setDecoratorLoaded] = useState(false)

  // Load the polyline decorator library
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore next-line
      import('leaflet-polylinedecorator')
        .then(() => setDecoratorLoaded(true))
        .catch(err => console.error('Failed to load leaflet-polylinedecorator:', err))
    }
  }, [])

  const latlngs = useMemo(() => {
    if (positions.length < 2) return []

    const start = L.latLng(positions[0].lat, positions[0].lng)
    const end = L.latLng(positions[1].lat, positions[1].lng)

    // Flip direction to reduce overlap if desired.
    const base = hashSign(pairKey(positions[0], positions[1]))
    const forward =
      positions[0].lat < positions[1].lat || (positions[0].lat === positions[1].lat && positions[0].lng <= positions[1].lng)

    const sign: 1 | -1 = forward ? base : base === 1 ? -1 : 1

    return buildArcLatLngs(map, start, end, curvature, sign)
  }, [map, positions, curvature])

  const labelLatLng = useMemo(() => {
    if (!label || latlngs.length < 2) return null

    // Place it closer to the arrow end; tweak 0.55–0.8 as desired.
    const t = 0.65
    const idx = Math.min(latlngs.length - 1, Math.max(0, Math.round(t * (latlngs.length - 1))))
    return latlngs[idx]
  }, [label, latlngs])

  useEffect(() => {
    if (latlngs.length < 2 || !decoratorLoaded) return

    const L_extended = (window as any).L
    if (!L_extended?.polylineDecorator || !L_extended?.Symbol) {
      console.warn('Polyline decorator not available on window.L')
      return
    }

    const polyline = L.polyline(latlngs, { color, weight }).addTo(map)

    let decorator: any = null
    try {
      // @ts-ignore
      decorator = L_extended.polylineDecorator(polyline, {
        patterns: [
          {
            offset: arrowOffset,
            repeat: arrowRepeat,
            // @ts-ignore
            symbol: L_extended.Symbol.arrowHead({
              pixelSize: arrowSize,
              polygon: true,
              pathOptions: { color, fillOpacity: 1, weight: 0 },
            }),
          },
        ],
      }).addTo(map)
    } catch (err) {
      console.error('Error creating polyline decorator:', err)
    }

    return () => {
      try {
        map.removeLayer(polyline)
        if (decorator) map.removeLayer(decorator)
      } catch {
        // ignore
      }
    }
  }, [map, latlngs, color, weight, arrowSize, arrowRepeat, arrowOffset, decoratorLoaded])

  if (positions.length < 2 || !label || !labelLatLng) return null
  return (
    <TextMarker
      key={`sortie-label-${label}`}
      position={[labelLatLng.lat, labelLatLng.lng]}
      text={label}
      style={{
        backgroundColor: '#facc15',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '2px solid white',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        minWidth: '30px',
        textAlign: 'center',
        display: 'inline-block',
      }}
    />
  )
}
