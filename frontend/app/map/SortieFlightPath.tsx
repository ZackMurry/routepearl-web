import { Point } from '@/lib/types'
import { FC } from 'react'
import { Polyline } from 'react-leaflet'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadArcPolyline from '@/components/ArrowheadArcPolyline'
import { getDroneColor } from './routeData'

interface Props {
  sortie: Point[]
  sortieIndex: number
  routeId: string
  vehicleId: string
  truckColor: string
  localSortieIndex: number
}

const SortieFlightPath: FC<Props> = ({ sortie, sortieIndex, routeId, vehicleId, truckColor, localSortieIndex }) => {
  const { selectedRouteId, setSelectedRouteId } = useFlightPlanner()
  if (sortie.length < 3) return <></>

  const sortieColor = getDroneColor(truckColor, localSortieIndex)

  const isSelected = selectedRouteId === routeId || selectedRouteId === vehicleId
  const isDimmed = selectedRouteId !== null && selectedRouteId !== routeId && selectedRouteId !== vehicleId

  return (
    <>
      {/* Invisible wider hit-target along the launch→customer→recovery path. */}
      <Polyline
        positions={sortie.map(p => [p.lat, p.lng]) as [number, number][]}
        pathOptions={{ color: 'transparent', weight: 14, opacity: 0, fillOpacity: 0 }}
        eventHandlers={{
          click: e => {
            setSelectedRouteId(selectedRouteId === routeId ? null : routeId)
            e.originalEvent?.stopPropagation?.()
          },
        }}
      />
      {sortie.slice(0, -1).map((pt, i) => (
        <ArrowheadArcPolyline
          key={`sortie-${sortieIndex}-segment-${i}`}
          sortie={sortie as [Point, Point, Point]}
          inboundColor={sortieColor}
          outboundColor={sortieColor}
          weight={isSelected ? 6 : isDimmed ? 2 : 4}
          opacity={isDimmed ? 0.3 : 1}
          arrowSize={12}
          arrowRepeat={0}
          arrowOffset='100%'
          curvature={0.22}
          dashed
        />
      ))}
    </>
  )
}

export default SortieFlightPath
