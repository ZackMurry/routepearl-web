'use client'

/**
 * Live mission simulation: animates trucks and drones along the current plan
 * while the mission is launched (SimVehicles), and the Live disruptions panel
 * (LiveDisruptionPanel) that injects a drone failure, weather or road closure
 * at the vehicles' actual positions, re-plans from there and resumes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Badge, Button, Flex, Select, Text } from '@radix-ui/themes'
import { AlertTriangle, MapPin, Trash2, X } from 'lucide-react'
import { useFlightPlanner } from '../FlightPlannerContext'
import { getTruckRouteColor } from '../routeData'
import { dronesCarried } from '../replan/replanClient'
import { airborneDronesAt, buildSchedule, currentStopAt, fmtClock, TruckSchedule, truckPositionAt } from './schedule'
import { DisruptionInput, ReplanRecord } from '@/lib/types'

function useSchedules() {
  const { generatedTruckRoutes } = useFlightPlanner()
  return useMemo(
    () =>
      generatedTruckRoutes
        .filter(r => r.stopIds && r.stopIds.length >= 2)
        .map(r => ({ route: r, schedule: buildSchedule(r) })),
    [generatedTruckRoutes],
  )
}

const truckIcon = (color: string, label: string) =>
  L.divIcon({
    html: `<div style="display:flex;align-items:center;gap:2px;transform:translate(-50%,-50%);white-space:nowrap">
      <div style="width:26px;height:26px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:14px">🚚</div>
      <span style="background:white;border-radius:3px;padding:0 3px;font:600 10px sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.3)">${label}</span></div>`,
    className: '',
    iconSize: [0, 0],
  })

const droneIcon = (label: string, failed = false) =>
  L.divIcon({
    html: `<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:2px;white-space:nowrap">
      <div style="width:18px;height:18px;border-radius:50%;background:${failed ? '#dc2626' : '#2563eb'};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.5);color:white;font:700 9px sans-serif;display:flex;align-items:center;justify-content:center">✈</div>
      <span style="background:white;border-radius:3px;padding:0 3px;font:600 9px sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.3)">${label}</span></div>`,
    className: '',
    iconSize: [0, 0],
  })

/** Vehicle markers; render inside <MapContainer>. */
export function SimVehicles() {
  const { missionLaunched, simTimeS, truckLabel, replanHistory } = useFlightPlanner()
  const schedules = useSchedules()
  // Drones reported as failed disappear from the map (weather-grounded drones still fly home and land).
  const lost = useMemo(() => {
    const out = new Set<string>()
    replanHistory.forEach(rec => rec.trucks.forEach(t => t.dronesLost.forEach(d => out.add(`${t.truckId}:${d}`))))
    return out
  }, [replanHistory])
  if (!missionLaunched) return null
  return (
    <>
      {schedules.map(({ route, schedule }) => {
        const pos = truckPositionAt(schedule, simTimeS)
        const color = getTruckRouteColor(route.truckType, route.truckId)
        const short = truckLabel(route.truckId).replace(/ truck /, ' ')
        return (
          <React.Fragment key={route.routeId}>
            {pos && (
              <Marker position={[pos.lat, pos.lng]} icon={truckIcon(color, short)} zIndexOffset={1000} interactive={false} />
            )}
            {airborneDronesAt(schedule, simTimeS)
              .filter(d => !lost.has(`${route.truckId}:${d.droneId}`))
              .map(d => (
                <Marker
                  key={`${route.routeId}-d${d.droneId}`}
                  position={[d.pos.lat, d.pos.lng]}
                  icon={droneIcon(`D${d.droneId}`)}
                  zIndexOffset={1100}
                >
                  <Tooltip direction='top'>
                    Drone {d.droneId} · {d.phase} · lands in {fmtClock(d.landsInS)}
                  </Tooltip>
                </Marker>
              ))}
          </React.Fragment>
        )
      })}
    </>
  )
}

type Banner = { kind: 'alert' | 'ok' | 'error'; text: string } | null

const bannerColors = {
  alert: { bg: '#fff7ed', border: '#fdba74', fg: '#9a3412' },
  ok: { bg: '#f0fdf4', border: '#86efac', fg: '#166534' },
  error: { bg: '#fef2f2', border: '#fca5a5', fg: '#991b1b' },
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '2px 0 6px',
}

const card: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 10px',
  background: '#fafafa',
}

const fmtMin = (hours: number) => `${Math.round(hours * 60)} min`

/**
 * Live disruptions panel (floats top-left over the map). While the mission
 * runs it shows the mission clock and lets the presenter inject a drone
 * failure, severe weather or a road closure at the vehicles' actual
 * positions; each one pauses the mission, re-plans from where everybody is,
 * reports what changed, and resumes on the updated plan.
 */
export function LiveDisruptionPanel() {
  const {
    missionLaunched,
    missionPaused,
    simTimeS,
    simSpeed,
    setSimSpeed,
    setMissionPausedState,
    replanSupported,
    replanPanelOpen,
    setReplanPanelOpen,
    runReplan,
    isReplanning,
    truckLabel,
    nodeLabel,
    trucks,
    roadClosures,
    removeRoadClosure,
    placingClosure,
    setPlacingClosure,
    replanHistory,
  } = useFlightPlanner()
  const schedules = useSchedules()
  const [banner, setBanner] = useState<Banner>(null)
  const [log, setLog] = useState<{ at: string; label: string; record?: ReplanRecord; error?: string }[]>([])
  const closureCount = useRef(roadClosures.length)
  const wasPausedBeforePlacing = useRef(false)

  // Open automatically when the mission is launched; clear the log on a new mission.
  useEffect(() => {
    if (missionLaunched) setReplanPanelOpen(true)
  }, [missionLaunched]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (replanHistory.length === 0) {
      setLog([])
      setBanner(null)
    }
  }, [replanHistory.length])

  const endT = Math.max(0, ...schedules.map(s => s.schedule.endT))
  const finished = missionLaunched && simTimeS >= endT
  const fallbackDrones = trucks.length === 1 ? trucks[0].drones : 0

  const observeNow = () => {
    const progress: Record<number, number> = {}
    const inFlight: { truckId: number; droneId: number; minutesUntilLanding: number; delivered: boolean }[] = []
    let ok = true
    schedules.forEach(({ route, schedule }) => {
      const c = currentStopAt(schedule, simTimeS, route.executedStopIndex ?? 0)
      if (c === null) ok = false
      progress[route.truckId] = c ?? 0
      airborneDronesAt(schedule as TruckSchedule, simTimeS).forEach(d =>
        inFlight.push({
          truckId: route.truckId,
          droneId: d.droneId,
          minutesUntilLanding: d.landsInS / 60,
          delivered: d.phase === 'inbound', // already dropped the package and flying back
        }),
      )
    })
    return { progress, inFlight, ok }
  }

  const inject = async (disruptions: DisruptionInput[], label: string) => {
    const { progress, inFlight, ok } = observeNow()
    if (!ok) {
      setBanner({ kind: 'error', text: 'A truck is already heading back to the depot; nothing left to re-plan.' })
      return false
    }
    setMissionPausedState(true)
    const where = schedules
      .map(
        ({ route }) => `${truckLabel(route.truckId)} at/next ${nodeLabel(route.stopIds?.[progress[route.truckId]] ?? '')}`,
      )
      .join(', ')
    setBanner({ kind: 'alert', text: `⚠ ${label} at ${fmtClock(simTimeS)} — ${where}. Re-planning…` })
    const at = fmtClock(simTimeS)
    try {
      const record = await runReplan({ progress, inFlight, disruptions, strategy: 'warm_start' })
      const reassigned = record.trucks.flatMap(t => t.reassignedCustomers)
      setBanner({
        kind: 'ok',
        text: `✓ Plan updated in ${record.runtimeS.toFixed(1)} s${
          reassigned.length ? ` · re-assigned ${reassigned.map(nodeLabel).join(', ')}` : ''
        }. Resuming…`,
      })
      setLog(prev => [{ at, label, record }, ...prev])
      setTimeout(() => setMissionPausedState(false), 2500)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setBanner({ kind: 'error', text: `Re-plan failed: ${msg}` })
      setLog(prev => [{ at, label, error: msg }, ...prev])
      return false
    }
  }

  // Road closure: "Place on map" pauses the mission; the map click adds the
  // closure (ClickHandler) and we re-plan right away.
  useEffect(() => {
    const prev = closureCount.current
    closureCount.current = roadClosures.length
    if (missionLaunched && roadClosures.length > prev) {
      void inject([], 'Road blocked')
    }
  }, [roadClosures.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!replanPanelOpen) return null

  const startPlacing = () => {
    if (placingClosure) {
      setPlacingClosure(false)
      if (!wasPausedBeforePlacing.current) setMissionPausedState(false)
      return
    }
    wasPausedBeforePlacing.current = missionPaused
    setMissionPausedState(true)
    setPlacingClosure(true)
  }

  const droneRows = schedules.map(({ route, schedule }) => {
    const airborne = new Map(airborneDronesAt(schedule, simTimeS).map(d => [d.droneId, d]))
    return { route, drones: dronesCarried(route, fallbackDrones), airborne }
  })
  const anyDrones = droneRows.some(r => r.drones.length > 0)
  const busy = isReplanning || finished || !missionLaunched

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1100,
        width: 'min(370px, calc(100vw - 24px))',
        maxHeight: 'calc(100dvh - 120px)',
        overflowY: 'auto',
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        border: '1px solid #e0e0e0',
        padding: 12,
        fontSize: 13,
      }}
      data-testid='live-panel'
    >
      <Flex justify='between' align='center' style={{ marginBottom: 8 }}>
        <Flex align='center' gap='2'>
          <AlertTriangle size={16} color='#ea580c' />
          <Text size='3' weight='bold'>
            Live disruptions
          </Text>
        </Flex>
        <button
          onClick={() => {
            setReplanPanelOpen(false)
            setPlacingClosure(false)
          }}
          title='Close'
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
        >
          <X size={16} />
        </button>
      </Flex>

      {!replanSupported ? (
        <div style={{ ...card, background: '#fff7ed', borderColor: '#fed7aa' }}>
          <Text size='2'>Generate a route first.</Text>
        </div>
      ) : (
        <Flex direction='column' gap='3'>
          {/* Mission clock */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <Text size='3' weight='bold' style={{ fontVariantNumeric: 'tabular-nums' }} data-testid='sim-clock'>
              {!missionLaunched ? '■' : missionPaused ? '⏸' : finished ? '✓' : '▶'} {fmtClock(Math.min(simTimeS, endT))} /{' '}
              {fmtClock(endT)}
            </Text>
            <Select.Root value={String(simSpeed)} onValueChange={v => setSimSpeed(Number(v))}>
              <Select.Trigger variant='soft' />
              <Select.Content position='popper' style={{ zIndex: 2000 }}>
                {[10, 30, 60, 120].map(v => (
                  <Select.Item key={v} value={String(v)}>
                    {v}× speed
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
          {!missionLaunched && (
            <Text size='2' color='gray'>
              Click <b>Launch</b> to start the mission. Then inject a disruption here at any moment — the plan is updated
              from where the vehicles actually are.
            </Text>
          )}

          {banner && (
            <div
              onClick={() => setBanner(null)}
              style={{
                background: bannerColors[banner.kind].bg,
                border: `1px solid ${bannerColors[banner.kind].border}`,
                color: bannerColors[banner.kind].fg,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              data-testid='sim-banner'
            >
              {banner.text}
            </div>
          )}

          {/* Disruptions */}
          <div>
            <div style={sectionTitle}>Inject a disruption</div>
            <Flex direction='column' gap='2'>
              {anyDrones &&
                droneRows.map(({ route, drones, airborne }) =>
                  drones.length === 0 ? null : (
                    <div key={route.routeId} style={card}>
                      <Text size='1' color='gray' as='div' style={{ marginBottom: 4 }}>
                        Drone failure · {truckLabel(route.truckId)}
                      </Text>
                      <Flex gap='2' wrap='wrap'>
                        {drones.map(d => {
                          const a = airborne.get(d)
                          return (
                            <Button
                              key={d}
                              size='1'
                              color='red'
                              variant='soft'
                              disabled={busy}
                              onClick={() =>
                                inject(
                                  [{ type: 'drone_unavailable', truckId: route.truckId, droneId: d }],
                                  `Drone ${d} on ${truckLabel(route.truckId)} failed${a ? ' in flight' : ''}`,
                                )
                              }
                            >
                              💥 Drone {d} fails
                              {a ? ` (${a.phase === 'inbound' ? 'returning' : `→ ${nodeLabel(a.customerId ?? '')}`})` : ''}
                            </Button>
                          )
                        })}
                      </Flex>
                    </div>
                  ),
                )}
              {anyDrones && (
                <Button
                  color='blue'
                  variant='soft'
                  disabled={busy}
                  onClick={() => inject([{ type: 'trucks_only' }], 'Severe weather: all drones grounded')}
                >
                  ⛈ Weather: ground all drones
                </Button>
              )}
              <div style={card}>
                <Flex justify='between' align='center'>
                  <Text size='2' weight='bold'>
                    🚧 Road blocked
                  </Text>
                  <Button
                    size='1'
                    variant={placingClosure ? 'solid' : 'soft'}
                    color={placingClosure ? 'red' : 'gray'}
                    disabled={busy && !placingClosure}
                    onClick={startPlacing}
                  >
                    <MapPin size={12} /> {placingClosure ? 'Click the road… (cancel)' : 'Place on map'}
                  </Button>
                </Flex>
                <Text size='1' color='gray' as='div' style={{ marginTop: 4 }}>
                  Pauses the mission; click a road on the truck&apos;s route ahead. Re-planning with a closure takes 10–30 s
                  (live road network).
                </Text>
                {roadClosures.map((z, i) => (
                  <Flex key={z.id} align='center' gap='2' style={{ marginTop: 4 }}>
                    <Badge color='red' size='1'>
                      #{i + 1}
                    </Badge>
                    <Text size='1' style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {z.lat.toFixed(5)}, {z.lng.toFixed(5)} · {Math.round(z.radiusM)} m
                    </Text>
                    <button
                      onClick={() => removeRoadClosure(z.id)}
                      title='Remove closure (applies at the next re-plan)'
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 'auto' }}
                    >
                      <Trash2 size={13} color='#9ca3af' />
                    </button>
                  </Flex>
                ))}
              </div>
            </Flex>
          </div>

          {/* Event log */}
          {log.length > 0 && (
            <div>
              <div style={sectionTitle}>What happened</div>
              <Flex direction='column' gap='2'>
                {log.map((e, i) => (
                  <div key={i} style={{ ...card, background: e.error ? '#fef2f2' : '#f0fdf4' }} data-testid='live-log-entry'>
                    <Text size='1' as='div' weight='bold'>
                      {e.at} · {e.label}
                    </Text>
                    {e.error && (
                      <Text size='1' as='div' color='red'>
                        {e.error}
                      </Text>
                    )}
                    {e.record?.trucks
                      .filter(t => t.reoptimized)
                      .map(t => (
                        <Text key={t.truckId} size='1' as='div'>
                          {truckLabel(t.truckId)}: {t.completedCustomers.length} delivered, {t.remainingCustomers.length} to
                          go
                          {t.reassignedCustomers.length > 0 && (
                            <> · re-assigned {t.reassignedCustomers.map(nodeLabel).join(', ')}</>
                          )}
                          {' · '}
                          {fmtMin(t.cost.time)} left, risk {t.cost.risk.toFixed(3)} · {t.runtimeS.toFixed(1)} s
                        </Text>
                      ))}
                    {e.record && e.record.trucks.every(t => !t.reoptimized) && (
                      <Text size='1' as='div' color='gray'>
                        No change needed (the closure is not on any remaining route).
                      </Text>
                    )}
                  </div>
                ))}
              </Flex>
            </div>
          )}
        </Flex>
      )}
    </div>
  )
}
