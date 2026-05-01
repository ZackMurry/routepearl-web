'use client'

import React, { FC, useRef, useState, useEffect } from 'react'
import { Box, Flex, Text, Button } from '@radix-ui/themes'
import { Plus, FolderOpen, ZoomIn, ZoomOut, Drone, Truck, Clock, Route, BarChart3, List, User, Filter, ChevronDown, Check, LayoutList, MapPin, Hash } from 'lucide-react'
import { GanttData, GanttChartState, GanttAxisMode, GanttLocationMode, GanttStop, GanttStopType, GanttVehicle, getStopColor, formatGanttTime, formatGanttDistance } from './gantt.types'
import GanttTimeAxis from './GanttTimeAxis'
import GanttRow from './GanttRow'
import GanttCurrentTimeMarker from './GanttCurrentTimeMarker'
import GanttListView from './GanttListView'

type VehicleFilter = 'all' | 'drones' | 'trucks' | 'driver'

/* ── Event-type stop icons (shared with GanttListView) ──────────────── */
import { House, Package, ArrowUp, ArrowDown, Zap } from 'lucide-react'

const ALL_STOP_TYPES: { type: GanttStopType; label: string; icon: React.ReactNode }[] = [
  { type: 'depot', label: 'Depot', icon: <House size={10} /> },
  { type: 'delivery', label: 'Delivery', icon: <Package size={10} /> },
  { type: 'launch', label: 'Launch', icon: <ArrowUp size={10} /> },
  { type: 'return', label: 'Return', icon: <ArrowDown size={10} /> },
  { type: 'charging', label: 'Charging', icon: <Zap size={10} /> },
  { type: 'travel', label: 'Travel', icon: <Truck size={10} /> },
]

/* ── Event Type Filter Dropdown ──────────────────────────────────────── */

const EventTypeFilter: FC<{
  activeTypes: Set<GanttStopType>
  onToggle: (type: GanttStopType) => void
  onSelectAll: () => void
  onClearAll: () => void
}> = ({ activeTypes, onToggle, onSelectAll, onClearAll }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected = activeTypes.size === ALL_STOP_TYPES.length
  const filterLabel = allSelected ? 'All Events' : `${activeTypes.size} of ${ALL_STOP_TYPES.length}`

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          fontSize: '11px',
          fontWeight: 500,
          color: allSelected ? '#6b7280' : '#3b82f6',
          backgroundColor: allSelected ? 'transparent' : '#eff6ff',
          border: `1px solid ${allSelected ? '#d1d5db' : '#bfdbfe'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          lineHeight: '18px',
        }}
      >
        <Filter size={11} />
        {filterLabel}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            minWidth: '180px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: '4px 0',
          }}
        >
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: '4px', padding: '4px 8px 6px', borderBottom: '1px solid #f3f4f6' }}>
            <button onClick={onSelectAll} style={{ flex: 1, fontSize: '10px', fontWeight: 500, padding: '3px 0', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
              Select All
            </button>
            <button onClick={onClearAll} style={{ flex: 1, fontSize: '10px', fontWeight: 500, padding: '3px 0', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear All
            </button>
          </div>

          {/* Type options */}
          {ALL_STOP_TYPES.map(({ type, label, icon }) => {
            const checked = activeTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => onToggle(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '12px',
                  color: checked ? '#1e293b' : '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  border: `1.5px solid ${checked ? getStopColor(type) : '#d1d5db'}`,
                  backgroundColor: checked ? getStopColor(type) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {checked && <Check size={10} color="white" strokeWidth={3} />}
                </div>

                {/* Icon */}
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: getStopColor(type),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                }}>
                  {icon}
                </div>

                <span style={{ fontWeight: checked ? 500 : 400 }}>{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  const [locationMode, setLocationMode] = useState<GanttLocationMode>('street')
  const [showAllRow, setShowAllRow] = useState(true)
  const [showTrucksInDriver, setShowTrucksInDriver] = useState(true)
  const [showDronesInDriver, setShowDronesInDriver] = useState(true)
  const [activeStopTypes, setActiveStopTypes] = useState<Set<GanttStopType>>(() => new Set(ALL_STOP_TYPES.map((t) => t.type)))
  // Collapse-by-truck state for multi-truck Gantt. Default-collapse when there
  // are 4+ truck groups (per design doc MC2). The truck row itself stays
  // visible — only its driver/drones get hidden when collapsed.
  const truckGroupIds = Array.from(
    new Set(data.vehicles.filter(v => v.type === 'truck' && v.groupId != null).map(v => v.groupId as number)),
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(() => new Set())
  useEffect(() => {
    setCollapsedGroups(prev => {
      if (truckGroupIds.length >= 4) {
        // Auto-collapse all groups when there are many trucks; don't unset
        // ones the user already toggled open.
        const next = new Set(prev)
        truckGroupIds.forEach(id => next.add(id))
        return next
      }
      // For K<4, leave whatever state the user has.
      return prev
    })
  }, [truckGroupIds.join(',')])
  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }
  const zoomInputRef = useRef<HTMLInputElement>(null)

  const handleStopTypeToggle = (type: GanttStopType) => {
    setActiveStopTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }
  const handleStopTypeSelectAll = () => setActiveStopTypes(new Set(ALL_STOP_TYPES.map((t) => t.type)))
  const handleStopTypeClearAll = () => setActiveStopTypes(new Set<GanttStopType>(['delivery']))

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
  const TRACK_PAD_RIGHT = 48
  const scaleWidth = containerWidth * zoomLevel
  // timelineWidth is computed after spread offsets below — placeholder used for pixelsPerUnit
  const baseTimelineWidth = scaleWidth + TRACK_PAD_RIGHT

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
    if (vehicleFilter === 'driver') {
      if (v.type === 'all') return showAllRow
      if (v.type === 'truck') return showTrucksInDriver
      if (v.type === 'driver') return true
      if (v.type === 'drone') return showDronesInDriver && v.groupId != null // only drones that interact with a truck
      return false
    }
    if (v.type === 'driver') return false // hide driver rows in non-driver views
    if (v.type === 'all') return showAllRow
    if (vehicleFilter === 'all') return true
    if (vehicleFilter === 'drones') return v.type === 'drone'
    if (vehicleFilter === 'trucks') return v.type === 'truck'
    return false
  })

  // In driver mode, sort vehicles so they appear grouped: All, then (Truck N, Driver N, Drone X, Drone Y...) per group
  const sortedVehicles = vehicleFilter === 'driver'
    ? [...filteredVehicles].sort((a, b) => {
        // All row first
        if (a.type === 'all') return -1
        if (b.type === 'all') return 1
        // Then sort by groupId
        const gA = a.groupId ?? 999
        const gB = b.groupId ?? 999
        if (gA !== gB) return gA - gB
        // Within a group: truck first, then driver, then drones
        const typeOrder = { truck: 0, driver: 1, drone: 2, all: -1 }
        return (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3)
      })
    : filteredVehicles

  // Apply stop-type filter to vehicle stops
  const allStopTypesActive = activeStopTypes.size === ALL_STOP_TYPES.length
  const stopFilteredByType = allStopTypesActive
    ? sortedVehicles
    : sortedVehicles.map((v) => ({
        ...v,
        stops: v.stops.filter((s) => activeStopTypes.has(s.type)),
      }))

  // Collapse-by-truck filter: hide non-truck rows whose groupId is collapsed.
  // The truck row itself always renders so the user can toggle back.
  const typeFilteredVehicles =
    collapsedGroups.size === 0
      ? stopFilteredByType
      : stopFilteredByType.filter(v => {
          if (v.groupId == null) return true
          if (!collapsedGroups.has(v.groupId)) return true
          return v.type === 'truck'
        })

  // Spread overlapping stops apart so they're easier to click.
  // Icon width = 24px; we want at least 4px gap between icon edges → 28px center-to-center.
  const ICON_W = 24
  const GAP = 4
  const STRIDE = ICON_W + GAP
  const stopFilteredVehicles = typeFilteredVehicles.map((v) => {
    const stops = v.stops.map((s) => ({ ...s })) // shallow clone so we can mutate pixelOffset
    for (let i = 0; i < stops.length; i++) {
      const a = stops[i]
      const aUnit = isDistanceMode ? (a.cumulativeDistance || 0) : a.time
      const aPx = aUnit * pixelsPerUnit + (a.pixelOffset || 0)

      for (let j = i + 1; j < stops.length; j++) {
        const b = stops[j]
        const bUnit = isDistanceMode ? (b.cumulativeDistance || 0) : b.time
        const bPx = bUnit * pixelsPerUnit + (b.pixelOffset || 0)
        if (bPx - aPx >= STRIDE) break // sorted — no more overlaps possible
        // Nudge b to the right so its center is STRIDE px from a's center
        b.pixelOffset = (b.pixelOffset || 0) + (STRIDE - (bPx - aPx))
      }
    }
    return { ...v, stops }
  })

  // Compute the actual rightmost icon position after spreading so the track is always
  // wide enough to contain all icons without them overflowing off the right edge.
  const ICON_HALF = 12 // half of 24px icon
  let maxIconRight = baseTimelineWidth
  stopFilteredVehicles.forEach((v) => {
    v.stops.forEach((s) => {
      const unitValue = isDistanceMode ? (s.cumulativeDistance || 0) : s.time
      const iconRight = unitValue * pixelsPerUnit + 16 + (s.pixelOffset || 0) + ICON_HALF
      if (iconRight > maxIconRight) maxIconRight = iconRight
    })
  })
  const timelineWidth = maxIconRight + TRACK_PAD_RIGHT

  // Row height for calculating current time marker height
  const rowHeight = 42
  const headerHeight = 28
  const totalContentHeight = headerHeight + stopFilteredVehicles.length * rowHeight

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
              style={{ width: '100px', cursor: 'pointer', accentColor: '#3b82f6' }}
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

          {/* Location display mode toggle */}
          <Flex
            align="center"
            gap="0"
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button style={segBtn(locationMode === 'street')} onClick={() => setLocationMode('street')} title="Show street addresses">
              <span style={{ color: locationMode === 'street' ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                <MapPin size={12} />
              </span>
            </button>
            <button style={segBtn(locationMode === 'coordinates')} onClick={() => setLocationMode('coordinates')} title="Show coordinates">
              <span style={{ color: locationMode === 'coordinates' ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                <Hash size={12} />
              </span>
            </button>
          </Flex>
        </Flex>

        {/* Event type filter + Axis mode toggle */}
        <Flex align="center" gap="2">
          <EventTypeFilter activeTypes={activeStopTypes} onToggle={handleStopTypeToggle} onSelectAll={handleStopTypeSelectAll} onClearAll={handleStopTypeClearAll} />

          <div style={{ width: '1px', height: '20px', backgroundColor: '#d1d5db' }} />

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
        </Flex>

        {/* Vehicle filter toggle */}
        {onVehicleFilterChange && (
          <Flex align="center" gap="2">
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
                { key: 'driver' as VehicleFilter, label: 'Drivers', icon: <User size={12} /> },
              ]).map((option) => {
                const isActive = vehicleFilter === option.key
                const isAllHighlight = option.key === 'all' && isActive && showAllRow
                const isDriverHighlight = option.key === 'driver' && isActive
                const btnStyle = isAllHighlight
                  ? { ...segBtn(true), color: '#2563eb', backgroundColor: '#eff6ff' }
                  : isDriverHighlight
                    ? { ...segBtn(true), backgroundColor: '#fb923c', color: 'white' }
                    : segBtn(isActive)
                const iconColor = isDriverHighlight
                  ? 'white'
                  : isActive ? '#3b82f6' : '#9ca3af'
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (option.key === 'all' && vehicleFilter === 'all') {
                        setShowAllRow((prev) => !prev)
                      } else {
                        onVehicleFilterChange(option.key)
                      }
                    }}
                    style={btnStyle}
                  >
                    {option.icon && (
                      <span style={{ color: iconColor, display: 'flex' }}>
                        {option.icon}
                      </span>
                    )}
                    {option.label}
                  </button>
                )
              })}
            </Flex>

            {/* Truck/Drone sub-toggles — always visible, greyed out when not in driver mode */}
            <Flex
              align="center"
              gap="0"
              style={{
                backgroundColor: '#e5e7eb',
                borderRadius: '6px',
                padding: '2px',
                opacity: vehicleFilter === 'driver' ? 1 : 0.4,
                pointerEvents: vehicleFilter === 'driver' ? 'auto' : 'none',
              }}
            >
              <button
                onClick={() => setShowTrucksInDriver((prev) => !prev)}
                disabled={vehicleFilter !== 'driver'}
                style={{ ...segBtn(vehicleFilter === 'driver' && showTrucksInDriver), cursor: vehicleFilter === 'driver' ? 'pointer' : 'default' }}
                title={showTrucksInDriver ? 'Hide truck rows' : 'Show truck rows'}
              >
                <span style={{ color: vehicleFilter === 'driver' && showTrucksInDriver ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                  <Truck size={12} />
                </span>
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#d1d5db' }} />
              <button
                onClick={() => setShowDronesInDriver((prev) => !prev)}
                disabled={vehicleFilter !== 'driver'}
                style={{ ...segBtn(vehicleFilter === 'driver' && showDronesInDriver), cursor: vehicleFilter === 'driver' ? 'pointer' : 'default' }}
                title={showDronesInDriver ? 'Hide drone rows' : 'Show drone rows'}
              >
                <span style={{ color: vehicleFilter === 'driver' && showDronesInDriver ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                  <Drone size={12} />
                </span>
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#d1d5db' }} />
              <button
                onClick={() => setShowAllRow((prev) => !prev)}
                disabled={vehicleFilter !== 'driver'}
                style={{ ...segBtn(vehicleFilter === 'driver' && showAllRow), cursor: vehicleFilter === 'driver' ? 'pointer' : 'default' }}
                title={showAllRow ? 'Hide All summary row' : 'Show All summary row'}
              >
                <span style={{ color: vehicleFilter === 'driver' && showAllRow ? '#3b82f6' : '#9ca3af', display: 'flex' }}>
                  <LayoutList size={12} />
                </span>
              </button>
            </Flex>
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
              {stopFilteredVehicles.map((vehicle, index) => {
                // Detect group start: first truck in a new group (not the first row overall)
                const isGroupStart = vehicleFilter === 'driver' && vehicle.type === 'truck' && vehicle.groupId != null && index > 0
                // Show the collapse chevron only when there's more than one truck group AND this is a truck row.
                const isCollapsibleTruck =
                  vehicle.type === 'truck' && vehicle.groupId != null && truckGroupIds.length > 1

                return (
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
                    isGroupStart={isGroupStart}
                    locationMode={locationMode}
                    onStopClick={onStopClick}
                    onStopDoubleClick={onStopDoubleClick}
                    onVehicleClick={onVehicleClick}
                    onVehicleDoubleClick={onVehicleDoubleClick}
                    isCollapsibleTruck={isCollapsibleTruck}
                    isCollapsed={vehicle.groupId != null && collapsedGroups.has(vehicle.groupId)}
                    onToggleCollapse={
                      isCollapsibleTruck && vehicle.groupId != null
                        ? () => toggleGroupCollapse(vehicle.groupId as number)
                        : undefined
                    }
                  />
                )
              })}

              {/* Current time marker - only show during mission in duration mode */}
              {currentTime > 0 && (
                <Box style={{ position: 'absolute', top: 0, left: '150px', right: 0, height: '100%', pointerEvents: 'none' }}>
                  <GanttCurrentTimeMarker
                    currentTime={currentTime}
                    pixelsPerSecond={isDistanceMode ? 0 : pixelsPerUnit}
                    height={stopFilteredVehicles.length * rowHeight}
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
            vehicles={stopFilteredVehicles}
            allVehicles={data.vehicles}
            axisMode={axisMode}
            locationMode={locationMode}
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
