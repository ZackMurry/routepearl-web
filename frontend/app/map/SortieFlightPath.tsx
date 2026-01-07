import { Point } from '@/lib/types'
import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import chroma from 'chroma-js'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'
import ArrowheadArcPolyline from '@/components/ArrowheadArcPolyline'

interface Props {
  sortie: Point[]
  sortieIndex: number
}

const SortieFlightPath: FC<Props> = ({ sortie, sortieIndex }) => {
  const { droneRoutes } = useFlightPlanner()
  const isFinalSortie = sortieIndex === droneRoutes.length - 1

  const colors = {
    outbound: isFinalSortie
      ? chroma.scale(['#facc15', '#fbbf24'])(0.5).hex()
      : chroma.scale(['#10b981', '#14b8a6'])(0.5).hex(),
    inbound: isFinalSortie
      ? chroma.scale(['#f59e0b', '#f97316'])(0.5).hex()
      : chroma.scale(['#f97316', '#ef4444'])(0.5).hex(),
  }
  return (
    <>
      {sortie.slice(0, -1).map((pt, i) => (
        <ArrowheadArcPolyline
          key={`sortie-${sortieIndex}-segment-${i}`}
          positions={[pt, sortie[i + 1]]}
          color='#4673bd'
          label={`S${sortieIndex + 1}`}
          weight={3}
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
