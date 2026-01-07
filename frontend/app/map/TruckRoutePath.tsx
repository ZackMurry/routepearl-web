import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import { Point } from '@/lib/types'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

const TruckRoutePath: FC = () => {
  // Create segments of truck route for arrow placement
  const { truckRoute } = useFlightPlanner()
  const chunkSize = Math.max(1, Math.floor(truckRoute.length / 15)) // ~15 arrows total
  const segments: Point[][] = []
  for (let i = 0; i < truckRoute.length - 1; i += chunkSize) {
    const end = Math.min(i + chunkSize + 1, truckRoute.length)
    segments.push(truckRoute.slice(i, end))
  }

  return segments.map((segment, segmentIndex) => (
    <ArrowheadPolyline
      key={`truck-segment-${segmentIndex}`}
      positions={segment}
      color='black'
      weight={3}
      arrowSize={10}
      arrowRepeat={0}
      arrowOffset='100%'
    />
  ))
}

export default TruckRoutePath
