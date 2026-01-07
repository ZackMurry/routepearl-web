import { FlightNode } from '@/lib/types'
import React, { FC, useMemo } from 'react'
import { Circle } from 'react-leaflet'
import LucideMarker from './LucideMarker'
import { getOrDefault, pointMatchesNode } from '@/lib/util'
import TextMarker from '@/components/TextMarker'
import { useFlightPlanner } from './FlightPlannerContext'
import { HAZARD_COLORS, NODE_COLORS } from '@/lib/constants'

interface Props {
  node: FlightNode
}

const FlightNodeMarker: FC<Props> = ({ node }) => {
  const hazardColor = getOrDefault(HAZARD_COLORS, node.severity)
  // Nodes are draggable only when both plot modes are OFF

  // Helper function: Get ALL sortie info for a node (a node can have multiple roles)
  const {
    updateNode,
    removeNode,
    truckRoute,
    droneRoutes,
    isFlightPlannerMode,
    plotModeCustomer,
    plotModeNodes,
    missionConfig,
    setSelectedNodeId,
  } = useFlightPlanner()

  const isDroneDelivery = useMemo(
    () =>
      droneRoutes.some(sortie => {
        if (sortie.length < 2) {
          return false
        }
        return pointMatchesNode(sortie[1], node)
      }),
    [droneRoutes, node],
  )

  const isTruckDelivery = node.type === 'customer' && !isDroneDelivery
  const isDraggable = !plotModeCustomer && !plotModeNodes

  const getAllSortieInfo = (node: FlightNode): Array<{ type: 'launch' | 'return' | 'delivery'; sortieNumber: number }> => {
    const sortieInfos: Array<{ type: 'launch' | 'return' | 'delivery'; sortieNumber: number }> = []

    for (let i = 0; i < droneRoutes.length; i++) {
      const sortie = droneRoutes[i]
      if (sortie.length >= 3) {
        if (pointMatchesNode(sortie[0], node)) {
          sortieInfos.push({ type: 'launch', sortieNumber: i + 1 })
        }
        if (pointMatchesNode(sortie[1], node)) {
          sortieInfos.push({ type: 'delivery', sortieNumber: i + 1 })
        }
        if (pointMatchesNode(sortie[2], node)) {
          sortieInfos.push({ type: 'return', sortieNumber: i + 1 })
        }
      }
    }

    return sortieInfos
  }
  const allSortieInfo = getAllSortieInfo(node)

  return (
    <React.Fragment key={node.id}>
      {/* Render circle for hazard nodes */}
      {node.type === 'hazard' && (
        <Circle
          center={[node.lat, node.lng]}
          radius={node.radius || 100} // Default 100m radius
          pathOptions={{
            color: hazardColor,
            fillColor: hazardColor,
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      )}
      <LucideMarker
        position={[node.lat, node.lng]}
        anchor={[0.25, 1]}
        color={isDroneDelivery ? '#4673bd' : 'black'}
        onClick={() => {
          // Only allow selecting when plot modes are off
          if (!plotModeCustomer && !plotModeNodes) {
            setSelectedNodeId(node.id)
          }
        }}
        onRightClick={() => removeNode(node.id)}
        draggable={isDraggable}
        onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
      />

      {/* Delivery type indicator */}
      {/* {isDroneDelivery && (
        <TextMarker
          position={[node.lat, node.lng]}
          text='🚁'
          offset={[15, -35]}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      )} */}

      {/* Sortie info indicators (for launch/return points) - can have multiple */}
      {false &&
        allSortieInfo
          .filter(info => info.type !== 'delivery')
          .map((sortieInfo, idx) => (
            <TextMarker
              key={`${node.id}-sortie-${sortieInfo.sortieNumber}-${sortieInfo.type}`}
              position={[node.lat, node.lng]}
              text={sortieInfo.type === 'launch' ? `S${sortieInfo.sortieNumber} ⬆` : `S${sortieInfo.sortieNumber} ⬇`}
              offset={[-45 - idx * 50, -35]} // Stack horizontally if multiple markers
              style={{
                backgroundColor: sortieInfo.type === 'launch' ? '#f97316' : '#10b981',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                border: '1px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            />
          ))}
    </React.Fragment>
  )
}

export default FlightNodeMarker
