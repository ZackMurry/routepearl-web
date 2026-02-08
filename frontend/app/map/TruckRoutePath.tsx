import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

const TruckRoutePath: FC = () => {
  const { truckRoute, selectedRouteId } = useFlightPlanner()

  if (truckRoute.length < 2) return null

  const isSelected = selectedRouteId === 'truck'
  const isDimmed = selectedRouteId !== null && selectedRouteId !== 'truck'

  return (
    <ArrowheadPolyline
      positions={truckRoute}
      color="#000000"
      weight={isSelected ? 6 : isDimmed ? 2 : 3}
      opacity={isDimmed ? 0.3 : 1}
      arrowSize={14}
      arrowRepeat={80}
      arrowOffset='30px'
      offset={4}
    />
  )
}

export default TruckRoutePath
