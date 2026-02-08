import { FlightNode } from '@/lib/types'
import React, { FC, ReactNode, useMemo } from 'react'
import { Circle } from 'react-leaflet'
import LucideMarker from './LucideMarker'
import { getOrDefault, pointMatchesNode } from '@/lib/util'
import TextMarker from '@/components/TextMarker'
import NumberedMarker from '@/components/NumberedMarker'
import { useFlightPlanner } from './FlightPlannerContext'
import { HAZARD_COLORS, NODE_COLORS } from '@/lib/constants'
import { Circle as LucideCircle, House, LucideIcon, LucideProps, MapPin, Zap } from 'lucide-react'

interface Props {
  node: FlightNode
}

interface Marker {
  icon: LucideIcon
  anchor: [number, number]
  size?: number
}

const FlightNodeMarker: FC<Props> = ({ node }) => {
  const hazardColor = getOrDefault(HAZARD_COLORS, node.severity)
  // Nodes are draggable only when both plot modes are OFF

  // Helper function: Get ALL sortie info for a node (a node can have multiple roles)
  const { updateNode, removeNode, truckRoute, droneRoutes, plotModeOrder, plotModeNodes, setSelectedNodeId } = useFlightPlanner()

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

  const isTruckDelivery = useMemo(
    () =>
      !isDroneDelivery && truckRoute.some(pt => pointMatchesNode(pt, node)),
    [isDroneDelivery, truckRoute, node],
  )

  // Order circle color: yellow=drone, blue=truck, white=unrouted
  const orderColor = isDroneDelivery ? '#facc15' : isTruckDelivery ? '#3b82f6' : '#ffffff'

  const isDraggable = !plotModeOrder && !plotModeNodes

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
  const marker: Marker | null = {
    depot: {
      icon: ((props: LucideProps) => <House fill='black' {...props} />) as LucideIcon,
      anchor: [0.5, 0.5] as [number, number],
      size: 16,
    },
    order: {
      icon: ((props: LucideProps) => <LucideCircle {...props} fill='#f9e912' />) as LucideIcon,
      anchor: [0.5, 0.5] as [number, number],
      size: 16,
    },
    station: {
      icon: ((props: LucideProps) => <Zap color='#f97316' {...props} />) as LucideIcon,
      anchor: [0.5, 0.5] as [number, number],
      size: 20,
    },
    waypoint: {
      icon: MapPin,
      anchor: [0, 0] as [number, number],
    },
    hazard: null,
  }[node.type]

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

      {/* Render NumberedMarker for order nodes */}
      {node.type === 'order' && (
        <NumberedMarker
          position={[node.lat, node.lng]}
          number={node.orderId || 0}
          size={24}
          color="#ffffff"
          textColor="#000000"
          onClick={() => {
            if (!plotModeOrder && !plotModeNodes) {
              setSelectedNodeId(node.id)
            }
          }}
          onRightClick={() => removeNode(node.id)}
          draggable={isDraggable}
          onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
        />
      )}

      {/* Render LucideMarker for non-order nodes */}
      {marker && node.type !== 'order' && (
        <LucideMarker
          position={[node.lat, node.lng]}
          anchor={marker.anchor}
          color={isDroneDelivery ? '#4673bd' : 'black'}
          onClick={() => {
            // Only allow selecting when plot modes are off
            if (!plotModeOrder && !plotModeNodes) {
              setSelectedNodeId(node.id)
            }
          }}
          onRightClick={() => removeNode(node.id)}
          draggable={isDraggable}
          onDragEnd={(lat, lng) => updateNode(node.id, { lat, lng })}
          LucideIcon={marker.icon}
          size={marker.size ?? 24}
        />
      )}

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
