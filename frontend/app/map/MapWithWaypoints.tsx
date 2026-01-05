'use client'
import React, { useEffect } from 'react'
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

function MapContent() {
  const { missionConfig, addNode, truckRoute, droneRoutes, plotModeCustomer, plotModeNodes } = useFlightPlanner()

  console.log(plotModeNodes)

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

          {truckRoute.length > 1 && (
            <>
              {/* Truck route with arrows - use chunked segments for better arrow distribution */}
              {(() => {
                // Create segments of truck route for arrow placement
                const chunkSize = Math.max(1, Math.floor(truckRoute.length / 15)) // ~15 arrows total
                const segments: Point[][] = []
                for (let i = 0; i < truckRoute.length - 1; i += chunkSize) {
                  const end = Math.min(i + chunkSize + 1, truckRoute.length)
                  segments.push(truckRoute.slice(i, end))
                }

                return segments.map((segment, segmentIndex) => {
                  const progress = segmentIndex / Math.max(1, segments.length - 1)
                  const color = chroma.scale(['blue', 'purple'])(progress).hex()
                  return (
                    <ArrowheadPolyline
                      key={`truck-segment-${segmentIndex}`}
                      positions={segment}
                      color={color}
                      weight={3}
                      arrowSize={10}
                      arrowRepeat={0}
                      arrowOffset='100%'
                    />
                  )
                })
              })()}
            </>
          )}

          {/* Drone routes with gradient and arrows */}
          {droneRoutes.map((sortie, sortieIndex) => (
            <SortieFlightPath key={`sortie-path-${sortieIndex}`} sortie={sortie} sortieIndex={sortieIndex} />
          ))}

          {/* Sortie labels on drone paths */}
          {droneRoutes.map((sortie, sortieIndex) => {
            if (sortie.length < 2) return null
            const isFinalSortie = sortieIndex === droneRoutes.length - 1
            // Place label at the midpoint between launch and delivery
            const midLat = (sortie[0].lat + sortie[1].lat) / 2
            const midLng = (sortie[0].lng + sortie[1].lng) / 2
            return (
              <TextMarker
                key={`sortie-label-${sortieIndex}`}
                position={[midLat, midLng]}
                text={isFinalSortie ? `S${sortieIndex + 1} ✓` : `S${sortieIndex + 1}`}
                style={{
                  backgroundColor: isFinalSortie ? '#facc15' : '#ef4444',
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
          })}
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
