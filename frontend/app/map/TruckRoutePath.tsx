import { FC, useMemo } from 'react'
import { CircleMarker } from 'react-leaflet'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

const TruckRoutePath: FC = () => {
  const { truckRoute, droneRoutes, selectedRouteId, fleetMode } = useFlightPlanner()

  // Collect drone launch (orange) and recovery (green) points
  const droneStops = useMemo(() => {
    const stops: { lat: number; lng: number; type: 'launch' | 'recover' }[] = []
    droneRoutes.forEach((sortie) => {
      if (sortie.length >= 3) {
        stops.push({ lat: sortie[0].lat, lng: sortie[0].lng, type: 'launch' })
        stops.push({ lat: sortie[2].lat, lng: sortie[2].lng, type: 'recover' })
      }
    })
    return stops
  }, [droneRoutes])

  if (truckRoute.length < 2) return null

  const hasTruck = fleetMode === 'truck-drone' || fleetMode === 'truck-only'
  const isSelected = selectedRouteId === 'truck'
  const isDimmed = selectedRouteId !== null && selectedRouteId !== 'truck'

  return (
    <>
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
      {/* Drone launch (orange) and recovery (green) stop indicators on truck route */}
      {hasTruck && droneStops.map((stop, i) => (
        <CircleMarker
          key={`drone-stop-${i}`}
          center={[stop.lat, stop.lng]}
          radius={5}
          pathOptions={{
            color: 'white',
            weight: 1.5,
            fillColor: stop.type === 'launch' ? '#f97316' : '#10b981',
            fillOpacity: isDimmed ? 0.3 : 0.9,
            opacity: isDimmed ? 0.3 : 1,
          }}
        />
      ))}
    </>
  )
}

export default TruckRoutePath
