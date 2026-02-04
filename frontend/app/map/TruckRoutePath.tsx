import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import { Point } from '@/lib/types'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'
import chroma from 'chroma-js'

const TruckRoutePath: FC = () => {
  // Create segments of truck route for arrow placement
  const { truckRoute } = useFlightPlanner()
  const chunkSize = Math.max(1, Math.floor(truckRoute.length / 15)) // ~15 arrows total
  const segments: Point[][] = []
  for (let i = 0; i < truckRoute.length - 1; i += chunkSize) {
    const end = Math.min(i + chunkSize + 1, truckRoute.length)
    segments.push(truckRoute.slice(i, end))
  }

  return segments.map((segment, segmentIndex) => {
    const progress = segmentIndex / Math.max(1, segments.length - 1)
    const color = chroma.scale(['#60a5fa', '#a855f7'])(progress).hex() // Light blue to violet
    return (
      <ArrowheadPolyline
        key={`truck-segment-${segmentIndex}`}
        positions={segment}
        color={color}
        weight={3}
        arrowSize={10}
        arrowRepeat={0}
        arrowOffset='100%'
      />
    )
  })
}

export default TruckRoutePath
