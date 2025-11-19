/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'
import { Point } from '@/lib/types'

interface ArrowheadPolylineProps {
  positions: Point[]
  color?: string
  arrowSize?: number
  weight?: number // Line weight/thickness
  arrowRepeat?: string | number // How often arrows appear (e.g., '50px', 100, '10%')
  arrowOffset?: string | number // Starting offset for arrows
}

export default function ArrowheadPolyline({
  positions,
  color = 'blue',
  arrowSize = 10,
  weight = 3,
  arrowRepeat = '80px', // Default: arrow every 80 pixels
  arrowOffset = '50px' // Default: start 50px from beginning
}: ArrowheadPolylineProps) {
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

  useEffect(() => {
    if (!positions.length || !decoratorLoaded) return

    // Access the extended L object with decorator
    const L_extended = (window as any).L

    if (!L_extended?.polylineDecorator || !L_extended?.Symbol) {
      console.warn('Polyline decorator not available on window.L')
      return
    }

    const latlngs = positions.map(p => [p.lat, p.lng] as [number, number])
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
              pathOptions: {
                color,
                fillOpacity: 1,
                weight: 0
              },
            }),
          },
        ],
      }).addTo(map)
    } catch (err) {
      console.error('Error creating polyline decorator:', err)
    }

    return () => {
      try {
        if (polyline) map.removeLayer(polyline)
        if (decorator) map.removeLayer(decorator)
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }, [positions, color, arrowSize, weight, arrowRepeat, arrowOffset, map, decoratorLoaded])

  return null
}
