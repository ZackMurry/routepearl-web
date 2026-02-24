import { Point } from '@/lib/types'
import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadArcPolyline from '@/components/ArrowheadArcPolyline'

interface Props {
  sortie: Point[]
  sortieIndex: number
}

const SortieFlightPath: FC<Props> = ({ sortie, sortieIndex }) => {
  const { droneRoutes, selectedRouteId } = useFlightPlanner()
  const isFinalSortie = sortieIndex === droneRoutes.length - 1
  if (sortie.length < 3) return <></>

  // Each sortie gets a distinct warm color from the palette
  const sortieColors = ['#ef4444', '#f97316', '#f59e0b', '#ea580c', '#e11d48', '#dc2626', '#d97706']
  const sortieColor = sortieColors[sortieIndex % sortieColors.length]

  const routeId = `drone-${sortieIndex + 1}`
  const isSelected = selectedRouteId === routeId
  const isDimmed = selectedRouteId !== null && selectedRouteId !== routeId

  return (
    <>
      {sortie.slice(0, -1).map((pt, i) => (
        <ArrowheadArcPolyline
          key={`sortie-${sortieIndex}-segment-${i}`}
          sortie={sortie as [Point, Point, Point]}
          inboundColor={sortieColor}
          outboundColor={sortieColor}
          weight={isSelected ? 6 : isDimmed ? 2 : 4}
          opacity={isDimmed ? 0.3 : 1}
          arrowSize={isFinalSortie ? 14 : 12}
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
