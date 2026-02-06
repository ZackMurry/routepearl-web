'use client'
import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMapEvents, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './flight-planner.css'
import { Point, FlightNode } from '@/lib/types'
import TextMarker from '@/components/TextMarker'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'
import chroma from 'chroma-js'
import { FlightPlannerProvider, useFlightPlanner } from './FlightPlannerContext'
import { FlightPlannerSidebar } from './FlightPlannerSidebar'
import { BottomPanel } from './BottomPanel'
import FlightNodeMarker from './FlightNodeMarker'
import SortieFlightPath from './SortieFlightPath'
import classNames from 'classnames'
import ClickHandler from './ClickHandler'
import TruckRoutePath from './TruckRoutePath'

function MapContent() {
  const { missionConfig, truckRoute, droneRoutes, plotModeNodes } = useFlightPlanner()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent SSR/hydration issues with Leaflet
  if (!isMounted) {
    return (
      <div style={{ height: '100vh', width: '100%', position: 'relative', backgroundColor: '#f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          Loading map...
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <MapContainer
          style={{ height: '100%', width: '100%' }}
          className={plotModeNodes ? 'leaflet-cursor-crosshair' : undefined}
          center={[38.9404, -92.3277]}
          zoom={15}
          attributionControl={false}
          zoomControl={false}
          zoomDelta={0.5}
          zoomSnap={0.5}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            subdomains='abcd'
          />

          <ClickHandler />

          {/* Render flight nodes */}
          {missionConfig.nodes.map(node => (
            <FlightNodeMarker key={node.id} node={node} />
          ))}

          {/* Render hazard zones */}
          {missionConfig.hazardZones.map(zone => (
            <Circle
              key={zone.id}
              center={[zone.center.lat, zone.center.lng]}
              radius={zone.radius}
              pathOptions={{
                color: zone.severity === 'high' ? 'red' : zone.severity === 'medium' ? 'orange' : 'yellow',
                fillColor: zone.severity === 'high' ? 'red' : zone.severity === 'medium' ? 'orange' : 'yellow',
                fillOpacity: 0.2,
              }}
            />
          ))}

          {truckRoute.length > 1 && <TruckRoutePath />}

          {/* Drone routes with gradient and arrows */}
          {droneRoutes.map((sortie, sortieIndex) => (
            <SortieFlightPath key={`sortie-path-${sortieIndex}`} sortie={sortie} sortieIndex={sortieIndex} />
          ))}
        </MapContainer>

        {/* Sidebar and Bottom Panel */}
        <FlightPlannerSidebar />
        <BottomPanel />
      </div>
    </>
  )
}

// Main component wrapped with provider
export default function MapWithWaypoints() {
  return (
    <FlightPlannerProvider>
      <MapContent />
    </FlightPlannerProvider>
  )
}
