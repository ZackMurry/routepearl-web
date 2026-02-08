'use client'

import React, { FC, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { GanttStop, GanttStopType, GanttAxisMode, formatGanttTime, formatGanttDistance } from './gantt.types'
import { formatDistance } from '../timeline/timeline.types'
import { House, Package, ArrowUp, ArrowDown, Zap, Truck } from 'lucide-react'

interface Props {
  stop: GanttStop
  vehicleColor: string
  pixelsPerUnit: number
  totalDuration: number
  axisMode: GanttAxisMode
  onStopClick?: (stop: GanttStop) => void
  onStopDoubleClick?: (stop: GanttStop) => void
}

const GanttStopIcon: FC<Props> = ({ stop, vehicleColor, pixelsPerUnit, totalDuration, axisMode, onStopClick, onStopDoubleClick }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const iconRef = useRef<HTMLDivElement>(null)

  // Position based on axis mode
  const unitValue = axisMode === 'distance' ? (stop.cumulativeDistance || 0) : stop.time
  const leftPosition = unitValue * pixelsPerUnit + 16

  // Icon size
  const iconSize = 16

  // Whether this launch/return has an associated delivery
  const hasOrder = !!stop.orderName

  const handleMouseEnter = useCallback(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
    }
    setShowTooltip(true)
  }, [])

  // Get icon based on stop type
  const getIcon = (type: GanttStopType) => {
    switch (type) {
      case 'depot':
        return <House size={iconSize} />
      case 'delivery':
        return <Package size={iconSize} />
      case 'launch':
        return hasOrder
          ? <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}><ArrowUp size={iconSize * 0.65} /><Package size={iconSize * 0.65} /></span>
          : <ArrowUp size={iconSize} />
      case 'return':
        return hasOrder
          ? <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}><ArrowDown size={iconSize * 0.65} /><Package size={iconSize * 0.65} /></span>
          : <ArrowDown size={iconSize} />
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
    <>
      <div
        ref={iconRef}
        className="gantt-stop-icon"
        style={{
          position: 'absolute',
          left: `${leftPosition}px`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          cursor: 'pointer',
          zIndex: showTooltip ? 100 : 10,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => onStopClick?.(stop)}
        onDoubleClick={() => onStopDoubleClick?.(stop)}
      >
        {/* Icon container */}
        <div
          style={{
            width: `${hasOrder && (stop.type === 'launch' || stop.type === 'return') ? iconSize + 16 : iconSize + 8}px`,
            height: `${iconSize + 8}px`,
            borderRadius: '4px',
            backgroundColor: getBackgroundColor(stop.type),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}
        >
          {getIcon(stop.type)}
        </div>
      </div>

      {/* Tooltip rendered via portal to escape overflow clipping */}
      {showTooltip && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1f2937',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 10000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{stop.label}</div>
          {/* Always show time */}
          <div style={{ color: '#9ca3af' }}>
            Time: {formatGanttTime(stop.time)}
            {stop.duration > 0 && ` (${formatGanttTime(stop.duration)} duration)`}
          </div>
          {/* Always show distance when available */}
          {stop.distance !== undefined && stop.distance > 0 && (
            <div style={{ color: '#34d399', marginTop: '2px' }}>
              Segment: {formatDistance(stop.distance)}
            </div>
          )}
          {stop.cumulativeDistance !== undefined && stop.cumulativeDistance > 0 && (
            <div style={{ color: '#6ee7b7', marginTop: '2px' }}>
              Cumulative: {formatGanttDistance(stop.cumulativeDistance)}
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
        </div>,
        document.body
      )}
    </>
  )
}

export default GanttStopIcon
