'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import LucideMarker from './LucideMarker'
import { Button } from '@radix-ui/themes'

type Point = { lat: number; lng: number }

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

export default function MapWithWaypoints() {
  const [waypoints, setWaypoints] = useState<Point[]>([])
  const [route, setRoute] = useState<Point[]>([])

  function ClickHandler() {
    useMapEvents({
      click(e) {
        setWaypoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }])
      },
    })
    return null
  }

  const removeWaypoint = (index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }

  const generateRoute = () => {
    if (waypoints.length < 2) {
      setRoute([])
      return
    }

    console.log(JSON.stringify(waypoints))
    const perms = permute(waypoints.slice(1)) // fix first point as start
    let best: Point[] = []
    let bestDist = Infinity

    for (const p of perms) {
      const candidate = [waypoints[0], ...p, waypoints[0]] // round trip
      let dist = 0
      for (let i = 0; i < candidate.length - 1; i++) {
        dist += distance(candidate[i], candidate[i + 1])
      }
      if (dist < bestDist) {
        bestDist = dist
        best = candidate
      }
    }

    setRoute(best)
    console.log('Best distance (meters):', bestDist)
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

        {route.length > 1 && <Polyline positions={route.map(p => [p.lat, p.lng])} color='blue' />}
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
