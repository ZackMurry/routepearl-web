import { FlightNode } from '@/lib/types'
import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { useFlightPlanner } from './FlightPlannerContext'

const ClickHandler = () => {
  const { missionConfig, addNode, truckRoute, droneRoutes, plotModeOrder, plotModeNodes } = useFlightPlanner()
  useMapEvents({
    click(e) {
      // Only create nodes if one of the plot modes is enabled
      if (!plotModeOrder && !plotModeNodes) return

      let newNode: FlightNode

      if (plotModeOrder) {
        // Order plot mode - create order nodes
        newNode = {
          id: `node-${Date.now()}`,
          type: 'order',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `Order ${missionConfig.nodes.filter(n => n.type === 'order').length + 1}`,
        }
      } else {
        // Nodes plot mode - create waypoint nodes
        newNode = {
          id: `node-${Date.now()}`,
          type: 'waypoint',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `Waypoint ${missionConfig.nodes.filter(n => n.type === 'waypoint').length + 1}`,
        }
      }

      addNode(newNode)
    },
  })

  const map = useMap()
  useEffect(() => {
    const isCrosshair = map.getContainer().classList.contains('leaflet-cursor-crosshair')
    const shouldBeCrosshair = plotModeNodes || plotModeOrder
    if (shouldBeCrosshair && !isCrosshair) {
      map.getContainer().className += ' leaflet-cursor-crosshair'
    } else if (!shouldBeCrosshair && isCrosshair) {
      map.getContainer().className = map.getContainer().className.replaceAll(' leaflet-cursor-crosshair', '')
    }
  }, [map, plotModeNodes, plotModeOrder])
  return null
}

export default ClickHandler
