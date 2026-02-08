'use client'

import React, { FC } from 'react'
import { formatGanttTime } from './gantt.types'

interface Props {
  currentTime: number // in seconds from mission start
  pixelsPerSecond: number
  height: number // container height in pixels
}

const GanttCurrentTimeMarker: FC<Props> = ({ currentTime, pixelsPerSecond, height }) => {
  const leftPosition = currentTime * pixelsPerSecond + 16

  return (
    <div
      className="gantt-current-time-marker"
      style={{
        position: 'absolute',
        left: `${leftPosition}px`,
        top: 0,
        height: `${height}px`,
        width: '2px',
        backgroundColor: '#ef4444', // red
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      {/* Time indicator at top */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}
      >
        {formatGanttTime(currentTime)}
      </div>
      {/* Dot at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#ef4444',
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

export default GanttCurrentTimeMarker
