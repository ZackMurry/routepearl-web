'use client'

import React, { FC } from 'react'
import { ScrollArea } from '@radix-ui/themes'
import { GanttVehicle, GanttStop, GanttStopType, GanttAxisMode, GanttLocationMode, getStopColor, formatGanttTime, formatGanttDistance, getStopLocation } from './gantt.types'
import { House, Package, ArrowUp, ArrowDown, ArrowRight, Zap, Truck, Drone, User, LayoutList, MapPin, Download } from 'lucide-react'

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

// ──────────────────────────────────────────────────────────────────────
// Inline layout constants for the list view.
//
// The shared `.data-table` CSS rules from flight-planner.css don't end up
// in the bundle at runtime, so every width, padding and alignment that
// this view depends on is declared inline right here. Being self-contained
// also guarantees the exact same cell widths across every vehicle table
// and every group tbody (the root of the earlier alignment bug).
//
// Total of explicit column widths is 544 px; the two flex columns split
// the remainder of the `minWidth` (720 px) at 88 px each, which is enough
// headroom for real content while still fitting tight side panels.
// ──────────────────────────────────────────────────────────────────────
const GANTT_TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  minWidth: '720px',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  fontSize: '12px',
  lineHeight: 1.4,
}

const COL_WIDTHS = {
  num: 48,
  type: 56,
  // event & location are flex (no explicit width)
  order: 96,
  time: 96,
  duration: 100,
  distance: 100,
} as const

// Note: build the <col> list as an array so there is zero whitespace
// between children — indented JSX siblings inside <colgroup> produce
// text nodes which React flags as a hydration error.
const GANTT_COL_DEFS: React.CSSProperties[] = [
  { width: `${COL_WIDTHS.num}px` },
  { width: `${COL_WIDTHS.type}px` },
  {},
  {},
  { width: `${COL_WIDTHS.order}px` },
  { width: `${COL_WIDTHS.time}px` },
  { width: `${COL_WIDTHS.duration}px` },
  { width: `${COL_WIDTHS.distance}px` },
]
const GanttColgroup = () => (
  <colgroup>{GANTT_COL_DEFS.map((s, i) => <col key={i} style={s} />)}</colgroup>
)

// Shared th/td padding — matches what the original .data-table CSS used
// so visual density is preserved even without the external stylesheet.
const CELL_PAD: React.CSSProperties = { padding: '6px 10px' }
const TH_STYLE: React.CSSProperties = {
  ...CELL_PAD,
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '11px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  position: 'sticky',
  top: 0,
  zIndex: 1,
}
const TD_STYLE: React.CSSProperties = {
  ...CELL_PAD,
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
  color: '#334155',
  overflow: 'hidden',
}

// Shared pill styles used across the order cell.
const LOCATION_PILL: React.CSSProperties = {
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
}
const ORDER_PILL_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '16px',
  height: '16px',
  borderRadius: '8px',
  color: 'white',
  fontSize: '9px',
  fontWeight: 700,
  padding: '0 4px',
  lineHeight: 1,
}

// Order cell — shared between grouped and non-grouped renderers.
// Launch/return/recover stops now show both endpoints (truck-stop badge
// and delivery orderId) separated by an arrow, so the reader can see
// where the drone is going or coming from at a glance — e.g. "S → 3"
// for a launch, "3 → 1" for a return.
// The order-pill turns gold whenever the stop is a drone node — either
// because it originated from a drone row, or because it's a drone-related
// stop type (launch/return/recover) regardless of which row it's on.
function renderOrderCell(stop: GanttStop, isDrone?: boolean) {
  const hasContent = stop.orderName || stop.locationBadge || stop.orderId != null
  if (!hasContent) {
    return <span style={{ color: '#d1d5db' }}>--</span>
  }
  const isDroneNode =
    isDrone || stop.type === 'launch' || stop.type === 'return' || stop.type === 'recover'
  const orderPillBg = isDroneNode ? '#ca8a04' : '#1f2937'
  const orderPill = stop.orderId != null
    ? <span style={{ ...ORDER_PILL_BASE, backgroundColor: orderPillBg }}>{stop.orderId}</span>
    : null
  const locPill = stop.locationBadge
    ? <span style={LOCATION_PILL}>{stop.locationBadge}</span>
    : null
  const arrow = <ArrowRight size={10} color="#6b7280" />

  // Launch: truck-stop → order
  if (stop.type === 'launch' && (locPill || orderPill)) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {locPill}
        {locPill && orderPill && arrow}
        {orderPill}
      </span>
    )
  }
  // Return: order → truck-stop
  if (stop.type === 'return' && (locPill || orderPill)) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {orderPill}
        {orderPill && locPill && arrow}
        {locPill}
      </span>
    )
  }
  // Recover: truck-stop badge only (no paired order on these stops)
  if (stop.type === 'recover' && locPill) {
    return <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{locPill}</span>
  }
  // Everything else (delivery, depot, travel, charging): order badge + name
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {orderPill}
      {stop.orderName && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.orderName}</span>}
    </span>
  )
}

// For a launch/return stop, find the paired delivery stop in the same sortie
// so we can surface both locations (launch point → delivery point, etc.).
function findPairedDelivery(stop: GanttStop, stops: GanttStop[]): GanttStop | undefined {
  if (stop.type !== 'launch' && stop.type !== 'return') return undefined
  if (stop.sortieNumber == null) return undefined
  return stops.find((s) => s.type === 'delivery' && s.sortieNumber === stop.sortieNumber)
}

// Render the Location cell — shows both endpoints with an arrow for drone
// launch/return so the reader sees the full hop (like a train timetable).
function renderLocationCell(
  stop: GanttStop,
  vehicleStops: GanttStop[],
  locationMode: GanttLocationMode
) {
  const self = getStopLocation(stop, locationMode)
  if (stop.type === 'launch' || stop.type === 'return') {
    const paired = findPairedDelivery(stop, vehicleStops)
    const pairedLoc = paired ? getStopLocation(paired, locationMode) : undefined
    if (self && pairedLoc) {
      const [from, to] = stop.type === 'launch' ? [self, pairedLoc] : [pairedLoc, self]
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
          title={`${from} → ${to}`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
            {from}
          </span>
          <ArrowRight size={10} color="#6b7280" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
            {to}
          </span>
        </span>
      )
    }
  }
  return self || '--'
}

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
                  {vehicle.type === 'all'
                    ? <LayoutList size={14} />
                    : vehicle.type === 'truck'
                      ? <Truck size={14} />
                      : vehicle.type === 'driver'
                        ? <User size={14} />
                        : <Drone size={14} />}
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
                  return (
                    <table className="data-table" style={GANTT_TABLE_STYLE}>
                      <GanttColgroup />
                      <thead>
                        <tr>
                          <th style={{ ...TH_STYLE, textAlign: 'center' }}>#</th>
                          <th style={TH_STYLE}>Type</th>
                          <th style={TH_STYLE}>Event</th>
                          <th style={TH_STYLE}>Location</th>
                          <th style={TH_STYLE}>Order</th>
                          <th style={{ ...TH_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>Time</th>
                          <th style={{ ...TH_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>Duration</th>
                          <th style={{ ...TH_STYLE, ...(!isDuration ? emphStyle : dimStyle) }}>Distance</th>
                        </tr>
                      </thead>
                      {groups.map((group, gIdx) => {
                        const accent = getGroupAccent(group.label)
                        const isNumbered = !['Start', 'Return to Depot', 'Rendezvous', 'Re-Launch', 'On Truck'].includes(group.label) && !group.label.startsWith('Order')
                        if (isNumbered) intervalCounter++
                        const badge = getGroupBadge(group.label, isNumbered ? intervalCounter : undefined)
                        // Prefer the delivery stop's location; otherwise the first stop with an address.
                        const deliveryStop = group.stops.find((s) => s.type === 'delivery' && (s.address || (s.lat != null && s.lng != null)))
                        const groupLocation = deliveryStop || group.stops.find((s) => s.address || (s.lat != null && s.lng != null))
                        const locationStr = groupLocation ? getStopLocation(groupLocation, locationMode) : undefined
                        // Prefer the group's own delivery stop as the representative order —
                        // its orderId is the order actually being delivered at this stop.
                        // On truck/driver rows this matters because launch/recover stops carry
                        // the drone's orderId, not the truck's. If a truck/driver group has no
                        // delivery of its own, we surface no order (rather than leaking the
                        // drone's order point into the truck's header).
                        const deliveryOrderStop = group.stops.find(
                          (s) => s.type === 'delivery' && (s.orderId != null || s.orderName)
                        )
                        const orderStop =
                          deliveryOrderStop ??
                          (vehicle.type === 'drone' || vehicle.type === 'all'
                            ? group.stops.find((s) => s.orderId != null || s.orderName)
                            : undefined)
                        // Treat the header order as a drone node when the vehicle row is a drone,
                        // when the stop in the 'all' view came from a drone, or when the order-carrying
                        // stop is itself a drone-interaction type (launch/return/recover).
                        const headerIsDrone =
                          vehicle.type === 'drone' ||
                          (vehicle.type === 'all' && !!orderStop?.vehicleName?.startsWith('Drone')) ||
                          orderStop?.type === 'launch' ||
                          orderStop?.type === 'return' ||
                          orderStop?.type === 'recover'

                        // Shared td style for header cells — background tint + bottom border applied per-cell
                        // because colSpan no longer covers the whole row. The left accent stripe lives on the
                        // first cell only. Tint bumped + top border added so the header stands apart from the
                        // stop rows below.
                        const headerCellBase: React.CSSProperties = {
                          padding: '6px 10px',
                          backgroundColor: `${accent}26`,
                          borderTop: `1px solid ${accent}66`,
                          borderBottom: `1px solid ${accent}66`,
                          cursor: 'default',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }

                        return (
                          <tbody key={`group-${gIdx}`}>
                            {/* Interval header — cells map 1:1 to the column layout below so the
                                group badge, label, location, and order line up with their columns. */}
                            <tr className="group-header-row">
                              {/* # — group badge, aligned with row-number column */}
                              <td style={{ ...headerCellBase, textAlign: 'center', borderLeft: `3px solid ${accent}` }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '18px',
                                    height: '18px',
                                    borderRadius: '9px',
                                    backgroundColor: accent,
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '0 5px',
                                  }}
                                >
                                  {badge}
                                </span>
                              </td>
                              {/* Type — intentionally empty to mirror the icon slot */}
                              <td style={headerCellBase} />
                              {/* Event — group label */}
                              <td style={{ ...headerCellBase, textOverflow: 'ellipsis' }}>
                                <span
                                  style={{
                                    fontSize: '12.5px',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {group.label}
                                </span>
                              </td>
                              {/* Location — aligned under the Location column */}
                              <td style={{ ...headerCellBase, textOverflow: 'ellipsis' }} title={locationStr || undefined}>
                                {locationStr ? (
                                  <span
                                    style={{
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      color: '#0f172a',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      maxWidth: '100%',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <MapPin size={11} style={{ flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{locationStr}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>--</span>
                                )}
                              </td>
                              {/* Order — aligned under the Order column */}
                              <td style={{ ...headerCellBase, textOverflow: 'ellipsis' }}>
                                {orderStop && (orderStop.orderId != null || orderStop.orderName) ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '100%' }}>
                                    {orderStop.orderId != null && (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          minWidth: '16px',
                                          height: '16px',
                                          borderRadius: '8px',
                                          backgroundColor: headerIsDrone ? '#ca8a04' : '#1f2937',
                                          color: 'white',
                                          fontSize: '9px',
                                          fontWeight: 700,
                                          padding: '0 4px',
                                          lineHeight: 1,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {orderStop.orderId}
                                      </span>
                                    )}
                                    {orderStop.orderName && (
                                      <span
                                        style={{
                                          fontSize: '11.5px',
                                          color: '#0f172a',
                                          fontWeight: 700,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {orderStop.orderName}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>--</span>
                                )}
                              </td>
                              {/* Time/Duration/Distance — event count, right aligned across the numeric columns */}
                              <td colSpan={3} style={{ ...headerCellBase, textAlign: 'right' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155' }}>
                                  {group.stops.length} {group.stops.length === 1 ? 'event' : 'events'}
                                </span>
                              </td>
                            </tr>
                            {group.stops.map((stop, idx) => {
                              globalIdx++
                              return (
                                <tr
                                  key={`${vehicle.id}-${stop.id}-${idx}`}
                                  onClick={() => onStopClick?.(stop)}
                                  onDoubleClick={() => onStopDoubleClick?.(stop)}
                                  style={{ cursor: onStopClick ? 'pointer' : 'default' }}
                                >
                                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>{globalIdx}</td>
                                  <td style={TD_STYLE}>
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
                                  <td style={{ ...TD_STYLE, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span>{stop.label}</span>
                                    {stop.vehicleName && (
                                      <span style={{ marginLeft: '6px', fontSize: '10px', color: stop.vehicleColor || '#6b7280' }}>
                                        {stop.vehicleName}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ ...TD_STYLE, color: '#6b7280', fontSize: '11px', overflow: 'hidden' }}>
                                    {renderLocationCell(stop, vehicle.stops, locationMode)}
                                  </td>
                                  <td style={TD_STYLE}>{renderOrderCell(stop, vehicle.type === 'drone' || (vehicle.type === 'all' && !!stop.vehicleName?.startsWith('Drone')))}</td>
                                  <td style={{ ...TD_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>
                                    {formatGanttTime(stop.time)}
                                  </td>
                                  <td style={{ ...TD_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>
                                    {stop.duration > 0 ? formatGanttTime(stop.duration) : '--'}
                                  </td>
                                  <td style={{ ...TD_STYLE, ...(!isDuration ? emphStyle : dimStyle) }}>
                                    {stop.distance && stop.distance > 0
                                      ? formatGanttDistance(stop.distance)
                                      : '--'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        )
                      })}
                    </table>
                  )
                })() : (
                  <table className="data-table" style={GANTT_TABLE_STYLE}>
                    <GanttColgroup />
                    <thead>
                      <tr>
                        <th style={{ ...TH_STYLE, textAlign: 'center' }}>#</th>
                        <th style={TH_STYLE}>Type</th>
                        <th style={TH_STYLE}>Event</th>
                        <th style={TH_STYLE}>Location</th>
                        <th style={TH_STYLE}>Order</th>
                        <th style={{ ...TH_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>Time</th>
                        <th style={{ ...TH_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>Duration</th>
                        <th style={{ ...TH_STYLE, ...(!isDuration ? emphStyle : dimStyle) }}>Distance</th>
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
                          <td style={{ ...TD_STYLE, textAlign: 'center' }}>{idx + 1}</td>
                          <td style={TD_STYLE}>
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
                          <td style={{ ...TD_STYLE, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span>{stop.label}</span>
                          </td>
                          <td style={{ ...TD_STYLE, color: '#6b7280', fontSize: '11px', overflow: 'hidden' }}>
                            {renderLocationCell(stop, vehicle.stops, locationMode)}
                          </td>
                          <td style={TD_STYLE}>{renderOrderCell(stop, vehicle.type === 'drone')}</td>
                          <td style={{ ...TD_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>
                            {formatGanttTime(stop.time)}
                          </td>
                          <td style={{ ...TD_STYLE, ...(isDuration ? emphStyle : dimStyle) }}>
                            {stop.duration > 0 ? formatGanttTime(stop.duration) : '--'}
                          </td>
                          <td style={{ ...TD_STYLE, ...(!isDuration ? emphStyle : dimStyle) }}>
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
