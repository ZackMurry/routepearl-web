'use client'

import React, { FC } from 'react'
import { formatGanttTime } from './gantt.types'

interface Props {
  totalDuration: number // in seconds
  zoomLevel: number // 1 = default, higher = more detail
  width: number // container width in pixels
}

const GanttTimeAxis: FC<Props> = ({ totalDuration, zoomLevel, width }) => {
  // Calculate interval based on duration and zoom level
  // Base interval is 5 minutes (300 seconds), adjusted by zoom
  const baseInterval = 300 // 5 minutes
  const interval = Math.max(60, Math.floor(baseInterval / zoomLevel)) // minimum 1 minute

  // Generate tick marks
  const ticks: { time: number; label: string; isMajor: boolean }[] = []
  const majorInterval = interval * 2 // Major ticks every 2 intervals

  for (let time = 0; time <= totalDuration; time += interval) {
    const isMajor = time % majorInterval === 0
    ticks.push({
      time,
      label: formatGanttTime(time),
      isMajor,
    })
  }

  // Calculate pixels per second
  const pixelsPerSecond = width / Math.max(totalDuration, 1)

  return (
    <div
      className="gantt-time-axis"
      style={{
        position: 'relative',
        height: '28px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
      }}
    >
      {ticks.map((tick, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${tick.time * pixelsPerSecond}px`,
            top: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Tick line */}
          <div
            style={{
              width: '1px',
              height: tick.isMajor ? '8px' : '4px',
              backgroundColor: tick.isMajor ? '#6b7280' : '#d1d5db',
              marginTop: 'auto',
            }}
          />
          {/* Label - only show for major ticks or if there's enough space */}
          {tick.isMajor && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                color: '#6b7280',
                whiteSpace: 'nowrap',
              }}
            >
              {tick.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default GanttTimeAxis
