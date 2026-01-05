import { Point } from '@/lib/types'
import { FC } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import chroma from 'chroma-js'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'

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
        <ArrowheadPolyline
          key={`sortie-${sortieIndex}-segment-${i}`}
          positions={[pt, sortie[i + 1]]}
          color={colors[i === 0 ? 'outbound' : 'inbound']}
          weight={isFinalSortie ? 5 : 4} // Slightly thicker for final sortie
          arrowSize={isFinalSortie ? 14 : 12} // Larger arrows for final sortie
          arrowRepeat={0} // One arrow at the end of each segment
          arrowOffset='100%'
        />
      ))}
    </>
  )
}

export default SortieFlightPath
