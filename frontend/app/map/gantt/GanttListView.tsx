'use client'

import React, { FC } from 'react'
import { ScrollArea } from '@radix-ui/themes'
import { GanttVehicle, GanttStop, GanttStopType, GanttAxisMode, GanttLocationMode, getStopColor, formatGanttTime, formatGanttDistance, getStopLocation } from './gantt.types'
import { House, Package, ArrowUp, ArrowDown, Zap, Truck, Drone, LayoutList, MapPin, Download } from 'lucide-react'

interface Props {
  vehicles: GanttVehicle[]
  axisMode: GanttAxisMode
  locationMode?: GanttLocationMode
  onStopClick?: (stop: GanttStop) => void
  onStopDoubleClick?: (stop: GanttStop) => void
  onVehicleClick?: (vehicle: GanttVehicle) => void
  onVehicleDoubleClick?: (vehicle: GanttVehicle) => void
}

const ICON_SIZE = 12

function getStopIcon(type: GanttStopType, hasOrder: boolean) {
  switch (type) {
    case 'depot':
      return <House size={ICON_SIZE} />
    case 'delivery':
      return <Package size={ICON_SIZE} />
    case 'launch':
      return hasOrder
        ? <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}><ArrowUp size={ICON_SIZE * 0.7} /><Package size={ICON_SIZE * 0.7} /></span>
        : <ArrowUp size={ICON_SIZE} />
    case 'return':
      return hasOrder
        ? <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}><ArrowDown size={ICON_SIZE * 0.7} /><Package size={ICON_SIZE * 0.7} /></span>
        : <ArrowDown size={ICON_SIZE} />
    case 'recover':
      return <Download size={ICON_SIZE} />
    case 'charging':
      return <Zap size={ICON_SIZE} />
    case 'travel':
      return <Truck size={ICON_SIZE} />
    default:
      return <Package size={ICON_SIZE} />
  }
}

function getStopBgColor(type: GanttStopType, vehicleColor: string): string {
  if (type === 'delivery') return vehicleColor
  return getStopColor(type) // getStopColor now handles 'recover' → cyan
}

// Derive accent color for a group label
function getGroupAccent(label: string): string {
  if (label === 'Start') return '#22c55e'
  if (label === 'Return to Depot') return '#ef4444'
  if (label === 'Rendezvous') return '#a855f7'
  if (label === 'Re-Launch') return '#f97316'
  if (label === 'On Truck') return '#1e3a8a'
  if (label.startsWith('Order')) return '#3b82f6'
  return '#6b7280'
}

// Derive badge text for a group label
function getGroupBadge(label: string, sequentialNum?: number): string {
  if (label === 'Start') return 'S'
  if (label === 'Return to Depot') return 'R'
  if (label === 'Rendezvous') return '⇲'
  if (label === 'Re-Launch') return '↑'
  if (label === 'On Truck') return '🚛'
  if (label.startsWith('Order')) return '📦'
  if (sequentialNum != null) return String(sequentialNum)
  return label.replace('Stop ', '')
}

// Build stop groups for a vehicle row.
// For truck: travel segments (no stopGroupLabel) are folded into the preceding group.
// For all: stops are bucketed into truck phase time windows.
function buildGroups(
  vehicle: GanttVehicle,
  allVehicles: GanttVehicle[]
): { label: string; stops: GanttStop[] }[] {
  const stops = vehicle.stops

  if (vehicle.type === 'all') {
    // Derive phase time windows from the truck vehicle's non-travel stops
    const truckVehicle = allVehicles.find((v) => v.type === 'truck')
    if (!truckVehicle) return [{ label: 'All', stops }]

    const boundaries: { label: string; fromTime: number }[] = []
    let lastLabel = ''
    truckVehicle.stops.forEach((s) => {
      if (!s.stopGroupLabel) return
      if (s.stopGroupLabel !== lastLabel) {
        boundaries.push({ label: s.stopGroupLabel, fromTime: s.time })
        lastLabel = s.stopGroupLabel
      }
    })
    if (boundaries.length === 0) return [{ label: 'All', stops }]

    const groups: { label: string; stops: GanttStop[] }[] = boundaries.map((b) => ({ label: b.label, stops: [] }))
    stops.forEach((stop) => {
      // Find the last boundary whose fromTime ≤ stop.time
      let phaseIdx = 0
      for (let b = 0; b < boundaries.length; b++) {
        if (stop.time >= boundaries[b].fromTime) phaseIdx = b
      }
      groups[phaseIdx].stops.push(stop)
    })
    return groups.filter((g) => g.stops.length > 0)
  }

  // driver / drone / truck: group by stopGroupLabel, carrying forward for unlabeled stops
  const groups: { label: string; stops: GanttStop[] }[] = []
  let currentLabel = ''
  let currentGroup: { label: string; stops: GanttStop[] } | null = null
  stops.forEach((stop) => {
    const label = stop.stopGroupLabel || currentLabel || 'Unknown'
    if (stop.stopGroupLabel) currentLabel = stop.stopGroupLabel
    if (!currentGroup || currentGroup.label !== label) {
      currentGroup = { label, stops: [] }
      groups.push(currentGroup)
    }
    currentGroup.stops.push(stop)
  })
  return groups
}

const GanttListView: FC<Props> = ({ vehicles, axisMode, locationMode = 'street', onStopClick, onStopDoubleClick, onVehicleClick, onVehicleDoubleClick }) => {
  const isDuration = axisMode === 'duration'
  const emphStyle = { fontWeight: 600, color: '#1e293b' } as const
  const dimStyle = { color: '#94a3b8' } as const

  const useGrouped = (type: string) =>
    type === 'driver' || type === 'drone' || type === 'truck' || type === 'all'

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: '0' }}>
        {vehicles.map((vehicle) => {
          const totalDur = vehicle.stops.reduce((s, st) => s + st.duration, 0)
          const totalDist = vehicle.stops.reduce((s, st) => s + (st.distance || 0), 0)

          return (
            <div key={vehicle.id}>
              {/* Vehicle group header */}
              <div
                onClick={() => onVehicleClick?.(vehicle)}
                onDoubleClick={() => onVehicleDoubleClick?.(vehicle)}
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 12px',
                  backgroundColor: '#f3f4f6',
                  borderLeft: `3px solid ${vehicle.color}`,
                  borderBottom: '1px solid #d1d5db',
                  cursor: onVehicleClick ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: vehicle.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {vehicle.type === 'all' ? <LayoutList size={14} /> : vehicle.type === 'truck' ? <Truck size={14} /> : <Drone size={14} />}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  {vehicle.name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                  {vehicle.stops.length} stop{vehicle.stops.length !== 1 ? 's' : ''}
                  {' · '}
                  {formatGanttTime(totalDur)}
                  {' · '}
                  {formatGanttDistance(totalDist)}
                </span>
              </div>

              {/* Events table */}
              {vehicle.stops.length > 0 ? (
                useGrouped(vehicle.type) ? (() => {
                  const groups = buildGroups(vehicle, vehicles)
                  let globalIdx = 0
                  let intervalCounter = 0
                  return groups.map((group, gIdx) => {
                    const accent = getGroupAccent(group.label)
                    const isNumbered = !['Start', 'Return to Depot', 'Rendezvous', 'Re-Launch', 'On Truck'].includes(group.label) && !group.label.startsWith('Order')
                    if (isNumbered) intervalCounter++
                    const badge = getGroupBadge(group.label, isNumbered ? intervalCounter : undefined)
                    const groupLocation = group.stops.find((s) => s.address || (s.lat != null && s.lng != null))
                    const locationStr = groupLocation ? getStopLocation(groupLocation, locationMode) : undefined

                    return (
                      <div key={`group-${gIdx}`}>
                        {/* Interval header — intentionally thin */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '2px 10px',
                            backgroundColor: `${accent}10`,
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: `3px solid ${accent}`,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '16px',
                              height: '16px',
                              borderRadius: '8px',
                              backgroundColor: accent,
                              color: 'white',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '0 4px',
                              flexShrink: 0,
                            }}
                          >
                            {badge}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            {group.label}
                          </span>
                          {locationStr && (
                            <span style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <MapPin size={9} />
                              {locationStr}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af' }}>
                            {group.stops.length}
                          </span>
                        </div>

                        {/* Events within this stop group */}
                        <table className="data-table">
                          {gIdx === 0 && (
                            <thead>
                              <tr>
                                <th className="col-stat-sm">#</th>
                                <th style={{ width: '52px', minWidth: '52px' }}>Type</th>
                                <th className="col-flex">Event</th>
                                <th className="col-flex">Location</th>
                                <th className="col-stat">Order</th>
                                <th className="col-stat" style={isDuration ? emphStyle : dimStyle}>Time</th>
                                <th className="col-stat" style={isDuration ? emphStyle : dimStyle}>Duration</th>
                                <th className="col-stat" style={!isDuration ? emphStyle : dimStyle}>Distance</th>
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {group.stops.map((stop, idx) => {
                              globalIdx++
                              return (
                                <tr
                                  key={`${vehicle.id}-${stop.id}-${idx}`}
                                  onClick={() => onStopClick?.(stop)}
                                  onDoubleClick={() => onStopDoubleClick?.(stop)}
                                  style={{ cursor: onStopClick ? 'pointer' : 'default' }}
                                >
                                  <td className="col-stat-sm">{globalIdx}</td>
                                  <td>
                                    <div
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '4px',
                                        backgroundColor: getStopBgColor(stop.type, stop.vehicleColor || vehicle.color),
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                      }}
                                    >
                                      {getStopIcon(stop.type, !!stop.orderName)}
                                    </div>
                                  </td>
                                  <td>
                                    <span>{stop.label}</span>
                                    {stop.sortieNumber != null && (
                                      <span style={{ marginLeft: '6px', fontSize: '11px', color: '#8b5cf6' }}>
                                        #{stop.sortieNumber}
                                      </span>
                                    )}
                                    {stop.vehicleName && (
                                      <span style={{ marginLeft: '6px', fontSize: '10px', color: stop.vehicleColor || '#6b7280' }}>
                                        {stop.vehicleName}
                                      </span>
                                    )}
                                  </td>
                                  <td className="cell-truncate" style={{ color: '#6b7280', fontSize: '11px' }}>
                                    {getStopLocation(stop, locationMode) || '--'}
                                  </td>
                                  <td>
                                    {(stop.orderName || stop.locationBadge) ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {/* Location badge (blue) for launch/return: physical launch/landing node */}
                                        {(stop.type === 'launch' || stop.type === 'return' || stop.type === 'recover') && stop.locationBadge && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              minWidth: '16px',
                                              height: '16px',
                                              borderRadius: '8px',
                                              backgroundColor: '#0369a1',
                                              color: 'white',
                                              fontSize: '9px',
                                              fontWeight: 700,
                                              padding: '0 4px',
                                              lineHeight: 1,
                                            }}
                                          >
                                            {stop.locationBadge}
                                          </span>
                                        )}
                                        {/* Order ID badge (dark) for all other stop types */}
                                        {stop.orderId != null && stop.type !== 'launch' && stop.type !== 'return' && stop.type !== 'recover' && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              minWidth: '16px',
                                              height: '16px',
                                              borderRadius: '8px',
                                              backgroundColor: '#1f2937',
                                              color: 'white',
                                              fontSize: '9px',
                                              fontWeight: 700,
                                              padding: '0 4px',
                                              lineHeight: 1,
                                            }}
                                          >
                                            {stop.orderId}
                                          </span>
                                        )}
                                        {stop.orderName}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#d1d5db' }}>--</span>
                                    )}
                                  </td>
                                  <td style={isDuration ? emphStyle : dimStyle}>
                                    {formatGanttTime(stop.time)}
                                  </td>
                                  <td style={isDuration ? emphStyle : dimStyle}>
                                    {stop.duration > 0 ? formatGanttTime(stop.duration) : '--'}
                                  </td>
                                  <td style={!isDuration ? emphStyle : dimStyle}>
                                    {stop.distance && stop.distance > 0
                                      ? formatGanttDistance(stop.distance)
                                      : '--'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })
                })() : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-stat-sm">#</th>
                        <th style={{ width: '52px', minWidth: '52px' }}>Type</th>
                        <th className="col-flex">Event</th>
                        <th className="col-flex">Location</th>
                        <th className="col-stat">Order</th>
                        <th className="col-stat" style={isDuration ? emphStyle : dimStyle}>Time</th>
                        <th className="col-stat" style={isDuration ? emphStyle : dimStyle}>Duration</th>
                        <th className="col-stat" style={!isDuration ? emphStyle : dimStyle}>Distance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicle.stops.map((stop, idx) => (
                        <tr
                          key={`${vehicle.id}-${stop.id}-${idx}`}
                          onClick={() => onStopClick?.(stop)}
                          onDoubleClick={() => onStopDoubleClick?.(stop)}
                          style={{ cursor: onStopClick ? 'pointer' : 'default' }}
                        >
                          <td className="col-stat-sm">{idx + 1}</td>
                          <td>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '4px',
                                backgroundColor: getStopBgColor(stop.type, vehicle.color),
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                              }}
                            >
                              {getStopIcon(stop.type, !!stop.orderName)}
                            </div>
                          </td>
                          <td>
                            <span>{stop.label}</span>
                            {stop.sortieNumber != null && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', color: '#8b5cf6' }}>
                                #{stop.sortieNumber}
                              </span>
                            )}
                          </td>
                          <td className="cell-truncate" style={{ color: '#6b7280', fontSize: '11px' }}>
                            {getStopLocation(stop, locationMode) || '--'}
                          </td>
                          <td>
                            {(stop.orderName || stop.locationBadge) ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {(stop.type === 'launch' || stop.type === 'return' || stop.type === 'recover') && stop.locationBadge && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: '16px',
                                      height: '16px',
                                      borderRadius: '8px',
                                      backgroundColor: '#0369a1',
                                      color: 'white',
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      padding: '0 4px',
                                      lineHeight: 1,
                                    }}
                                  >
                                    {stop.locationBadge}
                                  </span>
                                )}
                                {stop.orderId != null && stop.type !== 'launch' && stop.type !== 'return' && stop.type !== 'recover' && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: '16px',
                                      height: '16px',
                                      borderRadius: '8px',
                                      backgroundColor: '#1f2937',
                                      color: 'white',
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      padding: '0 4px',
                                      lineHeight: 1,
                                    }}
                                  >
                                    {stop.orderId}
                                  </span>
                                )}
                                {stop.orderName}
                              </span>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>--</span>
                            )}
                          </td>
                          <td style={isDuration ? emphStyle : dimStyle}>
                            {formatGanttTime(stop.time)}
                          </td>
                          <td style={isDuration ? emphStyle : dimStyle}>
                            {stop.duration > 0 ? formatGanttTime(stop.duration) : '--'}
                          </td>
                          <td style={!isDuration ? emphStyle : dimStyle}>
                            {stop.distance && stop.distance > 0
                              ? formatGanttDistance(stop.distance)
                              : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    borderBottom: '1px solid #d1d5db',
                  }}
                >
                  No matching events
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export default GanttListView
