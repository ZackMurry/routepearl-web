/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMap, CircleMarker, Polyline } from 'react-leaflet'

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
  startPaddingPx?: number // space to leave before endpoint
  dashUnderArrowPadPx?: number // extra space so dashes don't reach arrow
  debugGuidePoints?: boolean
  debugGuideMaxPoints?: number
  debugGuidePointRadius?: number
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

function trimByPx(map: L.Map, latlngs: L.LatLng[], paddingPx: number, isEnd: boolean): L.LatLng[] {
  if (latlngs.length < 2) return latlngs
  if (paddingPx <= 0) return latlngs

  // Work in forward direction; reverse if trimming from start
  const arr = isEnd ? latlngs : [...latlngs].reverse()
  const pts = arr.map(ll => map.latLngToLayerPoint(ll))

  // Total length in px
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += pts[i].distanceTo(pts[i - 1])
  }

  const target = total - paddingPx
  if (target <= 0) {
    // Nothing meaningful remains
    const single = arr[0]
    return isEnd ? [single] : [single]
  }

  let acc = 0
  const out: L.LatLng[] = [arr[0]]

  for (let i = 1; i < pts.length; i++) {
    const segLen = pts[i].distanceTo(pts[i - 1])

    if (acc + segLen >= target) {
      const remain = target - acc
      const t = segLen === 0 ? 0 : remain / segLen

      const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t
      const y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t

      out.push(map.layerPointToLatLng(new L.Point(x, y)))
      break
    }

    acc += segLen
    out.push(arr[i])
  }

  // Restore original order if we reversed
  return isEnd ? out : out.reverse()
}

function downsampleByCount<T>(arr: T[], count: number): T[] {
  if (arr.length <= 2) return arr
  const n = Math.max(2, Math.floor(count))
  if (arr.length <= n) return arr

  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const idx = Math.round(t * (arr.length - 1))
    out.push(arr[idx])
  }

  // De-dupe adjacent duplicates (can happen due to rounding)
  const dedup: T[] = [out[0]]
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== dedup[dedup.length - 1]) dedup.push(out[i])
  }
  return dedup
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

  endPaddingPx = 10,
  startPaddingPx = 12,
  dashUnderArrowPadPx = 12,
  debugGuidePoints = false,
  debugGuideMaxPoints = 200,
  debugGuidePointRadius = 3,
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
    // map.on('moveend', bump) // optional; include if panning changes your desired pixel-based curvature/trim

    return () => {
      map.off('zoomend', bump)
      // map.off('moveend', bump)
    }
  }, [map])

  const { outbound, inbound, outboundLabelPos, inboundLabelPos } = useMemo(() => {
    const [A, B, C] = sortie
    const A_ll = L.latLng(A.lat, A.lng)
    const B_ll = L.latLng(B.lat, B.lng)
    const C_ll = L.latLng(C.lat, C.lng)

    const sOut = outsideTriangleSign(map, A, B, C)
    const sIn = outsideTriangleSign(map, B, C, A)

    const outFull = buildArcLatLngs(map, A_ll, B_ll, curvature, sOut)
    const inFull = buildArcLatLngs(map, B_ll, C_ll, curvature, sIn)

    // 1) Trim start (isEnd = false)
    const outBase = trimByPx(map, outFull, startPaddingPx, false)
    const inBase = trimByPx(map, inFull, startPaddingPx, false)

    // 2) Trim end for arrow + dash spacing (isEnd = true)
    const extra = dashed ? dashUnderArrowPadPx : 0

    const outStroke = trimByPx(map, outBase, endPaddingPx + extra, true)
    const inStroke = trimByPx(map, inBase, endPaddingPx + extra, true)

    const outGuideFull = trimByPx(map, outBase, endPaddingPx, true)
    const inGuideFull = trimByPx(map, inBase, endPaddingPx, true)

    const outGuide = downsampleByCount(outGuideFull, 10)
    const inGuide = downsampleByCount(inGuideFull, 10)

    return {
      outbound: { stroke: outStroke, guide: outGuide },
      inbound: { stroke: inStroke, guide: inGuide },
      outboundLabelPos: outboundLabel ? pickLabelLatLng(outGuide, labelT) : null,
      inboundLabelPos: inboundLabel ? pickLabelLatLng(inGuide, labelT) : null,
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    sortie,
    curvature,
    dashed,
    endPaddingPx,
    dashUnderArrowPadPx,
    outboundLabel,
    inboundLabel,
    labelT,
    viewKey, // re-calculate when user changes the zoom
  ])

  useEffect(() => {
    if (!decoratorLoaded) return
    if (outbound.guide.length < 3 && inbound.guide.length < 2) return

    const L_extended = (window as any).L
    if (!L_extended?.polylineDecorator || !L_extended?.Symbol) {
      console.warn('Polyline decorator not available on window.L')
      return
    }

    const layers: L.Layer[] = []

    const addLeg = (leg: { stroke: L.LatLng[]; guide: L.LatLng[] }, color: string) => {
      if (leg.guide.length < 2) return

      // 1) Visible stroke (dashed) ends earlier
      if (leg.stroke.length >= 2) {
        const strokeLine = L.polyline(leg.stroke, {
          color,
          weight,
          dashArray: dashed ? dashArray ?? '8 8' : undefined,
          dashOffset,
        }).addTo(map)
        layers.push(strokeLine)
      }

      // 2) Invisible guide line ends later; arrow sits at its end
      const guideLine = L.polyline(leg.guide, {
        opacity: 0,
        weight: 0,
        interactive: false,
      }).addTo(map)
      layers.push(guideLine)

      try {
        // @ts-ignore
        const decorator = L_extended.polylineDecorator(guideLine, {
          patterns: [
            {
              offset: '100%',
              repeat: 0,
              // @ts-ignore
              symbol: L_extended.Symbol.arrowHead({
                pixelSize: arrowSize,
                polygon: true,
                pathOptions: {
                  color: '#000', // Black border
                  weight: 2, // Border thickness
                  fill: true,
                  fillColor: '#ffffff', // White fill
                  fillOpacity: 1.0,
                  opacity: 1,
                },
              }),
            },
          ],
        }).addTo(map)
        layers.push(decorator)
      } catch (err) {
        console.error('Error creating polyline decorator:', err)
      }
    }

    addLeg(outbound, outboundColor)
    addLeg(inbound, inboundColor)

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
    outbound,
    inbound,
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
      {debugGuidePoints && (
        <>
          {/* Optional: show the guide path itself */}
          <Polyline positions={outbound.guide} pathOptions={{ weight: 1, opacity: 0.8 }} />
          <Polyline positions={inbound.guide} pathOptions={{ weight: 1, opacity: 0.8 }} />

          {/* Show guide vertices */}
          {outbound.guide.slice(0, debugGuideMaxPoints).map((ll, i) => (
            <CircleMarker key={`dbg-out-${i}`} center={ll} radius={debugGuidePointRadius} pathOptions={{ opacity: 1 }} />
          ))}

          {inbound.guide.slice(0, debugGuideMaxPoints).map((ll, i) => (
            <CircleMarker key={`dbg-in-${i}`} center={ll} radius={debugGuidePointRadius} pathOptions={{ opacity: 1 }} />
          ))}
        </>
      )}
    </>
  )
}
