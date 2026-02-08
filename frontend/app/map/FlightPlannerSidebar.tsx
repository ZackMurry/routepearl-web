'use client'

import React, { useEffect, useState } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import {
  Box,
  Card,
  Flex,
  Text,
  TextField,
  TextArea,
  Button,
  ScrollArea,
  Tabs,
  Select,
  IconButton,
  Badge,
} from '@radix-ui/themes'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  AlertTriangle,
  Target,
  Settings,
  Layers,
  Play,
  Pause,
  Square,
  Upload,
  Download,
  ArrowUp,
  ArrowDown,
  MousePointer2,
  Lock,
  LogOut,
  Save,
  Route,
  CheckCircle,
  AlertCircle,
  Package,
  Truck,
  Plane,
} from 'lucide-react'
import { MissionSite, HazardZone, RoutingAlgorithm } from '@/lib/types'
import { forwardGeocode, seedAddressCache, parseCSVLine, isLatLng, csvTagToNodeType, nodeTypeToCsvTag, csvQuote } from '@/lib/geocoding'
import { useMap } from 'react-leaflet'

export function FlightPlannerSidebar() {
  const {
    missionConfig,
    updateMissionConfig,
    addNode,
    updateNode,
    removeNode,
    addHazardZone,
    updateHazardZone,
    removeHazardZone,
    activePanelTab,
    setActivePanelTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    isFlightPlannerMode,
    setIsFlightPlannerMode,
    plotModeNodes,
    setPlotModeNodes,
    selectedNodeId,
    truckRoute,
    droneRoutes,
    missionLaunched,
    missionPaused,
    launchMission,
    pauseMission,
    stopMission,
    importMission,
    exportMission,
    generateRoute,
    isGeneratingRoute,
    hasUnassignedWaypoints,
  } = useFlightPlanner()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const csvInputRef = React.useRef<HTMLInputElement>(null)
  const [csvImporting, setCsvImporting] = useState(false)

  const handleImportCSV = () => {
    csvInputRef.current?.click()
  }

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (event.target) event.target.value = ''

    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target?.result as string
      const lines = content.split('\n').filter(l => l.trim())
      if (lines.length === 0) return

      // Validate header
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase())
      const addrIdx = header.indexOf('address')
      const tagIdx = header.indexOf('node-tag')
      const radiusIdx = header.indexOf('radius')
      if (addrIdx === -1 || tagIdx === -1) return

      setCsvImporting(true)
      let imported = 0

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i])
        const addressVal = fields[addrIdx] || ''
        const tagVal = fields[tagIdx] || ''
        const radiusVal = radiusIdx >= 0 ? fields[radiusIdx] || '' : ''

        if (!addressVal || !tagVal) continue

        const nodeType = csvTagToNodeType(tagVal)
        if (!nodeType) continue

        if (nodeType === 'hazard') {
          const r = parseFloat(radiusVal)
          if (!radiusVal || isNaN(r) || r <= 0) continue
        }

        let lat: number, lng: number
        let addressStr: string | undefined
        if (isLatLng(addressVal)) {
          const parts = addressVal.split(',').map(s => s.trim())
          lat = parseFloat(parts[0])
          lng = parseFloat(parts[1])
        } else {
          try {
            const result = await forwardGeocode(addressVal)
            if (!result) continue
            lat = result.lat
            lng = result.lng
            addressStr = result.displayName
          } catch {
            continue
          }
        }

        const newNode: MissionSite = {
          id: `node-${Date.now()}-${Math.random()}`,
          type: nodeType,
          lat,
          lng,
          address: addressStr,
        }

        if (nodeType === 'hazard') {
          newNode.radius = parseFloat(radiusVal)
          newNode.severity = 'medium'
        }

        addNode(newNode)
        if (addressStr) seedAddressCache(lat, lng, addressStr)
        imported++
      }

      setCsvImporting(false)
    }
    reader.readAsText(file)
  }

  const handleExportCSV = () => {
    const rows: string[] = ['address,node-tag,radius']

    for (const node of missionConfig.nodes) {
      const tag = nodeTypeToCsvTag(node.type)
      if (!tag) continue

      const addr = node.address || `${node.lat},${node.lng}`
      const radius = node.type === 'hazard' && node.radius ? String(node.radius) : ''
      rows.push(`${csvQuote(addr)},${tag},${radius}`)
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(missionConfig.missionName || 'addresses').replace(/\s+/g, '_')}_addresses.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleMakeFlightPlan = () => {
    setIsFlightPlannerMode(true)
  }

  const handleImportFlightPlan = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = e => {
        const content = e.target?.result as string
        try {
          // Use importMission to properly assign missing address IDs
          importMission(content)
        } catch (error) {
          console.error('Failed to import flight plan:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  if (sidebarCollapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100vh',
          zIndex: 1000,
          pointerEvents: 'auto',
          display: 'flex',
        }}
      >
        <Card
          className='rounded-none rounded-r-lg shadow-xl'
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 14px',
            gap: '8px',
          }}
        >
          {/* Expand button */}
          <IconButton
            size='3'
            variant='ghost'
            onClick={() => setSidebarCollapsed(false)}
            style={{ cursor: 'pointer', marginBottom: '4px' }}
            title='Expand sidebar'
          >
            <ChevronRight size={24} />
          </IconButton>

          {isFlightPlannerMode ? (
            <>
              {/* Flight planner collapsed: action buttons only */}
              <IconButton
                size='3'
                variant='soft'
                color='gray'
                onClick={() => { setSidebarCollapsed(false); setIsFlightPlannerMode(false) }}
                title='Exit Flight Planner'
                style={{ cursor: 'pointer' }}
              >
                <LogOut size={20} />
              </IconButton>
              <IconButton
                size='3'
                variant='soft'
                color='green'
                onClick={() => { exportMission(); setIsFlightPlannerMode(false) }}
                title='Save & Exit'
                style={{ cursor: 'pointer' }}
              >
                <Save size={20} />
              </IconButton>
              <IconButton
                size='3'
                variant='soft'
                color='blue'
                onClick={() => exportMission()}
                title='Save'
                style={{ cursor: 'pointer' }}
              >
                <Download size={20} />
              </IconButton>

              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

              <IconButton
                size='3'
                variant='solid'
                color='blue'
                onClick={generateRoute}
                disabled={isGeneratingRoute || hasUnassignedWaypoints}
                title={hasUnassignedWaypoints ? 'Assign all waypoints a type first' : 'Generate Optimal Route'}
                style={{ cursor: 'pointer' }}
              >
                <Route size={20} />
              </IconButton>

              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

              {/* Compact status indicators */}
              <Flex direction='column' gap='2' style={{ alignItems: 'center' }}>
                {/* Route status */}
                <div
                  title={`Route: ${hasUnassignedWaypoints ? 'Blocked' : truckRoute.length > 0 || droneRoutes.length > 0 ? 'Generated' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? 'Required' : 'Pending'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hasUnassignedWaypoints ? 'rgba(239, 68, 68, 0.1)' : truckRoute.length > 0 || droneRoutes.length > 0 ? 'rgba(34, 197, 94, 0.1)' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? 'rgba(249, 115, 22, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${hasUnassignedWaypoints ? '#ef4444' : truckRoute.length > 0 || droneRoutes.length > 0 ? '#22c55e' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#f97316' : '#d1d5db'}`,
                  }}
                >
                  <Route size={14} style={{ color: hasUnassignedWaypoints ? '#ef4444' : truckRoute.length > 0 || droneRoutes.length > 0 ? '#22c55e' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#f97316' : '#9ca3af' }} />
                </div>
                {/* Truck route */}
                <div
                  title={`Truck Route: ${truckRoute.length > 0 ? `${truckRoute.length} pts` : '--'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: truckRoute.length > 0 ? 'rgba(55, 65, 81, 0.08)' : '#f3f4f6',
                    border: `1.5px solid ${truckRoute.length > 0 ? '#374151' : '#d1d5db'}`,
                  }}
                >
                  <Truck size={14} style={{ color: truckRoute.length > 0 ? '#374151' : '#9ca3af' }} />
                </div>
                {/* Drone paths */}
                <div
                  title={`Drone Paths: ${droneRoutes.length > 0 ? `${droneRoutes.length} sorties` : '--'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: droneRoutes.length > 0 ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${droneRoutes.length > 0 ? '#3b82f6' : '#d1d5db'}`,
                  }}
                >
                  <Plane size={14} style={{ color: droneRoutes.length > 0 ? '#3b82f6' : '#9ca3af' }} />
                </div>
                {/* Order points */}
                <div
                  title={`Order Points: ${missionConfig.nodes.filter(n => n.type === 'order').length || '--'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? 'rgba(16, 185, 129, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#10b981' : '#d1d5db'}`,
                  }}
                >
                  <Package size={14} style={{ color: missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#10b981' : '#9ca3af' }} />
                </div>
                {/* Unassigned waypoints warning */}
                {hasUnassignedWaypoints && (
                  <div
                    className='pulse-dot'
                    title={`Unassigned Waypoints: ${missionConfig.nodes.filter(n => n.type === 'waypoint').length}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1.5px solid #ef4444',
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                  </div>
                )}
              </Flex>
            </>
          ) : (
            <>
              {/* Mission control collapsed: main actions */}
              <IconButton
                size='3'
                variant='soft'
                onClick={() => { setSidebarCollapsed(false); handleMakeFlightPlan() }}
                disabled={missionLaunched}
                title={missionConfig.nodes.length > 0 ? 'Edit Flight Plan' : 'Make Flight Plan'}
                style={{ cursor: 'pointer' }}
              >
                {missionConfig.nodes.length > 0 ? <Settings size={20} /> : <Plus size={20} />}
              </IconButton>
              <IconButton
                size='3'
                variant='soft'
                onClick={() => { setSidebarCollapsed(false); handleImportFlightPlan() }}
                disabled={missionLaunched}
                title='Load Flight Plan'
                style={{ cursor: 'pointer' }}
              >
                <Upload size={20} />
              </IconButton>

              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

              <IconButton
                size='3'
                variant='soft'
                color='green'
                disabled={!missionConfig.nodes.length || (truckRoute.length === 0 && droneRoutes.length === 0) || missionLaunched}
                onClick={launchMission}
                title='Launch Mission'
                style={{ cursor: 'pointer' }}
              >
                <Play size={20} />
              </IconButton>
              <IconButton
                size='3'
                variant='soft'
                color='orange'
                disabled={!missionLaunched}
                onClick={pauseMission}
                title={missionPaused ? 'Resume Mission' : 'Pause Mission'}
                style={{ cursor: 'pointer' }}
              >
                <Pause size={20} />
              </IconButton>
              <IconButton
                size='3'
                variant='soft'
                color='red'
                disabled={!missionLaunched}
                onClick={stopMission}
                title='Stop Mission'
                style={{ cursor: 'pointer' }}
              >
                <Square size={20} />
              </IconButton>

              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

              {/* Compact status indicators */}
              <Flex direction='column' gap='2' style={{ alignItems: 'center' }}>
                <div
                  title={`Flight Plan: ${missionConfig.nodes.length > 0 ? 'Loaded' : 'None'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: missionConfig.nodes.length > 0 ? 'rgba(34, 197, 94, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${missionConfig.nodes.length > 0 ? '#22c55e' : '#d1d5db'}`,
                  }}
                >
                  <Layers size={14} style={{ color: missionConfig.nodes.length > 0 ? '#22c55e' : '#9ca3af' }} />
                </div>
                <div
                  title={`Route: ${truckRoute.length > 0 || droneRoutes.length > 0 ? 'Generated' : missionConfig.nodes.length > 0 ? 'Required' : 'N/A'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: truckRoute.length > 0 || droneRoutes.length > 0 ? 'rgba(34, 197, 94, 0.1)' : missionConfig.nodes.length > 0 ? 'rgba(249, 115, 22, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${truckRoute.length > 0 || droneRoutes.length > 0 ? '#22c55e' : missionConfig.nodes.length > 0 ? '#f97316' : '#d1d5db'}`,
                  }}
                >
                  <Route size={14} style={{ color: truckRoute.length > 0 || droneRoutes.length > 0 ? '#22c55e' : missionConfig.nodes.length > 0 ? '#f97316' : '#9ca3af' }} />
                </div>
                <div
                  title={`Mission: ${missionLaunched ? (missionPaused ? 'Paused' : 'Active') : (truckRoute.length > 0 || droneRoutes.length > 0) ? 'Ready' : 'Not Ready'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: missionLaunched ? (missionPaused ? 'rgba(249, 115, 22, 0.1)' : 'rgba(34, 197, 94, 0.1)') : (truckRoute.length > 0 || droneRoutes.length > 0) ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6',
                    border: `1.5px solid ${missionLaunched ? (missionPaused ? '#f97316' : '#22c55e') : (truckRoute.length > 0 || droneRoutes.length > 0) ? '#3b82f6' : '#d1d5db'}`,
                  }}
                >
                  <Play size={14} style={{ color: missionLaunched ? (missionPaused ? '#f97316' : '#22c55e') : (truckRoute.length > 0 || droneRoutes.length > 0) ? '#3b82f6' : '#9ca3af' }} />
                </div>
              </Flex>
            </>
          )}
        </Card>

        {/* Hidden file inputs still need to be rendered */}
        <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileImport} className='hidden' />
        <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
      </div>
    )
  }

  // Mission Management Mode Sidebar
  if (!isFlightPlannerMode) {
    return (
      <div
        className='flight-planner-sidebar'
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100vh',
          width: '384px',
          backgroundColor: 'white',
          zIndex: 1000,
          pointerEvents: 'auto',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        }}
      >
        <Card className='h-full rounded-none' style={{ backgroundColor: 'white', height: '100%' }}>
          <Flex direction='column' className='h-full' style={{ height: '100%' }}>
            {/* Header */}
            <Flex justify='between' align='center' className='p-4 border-b'>
              <Flex align='center' gap='2'>
                <Target size={20} />
                <Text size='5' weight='bold'>
                  Mission Control
                </Text>
              </Flex>
              <IconButton onClick={() => setSidebarCollapsed(true)} size='2' variant='ghost'>
                <ChevronLeft size={20} />
              </IconButton>
            </Flex>

            <ScrollArea className='flex-1'>
              <div className='p-4 space-y-6'>
                {/* Mission Management Section */}
                <Box
                  className={missionLaunched ? 'opacity-60' : ''}
                  style={{
                    backgroundColor: missionLaunched ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                    padding: missionLaunched ? '12px' : '0',
                    borderRadius: missionLaunched ? '8px' : '0',
                    border: missionLaunched ? '1px solid rgba(239, 68, 68, 0.2)' : 'none',
                  }}
                >
                  <Flex align='center' gap='2' className='mb-3'>
                    {missionLaunched ? <Lock size={18} className='text-red-500' /> : <Settings size={18} />}
                    <Text size='3' weight='bold'>
                      Mission Management
                    </Text>
                    {missionLaunched && (
                      <Badge color='red' size='1'>
                        Locked
                      </Badge>
                    )}
                  </Flex>

                  <Flex direction='column' align='center' gap='4'>
                    <Button size='3' onClick={handleMakeFlightPlan} disabled={missionLaunched}>
                      {missionConfig.nodes.length > 0 ? (
                        <>
                          <Settings size={16} /> Edit Flight Plan
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Make Flight Plan
                        </>
                      )}
                    </Button>
                    <Button
                      size='3'
                      variant='soft'
                      onClick={handleImportFlightPlan}
                      disabled={missionLaunched}
                    >
                      <Upload size={16} /> Load Flight Plan
                    </Button>
                  </Flex>
                </Box>

                {/* Flight Control Section */}
                <Box className='border-t pt-6'>
                  <Flex align='center' gap='2' className='mb-3'>
                    <Play size={18} />
                    <Text size='3' weight='bold'>
                      Flight Control
                    </Text>
                  </Flex>

                  <Flex gap='4' justify='center'>
                    <Button
                      size='2'
                      color='green'
                      disabled={
                        !missionConfig.nodes.length ||
                        (truckRoute.length === 0 && droneRoutes.length === 0) ||
                        missionLaunched
                      }
                      onClick={launchMission}
                    >
                      <Play size={14} /> Launch
                    </Button>
                    <Button
                      size='2'
                      color='orange'
                      variant='soft'
                      disabled={!missionLaunched}
                      onClick={pauseMission}
                    >
                      <Pause size={14} /> {missionPaused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button
                      size='2'
                      color='red'
                      variant='soft'
                      disabled={!missionLaunched}
                      onClick={stopMission}
                    >
                      <Square size={14} /> Stop
                    </Button>
                  </Flex>

                  {/* Status Table */}
                  <Box
                    className='mt-14'
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Flight Plan row */}
                    <Flex
                      align='center'
                      justify='between'
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      <Flex align='center' gap='2'>
                        <Layers size={14} style={{ color: '#6b7280' }} />
                        <Text size='2' style={{ color: '#374151' }}>Flight Plan</Text>
                      </Flex>
                      <Badge
                        size='1'
                        color={missionConfig.nodes.length > 0 ? 'green' : 'gray'}
                        variant={missionConfig.nodes.length > 0 ? 'soft' : 'outline'}
                      >
                        {missionConfig.nodes.length > 0 ? 'Loaded' : 'None'}
                      </Badge>
                    </Flex>

                    {/* Route row */}
                    <Flex
                      align='center'
                      justify='between'
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                      }}
                    >
                      <Flex align='center' gap='2'>
                        <Route size={14} style={{ color: '#6b7280' }} />
                        <Text size='2' style={{ color: '#374151' }}>Route</Text>
                      </Flex>
                      <Badge
                        size='1'
                        color={truckRoute.length > 0 || droneRoutes.length > 0 ? 'green' : missionConfig.nodes.length > 0 ? 'orange' : 'gray'}
                        variant={truckRoute.length > 0 || droneRoutes.length > 0 ? 'soft' : 'outline'}
                      >
                        {truckRoute.length > 0 || droneRoutes.length > 0 ? 'Generated' : missionConfig.nodes.length > 0 ? 'Required' : 'N/A'}
                      </Badge>
                    </Flex>

                    {/* Mission row */}
                    <Flex
                      align='center'
                      justify='between'
                      style={{
                        padding: '8px 12px',
                        backgroundColor: missionLaunched ? 'rgba(16, 185, 129, 0.05)' : '#f9fafb',
                      }}
                    >
                      <Flex align='center' gap='2'>
                        <Play size={14} style={{ color: missionLaunched ? (missionPaused ? '#f59e0b' : '#10b981') : '#6b7280' }} />
                        <Text size='2' style={{ color: '#374151' }}>Mission</Text>
                      </Flex>
                      <Badge
                        size='1'
                        color={missionLaunched ? (missionPaused ? 'orange' : 'green') : (truckRoute.length > 0 || droneRoutes.length > 0) ? 'blue' : 'gray'}
                        variant={missionLaunched ? 'solid' : (truckRoute.length > 0 || droneRoutes.length > 0) ? 'soft' : 'outline'}
                      >
                        {missionLaunched ? (missionPaused ? 'Paused' : 'Active') : (truckRoute.length > 0 || droneRoutes.length > 0) ? 'Ready' : 'Not Ready'}
                      </Badge>
                    </Flex>
                  </Box>
                </Box>

              </div>
            </ScrollArea>
          </Flex>
        </Card>

        {/* Hidden file input */}
        <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileImport} className='hidden' />
        <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
      </div>
    )
  }

  // Flight Planner Mode Sidebar
  return (
    <div
      className='flight-planner-sidebar'
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100vh',
        width: '384px',
        backgroundColor: 'white',
        zIndex: 1000,
        pointerEvents: 'auto',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      }}
    >
      <Card className='h-full rounded-none' style={{ backgroundColor: 'white', height: '100%' }}>
        <Flex direction='column' className='h-full' style={{ height: '100%' }}>
          {/* Header */}
          <Flex justify='between' align='center' className='p-4 border-b'>
            <Flex align='center' gap='2'>
              <Layers size={20} />
              <Text size='5' weight='bold'>
                Flight Planner
              </Text>
            </Flex>
            <IconButton onClick={() => setSidebarCollapsed(true)} size='3' variant='ghost' style={{ cursor: 'pointer' }}>
              <ChevronLeft size={24} />
            </IconButton>
          </Flex>

          {/* Tabs */}
          <Tabs.Root
            value={activePanelTab}
            onValueChange={(v: string) => setActivePanelTab(v as 'overview' | 'advanced')}
          >
            <Tabs.List className='px-4 pt-2'>
              <Tabs.Trigger value='overview'>
                <Target size={16} className='mr-1' />
                Actions
              </Tabs.Trigger>
              <Tabs.Trigger value='advanced'>
                <Settings size={16} className='mr-1' />
                Advanced
              </Tabs.Trigger>
            </Tabs.List>

            <ScrollArea className='flex-1'>
              {/* Actions Tab */}
              <Tabs.Content value='overview' className='p-4 space-y-4'>
                <Box>
                  <div className='space-y-10'>
                    <Flex gap='4' justify='center'>
                      <Button
                        size='2'
                        variant='soft'
                        color='gray'
                        onClick={() => setIsFlightPlannerMode(false)}
                      >
                        <LogOut size={14} /> Exit
                      </Button>
                      <Button
                        size='2'
                        variant='soft'
                        color='green'
                        onClick={() => {
                          exportMission()
                          setIsFlightPlannerMode(false)
                        }}
                      >
                        <Save size={14} /> Save & Exit
                      </Button>
                      <Button size='2' variant='soft' color='blue' onClick={() => exportMission()}>
                        <Download size={14} /> Save
                      </Button>
                    </Flex>

                    <Flex justify='center'>
                      <Button
                        size='3'
                        color='blue'
                        onClick={generateRoute}
                        loading={isGeneratingRoute}
                        disabled={hasUnassignedWaypoints}
                      >
                        <Route size={16} /> Generate Optimal Route
                      </Button>
                    </Flex>

                    {/* Route Status Table */}
                    <Box
                      style={{
                        border: `1px solid ${hasUnassignedWaypoints ? '#fca5a5' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Route status header */}
                      <Flex
                        align='center'
                        justify='between'
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: hasUnassignedWaypoints ? '#fef2f2' : '#f9fafb',
                        }}
                      >
                        <Flex align='center' gap='2'>
                          <Route size={14} style={{ color: hasUnassignedWaypoints ? '#ef4444' : '#6b7280' }} />
                          <Text size='2' weight='medium' style={{ color: '#374151' }}>Route Status</Text>
                        </Flex>
                        <Badge
                          size='1'
                          color={hasUnassignedWaypoints ? 'red' : truckRoute.length > 0 || droneRoutes.length > 0 ? 'green' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? 'orange' : 'gray'}
                          variant={truckRoute.length > 0 || droneRoutes.length > 0 ? 'soft' : 'outline'}
                        >
                          {hasUnassignedWaypoints ? 'Blocked' : truckRoute.length > 0 || droneRoutes.length > 0 ? 'Generated' : missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? 'Required' : 'Pending'}
                        </Badge>
                      </Flex>

                      {/* Unassigned waypoints row */}
                      {hasUnassignedWaypoints && (
                        <Flex
                          align='center'
                          justify='between'
                          style={{
                            padding: '6px 12px',
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: '#fef2f2',
                          }}
                        >
                          <Flex align='center' gap='2'>
                            <div className='pulse-dot' style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                            <Text size='1' style={{ color: '#991b1b' }}>Unassigned Waypoints</Text>
                          </Flex>
                          <Badge size='1' color='red' variant='soft'>
                            {missionConfig.nodes.filter(n => n.type === 'waypoint').length}
                          </Badge>
                        </Flex>
                      )}

                      {/* Truck route row */}
                      <Flex
                        align='center'
                        justify='between'
                        style={{
                          padding: '6px 12px',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: 'white',
                        }}
                      >
                        <Flex align='center' gap='2'>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: truckRoute.length > 0 ? '#374151' : '#d1d5db' }} />
                          <Text size='1' style={{ color: '#6b7280' }}>Truck Route</Text>
                        </Flex>
                        <Text size='1' weight='medium' style={{ color: truckRoute.length > 0 ? '#374151' : '#9ca3af' }}>
                          {truckRoute.length > 0 ? `${truckRoute.length} pts` : '--'}
                        </Text>
                      </Flex>

                      {/* Drone paths row */}
                      <Flex
                        align='center'
                        justify='between'
                        style={{
                          padding: '6px 12px',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: 'white',
                        }}
                      >
                        <Flex align='center' gap='2'>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: droneRoutes.length > 0 ? '#3b82f6' : '#d1d5db' }} />
                          <Text size='1' style={{ color: '#6b7280' }}>Drone Paths</Text>
                        </Flex>
                        <Text size='1' weight='medium' style={{ color: droneRoutes.length > 0 ? '#374151' : '#9ca3af' }}>
                          {droneRoutes.length > 0 ? `${droneRoutes.length} sorties` : '--'}
                        </Text>
                      </Flex>

                      {/* Nodes indicator row */}
                      <Flex
                        align='center'
                        justify='between'
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f9fafb',
                        }}
                      >
                        <Flex align='center' gap='2'>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#10b981' : '#d1d5db' }} />
                          <Text size='1' style={{ color: '#6b7280' }}>Order Points</Text>
                        </Flex>
                        <Flex align='center' gap='2'>
                          <Text size='1' weight='medium' style={{ color: missionConfig.nodes.filter(n => n.type === 'order').length > 0 ? '#374151' : '#9ca3af' }}>
                            {missionConfig.nodes.filter(n => n.type === 'order').length || '--'}
                          </Text>
                          {missionConfig.nodes.filter(n => n.type === 'order').length > 0 && truckRoute.length === 0 && droneRoutes.length === 0 && !hasUnassignedWaypoints && (
                            <div
                              className='pulse-dot'
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#f97316',
                              }}
                              title='Nodes added — generate route'
                            />
                          )}
                        </Flex>
                      </Flex>
                    </Box>
                  </div>
                </Box>
              </Tabs.Content>

              {/* Advanced Tab */}
              <Tabs.Content value='advanced' className='p-4 space-y-4'>
                <Box>
                  <Text size='2' weight='bold' className='mb-2 block'>
                    Routing Algorithm
                  </Text>
                  <Select.Root
                    value={missionConfig.algorithm}
                    onValueChange={(value: string) => updateMissionConfig({ algorithm: value as RoutingAlgorithm })}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value='alns'>ALNS (Adaptive Large Neighborhood Search)</Select.Item>
                      <Select.Item value='custom'>Custom</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text size='2' weight='bold' className='mb-3 block'>
                    Import/Export Addresses
                  </Text>
                  <Flex direction='column' align='center' gap='4'>
                    <Button size='2' variant='soft' onClick={handleImportCSV} disabled={csvImporting}>
                      <Upload size={16} /> {csvImporting ? 'Importing...' : 'Import Addresses (CSV)'}
                    </Button>
                    <Button size='2' variant='soft' onClick={handleExportCSV} disabled={missionConfig.nodes.length === 0}>
                      <Download size={16} /> Export Addresses (CSV)
                    </Button>
                  </Flex>
                </Box>

                <Box className='border-t pt-4'>
                  <Text size='2' weight='bold' className='mb-3 block'>
                    Reset
                  </Text>
                  <Flex justify='center'>
                    <Button
                      size='2'
                      variant='soft'
                      color='red'
                      onClick={() => {
                        updateMissionConfig({ nodes: [], routes: undefined })
                      }}
                      disabled={missionConfig.nodes.length === 0}
                    >
                      <Trash2 size={16} /> Reset Flight Plan
                    </Button>
                  </Flex>
                </Box>
              </Tabs.Content>
            </ScrollArea>
          </Tabs.Root>
        </Flex>
      </Card>
    </div>
  )
}

// Helper functions
function getNodeTypeColor(type: string): 'blue' | 'green' | 'orange' | 'purple' | 'red' {
  const colors = {
    depot: 'blue' as const,
    order: 'green' as const,
    station: 'orange' as const,
    waypoint: 'purple' as const,
    hazard: 'red' as const,
  }
  return colors[type as keyof typeof colors] || 'blue'
}

function getHazardColor(severity: string): 'yellow' | 'orange' | 'red' {
  const colors = {
    low: 'yellow' as const,
    medium: 'orange' as const,
    high: 'red' as const,
  }
  return colors[severity as keyof typeof colors] || 'orange'
}
