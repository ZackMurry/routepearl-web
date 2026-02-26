'use client'

import React, { FC, useRef, useState, useEffect } from 'react'
import { Box, Flex, Text, Button } from '@radix-ui/themes'
import { Plus, FolderOpen, ZoomIn, ZoomOut, Drone, Truck, Clock, Route, BarChart3, List } from 'lucide-react'
import { GanttData, GanttChartState, GanttAxisMode, GanttStop, GanttVehicle, formatGanttTime, formatGanttDistance } from './gantt.types'
import GanttTimeAxis from './GanttTimeAxis'
import GanttRow from './GanttRow'
import GanttCurrentTimeMarker from './GanttCurrentTimeMarker'
import GanttListView from './GanttListView'

type VehicleFilter = 'all' | 'drones' | 'trucks'

interface Props {
  data: GanttData
  state: GanttChartState
  currentTime?: number // Current mission time in seconds (for live tracking)
  onCreatePlan?: () => void
  onLoadPlan?: () => void
  vehicleFilter?: VehicleFilter
  onVehicleFilterChange?: (filter: VehicleFilter) => void
  onStopClick?: (stop: GanttStop) => void
  onStopDoubleClick?: (stop: GanttStop) => void
  onVehicleClick?: (vehicle: GanttVehicle) => void
  onVehicleDoubleClick?: (vehicle: GanttVehicle) => void
}

// Pick a "nice" grid interval in pixels for distance mode
function niceDistanceGridInterval(totalMeters: number, zoomLevel: number): number {
  const target = totalMeters / (5 * zoomLevel)
  const niceSteps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
  for (const step of niceSteps) {
    if (step >= target) return step
  }
  return 50000
}

const GanttChart: FC<Props> = ({
  data,
  state,
  currentTime = 0,
  onCreatePlan,
  onLoadPlan,
  vehicleFilter = 'all',
  onVehicleFilterChange,
  onStopClick,
  onStopDoubleClick,
  onVehicleClick,
  onVehicleDoubleClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [editingZoom, setEditingZoom] = useState(false)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const [axisMode, setAxisMode] = useState<GanttAxisMode>('duration')
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart')
  const [showAllRow, setShowAllRow] = useState(true)
  const zoomInputRef = useRef<HTMLInputElement>(null)

  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 3
  const ZOOM_STEP = 0.25

  const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

  const zoomIn = () => setZoomLevel((prev) => clampZoom(prev + ZOOM_STEP))
  const zoomOut = () => setZoomLevel((prev) => clampZoom(prev - ZOOM_STEP))

  const handleZoomTextClick = () => {
    setZoomInputValue(String(Math.round(zoomLevel * 100)))
    setEditingZoom(true)
  }

  const commitZoomInput = () => {
    const parsed = parseFloat(zoomInputValue)
    if (!isNaN(parsed)) {
      setZoomLevel(clampZoom(parsed / 100))
    }
    setEditingZoom(false)
  }

  useEffect(() => {
    if (editingZoom && zoomInputRef.current) {
      zoomInputRef.current.focus()
      zoomInputRef.current.select()
    }
  }, [editingZoom])

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 150)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)

    const observer = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateWidth)
      observer.disconnect()
    }
  }, [])

  // Calculate timeline width based on zoom
  // The scale width drives marker positioning; the track adds right padding
  // so the last marker (16px base offset + 12px icon half) doesn't hang on white.
  const TRACK_PAD_RIGHT = 32
  const scaleWidth = containerWidth * zoomLevel
  const timelineWidth = scaleWidth + TRACK_PAD_RIGHT

  // Compute pixels per unit based on axis mode (uses scaleWidth, not padded width)
  const isDistanceMode = axisMode === 'distance'
  const totalUnits = isDistanceMode
    ? Math.max(data.totalDistance || 1, 1)
    : Math.max(data.totalDuration, 1)
  const pixelsPerUnit = scaleWidth / totalUnits

  // Grid interval in pixels (for row grid lines)
  const gridIntervalPx = isDistanceMode
    ? niceDistanceGridInterval(totalUnits, zoomLevel) * pixelsPerUnit
    : 300 * pixelsPerUnit // 5 minutes

  // Filter vehicles based on active filter
  // The "All" summary row visibility is toggled by clicking the All button while already selected
  const filteredVehicles = data.vehicles.filter((v) => {
    if (v.type === 'all') return showAllRow
    if (vehicleFilter === 'all') return true
    if (vehicleFilter === 'drones') return v.type === 'drone'
    return v.type === 'truck'
  })

  // Row height for calculating current time marker height
  const rowHeight = 42
  const headerHeight = 28
  const totalContentHeight = headerHeight + filteredVehicles.length * rowHeight

  // No plan state
  if (state === 'no-plan') {
    return (
      <Box
        ref={containerRef}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '24px',
        }}
      >
        <Box style={{ textAlign: 'center', maxWidth: '400px' }}>
          <Text size="4" weight="bold" style={{ color: '#6b7280', display: 'block', marginBottom: '8px' }}>
            No Flight Plan Loaded
          </Text>
          <Text size="2" style={{ color: '#9ca3af', display: 'block', marginBottom: '24px' }}>
            Create a new flight plan or load an existing one to view the mission timeline.
          </Text>
          <Flex gap="3" justify="center">
            <Button size="2" variant="soft" onClick={onCreatePlan}>
              <Plus size={16} />
              Create Plan
            </Button>
            <Button size="2" onClick={onLoadPlan}>
              <FolderOpen size={16} />
              Load Plan
            </Button>
          </Flex>
        </Box>
      </Box>
    )
  }

  // Segmented toggle button style helper
  const segBtn = (isActive: boolean) => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '4px',
    border: 'none' as const,
    cursor: 'pointer' as const,
    fontSize: '11px',
    fontWeight: isActive ? 500 : 400,
    backgroundColor: isActive ? 'white' : 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.15s ease',
  })

  return (
    <Box
      ref={containerRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        overflow: 'hidden',
      }}
    >
      {/* Controls header */}
      <Flex
        justify="between"
        align="center"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #d1d5db',
          backgroundColor: '#f3f4f6',
        }}
      >
        {/* Zoom control + view toggle */}
        <Flex align="center" gap="2">
          {/* Zoom controls (disabled in list mode) */}
          <Flex
            align="center"
            gap="2"
            style={{
              opacity: viewMode === 'list' ? 0.4 : 1,
              pointerEvents: viewMode === 'list' ? 'none' : 'auto',
            }}
          >
            <ZoomOut
              size={14}
              style={{
                color: zoomLevel <= ZOOM_MIN ? '#d1d5db' : '#6b7280',
                cursor: zoomLevel <= ZOOM_MIN ? 'default' : 'pointer',
              }}
              onClick={zoomOut}
            />
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step="0.1"
              value={zoomLevel}
              disabled={viewMode === 'list'}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
            <ZoomIn
              size={14}
              style={{
                color: zoomLevel >= ZOOM_MAX ? '#d1d5db' : '#6b7280',
                cursor: zoomLevel >= ZOOM_MAX ? 'default' : 'pointer',
              }}
              onClick={zoomIn}
            />
            {editingZoom ? (
              <input
                ref={zoomInputRef}
                type="text"
                value={zoomInputValue}
                onChange={(e) => setZoomInputValue(e.target.value)}
                onBlur={commitZoomInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitZoomInput()
                  if (e.key === 'Escape') setEditingZoom(false)
                }}
                style={{
                  width: '48px',
                  marginLeft: '8px',
                  fontSize: '12px',
                  textAlign: 'center',
                  border: '1px solid #9ca3af',
                  borderRadius: '4px',
                  padding: '1px 4px',
                  outline: 'none',
                }}
              />
            ) : (
              <Text
                size="1"
                style={{
                  color: '#6b7280',
                  marginLeft: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => (e.currentTarget.style.borderColor = '#d1d5db')}
                onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => (e.currentTarget.style.borderColor = 'transparent')}
                onClick={handleZoomTextClick}
              >
                {Math.round(zoomLevel * 100)}%
              </Text>
            )}
          </Flex>

          {/* Divider */}
          <div style={{ width: '1px', height: '20px', backgroundColor: '#d1d5db' }} />

          {/* View mode toggle */}
          <Flex
            align="center"
            gap="0"
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button style={segBtn(viewMode === 'chart')} onClick={() => setViewMode('chart')} title="Chart view">
              <BarChart3 size={12} />
            </button>
            <button style={segBtn(viewMode === 'list')} onClick={() => setViewMode('list')} title="List view">
              <List size={12} />
            </button>
          </Flex>
        </Flex>

        {/* Axis mode toggle */}
        <Flex
          align="center"
          gap="0"
          style={{
            backgroundColor: '#e5e7eb',
            borderRadius: '6px',
            padding: '2px',
          }}
        >
          <button style={segBtn(axisMode === 'duration')} onClick={() => setAxisMode('duration')}>
            <span style={{ color: axisMode === 'duration' ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
              <Clock size={12} />
            </span>
            Duration
          </button>
          <button style={segBtn(axisMode === 'distance')} onClick={() => setAxisMode('distance')}>
            <span style={{ color: axisMode === 'distance' ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
              <Route size={12} />
            </span>
            Distance
          </button>
        </Flex>

        {/* Vehicle filter toggle */}
        {onVehicleFilterChange && (
          <Flex
            align="center"
            gap="0"
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            {([
              { key: 'all' as VehicleFilter, label: 'All', icon: null },
              { key: 'drones' as VehicleFilter, label: 'Drones', icon: <Drone size={12} /> },
              { key: 'trucks' as VehicleFilter, label: 'Trucks', icon: <Truck size={12} /> },
            ]).map((option) => {
              const isActive = vehicleFilter === option.key
              const isAllHighlight = option.key === 'all' && isActive && showAllRow
              const btnStyle = isAllHighlight
                ? { ...segBtn(true), color: '#2563eb', backgroundColor: '#eff6ff' }
                : segBtn(isActive)
              return (
                <button
                  key={option.key}
                  onClick={() => {
                    if (option.key === 'all' && vehicleFilter === 'all') {
                      // Already on All — toggle the summary row
                      setShowAllRow((prev) => !prev)
                    } else {
                      onVehicleFilterChange(option.key)
                    }
                  }}
                  style={btnStyle}
                >
                  {option.icon && (
                    <span style={{ color: isActive ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                      {option.icon}
                    </span>
                  )}
                  {option.label}
                </button>
              )
            })}
          </Flex>
        )}

        {/* Duration / Distance info */}
        <Text size="1" style={{ color: '#6b7280' }}>
          {isDistanceMode
            ? `Distance: ${formatGanttDistance(data.totalDistance || 0)}`
            : `Duration: ${formatGanttTime(data.wallClockDuration ?? data.totalDuration)}`}
        </Text>
      </Flex>

      {/* Content area — chart or list */}
      {viewMode === 'chart' ? (
        <Box style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <Box style={{ minWidth: `${timelineWidth + 150}px` }}>
            {/* Time/Distance axis */}
            <Flex>
              {/* Empty space for label column — sticky so it stays visible on horizontal scroll */}
              <Box style={{ position: 'sticky', left: 0, zIndex: 20, width: '150px', minWidth: '150px', backgroundColor: '#e5e7eb', borderRight: '1px solid #9ca3af' }} />
              {/* Axis */}
              <Box style={{ flex: 1, position: 'relative' }}>
                <GanttTimeAxis
                  totalDuration={data.totalDuration}
                  totalDistance={data.totalDistance}
                  axisMode={axisMode}
                  zoomLevel={zoomLevel}
                  width={timelineWidth}
                />
              </Box>
            </Flex>

            {/* Vehicle rows */}
            <Box style={{ position: 'relative' }}>
              {filteredVehicles.map((vehicle, index) => (
                <GanttRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  pixelsPerUnit={pixelsPerUnit}
                  totalDuration={data.totalDuration}
                  totalDistance={data.totalDistance}
                  axisMode={axisMode}
                  rowIndex={index}
                  isGreyed={state === 'empty-fleet'}
                  gridIntervalPx={gridIntervalPx}
                  onStopClick={onStopClick}
                  onStopDoubleClick={onStopDoubleClick}
                  onVehicleClick={onVehicleClick}
                  onVehicleDoubleClick={onVehicleDoubleClick}
                />
              ))}

              {/* Current time marker - only show during mission in duration mode */}
              {currentTime > 0 && (
                <Box style={{ position: 'absolute', top: 0, left: '150px', right: 0, height: '100%', pointerEvents: 'none' }}>
                  <GanttCurrentTimeMarker
                    currentTime={currentTime}
                    pixelsPerSecond={isDistanceMode ? 0 : pixelsPerUnit}
                    height={filteredVehicles.length * rowHeight}
                    axisMode={axisMode}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <GanttListView
            vehicles={filteredVehicles}
            axisMode={axisMode}
            onStopClick={onStopClick}
            onStopDoubleClick={onStopDoubleClick}
            onVehicleClick={onVehicleClick}
            onVehicleDoubleClick={onVehicleDoubleClick}
          />
        </Box>
      )}

      {/* Empty state message for greyed-out fleet */}
      {state === 'empty-fleet' && (
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <Text size="2" style={{ color: '#6b7280' }}>
            Generate a route to see the mission timeline
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default GanttChart
