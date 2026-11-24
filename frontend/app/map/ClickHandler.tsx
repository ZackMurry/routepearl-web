import { MissionSite } from '@/lib/types'
import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { useFlightPlanner } from './FlightPlannerContext'

const DEFAULT_CLOSURE_RADIUS_M = 60

const ClickHandler = () => {
  const {
    missionConfig,
    addNode,
    plotModeOrder,
    plotModeNodes,
    isFlightPlannerMode,
    placingClosure,
    setPlacingClosure,
    addRoadClosure,
  } = useFlightPlanner()
  useMapEvents({
    click(e) {
      // Re-planning: drop a road closure where the map was clicked.
      if (placingClosure) {
        addRoadClosure({ lat: e.latlng.lat, lng: e.latlng.lng, radiusM: DEFAULT_CLOSURE_RADIUS_M })
        setPlacingClosure(false)
        return
      }

      // Only create nodes if in flight planner mode and one of the plot modes is enabled
      if (!isFlightPlannerMode || (!plotModeOrder && !plotModeNodes)) return

      let newNode: MissionSite

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
    const shouldBeCrosshair = placingClosure || (isFlightPlannerMode && (plotModeNodes || plotModeOrder))
    if (shouldBeCrosshair && !isCrosshair) {
      map.getContainer().className += ' leaflet-cursor-crosshair'
    } else if (!shouldBeCrosshair && isCrosshair) {
      map.getContainer().className = map.getContainer().className.replaceAll(' leaflet-cursor-crosshair', '')
    }
  }, [map, plotModeNodes, plotModeOrder, placingClosure, isFlightPlannerMode])
  return null
}

export default ClickHandler
