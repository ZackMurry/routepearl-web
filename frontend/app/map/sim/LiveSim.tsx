'use client'

/**
 * Live mission simulation: animates trucks and drones along the current plan
 * while the mission is launched, and lets the presenter inject a disruption
 * (drone failure, weather) at the vehicles' actual positions. The disruption
 * pauses the mission, triggers a re-plan from where everybody is, and resumes
 * on the updated plan.
 */
import React, { useMemo, useState } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Button, Select, Text } from '@radix-ui/themes'
import { useFlightPlanner } from '../FlightPlannerContext'
import { getTruckRouteColor } from '../routeData'
import { dronesCarried } from '../replan/replanClient'
import {
  airborneDronesAt,
  buildSchedule,
  currentStopAt,
  fmtClock,
  landingMinutesAt,
  TruckSchedule,
  truckPositionAt,
} from './schedule'
import { DisruptionInput } from '@/lib/types'

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
            {pos && <Marker position={[pos.lat, pos.lng]} icon={truckIcon(color, short)} zIndexOffset={1000} interactive={false} />}
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

/** Floating control bar (top centre of the map). */
export function SimControls() {
  const {
    missionLaunched,
    missionPaused,
    simTimeS,
    simSpeed,
    setSimSpeed,
    setMissionPausedState,
    replanSupported,
    runReplan,
    isReplanning,
    truckLabel,
    nodeLabel,
    trucks,
  } = useFlightPlanner()
  const schedules = useSchedules()
  const [banner, setBanner] = useState<Banner>(null)

  if (!missionLaunched || !replanSupported) return null

  const endT = Math.max(0, ...schedules.map(s => s.schedule.endT))
  const finished = simTimeS >= endT
  const fallbackDrones = trucks.length === 1 ? trucks[0].drones : 0

  const progressNow = () => {
    const progress: Record<number, number> = {}
    const landing: Record<string, number> = {}
    let ok = true
    schedules.forEach(({ route, schedule }) => {
      const c = currentStopAt(schedule, simTimeS, route.executedStopIndex ?? 0)
      if (c === null) ok = false
      progress[route.truckId] = c ?? 0
      Object.assign(landing, landingMinutesAt(schedule as TruckSchedule, simTimeS))
    })
    return { progress, landing, ok }
  }

  const inject = async (disruptions: DisruptionInput[], label: string) => {
    const { progress, landing, ok } = progressNow()
    if (!ok) {
      setBanner({ kind: 'error', text: 'A truck is already heading back to the depot; nothing left to re-plan.' })
      return
    }
    setMissionPausedState(true)
    const where = schedules
      .map(({ route }) => `${truckLabel(route.truckId)} at/next ${nodeLabel(route.stopIds?.[progress[route.truckId]] ?? '')}`)
      .join(', ')
    setBanner({ kind: 'alert', text: `⚠ ${label} at mission time ${fmtClock(simTimeS)} — ${where}. Re-planning…` })
    try {
      const rec = await runReplan({ progress, minutesUntilLanding: landing, disruptions, strategy: 'warm_start' })
      const reassigned = rec.trucks.flatMap(t => t.reassignedCustomers)
      const after = rec.trucks.filter(t => t.reoptimized).map(t => `${Math.round(t.cost.time * 60)} min left`)
      setBanner({
        kind: 'ok',
        text: `✓ Plan updated in ${rec.runtimeS.toFixed(1)} s${reassigned.length ? ` · re-assigned ${reassigned.map(nodeLabel).join(', ')}` : ''}${after.length ? ` · ${after.join(', ')}` : ''}. Resuming…`,
      })
      setTimeout(() => setMissionPausedState(false), 2500)
    } catch (e) {
      setBanner({ kind: 'error', text: `Re-plan failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const droneButtons = schedules.flatMap(({ route, schedule }) => {
    const airborne = new Set(airborneDronesAt(schedule, simTimeS).map(d => d.droneId))
    return dronesCarried(route, fallbackDrones).map(d => ({
      key: `${route.truckId}:${d}`,
      label: `${schedules.length > 1 ? `${truckLabel(route.truckId).replace(/ truck /, ' ')} · ` : ''}Drone ${d} fails${airborne.has(d) ? ' (in flight)' : ''}`,
      disruption: { type: 'drone_unavailable', truckId: route.truckId, droneId: d } as DisruptionInput,
      text: `Drone ${d} on ${truckLabel(route.truckId)} failed${airborne.has(d) ? ' in flight' : ''}`,
    }))
  })
  const anyDrones = droneButtons.length > 0

  const bannerColors = {
    alert: { bg: '#fff7ed', border: '#fdba74', fg: '#9a3412' },
    ok: { bg: '#f0fdf4', border: '#86efac', fg: '#166534' },
    error: { bg: '#fef2f2', border: '#fca5a5', fg: '#991b1b' },
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        maxWidth: 'min(760px, calc(100vw - 840px))',
        minWidth: 420,
      }}
      data-testid='sim-controls'
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          background: 'white',
          borderRadius: 10,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 10px rgba(0,0,0,.18)',
          padding: '6px 10px',
        }}
      >
        <Text size='2' weight='bold' style={{ fontVariantNumeric: 'tabular-nums' }}>
          {missionPaused ? '⏸' : finished ? '✓' : '▶'} {fmtClock(Math.min(simTimeS, endT))} / {fmtClock(endT)}
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
        <span style={{ width: 1, height: 22, background: '#e5e7eb' }} />
        {droneButtons.map(b => (
          <Button
            key={b.key}
            size='1'
            color='red'
            variant='soft'
            disabled={isReplanning || finished}
            onClick={() => inject([b.disruption], b.text)}
          >
            💥 {b.label}
          </Button>
        ))}
        {anyDrones && (
          <Button
            size='1'
            color='blue'
            variant='soft'
            disabled={isReplanning || finished}
            onClick={() => inject([{ type: 'trucks_only' }], 'Severe weather: all drones grounded')}
          >
            ⛈ Weather: ground drones
          </Button>
        )}
      </div>
      {banner && (
        <div
          onClick={() => setBanner(null)}
          style={{
            background: bannerColors[banner.kind].bg,
            border: `1px solid ${bannerColors[banner.kind].border}`,
            color: bannerColors[banner.kind].fg,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
          data-testid='sim-banner'
        >
          {banner.text}
        </div>
      )}
    </div>
  )
}
