'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
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
import { forwardGeocode } from '@/lib/geocoding'
import { Search, Crosshair, MapPin, Type } from 'lucide-react'

function ZoomControl() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [editValue, setEditValue] = useState(String(map.getZoom()))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    const onZoom = () => {
      const z = map.getZoom()
      setZoom(z)
      if (!isEditing) setEditValue(String(z))
    }
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [map, isEditing])

  const handleZoomIn = () => map.zoomIn(0.5)
  const handleZoomOut = () => map.zoomOut(0.5)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const commitZoom = () => {
    setIsEditing(false)
    const val = parseFloat(editValue)
    if (!isNaN(val)) {
      const clamped = Math.min(Math.max(val, map.getMinZoom()), map.getMaxZoom())
      map.setZoom(clamped)
      setEditValue(String(clamped))
    } else {
      setEditValue(String(zoom))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitZoom()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(String(zoom))
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
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
      <button
        onClick={handleZoomOut}
        title="Zoom out"
        style={{
          width: 32,
          height: 32,
          border: 'none',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 18,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#374151',
          borderRight: '1px solid #e5e7eb',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        −
      </button>
      <input
        type="text"
        value={isEditing ? editValue : String(zoom)}
        onChange={handleInputChange}
        onFocus={() => { setIsEditing(true); setEditValue(String(zoom)) }}
        onBlur={commitZoom}
        onKeyDown={handleKeyDown}
        title="Zoom level (click to edit)"
        style={{
          width: 44,
          height: 32,
          border: 'none',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 500,
          color: '#374151',
          outline: 'none',
          backgroundColor: isEditing ? '#f0f9ff' : 'white',
          cursor: 'text',
        }}
      />
      <button
        onClick={handleZoomIn}
        title="Zoom in"
        style={{
          width: 32,
          height: 32,
          border: 'none',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 18,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#374151',
          borderLeft: '1px solid #e5e7eb',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        +
      </button>
    </div>
  )
}

type LocationMode = 'coords' | 'address'

function LocationJump() {
  const map = useMap()
  const [mode, setMode] = useState<LocationMode>('address')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [address, setAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const latRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)

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
      style={{
        position: 'absolute',
        top: 12,
        right: 130,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
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
                width: 72,
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
                width: 72,
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
              width: 160,
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
          <ZoomControl />
          <LocationJump />
          <MapCenterTracker />

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
