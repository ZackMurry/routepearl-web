import { FlightNode } from '@/lib/types'
import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { useFlightPlanner } from './FlightPlannerContext'

const ClickHandler = () => {
  const { missionConfig, addNode, truckRoute, droneRoutes, plotModeCustomer, plotModeNodes } = useFlightPlanner()
  useMapEvents({
    click(e) {
      // Only create nodes if one of the plot modes is enabled
      if (!plotModeCustomer && !plotModeNodes) return

      let newNode: FlightNode

      if (plotModeCustomer) {
        // Customer plot mode - create customer nodes
        newNode = {
          id: `node-${Date.now()}`,
          type: 'customer',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `Customer ${missionConfig.nodes.filter(n => n.type === 'customer').length + 1}`,
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
    const shouldBeCrosshair = plotModeNodes || plotModeCustomer
    if (shouldBeCrosshair && !isCrosshair) {
      map.getContainer().className += ' leaflet-cursor-crosshair'
    } else if (!shouldBeCrosshair && isCrosshair) {
      map.getContainer().className = map.getContainer().className.replaceAll(' leaflet-cursor-crosshair', '')
    }
    console.log(map.getContainer().classList)
    console.log('container class:', map.getContainer().className)
  }, [map, plotModeNodes, plotModeCustomer])
  return null
}

export default ClickHandler
