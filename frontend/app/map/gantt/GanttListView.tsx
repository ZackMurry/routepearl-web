'use client'

import React, { FC } from 'react'
import { ScrollArea } from '@radix-ui/themes'
import { GanttVehicle, GanttStop, GanttStopType, GanttAxisMode, getStopColor, formatGanttTime, formatGanttDistance } from './gantt.types'
import { House, Package, ArrowUp, ArrowDown, Zap, Truck, Drone, LayoutList } from 'lucide-react'

interface Props {
  vehicles: GanttVehicle[]
  axisMode: GanttAxisMode
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
  return getStopColor(type)
}

const GanttListView: FC<Props> = ({ vehicles, axisMode, onStopClick, onStopDoubleClick, onVehicleClick, onVehicleDoubleClick }) => {
  const isDuration = axisMode === 'duration'
  const emphStyle = { fontWeight: 600, color: '#1e293b' } as const
  const dimStyle = { color: '#94a3b8' } as const

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
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-stat-sm">#</th>
                      <th style={{ width: '52px', minWidth: '52px' }}>Type</th>
                      <th className="col-flex">Event</th>
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
                        <td>
                          {stop.orderName ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {stop.orderId != null && (
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
                  No events
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
