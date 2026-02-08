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
} from 'lucide-react'
import { FlightNode, HazardZone, RoutingAlgorithm } from '@/lib/types'
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
    launchMission,
    stopMission,
    importMission,
    exportMission,
    generateRoute,
    isGeneratingRoute,
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

        const newNode: FlightNode = {
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
      <div className='absolute left-0 top-0 h-full z-[1000] pointer-events-auto'>
        <Button onClick={() => setSidebarCollapsed(false)} className='mt-4 ml-2 bg-white shadow-lg hover:shadow-xl' size='3' style={{ cursor: 'pointer', padding: '10px' }}>
          <ChevronRight size={24} />
        </Button>
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
                    <Button size='2' color='orange' variant='soft' disabled>
                      <Pause size={14} /> Pause
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

                  <Box className={`mt-3 p-3 rounded ${missionLaunched ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <Text size='2' color={missionLaunched ? 'green' : 'blue'}>
                      <strong>Status:</strong>{' '}
                      {missionLaunched
                        ? 'Mission Active'
                        : !missionConfig.nodes.length
                        ? 'No waypoints'
                        : truckRoute.length === 0 && droneRoutes.length === 0
                        ? 'Route not generated'
                        : 'Ready to launch'}
                      <br />
                      {missionLaunched
                        ? 'The mission is currently running. Click Stop to end the mission.'
                        : !missionConfig.nodes.length
                        ? 'Add waypoints to create a flight plan.'
                        : truckRoute.length === 0 && droneRoutes.length === 0
                        ? 'Generate a route before launching the mission.'
                        : 'Mission is ready to launch.'}
                    </Text>
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
                  <div className='space-y-4'>
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
                      >
                        <Route size={16} /> Generate Optimal Route
                      </Button>
                    </Flex>

                    {/* Route Status Messages */}
                    {missionConfig.nodes.filter(n => n.type === 'order').length > 0 && truckRoute.length === 0 && droneRoutes.length === 0 && (
                      <Box className='bg-orange-50 p-3 rounded'>
                        <Flex align='center' gap='2' className='mb-1'>
                          <AlertCircle size={16} className='text-orange-600' />
                          <Text size='2' weight='bold' color='orange'>
                            Route Required
                          </Text>
                        </Flex>
                        <Text size='1' color='gray'>
                          Generate a route before you can launch the mission.
                        </Text>
                      </Box>
                    )}

                    {(truckRoute.length > 0 || droneRoutes.length > 0) && (
                      <Box className='bg-green-50 p-3 rounded'>
                        <Flex align='center' gap='2' className='mb-2'>
                          <CheckCircle size={16} className='text-green-600' />
                          <Text size='2' weight='bold' color='green'>
                            Route Generated
                          </Text>
                        </Flex>
                        <Text size='1' color='gray'>
                          Route is ready for review. Check the map for the optimized path.
                        </Text>
                        <Flex gap='2' className='mt-2 text-xs'>
                          <Text size='1' color='gray'>
                            Truck: {truckRoute.length} pts
                          </Text>
                          <Text size='1' color='gray'>
                            Drones: {droneRoutes.length} paths
                          </Text>
                        </Flex>
                      </Box>
                    )}
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
