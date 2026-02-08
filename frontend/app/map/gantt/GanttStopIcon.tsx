'use client'

import React, { FC, useState } from 'react'
import { GanttStop, GanttStopType, formatGanttTime, getStopColor } from './gantt.types'
import { formatDistance } from '../timeline/timeline.types'
import { House, Package, ArrowUp, ArrowDown, Zap, Truck } from 'lucide-react'

interface Props {
  stop: GanttStop
  vehicleColor: string
  pixelsPerSecond: number
  totalDuration: number
}

const GanttStopIcon: FC<Props> = ({ stop, vehicleColor, pixelsPerSecond, totalDuration }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  // Position based on time
  const leftPosition = stop.time * pixelsPerSecond

  // Icon size
  const iconSize = 16

  // Get icon based on stop type
  const getIcon = (type: GanttStopType) => {
    switch (type) {
      case 'depot':
        return <House size={iconSize} />
      case 'delivery':
        return <Package size={iconSize} />
      case 'launch':
        return <ArrowUp size={iconSize} />
      case 'return':
        return <ArrowDown size={iconSize} />
      case 'charging':
        return <Zap size={iconSize} />
      case 'travel':
        return <Truck size={iconSize} />
      default:
        return <Package size={iconSize} />
    }
  }

  // Get background color based on stop type
  const getBackgroundColor = (type: GanttStopType): string => {
    switch (type) {
      case 'depot':
        return '#374151' // gray-700
      case 'delivery':
        return vehicleColor // Use vehicle's color for deliveries
      case 'launch':
        return '#f97316' // orange
      case 'return':
        return '#10b981' // green
      case 'charging':
        return '#eab308' // yellow
      case 'travel':
        return '#9ca3af' // gray-400
      default:
        return vehicleColor
    }
  }

  return (
    <div
      className="gantt-stop-icon"
      style={{
        position: 'absolute',
        left: `${leftPosition}px`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        zIndex: showTooltip ? 100 : 10,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Icon container */}
      <div
        style={{
          width: `${iconSize + 8}px`,
          height: `${iconSize + 8}px`,
          borderRadius: '4px',
          backgroundColor: getBackgroundColor(stop.type),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
        }}
      >
        {getIcon(stop.type)}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1f2937',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{stop.label}</div>
          <div style={{ color: '#9ca3af' }}>
            Time: {formatGanttTime(stop.time)}
            {stop.duration > 0 && ` (${formatGanttTime(stop.duration)} duration)`}
          </div>
          {stop.distance !== undefined && stop.distance > 0 && (
            <div style={{ color: '#34d399', marginTop: '2px' }}>
              Distance: {formatDistance(stop.distance)}
            </div>
          )}
          {stop.orderName && (
            <div style={{ color: '#60a5fa', marginTop: '2px' }}>
              Order: {stop.orderName}
            </div>
          )}
          {stop.sortieNumber && (
            <div style={{ color: '#a78bfa', marginTop: '2px' }}>
              Sortie #{stop.sortieNumber}
            </div>
          )}
          {stop.description && (
            <div style={{ color: '#9ca3af', marginTop: '2px', fontStyle: 'italic' }}>
              {stop.description}
            </div>
          )}
          {/* Arrow pointing down */}
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1f2937',
            }}
          />
        </div>
      )}
    </div>
  )
}

export default GanttStopIcon
