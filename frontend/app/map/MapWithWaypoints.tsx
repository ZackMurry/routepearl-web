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

import React from 'react'
import { MapContainer, TileLayer, Polyline, useMapEvents, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './flight-planner.css'
import LucideMarker from './LucideMarker'
import { Point, FlightNode } from '@/lib/types'
import TextMarker from '@/components/TextMarker'
import chroma from 'chroma-js'
import { FlightPlannerProvider, useFlightPlanner } from './FlightPlannerContext'
import { FlightPlannerSidebar } from './FlightPlannerSidebar'
import { BottomPanel } from './BottomPanel'

function MapContent() {
  const {
    missionConfig,
    addNode,
    removeNode,
    updateNode,
    truckRoute,
    droneRoutes,
    isFlightPlannerMode,
    plotModeCustomer,
    plotModeNodes,
    selectedNodeId,
    setSelectedNodeId,
  } = useFlightPlanner()

  // Get color based on node type
  const getNodeColor = (type: string): string => {
    switch (type) {
      case 'depot':
        return '#3b82f6' // blue
      case 'customer':
        return '#10b981' // green
      case 'station':
        return '#f97316' // orange
      case 'waypoint':
        return '#8b5cf6' // purple
      case 'hazard':
        return '#ef4444' // red
      default:
        return '#6b7280' // gray
    }
  }

  // Get color based on hazard severity
  const getHazardColor = (severity?: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'low':
        return '#eab308' // yellow
      case 'medium':
        return '#f97316' // orange
      case 'high':
        return '#ef4444' // red
      default:
        return '#f97316' // orange (default)
    }
  }

  function ClickHandler() {
    useMapEvents({
      click(e) {
        // Only create nodes if one of the plot modes is enabled
        if (!plotModeCustomer && !plotModeNodes) return

        let newNode: FlightNode

        if (plotModeCustomer) {
          // Customer plot mode - create customer nodes
          newNode = {
            id: `node-${Date.now()}`,
            type: 'customer',
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            label: `Customer ${missionConfig.nodes.filter((n) => n.type === 'customer').length + 1}`,
          }
        } else {
          // Nodes plot mode - create waypoint nodes
          newNode = {
            id: `node-${Date.now()}`,
            type: 'waypoint',
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            label: `Waypoint ${missionConfig.nodes.filter((n) => n.type === 'waypoint').length + 1}`,
          }
        }

        addNode(newNode)
      },
    })
    return null
  }

  const removeWaypoint = (id: string) => removeNode(id)

  return (
    <>
      <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
        <MapContainer
          style={{ height: '100%', width: '100%' }}
          center={[26.4619, -81.7726]}
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
          {missionConfig.nodes.map((node) => {
            const hazardColor = getHazardColor(node.severity)
            // Nodes are draggable only when both plot modes are OFF
            const isDraggable = !plotModeCustomer && !plotModeNodes

            return (
              <React.Fragment key={node.id}>
                {/* Render circle for hazard nodes */}
                {node.type === 'hazard' && (
                  <Circle
                    center={[node.lat, node.lng]}
                    radius={node.radius || 100} // Default 100m radius
                    pathOptions={{
                      color: hazardColor,
                      fillColor: hazardColor,
                      fillOpacity: 0.15,
                      weight: 2,
                    }}
                  />
                )}
                <LucideMarker
                  position={[node.lat, node.lng]}
                  anchor={[0.25, 1]}
                  color={getNodeColor(node.type)}
                  onClick={() => {
                    // Only allow selecting when plot modes are off
                    if (!plotModeCustomer && !plotModeNodes) {
                      setSelectedNodeId(node.id)
                    }
                  }}
                  onRightClick={() => removeWaypoint(node.id)}
                  draggable={isDraggable}
                  onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
                />
              </React.Fragment>
            )
          })}

          {/* Render hazard zones */}
          {missionConfig.hazardZones.map((zone) => (
            <Circle
              key={zone.id}
              center={[zone.center.lat, zone.center.lng]}
              radius={zone.radius}
              pathOptions={{
                color: zone.severity === 'high' ? 'red' : zone.severity === 'medium' ? 'orange' : 'yellow',
                fillColor:
                  zone.severity === 'high' ? 'red' : zone.severity === 'medium' ? 'orange' : 'yellow',
                fillOpacity: 0.2,
              }}
            />
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
            {truckRoute
              .filter((val, i, a) => i === 0 || (val.lat !== a[i - 1].lat && val.lng !== a[i - 1].lng))
              .map((pt, i) => (
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
          .filter((val, i, a) => i === 0 || (val.lat !== a[i - 1].lat && val.lng !== a[i - 1].lng))
          .map((pt, idx) => (
            <TextMarker key={idx} position={[pt.lat, pt.lng]} text={`${idx + 1}`} />
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
