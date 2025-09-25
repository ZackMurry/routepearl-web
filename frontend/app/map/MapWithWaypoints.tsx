'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import LucideMarker from './LucideMarker'

export default function MapWithWaypoints() {
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([])

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

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer style={{ height: '100%', width: '100%' }} center={[38.9452, -92.3288]} zoom={17}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
          // url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          // url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          // url='https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png'
          // url='https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
        />

        <ClickHandler />

        {waypoints.map((pos, i) => (
          <LucideMarker key={i} position={[pos.lat, pos.lng]} anchor={[0.25, 1]} onRightClick={() => removeWaypoint(i)} />
        ))}

        {/* {waypoints.length > 1 && <Polyline positions={waypoints.map(p => [p.lat, p.lng])} color='blue' />} */}
      </MapContainer>
    </div>
  )
}
