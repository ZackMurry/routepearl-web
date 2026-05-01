'use client'

import React, { FC } from 'react'
import { GanttVehicle, GanttStop, GanttAxisMode, GanttLocationMode } from './gantt.types'
import GanttStopIcon from './GanttStopIcon'
import { Truck, Drone, LayoutList, User, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  vehicle: GanttVehicle
  pixelsPerUnit: number
  totalDuration: number
  totalDistance?: number
  axisMode: GanttAxisMode
  rowIndex: number
  isGreyed?: boolean // For empty fleet state
  gridIntervalPx: number // Pixel spacing for grid lines
  locationMode?: GanttLocationMode
  onStopClick?: (stop: GanttStop) => void
  onStopDoubleClick?: (stop: GanttStop) => void
  onVehicleClick?: (vehicle: GanttVehicle) => void
  onVehicleDoubleClick?: (vehicle: GanttVehicle) => void
  isGroupStart?: boolean // Add top gap for truck-driver group separation
  // Collapse-by-truck affordance (multi-truck Gantt). When set, the truck
  // row renders a chevron that toggles visibility of its driver/drone
  // siblings — the truck row itself stays visible so the user can expand back.
  isCollapsibleTruck?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const TRUCK_BLUE = '#1e3a8a'

// Convert hex color to rgba with low opacity
function vehicleTint(hex: string, alpha: number = 0.10): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const GanttRow: FC<Props> = ({ vehicle, pixelsPerUnit, totalDuration, totalDistance, axisMode, rowIndex, isGreyed = false, gridIntervalPx, isGroupStart = false, locationMode = 'street', onStopClick, onStopDoubleClick, onVehicleClick, onVehicleDoubleClick, isCollapsibleTruck = false, isCollapsed = false, onToggleCollapse }) => {
  const rowHeight = 42
  const isEven = rowIndex % 2 === 0
  const displayColor = vehicle.type === 'truck' || vehicle.type === 'driver' ? (vehicle.type === 'driver' ? vehicle.color : TRUCK_BLUE) : vehicle.color
  const rowTint = vehicleTint(displayColor)

  // Pre-compute stop group dividers for truck, driver, drone, and all rows
  const stopGroupDividers: React.ReactNode[] = []

  const stopPx = (s: GanttStop) => {
    const unitValue = axisMode === 'distance' ? (s.cumulativeDistance || 0) : s.time
    return unitValue * pixelsPerUnit + 16 + (s.pixelOffset || 0)
  }

  const pushDivider = (key: string | number, midPx: number, badgeText: string) => {
    stopGroupDividers.push(
      <div key={`divider-${key}`} style={{ position: 'absolute', left: `${midPx}px`, top: 0, bottom: 0, width: '2px', backgroundImage: 'repeating-linear-gradient(to bottom, #6b7280 0px, #6b7280 4px, transparent 4px, transparent 8px)', pointerEvents: 'none', zIndex: 5 }} />
    )
    stopGroupDividers.push(
      <div key={`label-${key}`} style={{ position: 'absolute', left: `${midPx}px`, top: '50%', transform: 'translate(-50%, -50%)', minWidth: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#4b5563', color: 'white', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 15 }}>
        {badgeText}
      </div>
    )
  }

  if (!isGreyed && (vehicle.type === 'driver' || vehicle.type === 'truck' || vehicle.type === 'drone')) {
    let droneIntervalCounter = 0
    for (let i = 1; i < vehicle.stops.length; i++) {
      const curr = vehicle.stops[i]
      if (curr.stopGroup == null) continue
      let prevIdx = i - 1
      while (prevIdx >= 0 && vehicle.stops[prevIdx].stopGroup == null) prevIdx--
      if (prevIdx < 0) continue
      const prev = vehicle.stops[prevIdx]
      if (prev.stopGroup === curr.stopGroup) continue
      const label = curr.stopGroupLabel || ''

      // For drone rows, skip dividers for intermediate Order/Rendezvous stops —
      // those labels are still visible in the tooltip on the stop icon itself.
      const isDroneIntermediateStop = vehicle.type === 'drone'
        && (label.startsWith('Order') || label === 'Rendezvous')
      if (isDroneIntermediateStop) continue

      droneIntervalCounter++
      const midPx = (stopPx(prev) + stopPx(curr)) / 2
      const badgeText = vehicle.type === 'drone'
        ? String(droneIntervalCounter)
        : label === 'Start' ? 'S'
          : label === 'Return to Depot' ? 'R'
          : label === 'Re-Launch' ? '↑'
          : label.replace('Stop ', '')
      pushDivider(i, midPx, badgeText)
    }
  }

  if (!isGreyed && vehicle.type === 'all') {
    // Build truck phase time boundaries from truck stops in the All row
    const truckStopsInAll = vehicle.stops.filter(
      (s) => s.vehicleName?.toLowerCase().includes('truck') && s.stopGroup != null
    )
    if (truckStopsInAll.length > 0) {
      // Collect unique phases in order
      const phases: { fromTime: number; label: string; group: number }[] = []
      let lastGroup = -1
      truckStopsInAll.forEach((s) => {
        if (s.stopGroup !== lastGroup) {
          phases.push({ fromTime: s.time, label: s.stopGroupLabel || '', group: s.stopGroup! })
          lastGroup = s.stopGroup!
        }
      })

      // Assign each All row stop to a phase index based on its time
      const getPhaseIdx = (stop: GanttStop): number => {
        let idx = 0
        for (let p = 0; p < phases.length; p++) {
          if (stop.time >= phases[p].fromTime) idx = p
        }
        return idx
      }

      // Walk the All row in visual order and place a divider wherever
      // adjacent stops cross a phase boundary — so the divider sits exactly
      // between two real markers rather than between distant truck stops.
      let intervalCounter = 0
      for (let i = 1; i < vehicle.stops.length; i++) {
        const prev = vehicle.stops[i - 1]
        const curr = vehicle.stops[i]
        const prevPhase = getPhaseIdx(prev)
        const currPhase = getPhaseIdx(curr)
        if (prevPhase === currPhase) continue
        intervalCounter++
        const midPx = (stopPx(prev) + stopPx(curr)) / 2
        const label = phases[currPhase].label
        const badgeText = label === 'Start' ? 'S'
          : label === 'Return to Depot' ? 'R'
          : label.replace('Stop ', '')
        pushDivider(`all-${i}`, midPx, badgeText)
      }
    }
  }

  return (
    <>
      {isGroupStart && (
        <div style={{ height: '6px', backgroundColor: '#e5e7eb' }} />
      )}
      <div
        className="gantt-row"
        style={{
          display: 'flex',
          height: `${rowHeight}px`,
          borderBottom: '1px solid #d1d5db',
          opacity: isGreyed ? 0.4 : 1,
        }}
      >
      {/* Vehicle label */}
      <div
        onClick={() => onVehicleClick?.(vehicle)}
        onDoubleClick={() => onVehicleDoubleClick?.(vehicle)}
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 20,
          width: '150px',
          minWidth: '150px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRight: '1px solid #d1d5db',
          backgroundColor: '#f3f4f6',
          borderLeft: `3px solid ${displayColor}`,
          cursor: onVehicleClick ? 'pointer' : 'default',
        }}
      >
        {/* Vehicle icon */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: displayColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          {vehicle.type === 'all' ? <LayoutList size={14} /> : vehicle.type === 'truck' ? <Truck size={14} /> : vehicle.type === 'driver' ? <User size={14} /> : <Drone size={14} />}
        </div>
        {/* Vehicle name */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#374151',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          {vehicle.name}
        </span>
        {/* Collapse-by-truck chevron — only on truck rows in a multi-truck Gantt */}
        {isCollapsibleTruck && (
          <button
            type='button'
            onClick={e => {
              e.stopPropagation()
              onToggleCollapse?.()
            }}
            title={isCollapsed ? 'Expand truck rows' : 'Collapse truck rows'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 2,
              marginLeft: 'auto',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Timeline track */}
      <div
        style={{
          flex: 1,
          position: 'relative',
        }}
      >
        {/* Colored background strip — same height as icons (24px), centered */}
        {!isGreyed && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '24px',
              transform: 'translateY(-50%)',
              backgroundColor: rowTint,
              pointerEvents: 'none',
            }}
          />
        )}
        {isGreyed && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f3f4f6',
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Grid lines */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'linear-gradient(90deg, #9ca3af 1px, transparent 1px)',
            backgroundSize: `${gridIntervalPx}px 100%`,
            backgroundPositionX: '16px',
            pointerEvents: 'none',
          }}
        />

        {/* Stop group dividers for truck and driver rows */}
        {stopGroupDividers}

        {/* Stop icons */}
        {!isGreyed &&
          vehicle.stops.map((stop, index) => (
            <GanttStopIcon
              key={`${vehicle.id}-${stop.id}-${index}`}
              stop={stop}
              vehicleColor={displayColor}
              pixelsPerUnit={pixelsPerUnit}
              totalDuration={totalDuration}
              axisMode={axisMode}
              locationMode={locationMode}
              onStopClick={onStopClick}
              onStopDoubleClick={onStopDoubleClick}
            />
          ))}

        {/* Empty state indicator for greyed rows */}
        {isGreyed && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '11px',
              color: '#9ca3af',
              fontStyle: 'italic',
            }}
          >
            No route data
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default GanttRow
