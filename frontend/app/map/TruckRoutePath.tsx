import { FC, useMemo } from 'react'
import { CircleMarker, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useFlightPlanner } from './FlightPlannerContext'
import ArrowheadPolyline from '@/components/ArrowheadPolyline'
import { GeneratedTruckRoute } from '@/lib/types'
import { getTruckRouteColor } from './routeData'

interface Props {
  route: GeneratedTruckRoute
  // 1-based per-type display index ("E1" = first electric, "G2" = second gas).
  // Source of truth for the depot badge label and the route's UI identity.
  typeIndex: number
  // Hide the depot badge entirely when there's only one truck (no need to disambiguate).
  isMultiTruck: boolean
}

const TruckRoutePath: FC<Props> = ({ route, typeIndex, isMultiTruck }) => {
  const { selectedRouteId, setSelectedRouteId, fleetMode } = useFlightPlanner()

  // Collect drone launch (orange) and recovery (green) points
  const droneStops = useMemo(() => {
    const stops: { lat: number; lng: number; type: 'launch' | 'recover' }[] = []
    route.droneRoutes.forEach(sortie => {
      if (sortie.length >= 3) {
        stops.push({ lat: sortie[0].lat, lng: sortie[0].lng, type: 'launch' })
        stops.push({ lat: sortie[2].lat, lng: sortie[2].lng, type: 'recover' })
      }
    })
    return stops
  }, [route.droneRoutes])

  const color = getTruckRouteColor(route.truckType, route.truckId)
  const isSelected = selectedRouteId === route.routeId
  const isDimmed = selectedRouteId !== null && selectedRouteId !== route.routeId

  // Short depot-badge label: "E1", "E2", "G1", "G2" — per design doc M1.a.
  const badgeLabel = `${route.truckType === 'electric' ? 'E' : 'G'}${typeIndex}`
  const badgeIcon = useMemo(
    () =>
      L.divIcon({
        html: `<div style="
          background:${color};
          color:white;
          font:600 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          padding:3px 6px;
          border-radius:4px;
          border:1.5px solid white;
          box-shadow:0 1px 2px rgba(0,0,0,0.4);
          white-space:nowrap;
          opacity:${isDimmed ? 0.4 : 1};
        ">${badgeLabel}</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [-6, 24],
      }),
    [color, badgeLabel, isDimmed],
  )

  if (route.truckRoute.length < 2) return null

  const hasTruck = fleetMode === 'truck-drone' || fleetMode === 'truck-only'
  const depotPoint = route.truckRoute[0]

  return (
    <>
      {/* Invisible wider hit-target for click-to-select. Sits on top of the
          visible polyline so clicks on or near the route register. */}
      <Polyline
        positions={route.truckRoute}
        pathOptions={{ color: 'transparent', weight: 14, opacity: 0, fillOpacity: 0 }}
        eventHandlers={{
          click: e => {
            setSelectedRouteId(selectedRouteId === route.routeId ? null : route.routeId)
            e.originalEvent?.stopPropagation?.()
          },
        }}
      />
      <ArrowheadPolyline
        positions={route.truckRoute}
        color={hasTruck ? color : '#9ca3af'}
        weight={isSelected ? 6 : isDimmed || !hasTruck ? 2 : 3}
        opacity={!hasTruck ? 0.35 : isDimmed ? 0.3 : 1}
        arrowSize={12}
        arrowRepeat='10%'
        arrowOffset='5%'
        offset={Math.min(4 + route.truckId * 3, 12)}
      />
      {/* Per-truck depot badge ("E1", "G2", etc.) — only shown for multi-truck. */}
      {isMultiTruck && hasTruck && (
        <Marker position={[depotPoint.lat, depotPoint.lng]} icon={badgeIcon} interactive={false} />
      )}
      {/* Drone launch (orange) and recovery (green) stop indicators on truck route */}
      {hasTruck && droneStops.map((stop, i) => (
        <CircleMarker
          key={`drone-stop-${i}`}
          center={[stop.lat, stop.lng]}
          radius={5}
          pathOptions={{
            color: 'white',
            weight: 1.5,
            fillColor: stop.type === 'launch' ? '#f97316' : '#10b981',
            fillOpacity: isDimmed ? 0.3 : 0.9,
            opacity: isDimmed ? 0.3 : 1,
          }}
        />
      ))}
    </>
  )
}

export default TruckRoutePath
