'use client'

import React, { useRef } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import { FlightNode } from '@/lib/types'
import { Box, Card, Flex, Text, Button, Badge, IconButton, ScrollArea, TextField } from '@radix-ui/themes'
import {
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Square,
  Save,
  Upload,
  Download,
  FileText,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  X,
  LogOut,
  Route,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  MousePointer2,
} from 'lucide-react'

export function BottomPanel() {
  const {
    currentMission,
    missionConfig,
    bottomPanelExpanded,
    setBottomPanelExpanded,
    saveMission,
    exportMission,
    importMission,
    createNewMission,
    truckRoute,
    droneRoutes,
    isFlightPlannerMode,
    setIsFlightPlannerMode,
    addNode,
    updateNode,
    removeNode,
    generateRoute,
    isGeneratingRoute,
    plotModeCustomer,
    setPlotModeCustomer,
    selectedNodeId,
  } = useFlightPlanner()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        importMission(content)
      }
      reader.readAsText(file)
    }
  }

  const handleImportCSV = () => {
    csvInputRef.current?.click()
  }

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const lines = content.split('\n').slice(1) // Skip header

        lines.forEach((line) => {
          if (!line.trim()) return
          const [type, label, lat, lng, action] = line.split(',')

          if (type === 'customer' || !type) {
            const newNode: FlightNode = {
              id: `node-${Date.now()}-${Math.random()}`,
              type: 'customer',
              lat: parseFloat(lat),
              lng: parseFloat(lng),
              label: label || `Customer ${missionConfig.nodes.filter(n => n.type === 'customer').length + 1}`,
              action: action || '',
            }
            addNode(newNode)
          }
        })
      }
      reader.readAsText(file)
    }
  }

  const handleExportCSV = () => {
    const customers = missionConfig.nodes.filter((n) => n.type === 'customer')
    const csvContent = [
      'Type,Label,Latitude,Longitude,Action',
      ...customers.map(
        (node) => `${node.type},${node.label || ''},${node.lat},${node.lng},${node.action || ''}`
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${missionConfig.missionName.replace(/\s+/g, '_')}_customers.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleAddCustomer = () => {
    const newNode: FlightNode = {
      id: `node-${Date.now()}`,
      type: 'customer',
      lat: 26.4619, // Default FGCU coordinates
      lng: -81.7726,
      label: `Customer ${missionConfig.nodes.filter((n) => n.type === 'customer').length + 1}`,
    }
    addNode(newNode)
  }

  const handleExitFlightPlanner = () => {
    setIsFlightPlannerMode(false)
  }

  const missionStatus = currentMission?.status || 'idle'
  const hasRoute = truckRoute.length > 0 || droneRoutes.length > 0
  const customerNodes = missionConfig.nodes.filter((n) => n.type === 'customer')

  // Collapsed state
  if (!bottomPanelExpanded) {
    return (
      <div
        className="flight-planner-bottom"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <Card className="rounded-t-lg rounded-b-none shadow-xl mx-4 mb-0" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
          <Flex justify="between" align="center" className="p-3">
            <Flex gap="4" align="center">
              {isFlightPlannerMode ? (
                <>
                  <Flex align="center" gap="2">
                    <Route size={18} />
                    <Text size="2" weight="bold">
                      Flight Planner
                    </Text>
                  </Flex>
                  <Flex gap="2" align="center">
                    <MapPin size={14} />
                    <Text size="1" color="gray">
                      {customerNodes.length} customers
                    </Text>
                  </Flex>
                  {hasRoute && (
                    <Flex gap="2" align="center">
                      <CheckCircle size={14} className="text-green-500" />
                      <Text size="1" color="green">
                        Route Generated
                      </Text>
                    </Flex>
                  )}
                </>
              ) : (
                <>
                  <Flex align="center" gap="2">
                    <FileText size={18} />
                    <Text size="2" weight="bold">
                      Mission Progress
                    </Text>
                    <Badge color={getStatusColor(missionStatus)}>{missionStatus}</Badge>
                  </Flex>
                  <Flex gap="2" align="center">
                    <Clock size={14} />
                    <Text size="1" color="gray">
                      00:00 elapsed
                    </Text>
                  </Flex>
                  <Flex gap="2" align="center">
                    <CheckCircle size={14} className="text-gray-400" />
                    <Text size="1" color="gray">
                      3 tasks pending
                    </Text>
                  </Flex>
                </>
              )}
            </Flex>

            <Flex gap="2">
              {isFlightPlannerMode && (
                <Button size="1" onClick={generateRoute} loading={isGeneratingRoute}>
                  <Route size={14} /> Generate
                </Button>
              )}
              <IconButton size="1" variant="ghost" onClick={() => setBottomPanelExpanded(true)}>
                <ChevronUp size={18} />
              </IconButton>
            </Flex>
          </Flex>
        </Card>
      </div>
    )
  }

  // Expanded state - Flight Planner Mode
  if (isFlightPlannerMode) {
    return (
      <div
        className="flight-planner-bottom"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '16rem',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <Card className="h-full rounded-none shadow-xl" style={{ height: '100%' }}>
          <Flex direction="column" className="h-full">
            {/* Header */}
            <Flex justify="between" align="center" className="p-3 border-b" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
              <Flex gap="4" align="center">
                <Flex align="center" gap="2">
                  <Route size={18} />
                  <Text size="3" weight="bold">
                    Flight Planner
                  </Text>
                </Flex>
                <Flex gap="3" align="center" className="text-gray-600">
                  <Flex gap="1" align="center">
                    <MapPin size={14} />
                    <Text size="1">{customerNodes.length} customers</Text>
                  </Flex>
                  {hasRoute && (
                    <Flex gap="1" align="center">
                      <CheckCircle size={14} className="text-green-500" />
                      <Text size="1" color="green">
                        Route ready
                      </Text>
                    </Flex>
                  )}
                </Flex>
              </Flex>

              <Flex gap="2">
                <Button size="1" variant="soft" color="blue" onClick={exportMission}>
                  <Download size={14} /> Save
                </Button>
                <Button size="1" variant="soft" color="gray" onClick={handleExitFlightPlanner}>
                  <LogOut size={14} /> Exit Planner
                </Button>
                <IconButton size="2" variant="ghost" onClick={() => setBottomPanelExpanded(false)}>
                  <ChevronDown size={20} />
                </IconButton>
              </Flex>
            </Flex>

            <Flex className="flex-1" style={{ minHeight: 0, backgroundColor: 'white' }}>
              {/* Left: Customer Nodes List */}
              <Box className="flex-1 p-4 border-r" style={{ overflow: 'hidden' }}>
                <Flex justify="between" align="center" className="mb-3">
                  <Text size="2" weight="bold">
                    Customer Locations ({customerNodes.length})
                  </Text>
                  <Flex gap="2">
                    <Button
                      size="1"
                      variant={plotModeCustomer ? 'solid' : 'soft'}
                      color={plotModeCustomer ? 'blue' : 'gray'}
                      onClick={() => setPlotModeCustomer(!plotModeCustomer)}
                    >
                      <MousePointer2 size={14} /> Plot
                    </Button>
                    <Button size="1" onClick={handleAddCustomer}>
                      <Plus size={14} /> Add Customer
                    </Button>
                  </Flex>
                </Flex>

                <ScrollArea style={{ height: 'calc(100% - 2.5rem)' }}>
                  <div className="space-y-2 pr-2">
                    {customerNodes.map((node, index) => (
                      <Card
                        key={node.id}
                        className="p-2"
                        style={{
                          backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                          border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                        }}
                      >
                        <Flex justify="between" align="start">
                          <Flex direction="column" gap="2" className="flex-1 mr-2">
                            <Flex align="center" gap="2">
                              <MapPin size={14} />
                              <TextField.Root
                                value={node.label || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateNode(node.id, { label: e.target.value })
                                }
                                placeholder={`Customer ${index + 1}`}
                                size="1"
                                style={{ flex: 1 }}
                              />
                            </Flex>
                            <Flex gap="2">
                              {/* Latitude with increment/decrement */}
                              <Flex align="center" gap="1" style={{ flex: 1 }}>
                                <TextField.Root
                                  value={node.lat}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateNode(node.id, { lat: parseFloat(e.target.value) || 0 })
                                  }
                                  placeholder="Latitude"
                                  size="1"
                                  type="number"
                                  step="0.0001"
                                  style={{ flex: 1 }}
                                />
                                <Flex direction="column" gap="1">
                                  <IconButton
                                    size="1"
                                    variant="soft"
                                    onClick={() => updateNode(node.id, { lat: parseFloat((node.lat + 0.0001).toFixed(6)) })}
                                    style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                  >
                                    <ArrowUp size={12} />
                                  </IconButton>
                                  <IconButton
                                    size="1"
                                    variant="soft"
                                    onClick={() => updateNode(node.id, { lat: parseFloat((node.lat - 0.0001).toFixed(6)) })}
                                    style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                  >
                                    <ArrowDown size={12} />
                                  </IconButton>
                                </Flex>
                              </Flex>

                              {/* Longitude with increment/decrement */}
                              <Flex align="center" gap="1" style={{ flex: 1 }}>
                                <TextField.Root
                                  value={node.lng}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateNode(node.id, { lng: parseFloat(e.target.value) || 0 })
                                  }
                                  placeholder="Longitude"
                                  size="1"
                                  type="number"
                                  step="0.0001"
                                  style={{ flex: 1 }}
                                />
                                <Flex direction="column" gap="1">
                                  <IconButton
                                    size="1"
                                    variant="soft"
                                    onClick={() => updateNode(node.id, { lng: parseFloat((node.lng + 0.0001).toFixed(6)) })}
                                    style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                  >
                                    <ArrowUp size={12} />
                                  </IconButton>
                                  <IconButton
                                    size="1"
                                    variant="soft"
                                    onClick={() => updateNode(node.id, { lng: parseFloat((node.lng - 0.0001).toFixed(6)) })}
                                    style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                  >
                                    <ArrowDown size={12} />
                                  </IconButton>
                                </Flex>
                              </Flex>
                            </Flex>
                          </Flex>
                          <IconButton
                            size="1"
                            variant="ghost"
                            color="red"
                            onClick={() => removeNode(node.id)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Flex>
                      </Card>
                    ))}

                    {customerNodes.length === 0 && (
                      <Box className="text-center p-6 bg-gray-50 rounded">
                        <Text size="2" color="gray">
                          No customers added yet. Click &quot;Add Customer&quot; or click on the map.
                        </Text>
                      </Box>
                    )}
                  </div>
                </ScrollArea>
              </Box>

              {/* Right: Actions */}
              <Box className="w-80 p-4">
                <Text size="2" weight="bold" className="mb-3 block">
                  Route Actions
                </Text>

                <div className="space-y-3">
                  <Button size="3" className="w-full" color="blue" onClick={generateRoute} loading={isGeneratingRoute}>
                    <Route size={16} /> Generate Optimal Route
                  </Button>

                  <Box className="border-t pt-3">
                    <Text size="2" weight="bold" className="mb-2 block">
                      Import/Export
                    </Text>
                    <div className="space-y-2">
                      <Button size="2" variant="soft" className="w-full" onClick={handleImportCSV}>
                        <Upload size={16} /> Import Customers (CSV)
                      </Button>
                      <Button
                        size="2"
                        variant="soft"
                        className="w-full"
                        onClick={handleExportCSV}
                        disabled={customerNodes.length === 0}
                      >
                        <Download size={16} /> Export Customers (CSV)
                      </Button>
                    </div>
                  </Box>

                  <Box className="border-t pt-3">
                    <Text size="2" weight="bold" className="mb-2 block">
                      Save Plan
                    </Text>
                    <Flex gap="2">
                      <Button size="2" variant="soft" className="flex-1" onClick={saveMission}>
                        <Save size={16} /> Save
                      </Button>
                      <Button size="2" variant="soft" className="flex-1" onClick={exportMission}>
                        <Download size={16} /> Export
                      </Button>
                    </Flex>
                  </Box>

                  {hasRoute && (
                    <Box className="bg-green-50 p-3 rounded mt-3">
                      <Flex align="center" gap="2" className="mb-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <Text size="2" weight="bold" color="green">
                          Route Generated
                        </Text>
                      </Flex>
                      <Text size="1" color="gray">
                        Route is ready for review. Check the map for the optimized path.
                      </Text>
                    </Box>
                  )}
                </div>
              </Box>
            </Flex>
          </Flex>
        </Card>

        {/* Hidden file inputs */}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVImport}
          className="hidden"
        />
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
      </div>
    )
  }

  // Expanded state - Mission Management Mode
  const mockTasks = [
    { id: 1, name: 'Pre-flight check', status: 'pending', progress: 0 },
    { id: 2, name: 'Route validation', status: 'pending', progress: 0 },
    { id: 3, name: 'Equipment calibration', status: 'pending', progress: 0 },
  ]

  return (
    <div
      className="flight-planner-bottom"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '16rem',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      <Card className="h-full rounded-none shadow-xl" style={{ height: '100%' }}>
        <Flex direction="column" className="h-full">
          {/* Header */}
          <Flex justify="between" align="center" className="p-3 border-b" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
            <Flex gap="4" align="center">
              <Flex align="center" gap="2">
                <FileText size={18} />
                <Text size="3" weight="bold">
                  Mission Progress
                </Text>
                <Badge color={getStatusColor(missionStatus)} size="2">
                  {missionStatus}
                </Badge>
              </Flex>

              <Flex gap="3" align="center" className="text-gray-600">
                <Flex gap="1" align="center">
                  <Clock size={14} />
                  <Text size="1">00:00 elapsed</Text>
                </Flex>
                {missionConfig.estimatedDuration && (
                  <Flex gap="1" align="center">
                    <Text size="1">/ {missionConfig.estimatedDuration}m total</Text>
                  </Flex>
                )}
              </Flex>
            </Flex>

            <IconButton size="2" variant="ghost" onClick={() => setBottomPanelExpanded(false)}>
              <ChevronDown size={20} />
            </IconButton>
          </Flex>

          <Flex className="flex-1" style={{ minHeight: 0, backgroundColor: 'white' }}>
            {/* Left: Current Tasks */}
            <Box className="flex-1 p-4 border-r" style={{ overflow: 'hidden' }}>
              <Text size="2" weight="bold" className="mb-3 block">
                Current Tasks
              </Text>

              <ScrollArea style={{ height: 'calc(100% - 2rem)' }}>
                <div className="space-y-2 pr-2">
                  {mockTasks.map((task) => (
                    <Card key={task.id} className="p-3">
                      <Flex justify="between" align="start" className="mb-2">
                        <Flex align="center" gap="2">
                          {task.status === 'complete' ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : task.status === 'in_progress' ? (
                            <Clock size={16} className="text-blue-500" />
                          ) : (
                            <AlertCircle size={16} className="text-gray-400" />
                          )}
                          <Text size="2" weight="medium">
                            {task.name}
                          </Text>
                        </Flex>
                        <Badge
                          color={
                            task.status === 'complete'
                              ? 'green'
                              : task.status === 'in_progress'
                                ? 'blue'
                                : 'gray'
                          }
                          size="1"
                        >
                          {task.status}
                        </Badge>
                      </Flex>
                      <Box className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                        <Box
                          className="h-full bg-blue-500"
                          style={{ width: `${task.progress}%` }}
                        />
                      </Box>
                    </Card>
                  ))}

                  {mockTasks.length === 0 && (
                    <Box className="text-center p-6 bg-gray-50 rounded">
                      <Text size="2" color="gray">
                        No active tasks. Launch a mission to begin.
                      </Text>
                    </Box>
                  )}
                </div>
              </ScrollArea>
            </Box>

            {/* Right: Mission Overview */}
            <Box className="w-80 p-4">
              <Text size="2" weight="bold" className="mb-3 block">
                Mission Overview
              </Text>

              <div className="space-y-3">
                {/* Mission Stats */}
                <Box className="p-3 bg-gray-50 rounded space-y-2">
                  <Flex justify="between">
                    <Text size="1" color="gray">Mission:</Text>
                    <Text size="1" weight="medium">{missionConfig.missionName}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="1" color="gray">Waypoints:</Text>
                    <Text size="1" weight="medium">{missionConfig.nodes.length}</Text>
                  </Flex>
                  {hasRoute && (
                    <>
                      <Flex justify="between">
                        <Text size="1" color="gray">Truck Route:</Text>
                        <Text size="1" weight="medium">{truckRoute.length} points</Text>
                      </Flex>
                      <Flex justify="between">
                        <Text size="1" color="gray">Drone Routes:</Text>
                        <Text size="1" weight="medium">{droneRoutes.length} sorties</Text>
                      </Flex>
                    </>
                  )}
                </Box>

                {/* Mission Goal */}
                {missionConfig.missionGoal && (
                  <Box className="p-3 bg-blue-50 rounded">
                    <Text size="1" weight="bold" className="block mb-1">
                      Mission Goal:
                    </Text>
                    <Text size="1" color="gray">
                      {missionConfig.missionGoal}
                    </Text>
                  </Box>
                )}

                {/* Status Indicators */}
                <Box className="space-y-2">
                  <StatusItem
                    label="Route Planning"
                    status={hasRoute ? 'complete' : 'pending'}
                    detail={hasRoute ? 'Route ready' : 'No route planned'}
                  />
                  <StatusItem
                    label="Flight Status"
                    status={missionStatus === 'active' ? 'complete' : 'pending'}
                    detail={missionStatus === 'active' ? 'Mission active' : 'Not launched'}
                  />
                </Box>

                {/* Alert for hazards */}
                {missionConfig.nodes.filter((n) => n.type === 'hazard').length > 0 && (
                  <Box className="p-3 bg-orange-50 rounded">
                    <Flex align="center" gap="2" className="mb-1">
                      <AlertCircle size={16} className="text-orange-600" />
                      <Text size="1" weight="bold" color="orange">
                        Hazard Alert
                      </Text>
                    </Flex>
                    <Text size="1" color="gray">
                      {missionConfig.nodes.filter((n) => n.type === 'hazard').length} hazard zone(s) detected on route
                    </Text>
                  </Box>
                )}
              </div>
            </Box>
          </Flex>
        </Flex>
      </Card>
    </div>
  )
}

// Helper Components
function StatusItem({
  label,
  status,
  detail,
}: {
  label: string
  status: 'complete' | 'incomplete' | 'pending'
  detail: string
}) {
  const icon =
    status === 'complete' ? (
      <CheckCircle size={16} className="text-green-500" />
    ) : status === 'incomplete' ? (
      <AlertCircle size={16} className="text-red-500" />
    ) : (
      <Clock size={16} className="text-gray-400" />
    )

  return (
    <Flex gap="2" align="start">
      {icon}
      <Box className="flex-1">
        <Text size="2" weight="medium">
          {label}
        </Text>
        <Text size="1" color="gray">
          {detail}
        </Text>
      </Box>
    </Flex>
  )
}

function getStatusColor(status: string): 'gray' | 'blue' | 'green' | 'orange' | 'red' {
  const colors: Record<string, 'gray' | 'blue' | 'green' | 'orange' | 'red'> = {
    idle: 'gray',
    planning: 'blue',
    ready: 'green',
    active: 'green',
    paused: 'orange',
    completed: 'blue',
    failed: 'red',
  }
  return colors[status] || 'gray'
}
