import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

const TruckRoutePath: FC = () => {
  const { truckRoute, selectedRouteId, fleetMode } = useFlightPlanner()

  if (truckRoute.length < 2) return null

  const hasTruck = fleetMode === 'truck-drone' || fleetMode === 'truck-only'
  const isSelected = selectedRouteId === 'truck'
  const isDimmed = selectedRouteId !== null && selectedRouteId !== 'truck'

  return (
    <ArrowheadPolyline
      positions={truckRoute}
      color={hasTruck ? '#1e3a5f' : '#9ca3af'}
      weight={isSelected ? 6 : isDimmed || !hasTruck ? 2 : 3}
      opacity={!hasTruck ? 0.35 : isDimmed ? 0.3 : 1}
      arrowSize={12}
      arrowRepeat='10%'
      arrowOffset='5%'
      offset={4}
    />
  )
}

export default TruckRoutePath
