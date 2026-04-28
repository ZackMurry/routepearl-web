'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './flight-planner.css'
import { FlightPlannerProvider, useFlightPlanner } from './FlightPlannerContext'
import { BottomPanel } from './BottomPanel'
import MissionSiteMarker from './MissionSiteMarker'
import SortieFlightPath from './SortieFlightPath'
import ClickHandler from './ClickHandler'
import TruckRoutePath from './TruckRoutePath'
import { getTruckRouteColor } from './routeData'
import { forwardGeocode } from '@/lib/geocoding'
import { Search, Crosshair, Type, ZoomIn, ZoomOut } from 'lucide-react'

type LocationMode = 'coords' | 'address'

function LocationJump() {
  const map = useMap()
  const [mode, setMode] = useState<LocationMode>('address')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [address, setAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const latRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  // Zoom state
  const [zoom, setZoom] = useState(map.getZoom())
  const [editingZoom, setEditingZoom] = useState(false)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const zoomInputRef = useRef<HTMLInputElement>(null)
  const ZOOM_MIN = map.getMinZoom()
  const ZOOM_MAX = map.getMaxZoom()

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current)
      L.DomEvent.disableScrollPropagation(containerRef.current)
    }
  }, [])

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [map])

  useEffect(() => {
    if (editingZoom && zoomInputRef.current) {
      zoomInputRef.current.focus()
      zoomInputRef.current.select()
    }
  }, [editingZoom])

  const zoomPercent = Math.round(((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100)

  const handleZoomIn = () => map.zoomIn(0.5)
  const handleZoomOut = () => map.zoomOut(0.5)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => map.setZoom(parseFloat(e.target.value))

  const handleZoomTextClick = () => {
    setZoomInputValue(String(zoomPercent))
    setEditingZoom(true)
  }

  const commitZoomInput = () => {
    const parsed = parseFloat(zoomInputValue)
    if (!isNaN(parsed)) {
      const zoomVal = ZOOM_MIN + (Math.min(Math.max(parsed, 0), 100) / 100) * (ZOOM_MAX - ZOOM_MIN)
      map.setZoom(zoomVal)
    }
    setEditingZoom(false)
  }

  const jumpToCoords = useCallback(() => {
    const latVal = parseFloat(lat)
    const lngVal = parseFloat(lng)
    if (isNaN(latVal) || isNaN(lngVal) || latVal < -90 || latVal > 90 || lngVal < -180 || lngVal > 180) {
      setError('Invalid coordinates')
      return
    }
    setError('')
    map.flyTo([latVal, lngVal], Math.max(map.getZoom(), 14))
  }, [lat, lng, map])

  const jumpToAddress = useCallback(async () => {
    if (!address.trim()) return
    setSearching(true)
    setError('')
    try {
      const result = await forwardGeocode(address.trim())
      if (result) {
        map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), 14))
        setAddress(result.displayName)
      } else {
        setError('Location not found')
      }
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }, [address, map])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'coords') jumpToCoords()
      else jumpToAddress()
    }
  }

  const toggleMode = () => {
    setError('')
    setMode((prev) => (prev === 'coords' ? 'address' : 'coords'))
  }

  // Button style helper
  const btnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    border: 'none',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#374151',
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: 'min(320px, calc(100vw - 24px))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
        }}
      >
        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          title={mode === 'coords' ? 'Switch to address search' : 'Switch to coordinates'}
          style={{ ...btnStyle, borderRight: '1px solid #e5e7eb' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
        >
          {mode === 'coords' ? <Crosshair size={14} /> : <Type size={14} />}
        </button>

        {mode === 'coords' ? (
          <>
            <input
              ref={latRef}
              type="text"
              placeholder="Lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: 100,
                minWidth: 60,
                flex: 1,
                height: 32,
                border: 'none',
                borderRight: '1px solid #e5e7eb',
                textAlign: 'center',
                fontSize: 12,
                color: '#374151',
                outline: 'none',
                padding: '0 4px',
              }}
            />
            <input
              type="text"
              placeholder="Lng"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: 100,
                minWidth: 60,
                flex: 1,
                height: 32,
                border: 'none',
                textAlign: 'center',
                fontSize: 12,
                color: '#374151',
                outline: 'none',
                padding: '0 4px',
              }}
            />
          </>
        ) : (
          <input
            ref={addressRef}
            type="text"
            placeholder="Search address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: 200,
              minWidth: 100,
              flex: 1,
              height: 32,
              border: 'none',
              fontSize: 12,
              color: '#374151',
              outline: 'none',
              padding: '0 8px',
            }}
          />
        )}

        {/* Go button */}
        <button
          onClick={mode === 'coords' ? jumpToCoords : jumpToAddress}
          disabled={searching}
          title="Jump to location"
          style={{
            ...btnStyle,
            borderLeft: '1px solid #e5e7eb',
            backgroundColor: '#3b82f6',
            color: 'white',
            opacity: searching ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (!searching) e.currentTarget.style.backgroundColor = '#2563eb' }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          {searching ? (
            <span style={{ fontSize: 11, fontWeight: 500 }}>...</span>
          ) : (
            <Search size={14} />
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      {/* Zoom control row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          height: 32,
        }}
      >
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          style={{ ...btnStyle, borderRight: '1px solid #e5e7eb' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
        >
          <ZoomOut size={14} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.5}
            value={zoom}
            onChange={handleSliderChange}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
          />
        </div>
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          style={{ ...btnStyle, borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
        >
          <ZoomIn size={14} />
        </button>
        {editingZoom ? (
          <input
            ref={zoomInputRef}
            type="text"
            value={zoomInputValue}
            onChange={(e) => setZoomInputValue(e.target.value)}
            onBlur={commitZoomInput}
            onKeyDown={(e) => { if (e.key === 'Enter') commitZoomInput() }}
            style={{
              width: 44,
              height: 32,
              border: 'none',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
              outline: 'none',
              padding: 0,
            }}
          />
        ) : (
          <button
            onClick={handleZoomTextClick}
            title="Click to type zoom %"
            style={{
              ...btnStyle,
              width: 44,
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
          >
            {zoomPercent}%
          </button>
        )}
      </div>
    </div>
  )
}

function MapCenterTracker() {
  const map = useMap()
  const { setMapCenter } = useFlightPlanner()

  useEffect(() => {
    const onMoveEnd = () => {
      const c = map.getCenter()
      setMapCenter({ lat: c.lat, lng: c.lng })
    }
    map.on('moveend', onMoveEnd)
    // Set initial center
    onMoveEnd()
    return () => { map.off('moveend', onMoveEnd) }
  }, [map, setMapCenter])

  return null
}

function FitBoundsOnLoad() {
  const map = useMap()
  const { missionConfig, fitBoundsCounter } = useFlightPlanner()

  useEffect(() => {
    if (fitBoundsCounter === 0) return

    const points = missionConfig.nodes.map(n => [n.lat, n.lng] as [number, number])
    if (points.length === 0) return

    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 14))
    } else {
      map.flyToBounds(points, { padding: [50, 50], maxZoom: 16 })
    }
  }, [fitBoundsCounter]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function MapContent() {
  const { missionConfig, generatedTruckRoutes, plotModeNodes } = useFlightPlanner()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent SSR/hydration issues with Leaflet
  if (!isMounted) {
    return (
      <div style={{ height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          Loading map...
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ height: '100dvh', width: '100%', position: 'relative', overflow: 'hidden' }}>
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
          <LocationJump />
          <MapCenterTracker />
          <FitBoundsOnLoad />

          {/* Render mission sites */}
          {missionConfig.nodes.map(node => (
            <MissionSiteMarker key={node.id} node={node} />
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

          {(() => {
            // Per design doc §2.5: assign per-type 1-based display index by walking
            // backend response order. Drives both the depot badge label and which
            // sorties belong to which "Electric Truck #1" / "Gas Truck #1" identity.
            let elec = 0
            let gas = 0
            return generatedTruckRoutes.map(route => {
              const typeIndex = route.truckType === 'electric' ? ++elec : ++gas
              return (
                <TruckRoutePath
                  key={route.routeId}
                  route={route}
                  typeIndex={typeIndex}
                  isMultiTruck={generatedTruckRoutes.length > 1}
                />
              )
            })
          })()}

          {/* Drone routes with gradient and arrows */}
          {generatedTruckRoutes.flatMap(route => {
            const truckColor = getTruckRouteColor(route.truckType, route.truckId)
            return route.droneSorties.map(sortie => (
              <SortieFlightPath
                key={sortie.routeId}
                sortie={[sortie.launch, sortie.customer, sortie.recovery]}
                sortieIndex={sortie.sortieIndex - 1}
                routeId={sortie.routeId}
                vehicleId={sortie.vehicleId}
                truckColor={truckColor}
                localSortieIndex={sortie.localSortieIndex}
              />
            ))
          })}
        </MapContainer>

        {/* Bottom Panel */}
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
