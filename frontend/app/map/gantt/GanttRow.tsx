'use client'

import React, { FC } from 'react'
import { GanttVehicle } from './gantt.types'
import GanttStopIcon from './GanttStopIcon'
import { Truck, Plane } from 'lucide-react'

interface Props {
  vehicle: GanttVehicle
  pixelsPerSecond: number
  totalDuration: number
  isGreyed?: boolean // For empty fleet state
}

const GanttRow: FC<Props> = ({ vehicle, pixelsPerSecond, totalDuration, isGreyed = false }) => {
  const rowHeight = 48

  return (
    <div
      className="gantt-row"
      style={{
        display: 'flex',
        height: `${rowHeight}px`,
        borderBottom: '1px solid #e5e7eb',
        opacity: isGreyed ? 0.4 : 1,
      }}
    >
      {/* Vehicle label */}
      <div
        style={{
          width: '150px',
          minWidth: '150px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
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
          backgroundColor: isGreyed ? '#f3f4f6' : 'white',
        }}
      >
        {/* Grid lines (optional subtle background) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'linear-gradient(90deg, #f3f4f6 1px, transparent 1px)',
            backgroundSize: `${300 * pixelsPerSecond}px 100%`, // Grid every 5 minutes
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
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
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
