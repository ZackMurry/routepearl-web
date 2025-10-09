'use client'

// Haversine distance in meters
function distance(a: Point, b: Point): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// brute force permutations
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  const result: T[][] = []
  arr.forEach((item, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permute(rest)) {
      result.push([item, ...p])
    }
  })
  return result
}

import React, { useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import LucideMarker from './LucideMarker'
import { Button } from '@radix-ui/themes'
import { Point } from '@/lib/types'
import { Heading1, Heading2 } from 'lucide-react'
import TextMarker from '@/components/TextMarker'
import chroma from 'chroma-js'

export default function MapWithWaypoints() {
  const [waypoints, setWaypoints] = useState<Point[]>([])
  const [truckRoute, setTruckRoute] = useState<Point[]>([])
  const [droneRoutes, setDroneRoutes] = useState<Point[][]>([])

  function ClickHandler() {
    useMapEvents({
      click(e) {
        setWaypoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }])
      },
    })
    return null
  }

  const removeWaypoint = (index: number) => setWaypoints(prev => prev.filter((_, i) => i !== index))

  const generateRoute = async () => {
    // your API call code stays the same
    if (waypoints.length < 2) {
      setTruckRoute([])
      setDroneRoutes([])
      return
    }

    const depots = [waypoints[0]]
    const customers = waypoints.slice(1)
    const stations: Point[] = []

    try {
      const res = await fetch('http://localhost:8000/api/routes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depots: depots.map((p, i) => ({ id: `Depot ${i}`, lat: p.lat, lon: p.lng })),
          customers: customers.map((p, i) => ({ id: `Customer ${i + 1}`, lat: p.lat, lon: p.lng })),
          stations: stations.map((p, i) => ({ id: `Station ${i + 1}`, lat: p.lat, lon: p.lng })),
        }),
      })

      if (!res.ok) {
        console.error('Backend error', await res.text())
        return
      }

      const data = await res.json()

      // --- Truck route ---
      if (data.routes.truck_route) {
        // Flatten all inner paths into a single sequence of points
        const truckPoints: Point[] = data.routes.truck_route.flatMap((segment: number[][]) =>
          segment.map(([lat, lon]) => ({ lat, lng: lon })),
        )
        setTruckRoute(truckPoints)
        console.log('Truck route:', truckPoints)
      } else {
        setTruckRoute([])
      }

      // --- Drone route ---
      if (data.routes.drone_route) {
        // data.routes.drone_route is now [[lat, lon], ...]
        // For consistency, store as an array of one array of points
        const dronePaths = []
        const toLatLon = (coord: number[]): Point => ({ lat: coord[0], lng: coord[1] })
        for (const dp of data.routes.drone_route) {
          dronePaths.push([toLatLon(dp[0]), toLatLon(dp[1]), toLatLon(dp[2])])
        }
        setDroneRoutes(dronePaths)
        console.log('Drone route:', dronePaths)
      } else {
        setDroneRoutes([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer
        style={{ height: '100%', width: '100%' }}
        center={[38.9452, -92.3288]}
        zoom={17}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          subdomains='abcd'
        />

        <ClickHandler />

        {waypoints.map((pos, i) => (
          <LucideMarker key={i} position={[pos.lat, pos.lng]} anchor={[0.25, 1]} onRightClick={() => removeWaypoint(i)} />
        ))}

        {/* Truck route */}
        {/* {truckRoute.length > 1 && (
          <>
            <Polyline positions={truckRoute.map(p => [p.lat, p.lng])} color='blue' />
            {truckRoute.map((pt, i) => (
              <TextMarker key={i} position={[pt.lat, pt.lng]} text={`${i}`} />
            ))}
          </>
        )} */}

        {/* Drone routes */}
        {/* {droneRoutes.map((destinations, i) => (
          <React.Fragment key={`fragment-${i}`}>
            <Polyline key={`polyline-${i}`} positions={destinations.map(p => [p.lat, p.lng])} color='red' />
          </React.Fragment>
        ))}
        {droneRoutes
          .reduce((acc, sortie) => [...acc, ...sortie], [])
          .map((pt, idx) => (
            <TextMarker key={idx} position={[pt.lat, pt.lng]} text={`${idx}`} />
          ))} */}

        {truckRoute.length > 1 && (
          <>
            {truckRoute.map((pt, i) => {
              const next = truckRoute[i + 1]
              if (!next) return null
              // Gradient from blue (start) to lightblue (end)
              const color = chroma
                .scale(['blue', 'purple'])(i / (truckRoute.length - 1))
                .hex()
              return (
                <Polyline
                  key={i}
                  positions={[
                    [pt.lat, pt.lng],
                    [next.lat, next.lng],
                  ]}
                  color={color}
                  weight={3}
                />
              )
            })}
            {truckRoute.map((pt, i) => (
              <TextMarker key={i} position={[pt.lat, pt.lng]} text={`${i + 1}`} />
            ))}
          </>
        )}

        {/* Drone routes with gradient */}
        {droneRoutes.map((destinations, i) =>
          destinations.map((pt, j) => {
            const next = destinations[j + 1]
            if (!next) return null
            const color = chroma
              .scale(['red', 'yellow'])(j / (destinations.length - 1))
              .hex()
            return (
              <Polyline
                key={`${i}-${j}`}
                positions={[
                  [pt.lat, pt.lng],
                  [next.lat, next.lng],
                ]}
                color={color}
                weight={3}
              />
            )
          }),
        )}

        {droneRoutes
          .reduce((acc, sortie) => [...acc, ...sortie], [])
          .map((pt, idx) => (
            <TextMarker key={idx} position={[pt.lat, pt.lng]} text={`${idx + 1}`} />
          ))}
      </MapContainer>

      <Button
        className='absolute bottom-5 right-5 p-2 bg-blue-500 text-white !z-[100000] cursor-pointer rounded-md'
        onClick={generateRoute}
      >
        Generate Route
      </Button>
    </div>
  )
}
