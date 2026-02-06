'use client'

import React, { FC, useRef, useState, useEffect } from 'react'
import { Box, Flex, Text, Button, Slider } from '@radix-ui/themes'
import { Plus, FolderOpen, ZoomIn, ZoomOut } from 'lucide-react'
import { GanttData, GanttChartState, formatGanttTime } from './gantt.types'
import GanttTimeAxis from './GanttTimeAxis'
import GanttRow from './GanttRow'
import GanttCurrentTimeMarker from './GanttCurrentTimeMarker'

interface Props {
  data: GanttData
  state: GanttChartState
  currentTime?: number // Current mission time in seconds (for live tracking)
  onCreatePlan?: () => void
  onLoadPlan?: () => void
}

const GanttChart: FC<Props> = ({
  data,
  state,
  currentTime = 0,
  onCreatePlan,
  onLoadPlan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [zoomLevel, setZoomLevel] = useState(1) // 1 = default, 0.5 = zoomed out, 2 = zoomed in

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract label width (100px) from total width
        setContainerWidth(containerRef.current.offsetWidth - 100)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)

    // Also observe container size changes
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
  const timelineWidth = containerWidth * zoomLevel

  // Pixels per second
  const pixelsPerSecond = timelineWidth / Math.max(data.totalDuration, 1)

  // Row height for calculating current time marker height
  const rowHeight = 48
  const headerHeight = 28
  const totalContentHeight = headerHeight + data.vehicles.length * rowHeight

  // Format current date
  const dateString = data.startTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // No plan state - show placeholder with CTAs
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
        <Box
          style={{
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
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
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        {/* Zoom control */}
        <Flex align="center" gap="2">
          <ZoomOut size={14} style={{ color: '#6b7280' }} />
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            style={{ width: '100px' }}
          />
          <ZoomIn size={14} style={{ color: '#6b7280' }} />
          <Text size="1" style={{ color: '#6b7280', marginLeft: '8px' }}>
            {Math.round(zoomLevel * 100)}%
          </Text>
        </Flex>

        {/* Date display */}
        <Text size="1" style={{ color: '#6b7280' }}>
          {dateString}
        </Text>

        {/* Duration info */}
        <Text size="1" style={{ color: '#6b7280' }}>
          Duration: {formatGanttTime(data.totalDuration)}
        </Text>
      </Flex>

      {/* Scrollable timeline content */}
      <Box style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Box style={{ minWidth: `${timelineWidth + 100}px` }}>
          {/* Time axis */}
          <Flex>
            {/* Empty space for label column */}
            <Box style={{ width: '100px', minWidth: '100px', backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' }} />
            {/* Time axis */}
            <Box style={{ flex: 1, position: 'relative' }}>
              <GanttTimeAxis
                totalDuration={data.totalDuration}
                zoomLevel={zoomLevel}
                width={timelineWidth}
              />
            </Box>
          </Flex>

          {/* Vehicle rows */}
          <Box style={{ position: 'relative' }}>
            {data.vehicles.map((vehicle) => (
              <GanttRow
                key={vehicle.id}
                vehicle={vehicle}
                pixelsPerSecond={pixelsPerSecond}
                totalDuration={data.totalDuration}
                isGreyed={state === 'empty-fleet'}
              />
            ))}

            {/* Current time marker - only show during mission */}
            {currentTime > 0 && (
              <Box style={{ position: 'absolute', top: 0, left: '100px', right: 0, height: '100%', pointerEvents: 'none' }}>
                <GanttCurrentTimeMarker
                  currentTime={currentTime}
                  pixelsPerSecond={pixelsPerSecond}
                  height={data.vehicles.length * rowHeight}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

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
