'use client'

import React, { FC } from 'react'
import { GanttAxisMode, formatGanttTime, formatGanttDistance } from './gantt.types'

interface Props {
  totalDuration: number // in seconds
  totalDistance?: number // in meters
  axisMode: GanttAxisMode
  zoomLevel: number // 1 = default, higher = more detail
  width: number // container width in pixels
}

// Pick a "nice" interval for distance ticks (in meters)
function niceDistanceInterval(totalMeters: number, zoomLevel: number): number {
  const target = totalMeters / (5 * zoomLevel) // ~5 ticks at zoom 1
  const niceSteps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
  for (const step of niceSteps) {
    if (step >= target) return step
  }
  return 50000
}

const GanttTimeAxis: FC<Props> = ({ totalDuration, totalDistance, axisMode, zoomLevel, width }) => {
  const isDistance = axisMode === 'distance'
  const totalUnits = isDistance ? Math.max(totalDistance || 1, 1) : Math.max(totalDuration, 1)
  const pixelsPerUnit = width / totalUnits

  // Generate tick marks
  const ticks: { value: number; label: string; isMajor: boolean }[] = []

  if (isDistance) {
    const interval = niceDistanceInterval(totalUnits, zoomLevel)
    const majorInterval = interval * 2
    for (let dist = 0; dist <= totalUnits; dist += interval) {
      const isMajor = dist % majorInterval === 0
      ticks.push({ value: dist, label: formatGanttDistance(dist), isMajor })
    }
  } else {
    // Time-based ticks (existing logic)
    const baseInterval = 300 // 5 minutes
    const interval = Math.max(60, Math.floor(baseInterval / zoomLevel))
    const majorInterval = interval * 2
    for (let time = 0; time <= totalDuration; time += interval) {
      const isMajor = time % majorInterval === 0
      ticks.push({ value: time, label: formatGanttTime(time), isMajor })
    }
  }

  return (
    <div
      className="gantt-time-axis"
      style={{
        position: 'relative',
        height: '28px',
        borderBottom: '1px solid #d1d5db',
        backgroundColor: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      {ticks.map((tick, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${tick.value * pixelsPerUnit + 16}px`,
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
              height: tick.isMajor ? '12px' : '6px',
              backgroundColor: tick.isMajor ? '#374151' : '#9ca3af',
              marginTop: 'auto',
            }}
          />
          {/* Label - only show for major ticks */}
          {tick.isMajor && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                color: '#374151',
                whiteSpace: 'nowrap',
                fontWeight: 500,
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
