import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

const TruckRoutePath: FC = () => {
  const { truckRoute } = useFlightPlanner()

  if (truckRoute.length < 2) return null

  return (
    <ArrowheadPolyline
      positions={truckRoute}
      color="#000000"
      weight={3}
      arrowSize={10}
      arrowRepeat={150}
      arrowOffset='50%'
    />
  )
}

export default TruckRoutePath
