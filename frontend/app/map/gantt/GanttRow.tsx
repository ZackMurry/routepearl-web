'use client'

import React, { FC } from 'react'
import { GanttVehicle, GanttStop, GanttAxisMode } from './gantt.types'
import GanttStopIcon from './GanttStopIcon'
import { Truck, Drone, LayoutList } from 'lucide-react'

interface Props {
  vehicle: GanttVehicle
  pixelsPerUnit: number
  totalDuration: number
  totalDistance?: number
  axisMode: GanttAxisMode
  rowIndex: number
  isGreyed?: boolean // For empty fleet state
  gridIntervalPx: number // Pixel spacing for grid lines
  onStopClick?: (stop: GanttStop) => void
  onStopDoubleClick?: (stop: GanttStop) => void
  onVehicleClick?: (vehicle: GanttVehicle) => void
  onVehicleDoubleClick?: (vehicle: GanttVehicle) => void
}

const TRUCK_BLUE = '#1e3a8a'

// Convert hex color to rgba with low opacity
function vehicleTint(hex: string, alpha: number = 0.10): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const GanttRow: FC<Props> = ({ vehicle, pixelsPerUnit, totalDuration, totalDistance, axisMode, rowIndex, isGreyed = false, gridIntervalPx, onStopClick, onStopDoubleClick, onVehicleClick, onVehicleDoubleClick }) => {
  const rowHeight = 42
  const isEven = rowIndex % 2 === 0
  const displayColor = vehicle.type === 'truck' ? TRUCK_BLUE : vehicle.color
  const rowTint = vehicleTint(displayColor)

  return (
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
          {vehicle.type === 'all' ? <LayoutList size={14} /> : vehicle.type === 'truck' ? <Truck size={14} /> : <Drone size={14} />}
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
          }}
        >
          {vehicle.name}
        </span>
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
  )
}

export default GanttRow
