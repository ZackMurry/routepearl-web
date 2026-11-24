'use client'

/**
 * Dynamic re-planning panel.
 *
 * The operator says where each truck is now and what went wrong (a drone is
 * unavailable, weather grounds all drones, a road is blocked); the backend
 * updates the existing plan from those positions instead of planning again
 * from the depot. Routes still end at the depot.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Checkbox, Flex, Select, Switch, Text } from '@radix-ui/themes'
import { AlertTriangle, CheckCircle, MapPin, Trash2, X } from 'lucide-react'
import { DisruptionInput, GeneratedTruckRoute, ReplanRecord, ReplanStrategy } from '@/lib/types'
import { useFlightPlanner } from '../FlightPlannerContext'
import { dronesCarried, inFlightAt } from './replanClient'

const fmtMinutes = (hours: number) => {
  const m = hours * 60
  return m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${m.toFixed(1)} min`
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 6,
}

const card: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 10px',
  background: '#fafafa',
}

export default function ReplanPanel() {
  const {
    replanPanelOpen,
    setReplanPanelOpen,
    replanSupported,
    generatedTruckRoutes,
    trucks,
    roadClosures,
    updateRoadClosure,
    removeRoadClosure,
    placingClosure,
    setPlacingClosure,
    isReplanning,
    runReplan,
    canUndoReplan,
    undoReplan,
    replanHistory,
    truckLabel,
    nodeLabel,
  } = useFlightPlanner()

  const [progress, setProgress] = useState<Record<number, number>>({})
  const [landing, setLanding] = useState<Record<string, number>>({})
  const [lostDrones, setLostDrones] = useState<Set<string>>(new Set())
  const [trucksOnly, setTrucksOnly] = useState(false)
  const [strategy, setStrategy] = useState<ReplanStrategy>('warm_start')
  const [maxIterations, setMaxIterations] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [lastRecord, setLastRecord] = useState<ReplanRecord | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // When the routes change (new plan, re-plan applied, undo), start each truck
  // at the stop it had reached and clear this round's disruptions.
  const routesKey = generatedTruckRoutes.map(r => `${r.routeId}:${(r.stopIds ?? []).join(',')}:${r.executedStopIndex ?? 0}`).join('|')
  useEffect(() => {
    const p: Record<number, number> = {}
    generatedTruckRoutes.forEach(r => (p[r.truckId] = r.executedStopIndex ?? 0))
    setProgress(p)
    setLanding({})
    setLostDrones(new Set())
    setTrucksOnly(false)
  }, [routesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallbackDrones = trucks.length === 1 ? trucks[0].drones : 0
  const anyDrones = generatedTruckRoutes.some(r => dronesCarried(r, fallbackDrones).length > 0)

  const disruptions: DisruptionInput[] = useMemo(() => {
    const out: DisruptionInput[] = []
    lostDrones.forEach(key => {
      const [truckId, droneId] = key.split(':').map(Number)
      out.push({ type: 'drone_unavailable', truckId, droneId })
    })
    if (trucksOnly) out.push({ type: 'trucks_only' })
    return out
  }, [lostDrones, trucksOnly])

  const hasDisruption = disruptions.length > 0 || roadClosures.length > 0

  if (!replanPanelOpen) return null

  const toggleLost = (truckId: number, droneId: number) =>
    setLostDrones(prev => {
      const next = new Set(prev)
      const key = `${truckId}:${droneId}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const onRun = async () => {
    setError(null)
    try {
      const iters = parseInt(maxIterations, 10)
      const record = await runReplan({
        progress,
        minutesUntilLanding: landing,
        disruptions,
        strategy,
        maxIterations: Number.isFinite(iters) && iters > 0 ? iters : undefined,
      })
      setLastRecord(record)
      setPlacingClosure(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const stopOptions = (route: GeneratedTruckRoute) => {
    const stops = route.stopIds ?? []
    const first = route.executedStopIndex ?? 0
    const out: { value: number; label: string }[] = []
    // The last stop is the depot at the end of the mission: nothing left to re-plan.
    for (let i = first; i < stops.length - 1; i++) {
      out.push({
        value: i,
        label: i === 0 ? `${nodeLabel(stops[i])} (not departed yet)` : `${i}. At ${nodeLabel(stops[i])}`,
      })
    }
    return out
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1100,
        width: 'min(390px, calc(100vw - 24px))',
        maxHeight: 'calc(100dvh - 120px)',
        overflowY: 'auto',
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        border: '1px solid #e0e0e0',
        padding: 12,
        fontSize: 13,
      }}
      data-testid='replan-panel'
    >
      <Flex justify='between' align='center' style={{ marginBottom: 8 }}>
        <Flex align='center' gap='2'>
          <AlertTriangle size={16} color='#ea580c' />
          <Text size='3' weight='bold'>
            Disruption &amp; re-plan
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
          <Text size='2'>
            Generate a route first. (Routes saved before re-planning support was added don&apos;t carry the stop ids the
            re-planner needs, so generate them again.)
          </Text>
        </div>
      ) : (
        <Flex direction='column' gap='3'>
          {/* 1. Where is each truck? */}
          <div>
            <div style={sectionTitle}>1 · Where is each truck now?</div>
            <Flex direction='column' gap='2'>
              {generatedTruckRoutes.map(route => {
                const c = progress[route.truckId] ?? 0
                const airborne = inFlightAt(route, c)
                return (
                  <div key={route.routeId} style={card}>
                    <Text size='2' weight='bold'>
                      {truckLabel(route.truckId)}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Select.Root
                        value={String(c)}
                        onValueChange={v => setProgress(prev => ({ ...prev, [route.truckId]: Number(v) }))}
                      >
                        <Select.Trigger style={{ width: '100%' }} />
                        <Select.Content position='popper' style={{ zIndex: 2000 }}>
                          {stopOptions(route).map(o => (
                            <Select.Item key={o.value} value={String(o.value)}>
                              {o.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </div>
                    <Text size='1' color='gray' as='div' style={{ marginTop: 4 }}>
                      Deliveries at and before this stop count as done. If the truck is between stops, pick the stop it
                      is driving to.
                    </Text>
                    {airborne.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {airborne.map(p => {
                          const key = `${route.truckId}:${p.sortie.droneId}`
                          return (
                            <Flex key={key} align='center' gap='2' style={{ marginTop: 2 }}>
                              <Badge color='blue' size='1'>
                                Drone {p.sortie.droneId} airborne
                              </Badge>
                              <Text size='1'>lands at {nodeLabel(p.sortie.recoveryId ?? '')} in</Text>
                              <input
                                type='number'
                                min={0}
                                step={0.5}
                                value={landing[key] ?? 0}
                                onChange={e => setLanding(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                style={{ width: 52, fontSize: 12, padding: '1px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                              <Text size='1'>min</Text>
                            </Flex>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </Flex>
          </div>

          {/* 2. What happened? */}
          <div>
            <div style={sectionTitle}>2 · What happened?</div>
            <Flex direction='column' gap='2'>
              {anyDrones && (
                <div style={card}>
                  <Text size='2' weight='bold' as='div'>
                    Drone unavailable
                  </Text>
                  {generatedTruckRoutes.map(route => {
                    const drones = dronesCarried(route, fallbackDrones)
                    if (drones.length === 0) return null
                    return (
                      <Flex key={route.routeId} align='center' gap='3' wrap='wrap' style={{ marginTop: 4 }}>
                        <Text size='1' color='gray' style={{ minWidth: 92 }}>
                          {truckLabel(route.truckId)}
                        </Text>
                        {drones.map(d => (
                          <Text as='label' size='2' key={d}>
                            <Flex gap='1' align='center'>
                              <Checkbox
                                checked={lostDrones.has(`${route.truckId}:${d}`)}
                                onCheckedChange={() => toggleLost(route.truckId, d)}
                                disabled={trucksOnly}
                              />
                              Drone {d}
                            </Flex>
                          </Text>
                        ))}
                      </Flex>
                    )
                  })}
                </div>
              )}

              {anyDrones && (
                <div style={card}>
                  <Text as='label' size='2'>
                    <Flex gap='2' align='center' justify='between'>
                      <span>
                        <b>Weather</b> — ground all drones (trucks only)
                      </span>
                      <Switch checked={trucksOnly} onCheckedChange={setTrucksOnly} />
                    </Flex>
                  </Text>
                </div>
              )}

              <div style={card}>
                <Flex justify='between' align='center'>
                  <Text size='2' weight='bold'>
                    Road blocked
                  </Text>
                  <Button
                    size='1'
                    variant={placingClosure ? 'solid' : 'soft'}
                    color={placingClosure ? 'red' : 'gray'}
                    onClick={() => setPlacingClosure(!placingClosure)}
                  >
                    <MapPin size={12} /> {placingClosure ? 'Click the map…' : 'Place on map'}
                  </Button>
                </Flex>
                {roadClosures.length === 0 ? (
                  <Text size='1' color='gray' as='div' style={{ marginTop: 4 }}>
                    No closures. Closures stay in force for later re-plans until removed.
                  </Text>
                ) : (
                  roadClosures.map((z, i) => (
                    <Flex key={z.id} align='center' gap='2' style={{ marginTop: 4 }}>
                      <Badge color='red' size='1'>
                        #{i + 1}
                      </Badge>
                      <Text size='1' style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {z.lat.toFixed(5)}, {z.lng.toFixed(5)}
                      </Text>
                      <input
                        type='number'
                        min={5}
                        step={5}
                        value={z.radiusM}
                        title='Radius (m)'
                        onChange={e => updateRoadClosure(z.id, { radiusM: Math.max(5, Number(e.target.value)) })}
                        style={{ width: 56, fontSize: 12, padding: '1px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <Text size='1'>m</Text>
                      <button
                        onClick={() => removeRoadClosure(z.id)}
                        title='Remove closure'
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 'auto' }}
                      >
                        <Trash2 size={13} color='#9ca3af' />
                      </button>
                    </Flex>
                  ))
                )}
              </div>
            </Flex>
          </div>

          {/* Advanced */}
          <div>
            <button
              onClick={() => setShowAdvanced(s => !s)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#6b7280', fontSize: 12 }}
            >
              {showAdvanced ? '▾' : '▸'} Solver options
            </button>
            {showAdvanced && (
              <Flex direction='column' gap='2' style={{ ...card, marginTop: 4 }}>
                <Flex align='center' justify='between' gap='2'>
                  <Text size='1'>Strategy</Text>
                  <Select.Root value={strategy} onValueChange={v => setStrategy(v as ReplanStrategy)}>
                    <Select.Trigger />
                    <Select.Content position='popper' style={{ zIndex: 2000 }}>
                      <Select.Item value='warm_start'>Warm start (repair, then ALNS)</Select.Item>
                      <Select.Item value='from_scratch'>From scratch (ALNS on remaining)</Select.Item>
                      <Select.Item value='repair_only'>Repair only (fastest)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex align='center' justify='between' gap='2'>
                  <Text size='1'>Max ALNS iterations</Text>
                  <input
                    type='number'
                    min={1}
                    placeholder='default'
                    value={maxIterations}
                    onChange={e => setMaxIterations(e.target.value)}
                    style={{ width: 90, fontSize: 12, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </Flex>
              </Flex>
            )}
          </div>

          {/* Run */}
          <Flex gap='2'>
            <Button style={{ flex: 1 }} color='orange' onClick={onRun} loading={isReplanning} disabled={isReplanning}>
              {hasDisruption ? 'Re-plan from current positions' : 'Re-plan (no disruption)'}
            </Button>
            <Button variant='soft' color='gray' onClick={undoReplan} disabled={!canUndoReplan || isReplanning} title='Undo the last re-plan'>
              Undo
            </Button>
          </Flex>

          {error && (
            <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca' }}>
              <Text size='2' color='red'>
                {error}
              </Text>
            </div>
          )}

          {lastRecord && <ReplanResult record={lastRecord} truckLabel={truckLabel} nodeLabel={nodeLabel} />}

          {replanHistory.length > 0 && (
            <Text size='1' color='gray'>
              {replanHistory.length} re-plan{replanHistory.length === 1 ? '' : 's'} applied to this mission. Grey legs and
              sorties on the map are already executed.
            </Text>
          )}
        </Flex>
      )}
    </div>
  )
}

function ReplanResult({
  record,
  truckLabel,
  nodeLabel,
}: {
  record: ReplanRecord
  truckLabel: (id: number) => string
  nodeLabel: (id: string) => string
}) {
  return (
    <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }} data-testid='replan-result'>
      <Flex align='center' gap='2' style={{ marginBottom: 4 }}>
        <CheckCircle size={14} color='#16a34a' />
        <Text size='2' weight='bold'>
          Plan updated in {record.runtimeS.toFixed(1)} s
        </Text>
      </Flex>
      {record.disruptions.length > 0 && (
        <Text size='1' as='div' color='gray' style={{ marginBottom: 4 }}>
          {record.disruptions.join(' · ')}
        </Text>
      )}
      {record.trucks.map(t => (
        <div key={t.truckId} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #dcfce7' }}>
          <Flex justify='between' align='center'>
            <Text size='2' weight='bold'>
              {truckLabel(t.truckId)}
            </Text>
            <Badge color={t.reoptimized ? 'orange' : 'gray'} size='1'>
              {t.reoptimized ? 're-planned' : 'unchanged'}
            </Badge>
          </Flex>
          <Text size='1' as='div'>
            From {nodeLabel(t.currentStop)} · {t.completedCustomers.length} delivered · {t.remainingCustomers.length} to go ·
            drones {t.dronesAvailable.length ? t.dronesAvailable.join(', ') : 'none'}
          </Text>
          {t.reasons.length > 0 && (
            <Text size='1' as='div' color='gray'>
              Why: {t.reasons.join('; ')}
            </Text>
          )}
          {t.reassignedCustomers.length > 0 && (
            <Text size='1' as='div'>
              Re-assigned: {t.reassignedCustomers.map(nodeLabel).join(', ')}
            </Text>
          )}
          {t.reoptimized && (
            <Text size='1' as='div'>
              Remaining time {fmtMinutes(t.initialCost.time)} after repair → <b>{fmtMinutes(t.cost.time)}</b> after ALNS · risk{' '}
              {t.initialCost.risk.toFixed(3)} → <b>{t.cost.risk.toFixed(3)}</b>
            </Text>
          )}
          {t.reroutedLegs > 0 && (
            <Text size='1' as='div'>
              {t.reroutedLegs} road leg{t.reroutedLegs === 1 ? '' : 's'} re-routed around closures
            </Text>
          )}
          {t.alnsError && (
            <Text size='1' as='div' color='red'>
              ALNS error (repaired plan kept): {t.alnsError}
            </Text>
          )}
        </div>
      ))}
      {record.warnings.map((w, i) => (
        <Text key={i} size='1' as='div' color='orange' style={{ marginTop: 4 }}>
          ⚠ {w}
        </Text>
      ))}
    </div>
  )
}
