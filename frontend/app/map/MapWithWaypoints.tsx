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
import NumberedMarker from '@/components/NumberedMarker'
import { Point, FlightNode } from '@/lib/types'
import TextMarker from '@/components/TextMarker'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'
import chroma from 'chroma-js'
import { Warehouse, Fuel, FlagTriangleRight, AlertTriangle } from 'lucide-react'
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

  // Helper function: Check if a point matches a node (within 0.0001 degrees ~11m)
  const pointMatchesNode = (point: Point, node: FlightNode): boolean => {
    const latDiff = Math.abs(point.lat - node.lat)
    const lngDiff = Math.abs(point.lng - node.lng)
    return latDiff < 0.0001 && lngDiff < 0.0001
  }

  // Helper function: Get drone delivery nodes (middle point of each sortie)
  const getDroneDeliveryNodes = (): Set<string> => {
    const deliveryNodeIds = new Set<string>()
    droneRoutes.forEach((sortie) => {
      if (sortie.length >= 2) {
        const deliveryPoint = sortie[1] // Middle point is the delivery
        const matchingNode = missionConfig.nodes.find((node) => pointMatchesNode(deliveryPoint, node))
        if (matchingNode) {
          deliveryNodeIds.add(matchingNode.id)
        }
      }
    })
    return deliveryNodeIds
  }

  // Helper function: Get truck delivery nodes
  const getTruckDeliveryNodes = (): Set<string> => {
    const truckDeliveryIds = new Set<string>()
    const droneDeliveryIds = getDroneDeliveryNodes()

    // Customer nodes not served by drone are served by truck
    missionConfig.nodes.forEach((node) => {
      if (node.type === 'customer' && !droneDeliveryIds.has(node.id)) {
        truckDeliveryIds.add(node.id)
      }
    })

    return truckDeliveryIds
  }

  // Helper function: Get ALL sortie info for a node (a node can have multiple roles)
  const getAllSortieInfo = (node: FlightNode): Array<{ type: 'launch' | 'return' | 'delivery'; sortieNumber: number }> => {
    const sortieInfos: Array<{ type: 'launch' | 'return' | 'delivery'; sortieNumber: number }> = []

    for (let i = 0; i < droneRoutes.length; i++) {
      const sortie = droneRoutes[i]
      if (sortie.length >= 3) {
        if (pointMatchesNode(sortie[0], node)) {
          sortieInfos.push({ type: 'launch', sortieNumber: i + 1 })
        }
        if (pointMatchesNode(sortie[1], node)) {
          sortieInfos.push({ type: 'delivery', sortieNumber: i + 1 })
        }
        if (pointMatchesNode(sortie[2], node)) {
          sortieInfos.push({ type: 'return', sortieNumber: i + 1 })
        }
      }
    }

    return sortieInfos
  }

  const droneDeliveryNodes = getDroneDeliveryNodes()
  const truckDeliveryNodes = getTruckDeliveryNodes()

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
          // Label and addressId will be auto-assigned by FlightPlannerContext
          newNode = {
            id: `node-${Date.now()}`,
            type: 'customer',
            lat: e.latlng.lat,
            lng: e.latlng.lng,
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
          {missionConfig.nodes.map((node, nodeIndex) => {
            const hazardColor = getHazardColor(node.severity)
            // Nodes are draggable only when both plot modes are OFF
            const isDraggable = !plotModeCustomer && !plotModeNodes
            const isDroneDelivery = droneDeliveryNodes.has(node.id)
            const isTruckDelivery = truckDeliveryNodes.has(node.id)
            const allSortieInfo = getAllSortieInfo(node)

            // Get the Address ID for customer nodes (uses the addressId field directly)
            const addressId = node.type === 'customer' ? (node.addressId || 1) : 0

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
                {/* Use NumberedMarker for customers, LucideMarker for other nodes */}
                {node.type === 'customer' ? (
                  <NumberedMarker
                    position={[node.lat, node.lng]}
                    number={addressId}
                    color={getNodeColor(node.type)}
                    onClick={() => {
                      if (!plotModeCustomer && !plotModeNodes) {
                        setSelectedNodeId(node.id)
                      }
                    }}
                    onRightClick={() => removeWaypoint(node.id)}
                    draggable={isDraggable}
                    onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
                  />
                ) : (
                  <LucideMarker
                    position={[node.lat, node.lng]}
                    anchor={node.type === 'depot' || node.type === 'station' ? [0.5, 0.5] : [0.25, 1]}
                    color={node.type === 'depot' || node.type === 'station' ? '#000000' : getNodeColor(node.type)}
                    LucideIcon={
                      node.type === 'depot' ? Warehouse :
                      node.type === 'station' ? Fuel :
                      node.type === 'hazard' ? AlertTriangle :
                      FlagTriangleRight
                    }
                    size={node.type === 'depot' || node.type === 'station' ? 28 : 24}
                    onClick={() => {
                      if (!plotModeCustomer && !plotModeNodes) {
                        setSelectedNodeId(node.id)
                      }
                    }}
                    onRightClick={() => removeWaypoint(node.id)}
                    draggable={isDraggable}
                    onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
                  />
                )}

                {/* Delivery type indicator - positioned above the marker */}
                {isDroneDelivery && (
                  <TextMarker
                    position={[node.lat, node.lng]}
                    text="🚁"
                    offset={[-25, -72]}
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      padding: '2px 14px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                )}
                {isTruckDelivery && (
                  <TextMarker
                    position={[node.lat, node.lng]}
                    text="🚛"
                    offset={[-25, -72]}
                    style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '2px 14px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                )}

                {/* Sortie info indicators (for launch/return points) - positioned below the marker */}
                {allSortieInfo
                  .filter(info => info.type !== 'delivery')
                  .sort((a, b) => a.sortieNumber - b.sortieNumber) // Sort by sortie number ascending
                  .map((sortieInfo, idx) => {
                    // Match the sortie color from the route palette (contrasts with green/orange arrows)
                    const sortieColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#6366f1', '#d946ef']
                    const sortieColor = sortieColors[(sortieInfo.sortieNumber - 1) % sortieColors.length]
                    // Arrow color indicates direction: green for launch, orange for return
                    const arrowColor = sortieInfo.type === 'launch' ? '#10b981' : '#f97316'

                    return (
                      <TextMarker
                        key={`${node.id}-sortie-${sortieInfo.sortieNumber}-${sortieInfo.type}`}
                        position={[node.lat, node.lng]}
                        text={sortieInfo.type === 'launch' ? `S${sortieInfo.sortieNumber} ⬆` : `S${sortieInfo.sortieNumber} ⬇`}
                        offset={[-45 + (idx * 45), 12]} // Stack left to right: smallest sortie on left, largest on right
                        style={{
                          backgroundColor: sortieColor,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          border: `2px solid ${arrowColor}`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        }}
                      />
                    )
                  })}
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
                const color = chroma.scale(['#60a5fa', '#a855f7'])(progress).hex() // Light blue to violet
                const arrowColor = '#000000' // Black arrows
                return (
                  <ArrowheadPolyline
                    key={`truck-segment-${segmentIndex}`}
                    positions={segment}
                    color={color}
                    arrowColor={arrowColor}
                    weight={3}
                    arrowSize={10}
                    arrowRepeat={0}
                    arrowOffset="100%"
                  />
                )
              })
            })()}
          </>
        )}

        {/* Drone routes - each sortie has one distinct color */}
        {droneRoutes.map((sortie, sortieIndex) =>
          sortie.map((pt, segmentIndex) => {
            const next = sortie[segmentIndex + 1]
            if (!next) return null

            // Each sortie gets a distinct color
            const sortieColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#6366f1', '#d946ef']
            const sortieColor = sortieColors[sortieIndex % sortieColors.length]

            // Black arrows for all drone routes
            const arrowColor = '#000000'

            return (
              <ArrowheadPolyline
                key={`sortie-${sortieIndex}-segment-${segmentIndex}`}
                positions={[pt, next]}
                color={sortieColor}
                arrowColor={arrowColor}
                weight={4}
                arrowSize={10}
                arrowRepeat="60px" // Arrows distributed along the line
                arrowOffset="30px"
                dashArray="10, 8" // Dotted line for drone routes
              />
            )
          }),
        )}

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
