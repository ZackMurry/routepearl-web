/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'
import { Point } from '@/lib/types'
import TextMarker from './TextMarker'

interface SortieArcPathsProps {
  /** Always 3 points: [A, B, C] */
  sortie: [Point, Point, Point]

  outboundColor?: string
  inboundColor?: string

  weight?: number
  curvature?: number

  arrowSize?: number
  arrowRepeat?: string | number
  arrowOffset?: string | number

  dashed?: boolean
  dashArray?: string
  dashOffset?: string

  outboundLabel?: string
  inboundLabel?: string

  /** 0..1 position along each arc for label placement */
  labelT?: number

  /** Optional style override for TextMarker */
  labelStyle?: React.CSSProperties
  endPaddingPx?: number // space to leave before endpoint
}

function quadBezier(p0: L.Point, p1: L.Point, p2: L.Point, t: number): L.Point {
  const u = 1 - t
  const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x
  const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  return new L.Point(x, y)
}

/**
 * Choose sign so the curve bulges to the opposite side of `ref` (outside triangle).
 * For segment start->end:
 * - sign=+1 bulges to the "left" of direction (because ux=-dy/dist, uy=dx/dist)
 * - If ref is on the left (cross>0), outside is right => sign=-1
 */
function outsideTriangleSign(map: L.Map, start: Point, end: Point, ref: Point): 1 | -1 {
  const p0 = map.latLngToLayerPoint(L.latLng(start.lat, start.lng))
  const p1 = map.latLngToLayerPoint(L.latLng(end.lat, end.lng))
  const pr = map.latLngToLayerPoint(L.latLng(ref.lat, ref.lng))

  const vx = p1.x - p0.x
  const vy = p1.y - p0.y
  const wx = pr.x - p0.x
  const wy = pr.y - p0.y

  const cross = vx * wy - vy * wx
  return cross > 0 ? -1 : 1
}

function buildArcLatLngs(map: L.Map, start: L.LatLng, end: L.LatLng, curvature: number, sign: 1 | -1): L.LatLng[] {
  const p0 = map.latLngToLayerPoint(start)
  const p2 = map.latLngToLayerPoint(end)

  const dx = p2.x - p0.x
  const dy = p2.y - p0.y
  const dist = Math.hypot(dx, dy)

  if (!isFinite(dist) || dist < 2) return [start, end]

  const mid = new L.Point((p0.x + p2.x) / 2, (p0.y + p2.y) / 2)

  // "Left" unit normal
  const ux = -dy / dist
  const uy = dx / dist

  const offset = dist * curvature * sign
  const p1 = new L.Point(mid.x + ux * offset, mid.y + uy * offset)

  const samples = Math.max(16, Math.min(96, Math.round(dist / 10)))
  const latlngs: L.LatLng[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = quadBezier(p0, p1, p2, t)
    latlngs.push(map.layerPointToLatLng(pt))
  }
  return latlngs
}

function pickLabelLatLng(latlngs: L.LatLng[], t: number): L.LatLng | null {
  if (latlngs.length < 2) return null
  const tt = Math.max(0, Math.min(1, t))
  const idx = Math.min(latlngs.length - 1, Math.max(0, Math.round(tt * (latlngs.length - 1))))
  return latlngs[idx]
}

function trimEndByPx(map: L.Map, latlngs: L.LatLng[], endPaddingPx: number): L.LatLng[] {
  if (latlngs.length < 2) return latlngs
  if (endPaddingPx <= 0) return latlngs

  const pts = latlngs.map(ll => map.latLngToLayerPoint(ll))

  // total length in px
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += pts[i].distanceTo(pts[i - 1])
  }

  const target = total - endPaddingPx
  if (target <= 0) return [latlngs[0]] // too short; nothing meaningful to draw

  // walk until we reach target, then interpolate final point
  let acc = 0
  const out: L.LatLng[] = [latlngs[0]]

  for (let i = 1; i < pts.length; i++) {
    const segLen = pts[i].distanceTo(pts[i - 1])
    if (acc + segLen >= target) {
      const remain = target - acc
      const t = segLen === 0 ? 0 : remain / segLen

      const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t
      const y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t

      out.push(map.layerPointToLatLng(new L.Point(x, y)))
      return out
    }

    acc += segLen
    out.push(latlngs[i])
  }

  return out
}

function trimToFraction(map: L.Map, latlngs: L.LatLng[], fraction: number): L.LatLng[] {
  if (latlngs.length < 2) return latlngs
  const f = Math.max(0, Math.min(1, fraction))

  const pts = latlngs.map(ll => map.latLngToLayerPoint(ll))

  let total = 0
  for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1])
  const target = total * f
  if (target <= 0) return [latlngs[0]]

  let acc = 0
  const out: L.LatLng[] = [latlngs[0]]

  for (let i = 1; i < pts.length; i++) {
    const segLen = pts[i].distanceTo(pts[i - 1])
    if (acc + segLen >= target) {
      const remain = target - acc
      const t = segLen === 0 ? 0 : remain / segLen
      const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t
      const y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
      out.push(map.layerPointToLatLng(new L.Point(x, y)))
      return out
    }
    acc += segLen
    out.push(latlngs[i])
  }

  return out
}

export default function SortieArcPaths({
  sortie,

  outboundColor = '#10b981',
  inboundColor = '#f97316',

  weight = 4,
  curvature = 0.22,

  arrowSize = 12,
  arrowRepeat = 0,
  arrowOffset = '100%',

  dashed = false,
  dashArray,
  dashOffset,

  outboundLabel,
  inboundLabel,
  labelT = 0.65,
  labelStyle,

  endPaddingPx = 8,
}: SortieArcPathsProps) {
  const map = useMap()
  const [decoratorLoaded, setDecoratorLoaded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      import('leaflet-polylinedecorator')
        .then(() => setDecoratorLoaded(true))
        .catch(err => console.error('Failed to load leaflet-polylinedecorator:', err))
    }
  }, [])

  const [viewKey, setViewKey] = useState(0)

  useEffect(() => {
    const bump = () => setViewKey(k => k + 1)

    map.on('zoomend', bump)
    map.on('moveend', bump) // optional; include if panning changes your desired pixel-based curvature/trim

    return () => {
      map.off('zoomend', bump)
      map.off('moveend', bump)
    }
  }, [map])

  const { outboundLatLngs, inboundLatLngs, outboundLabelPos, inboundLabelPos } = useMemo(() => {
    const [A, B, C] = sortie

    const A_ll = L.latLng(A.lat, A.lng)
    const B_ll = L.latLng(B.lat, B.lng)
    const C_ll = L.latLng(C.lat, C.lng)

    const sOut = outsideTriangleSign(map, A, B, C) // AB away from C
    const sIn = outsideTriangleSign(map, B, C, A) // BC away from A

    const outRaw = buildArcLatLngs(map, A_ll, B_ll, curvature, sOut)
    const inRaw = buildArcLatLngs(map, B_ll, C_ll, curvature, sIn)

    const out = trimEndByPx(map, outRaw, endPaddingPx)
    const inbd = trimEndByPx(map, inRaw, endPaddingPx)

    return {
      outboundLatLngs: out,
      inboundLatLngs: inbd,
      outboundLabelPos: outboundLabel ? pickLabelLatLng(out, labelT) : null,
      inboundLabelPos: inboundLabel ? pickLabelLatLng(inbd, labelT) : null,
    }
  }, [map, sortie, curvature, outboundLabel, inboundLabel, labelT, endPaddingPx, viewKey])

  useEffect(() => {
    if (!decoratorLoaded) return
    if (outboundLatLngs.length < 2 && inboundLatLngs.length < 2) return

    const L_extended = (window as any).L
    if (!L_extended?.polylineDecorator || !L_extended?.Symbol) {
      console.warn('Polyline decorator not available on window.L')
      return
    }

    const layers: L.Layer[] = []

    const addLeg = (latlngs: L.LatLng[], color: string) => {
      if (latlngs.length < 2) return

      const polyline = L.polyline(latlngs, {
        color,
        weight,
        dashArray: dashed ? dashArray ?? '8 8' : undefined,
        dashOffset,
      }).addTo(map)
      layers.push(polyline)

      try {
        // @ts-ignore
        const decorator = L_extended.polylineDecorator(polyline, {
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
        layers.push(decorator)
      } catch (err) {
        console.error('Error creating polyline decorator:', err)
      }
    }

    addLeg(outboundLatLngs, outboundColor)
    addLeg(inboundLatLngs, inboundColor)

    return () => {
      for (const layer of layers) {
        try {
          map.removeLayer(layer)
        } catch {
          // ignore
        }
      }
    }
  }, [
    map,
    decoratorLoaded,
    outboundLatLngs,
    inboundLatLngs,
    outboundColor,
    inboundColor,
    weight,
    dashed,
    dashArray,
    dashOffset,
    arrowOffset,
    arrowRepeat,
    arrowSize,
  ])

  const defaultLabelStyle: React.CSSProperties = {
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
  }

  return (
    <>
      {outboundLabel && outboundLabelPos && (
        <TextMarker
          key={`sortie-label-outbound-${outboundLabel}`}
          position={[outboundLabelPos.lat, outboundLabelPos.lng]}
          text={outboundLabel}
          style={{ ...defaultLabelStyle, ...labelStyle }}
        />
      )}

      {inboundLabel && inboundLabelPos && (
        <TextMarker
          key={`sortie-label-inbound-${inboundLabel}`}
          position={[inboundLabelPos.lat, inboundLabelPos.lng]}
          text={inboundLabel}
          style={{ ...defaultLabelStyle, ...labelStyle }}
        />
      )}
    </>
  )
}
