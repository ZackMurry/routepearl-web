'use client'

import React, { FC } from 'react'
import { GanttVehicle, GanttStop, GanttAxisMode } from './gantt.types'
import GanttStopIcon from './GanttStopIcon'
import { Truck, Plane } from 'lucide-react'

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

const GanttRow: FC<Props> = ({ vehicle, pixelsPerUnit, totalDuration, totalDistance, axisMode, rowIndex, isGreyed = false, gridIntervalPx, onStopClick, onStopDoubleClick, onVehicleClick, onVehicleDoubleClick }) => {
  const rowHeight = 48
  const isEven = rowIndex % 2 === 0

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
          width: '150px',
          minWidth: '150px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRight: '1px solid #d1d5db',
          backgroundColor: '#f3f4f6',
          borderLeft: `3px solid ${vehicle.color}`,
          cursor: onVehicleClick ? 'pointer' : 'default',
        }}
      >
        {/* Vehicle icon */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: vehicle.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          {vehicle.type === 'truck' ? <Truck size={14} /> : <Plane size={14} />}
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
          backgroundColor: isGreyed ? '#f3f4f6' : isEven ? 'rgba(249,250,251,0.5)' : 'white',
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
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
              vehicleColor={vehicle.color}
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
