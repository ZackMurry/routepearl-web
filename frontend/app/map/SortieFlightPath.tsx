import { Point, SortieStatus } from '@/lib/types'
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
  truckRouteId: string
  truckColor: string
  localSortieIndex: number
  // Execution status after a re-plan: done sorties are greyed, airborne ones solid.
  status?: SortieStatus
}

const SortieFlightPath: FC<Props> = ({
  sortie,
  sortieIndex,
  routeId,
  vehicleId,
  truckRouteId,
  truckColor,
  localSortieIndex,
  status,
}) => {
  const { selectedRouteId, setSelectedRouteId, hiddenRouteIds } = useFlightPlanner()
  if (sortie.length < 3) return <></>
  // Sortie hides whenever its parent truck is hidden — drones don't have an
  // independent visibility toggle, just the truck-level one.
  if (hiddenRouteIds.has(truckRouteId)) return <></>

  const sortieColor = status === 'done' ? '#9ca3af' : getDroneColor(truckColor, localSortieIndex)

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
          weight={isSelected ? 6 : isDimmed || status === 'done' ? 2 : 4}
          opacity={isDimmed ? 0.3 : status === 'done' ? 0.6 : 1}
          arrowSize={12}
          arrowRepeat={0}
          arrowOffset='100%'
          curvature={0.22}
          dashed={status !== 'in_flight'}
        />
      ))}
    </>
  )
}

export default SortieFlightPath
