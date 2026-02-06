'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import { FlightNode } from '@/lib/types'
import { Box, Card, Flex, Text, Button, Badge, IconButton, ScrollArea, TextField, Progress, Tabs, Select } from '@radix-ui/themes'
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
  Package,
  Truck,
  Plane,
  Timer,
  House,
  Zap,
  AlertTriangle,
  Settings,
} from 'lucide-react'
import { TimelineTab } from './timeline'
import { useTimelineGenerator } from './timeline/useTimelineGenerator'
import { GanttChart, useGanttData, generateEmptyGanttData, GanttChartState } from './gantt'

export function BottomPanel() {
  const {
    currentMission,
    missionConfig,
    updateMissionConfig,
    bottomPanelExpanded,
    setBottomPanelExpanded,
    bottomPanelHeight,
    setBottomPanelHeight,
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
    plotModeNodes,
    setPlotModeNodes,
    selectedNodeId,
    missionLaunched,
  } = useFlightPlanner()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(0)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [missionTab, setMissionTab] = useState<'gantt' | 'customers' | 'flightNodes' | 'timeline'>('gantt')
  const [nodeTab, setNodeTab] = useState<'customers' | 'flightNodes'>('customers')
  const [fleetMode, setFleetMode] = useState<'truck-drone' | 'truck-only' | 'drones-only'>('truck-drone')
  const [droneCount, setDroneCount] = useState<number>(2)

  // Mouse event handlers for resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartY(e.clientY)
    setDragStartHeight(bottomPanelHeight)
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY - e.clientY
      const minHeightPercent = isFlightPlannerMode ? 0.32 : 0.24 // 30% for flight planner, 24% for mission management
      const minHeight = window.innerHeight * minHeightPercent
      const maxHeight = window.innerHeight * 0.8 // 80% of viewport height
      const newHeight = Math.max(minHeight, Math.min(maxHeight, dragStartHeight + deltaY))
      setBottomPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartY, dragStartHeight, setBottomPanelHeight, isFlightPlannerMode])

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        console.log('File content loaded, importing mission...')
        importMission(content)
        // Show success toast after a brief delay to ensure state is updated
        setTimeout(() => {
          showToast(`Mission imported successfully!`, 'success')
        }, 100)
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
          const [type, label, lat, lng, action, radius, severity] = line.split(',')

          const nodeType = (type || 'customer') as FlightNode['type']
          const newNode: FlightNode = {
            id: `node-${Date.now()}-${Math.random()}`,
            type: nodeType,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            label: label || undefined,
            action: action || undefined,
          }

          if (nodeType === 'hazard') {
            newNode.radius = parseFloat(radius) || 100
            newNode.severity = (severity as 'low' | 'medium' | 'high') || 'medium'
          }

          addNode(newNode)
        })
      }
      reader.readAsText(file)
    }
  }

  const handleExportCSV = () => {
    const csvContent = [
      'Type,Label,Latitude,Longitude,Action,Radius,Severity',
      ...missionConfig.nodes.map(
        (node) => `${node.type},${node.label || node.addressId || ''},${node.lat},${node.lng},${node.action || ''},${node.radius || ''},${node.severity || ''}`
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${missionConfig.missionName.replace(/\s+/g, '_')}_addresses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleAddCustomer = () => {
    // Label and addressId will be auto-assigned by FlightPlannerContext
    const newNode: FlightNode = {
      id: `node-${Date.now()}`,
      type: 'customer',
      lat: 26.4619, // Default FGCU coordinates
      lng: -81.7726,
    }
    addNode(newNode)
  }

  const handleAddFlightNode = () => {
    const newNode: FlightNode = {
      id: `node-${Date.now()}`,
      type: 'waypoint',
      lat: 26.4619, // Default FGCU coordinates
      lng: -81.7726,
    }
    addNode(newNode)
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setToastOpen(true)
  }

  const handleSave = () => {
    try {
      saveMission()
      showToast(`Mission "${missionConfig.missionName}" saved successfully!`, 'success')
    } catch (error) {
      showToast('Failed to save mission', 'error')
    }
  }

  const handleExport = () => {
    try {
      exportMission()
      showToast(`Mission "${missionConfig.missionName}" exported successfully!`, 'success')
    } catch (error) {
      showToast('Failed to export mission', 'error')
    }
  }

  const handleExitFlightPlanner = () => {
    setIsFlightPlannerMode(false)
  }

  const missionStatus = currentMission?.status || 'Idle'
  const hasRoute = truckRoute.length > 0 || droneRoutes.length > 0
  const customerNodes = missionConfig.nodes.filter((n) => n.type === 'customer')
  const flightNodes = missionConfig.nodes.filter((n) => n.type !== 'customer')

  // Stats for header display
  const totalCustomers = customerNodes.length
  const deliveredPackages = 0 // TODO: Track actual deliveries
  const totalDistance = hasRoute ? '10.5km' : 'X' // TODO: Calculate actual distance
  const coveredDistance = '0km' // TODO: Track actual distance covered
  const estimatedTime = missionConfig.estimatedDuration ? formatDuration(missionConfig.estimatedDuration) : 'X:XX'

  // Generate timeline data for Gantt chart
  const timelineResult = useTimelineGenerator(truckRoute, droneRoutes, missionConfig.nodes)

  // Generate Gantt chart data - always call hooks unconditionally
  const ganttDataFromHook = useGanttData(timelineResult, fleetMode, droneCount)
  const ganttData = hasRoute ? ganttDataFromHook : generateEmptyGanttData(fleetMode, droneCount)

  // Determine Gantt chart state
  const ganttState: GanttChartState = !missionConfig.nodes.some((n) => n.type === 'depot') && customerNodes.length === 0
    ? 'no-plan'
    : hasRoute
      ? 'loaded'
      : 'empty-fleet'

  // Current mission elapsed time in seconds (for live tracking)
  const [missionElapsedTime, setMissionElapsedTime] = useState(0)

  // Simple Toast UI Component (without Radix Toast to avoid DOM conflicts with Leaflet)
  const ToastUI = () => {
    if (!toastOpen) return null

    return (
      <div
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: toastType === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 10000,
          minWidth: '300px',
          animation: 'slideIn 0.2s ease-out',
        }}
        onClick={() => setToastOpen(false)}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {toastType === 'success' ? '✓' : '✗'} {toastMessage}
        </span>
      </div>
    )
  }

  // Auto-close toast after 3 seconds
  useEffect(() => {
    if (toastOpen) {
      const timer = setTimeout(() => {
        setToastOpen(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastOpen])

  // Collapsed state
  if (!bottomPanelExpanded) {
    return (
      <>
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
        <Card className="rounded-t-lg rounded-b-none shadow-xl mx-4 mb-0" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <Flex direction="column">
            <Flex justify="between" align="center" className="p-3">
              <Flex gap="4" align="center">
                {isFlightPlannerMode ? (
                  <Flex align="center" gap="2">
                    <Route size={18} />
                    <TextField.Root
                      value={missionConfig.missionName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateMissionConfig({ missionName: e.target.value })
                      }
                      placeholder="Mission name"
                      size="1"
                      style={{ width: '180px' }}
                    />
                  </Flex>
                ) : (
                  <Flex align="center" gap="2">
                    <FileText size={18} />
                    <Text size="2" weight="bold">
                      {missionConfig.missionName || 'Untitled Mission'}
                    </Text>
                    <Badge color={getStatusColor(missionStatus)}>{missionStatus}</Badge>
                  </Flex>
                )}
                <Flex gap="3" align="center" className="text-gray-600">
                  <Flex gap="1" align="center" title="Time Elapsed / Estimated">
                    <Clock size={14} />
                    <Text size="1">00:00/{estimatedTime}</Text>
                  </Flex>
                  <Flex gap="1" align="center" title="Deliveries">
                    <Package size={14} />
                    <Text size="1">{deliveredPackages}/{hasRoute ? totalCustomers : 'X'}</Text>
                  </Flex>
                  <Flex gap="1" align="center" title="Distance Covered / Total">
                    <Route size={14} />
                    <Text size="1">{coveredDistance}/{totalDistance}</Text>
                  </Flex>
                </Flex>
              </Flex>

              <IconButton size="1" variant="ghost" onClick={() => setBottomPanelExpanded(true)}>
                <ChevronUp size={18} />
              </IconButton>
            </Flex>
            <MissionStatsBar missionConfig={missionConfig} missionLaunched={missionLaunched} />
          </Flex>
        </Card>
        </div>
        <ToastUI />
      </>
    )
  }

  // Expanded state - Flight Planner Mode
  if (isFlightPlannerMode) {
    return (
      <>
        <div
          className="flight-planner-bottom"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${bottomPanelHeight}px`,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            cursor: isDragging ? 'grabbing' : 'ns-resize',
            zIndex: 1001,
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        />
        <Card className="h-full rounded-none shadow-xl" style={{ height: '100%' }}>
          <Flex direction="column" className="h-full">
            {/* Header */}
            <Flex justify="between" align="center" className="p-3 border-b" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
              <Flex gap="4" align="center">
                <Flex align="center" gap="2">
                  <Route size={18} />
                  <TextField.Root
                    value={missionConfig.missionName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateMissionConfig({ missionName: e.target.value })
                    }
                    placeholder="Mission name"
                    size="2"
                    style={{ width: '200px' }}
                  />
                </Flex>
                {hasRoute && (
                  <Flex gap="1" align="center">
                    <CheckCircle size={14} className="text-green-500" />
                    <Text size="1" color="green">
                      Route ready
                    </Text>
                  </Flex>
                )}
                <Flex gap="3" align="center" className="text-gray-600">
                  <Flex gap="1" align="center" title="Time Elapsed / Estimated">
                    <Clock size={14} />
                    <Text size="1">00:00/{estimatedTime}</Text>
                  </Flex>
                  <Flex gap="1" align="center" title="Deliveries">
                    <Package size={14} />
                    <Text size="1">{deliveredPackages}/{hasRoute ? totalCustomers : 'X'}</Text>
                  </Flex>
                  <Flex gap="1" align="center" title="Distance Covered / Total">
                    <Route size={14} />
                    <Text size="1">{coveredDistance}/{totalDistance}</Text>
                  </Flex>
                </Flex>
              </Flex>

              <IconButton size="2" variant="ghost" onClick={() => setBottomPanelExpanded(false)}>
                <ChevronDown size={20} />
              </IconButton>
            </Flex>

            {/* Stats Bar */}
            <MissionStatsBar missionConfig={missionConfig} />

            <Flex className="flex-1" style={{ minHeight: 0, backgroundColor: 'white' }}>
              {/* Left: Nodes with Tabs */}
              <Box className="flex-1 border-r" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Tabs.Root value={nodeTab} onValueChange={(v) => setNodeTab(v as 'customers' | 'flightNodes')} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Flex justify="between" align="center" className="px-4 pt-3">
                    <Tabs.List>
                      <Tabs.Trigger value="customers">
                        <MapPin size={14} className="mr-1" />
                        Customer Locations ({customerNodes.length})
                      </Tabs.Trigger>
                      <Tabs.Trigger value="flightNodes">
                        <Plane size={14} className="mr-1" />
                        Flight Nodes ({flightNodes.length})
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Flex gap="2">
                      {nodeTab === 'customers' ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <Button
                            size="1"
                            variant={plotModeNodes ? 'solid' : 'soft'}
                            color={plotModeNodes ? 'blue' : 'gray'}
                            onClick={() => setPlotModeNodes(!plotModeNodes)}
                          >
                            <MousePointer2 size={14} /> Plot
                          </Button>
                          <Button size="1" onClick={handleAddFlightNode}>
                            <Plus size={14} /> Add Node
                          </Button>
                        </>
                      )}
                    </Flex>
                  </Flex>

                  {/* Customer Locations Tab */}
                  <Tabs.Content value="customers" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'hidden' }}>
                    <ScrollArea style={{ height: '100%' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '8px',
                          paddingRight: '8px',
                        }}
                      >
                        {customerNodes.map((node) => (
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
                                  <MapPin size={14} className="text-green-600" />
                                  <Badge color="green" size="2" style={{ fontWeight: 'bold' }}>
                                    Customer ID: {node.addressId || '?'}
                                  </Badge>
                                </Flex>
                                <Flex gap="2">
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
                      </div>
                      {customerNodes.length === 0 && (
                        <Box className="text-center p-6 bg-gray-50 rounded">
                          <Text size="2" color="gray">
                            No customers added yet. Click &quot;Add Customer&quot; or click on the map.
                          </Text>
                        </Box>
                      )}
                    </ScrollArea>
                  </Tabs.Content>

                  {/* Flight Nodes Tab */}
                  <Tabs.Content value="flightNodes" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'hidden' }}>
                    <ScrollArea style={{ height: '100%' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                          gap: '8px',
                          paddingRight: '8px',
                        }}
                      >
                        {flightNodes.map((node, index) => (
                          <Card
                            key={node.id}
                            className="p-2"
                            style={{
                              backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                              border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                            }}
                          >
                            <Flex justify="between" align="start" className="mb-2">
                              <Flex align="center" gap="2">
                                <MapPin size={14} />
                                <Badge
                                  color={
                                    node.type === 'hazard' && node.severity
                                      ? getHazardColor(node.severity)
                                      : getNodeTypeColor(node.type)
                                  }
                                  size="1"
                                  style={{ fontWeight: 'bold' }}
                                >
                                  Flight Node ID: {node.flightNodeId || '?'}
                                </Badge>
                                <Badge
                                  color={
                                    node.type === 'hazard' && node.severity
                                      ? getHazardColor(node.severity)
                                      : getNodeTypeColor(node.type)
                                  }
                                  size="1"
                                  variant="soft"
                                >
                                  {node.type}
                                </Badge>
                                {node.type === 'hazard' && node.severity && (
                                  <Badge size="1" variant="soft" color={getHazardColor(node.severity)}>
                                    {node.severity}
                                  </Badge>
                                )}
                              </Flex>
                              <IconButton size="1" variant="ghost" color="red" onClick={() => removeNode(node.id)}>
                                <Trash2 size={14} />
                              </IconButton>
                            </Flex>

                            <Box className="space-y-2">
                              <Select.Root
                                value={node.type}
                                onValueChange={(value: string) => {
                                  const updates: Partial<FlightNode> = { type: value as FlightNode['type'] }
                                  if (value === 'hazard') {
                                    if (!node.radius) updates.radius = 100
                                    if (!node.severity) updates.severity = 'medium'
                                  }
                                  updateNode(node.id, updates)
                                }}
                              >
                                <Select.Trigger />
                                <Select.Content>
                                  <Select.Item value="depot">Depot</Select.Item>
                                  <Select.Item value="station">Station</Select.Item>
                                  <Select.Item value="waypoint">Waypoint</Select.Item>
                                  <Select.Item value="hazard">Hazard</Select.Item>
                                </Select.Content>
                              </Select.Root>

                              <Flex gap="2">
                                <Flex align="center" gap="1" style={{ flex: 1 }}>
                                  <TextField.Root
                                    placeholder="Lat"
                                    value={node.lat}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                      updateNode(node.id, { lat: parseFloat(e.target.value) || 0 })
                                    }
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
                                <Flex align="center" gap="1" style={{ flex: 1 }}>
                                  <TextField.Root
                                    placeholder="Lng"
                                    value={node.lng}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                      updateNode(node.id, { lng: parseFloat(e.target.value) || 0 })
                                    }
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

                              {node.type === 'hazard' && (
                                <Flex gap="2">
                                  <TextField.Root
                                    placeholder="Radius (m)"
                                    value={node.radius || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                      updateNode(node.id, { radius: parseFloat(e.target.value) || 100 })
                                    }
                                    size="1"
                                    type="number"
                                    style={{ flex: 1 }}
                                  />
                                  <Select.Root
                                    value={node.severity || 'medium'}
                                    onValueChange={(value: string) =>
                                      updateNode(node.id, { severity: value as 'low' | 'medium' | 'high' })
                                    }
                                  >
                                    <Select.Trigger placeholder="Severity" />
                                    <Select.Content>
                                      <Select.Item value="low">Low</Select.Item>
                                      <Select.Item value="medium">Medium</Select.Item>
                                      <Select.Item value="high">High</Select.Item>
                                    </Select.Content>
                                  </Select.Root>
                                </Flex>
                              )}

                            </Box>
                          </Card>
                        ))}
                      </div>
                      {flightNodes.length === 0 && (
                        <Box className="text-center p-6 bg-gray-50 rounded">
                          <Text size="2" color="gray">
                            No flight nodes added yet. Click &quot;Add Node&quot; to add depots, stations, waypoints, or hazards.
                          </Text>
                        </Box>
                      )}
                    </ScrollArea>
                  </Tabs.Content>
                </Tabs.Root>
              </Box>

              {/* Right: Fleet Control */}
              <Box className="w-72 p-4 border-l">
                <Text size="2" weight="bold" className="mb-3 block">
                  Fleet Control
                </Text>
                <Flex direction="column" gap="4">
                  <Button
                    size="2"
                    variant={fleetMode === 'truck-drone' ? 'solid' : 'soft'}
                    color={fleetMode === 'truck-drone' ? 'blue' : 'gray'}
                    className="w-full justify-between"
                    onClick={() => setFleetMode('truck-drone')}
                  >
                    <Flex align="center" gap="2">
                      <Truck size={16} />
                      <Plane size={16} />
                      <Text size="2">1 Truck + Drones</Text>
                    </Flex>
                    <TextField.Root
                      type="number"
                      value={droneCount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDroneCount(Math.max(1, parseInt(e.target.value) || 1))}
                      size="1"
                      style={{ width: '50px' }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      disabled={fleetMode !== 'truck-drone'}
                    />
                  </Button>
                  <Button
                    size="2"
                    variant={fleetMode === 'truck-only' ? 'solid' : 'soft'}
                    color={fleetMode === 'truck-only' ? 'blue' : 'gray'}
                    className="w-full justify-center"
                    onClick={() => setFleetMode('truck-only')}
                  >
                    <Flex align="center" gap="2">
                      <Truck size={16} />
                      <Text size="2">Truck Only</Text>
                    </Flex>
                  </Button>
                  <Button
                    size="2"
                    variant={fleetMode === 'drones-only' ? 'solid' : 'soft'}
                    color={fleetMode === 'drones-only' ? 'blue' : 'gray'}
                    className="w-full justify-between"
                    onClick={() => setFleetMode('drones-only')}
                  >
                    <Flex align="center" gap="2">
                      <Plane size={16} />
                      <Text size="2">Drones Only</Text>
                    </Flex>
                    <TextField.Root
                      type="number"
                      value={droneCount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDroneCount(Math.max(1, parseInt(e.target.value) || 1))}
                      size="1"
                      style={{ width: '50px' }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      disabled={fleetMode !== 'drones-only'}
                    />
                  </Button>
                </Flex>
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
        <ToastUI />
      </>
    )
  }

  // Expanded state - Mission Management Mode
  const deliveryProgress = totalCustomers > 0 ? (deliveredPackages / totalCustomers) * 100 : 0

  // Mock mission tracking data (TODO: Replace with real-time tracking)
  const currentSortie = 0 // 0 means not started
  const totalSorties = droneRoutes.length
  const currentTruckPoint = 0
  const totalTruckPoints = truckRoute.length
  const isReturningToDepot = false // Will determine if truck is on purple return line

  // If mission is launched, show mission status tabs
  if (missionLaunched && !isFlightPlannerMode) {
    return (
      <>
        <div
          className="flight-planner-bottom"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${bottomPanelHeight}px`,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              cursor: isDragging ? 'grabbing' : 'ns-resize',
              zIndex: 1001,
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
            }}
            onMouseLeave={(e) => {
              if (!isDragging) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
          <Card className="h-full rounded-none shadow-xl" style={{ height: '100%' }}>
            <Flex direction="column" className="h-full">
              {/* Header */}
              <Flex justify="between" align="center" className="p-3 border-b" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                <Flex gap="4" align="center">
                  <Flex align="center" gap="2">
                    <FileText size={18} />
                    <Text size="3" weight="bold">
                      {missionConfig.missionName || 'Untitled Mission'}
                    </Text>
                    <Badge color="green" size="2">
                      Running
                    </Badge>
                  </Flex>

                  <Flex gap="3" align="center" className="text-gray-600">
                    <Flex gap="1" align="center" title="Time Elapsed / Estimated">
                      <Clock size={14} />
                      <Text size="1">00:00/{estimatedTime}</Text>
                    </Flex>
                    <Flex gap="1" align="center" title="Deliveries">
                      <Package size={14} />
                      <Text size="1">{deliveredPackages}/{hasRoute ? totalCustomers : 'X'}</Text>
                    </Flex>
                    <Flex gap="1" align="center" title="Distance Covered / Total">
                      <Route size={14} />
                      <Text size="1">{coveredDistance}/{totalDistance}</Text>
                    </Flex>
                  </Flex>
                </Flex>

                <IconButton size="2" variant="ghost" onClick={() => setBottomPanelExpanded(false)}>
                  <ChevronDown size={20} />
                </IconButton>
              </Flex>

              {/* Stats Bar */}
              <MissionStatsBar missionConfig={missionConfig} missionLaunched={missionLaunched} />

              {/* Tabs */}
              <Tabs.Root value={missionTab} onValueChange={(v) => setMissionTab(v as 'gantt' | 'customers' | 'flightNodes' | 'timeline')} className="flex-1" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Tabs.List className="px-4 pt-2">
                  <Tabs.Trigger value="gantt">
                    <Route size={16} className="mr-1" />
                    Gantt Chart
                  </Tabs.Trigger>
                  <Tabs.Trigger value="customers">
                    <MapPin size={16} className="mr-1" />
                    Customers ({customerNodes.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value="flightNodes">
                    <Plane size={16} className="mr-1" />
                    Flight Nodes ({flightNodes.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value="timeline">
                    <Timer size={16} className="mr-1" />
                    Timeline
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Tab 1: Gantt Chart */}
                <Tabs.Content value="gantt" className="flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>
                  <GanttChart
                    data={ganttData}
                    state={ganttState}
                    currentTime={missionElapsedTime}
                    onCreatePlan={() => setIsFlightPlannerMode(true)}
                    onLoadPlan={() => fileInputRef.current?.click()}
                  />
                </Tabs.Content>

                {/* Tab 2: Customers */}
                <Tabs.Content value="customers" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
                  <Box>
                    {/* Progress Summary */}
                    <Box className="mb-4 p-4 bg-gray-50 rounded">
                      <Flex justify="between" align="center" className="mb-2">
                        <Text size="2" weight="bold">Overall Delivery Progress</Text>
                        <Text size="3" weight="bold" color="blue">{deliveredPackages}/{totalCustomers}</Text>
                      </Flex>
                      <Progress value={deliveryProgress} size="3" />
                      <Text size="1" color="gray" className="mt-1 block">
                        {Math.round(deliveryProgress)}% complete
                      </Text>
                    </Box>

                    {/* Customer List */}
                    <Text size="2" weight="bold" className="mb-3 block">
                      Customer Locations
                    </Text>
                    <ScrollArea style={{ height: 'calc(100% - 120px)' }}>
                      <div className="space-y-2 pr-2">
                        {customerNodes.map((customer) => {
                          const isDelivered = false // TODO: Track actual deliveries
                          return (
                            <Card key={customer.id} className="p-3">
                              <Flex justify="between" align="center">
                                <Flex align="center" gap="2" className="flex-1">
                                  <MapPin size={16} className={isDelivered ? 'text-green-500' : 'text-gray-400'} />
                                  <Box className="flex-1">
                                    <Text size="2" weight="medium">
                                      Address ID: {customer.addressId || '?'}
                                    </Text>
                                    <Text size="1" color="gray">
                                      {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
                                    </Text>
                                  </Box>
                                </Flex>
                                <Badge color={isDelivered ? 'green' : 'gray'} size="2">
                                  {isDelivered ? (
                                    <Flex align="center" gap="1">
                                      <CheckCircle size={12} />
                                      Delivered
                                    </Flex>
                                  ) : (
                                    <Flex align="center" gap="1">
                                      <Clock size={12} />
                                      Pending
                                    </Flex>
                                  )}
                                </Badge>
                              </Flex>
                            </Card>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </Box>
                </Tabs.Content>

                {/* Tab 3: Flight Nodes */}
                <Tabs.Content value="flightNodes" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
                  <ScrollArea style={{ height: '100%' }}>
                    <div className="space-y-2 pr-2">
                      {flightNodes.map((node) => (
                        <Card key={node.id} className="p-3">
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="2" className="flex-1">
                              {node.type === 'depot' ? (
                                <House size={16} className="text-blue-500" />
                              ) : node.type === 'station' ? (
                                <Zap size={16} className="text-orange-500" />
                              ) : node.type === 'hazard' ? (
                                <AlertTriangle size={16} className="text-red-500" />
                              ) : (
                                <MapPin size={16} className="text-purple-500" />
                              )}
                              <Box className="flex-1">
                                <Flex align="center" gap="2">
                                  <Text size="2" weight="medium">
                                    {node.label || `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} ${node.flightNodeId || ''}`}
                                  </Text>
                                  <Badge
                                    color={
                                      node.type === 'depot'
                                        ? 'blue'
                                        : node.type === 'station'
                                          ? 'orange'
                                          : node.type === 'hazard'
                                            ? 'red'
                                            : 'purple'
                                    }
                                    size="1"
                                  >
                                    {node.type}
                                  </Badge>
                                </Flex>
                                <Text size="1" color="gray">
                                  {node.lat.toFixed(6)}, {node.lng.toFixed(6)}
                                </Text>
                              </Box>
                            </Flex>
                          </Flex>
                        </Card>
                      ))}
                      {flightNodes.length === 0 && (
                        <Box className="text-center p-6 bg-gray-50 rounded">
                          <Text size="2" color="gray">
                            No flight nodes (depots, stations, waypoints, hazards) defined.
                          </Text>
                        </Box>
                      )}
                    </div>
                  </ScrollArea>
                </Tabs.Content>

                {/* Tab 4: Timeline */}
                <Tabs.Content value="timeline" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
                  <TimelineTab />
                </Tabs.Content>
              </Tabs.Root>
            </Flex>
          </Card>
        </div>
        <ToastUI />
      </>
    )
  }

  // Default Mission Management Mode (not launched)
  return (
    <>
      <div
        className="flight-planner-bottom"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${bottomPanelHeight}px`,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          cursor: isDragging ? 'grabbing' : 'ns-resize',
          zIndex: 1001,
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
      />
      <Card className="h-full rounded-none shadow-xl" style={{ height: '100%' }}>
        <Flex direction="column" className="h-full">
          {/* Header */}
          <Flex justify="between" align="center" className="p-3 border-b" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
            <Flex gap="4" align="center">
              <Flex align="center" gap="2">
                <FileText size={18} />
                <Text size="3" weight="bold">
                  {missionConfig.missionName || 'Untitled Mission'}
                </Text>
                <Badge color={getStatusColor(missionStatus)} size="2">
                  {missionStatus}
                </Badge>
              </Flex>

              <Flex gap="3" align="center" className="text-gray-600">
                <Flex gap="1" align="center" title="Time Elapsed / Estimated">
                  <Clock size={14} />
                  <Text size="1">00:00/{estimatedTime}</Text>
                </Flex>
                <Flex gap="1" align="center" title="Deliveries">
                  <Package size={14} />
                  <Text size="1">{deliveredPackages}/{hasRoute ? totalCustomers : 'X'}</Text>
                </Flex>
                <Flex gap="1" align="center" title="Distance Covered / Total">
                  <Route size={14} />
                  <Text size="1">{coveredDistance}/{totalDistance}</Text>
                </Flex>
              </Flex>
            </Flex>

            <IconButton size="2" variant="ghost" onClick={() => setBottomPanelExpanded(false)}>
              <ChevronDown size={20} />
            </IconButton>
          </Flex>

          {/* Stats Bar */}
          <MissionStatsBar missionConfig={missionConfig} missionLaunched={missionLaunched} />

          {/* Tabs */}
          <Tabs.Root value={missionTab} onValueChange={(v) => setMissionTab(v as 'gantt' | 'customers' | 'flightNodes' | 'timeline')} className="flex-1" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Tabs.List className="px-4 pt-2">
              <Tabs.Trigger value="gantt">
                <Route size={16} className="mr-1" />
                Gantt Chart
              </Tabs.Trigger>
              <Tabs.Trigger value="customers">
                <MapPin size={16} className="mr-1" />
                Customers ({customerNodes.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="flightNodes">
                <Plane size={16} className="mr-1" />
                Flight Nodes ({flightNodes.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="timeline">
                <Timer size={16} className="mr-1" />
                Timeline
              </Tabs.Trigger>
            </Tabs.List>

            {/* Tab 1: Gantt Chart */}
            <Tabs.Content value="gantt" className="flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>
              <GanttChart
                data={ganttData}
                state={ganttState}
                currentTime={missionElapsedTime}
                onCreatePlan={() => setIsFlightPlannerMode(true)}
                onLoadPlan={() => fileInputRef.current?.click()}
              />
            </Tabs.Content>

            {/* Tab 2: Customers */}
            <Tabs.Content value="customers" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
              <ScrollArea style={{ height: '100%' }}>
                <div className="space-y-2 pr-2">
                  {customerNodes.map((customer) => (
                    <Card key={customer.id} className="p-3">
                      <Flex justify="between" align="center">
                        <Flex align="center" gap="2" className="flex-1">
                          <MapPin size={16} className="text-gray-400" />
                          <Box className="flex-1">
                            <Text size="2" weight="medium">
                              Address ID: {customer.addressId || '?'}
                            </Text>
                            <Text size="1" color="gray">
                              {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
                            </Text>
                          </Box>
                        </Flex>
                        <Badge color="gray" size="2">
                          <Flex align="center" gap="1">
                            <Clock size={12} />
                            Pending
                          </Flex>
                        </Badge>
                      </Flex>
                    </Card>
                  ))}
                  {customerNodes.length === 0 && (
                    <Box className="text-center p-6 bg-gray-50 rounded">
                      <Text size="2" color="gray">
                        No customers added. Create or load a flight plan to add customers.
                      </Text>
                    </Box>
                  )}
                </div>
              </ScrollArea>
            </Tabs.Content>

            {/* Tab 3: Flight Nodes */}
            <Tabs.Content value="flightNodes" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
              <ScrollArea style={{ height: '100%' }}>
                <div className="space-y-2 pr-2">
                  {flightNodes.map((node) => (
                    <Card key={node.id} className="p-3">
                      <Flex justify="between" align="center">
                        <Flex align="center" gap="2" className="flex-1">
                          {node.type === 'depot' ? (
                            <House size={16} className="text-blue-500" />
                          ) : node.type === 'station' ? (
                            <Zap size={16} className="text-orange-500" />
                          ) : node.type === 'hazard' ? (
                            <AlertTriangle size={16} className="text-red-500" />
                          ) : (
                            <MapPin size={16} className="text-purple-500" />
                          )}
                          <Box className="flex-1">
                            <Flex align="center" gap="2">
                              <Text size="2" weight="medium">
                                {node.label || `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} ${node.flightNodeId || ''}`}
                              </Text>
                              <Badge
                                color={
                                  node.type === 'depot'
                                    ? 'blue'
                                    : node.type === 'station'
                                      ? 'orange'
                                      : node.type === 'hazard'
                                        ? 'red'
                                        : 'purple'
                                }
                                size="1"
                              >
                                {node.type}
                              </Badge>
                            </Flex>
                            <Text size="1" color="gray">
                              {node.lat.toFixed(6)}, {node.lng.toFixed(6)}
                            </Text>
                          </Box>
                        </Flex>
                      </Flex>
                    </Card>
                  ))}
                  {flightNodes.length === 0 && (
                    <Box className="text-center p-6 bg-gray-50 rounded">
                      <Text size="2" color="gray">
                        No flight nodes defined. Create or load a flight plan.
                      </Text>
                    </Box>
                  )}
                </div>
              </ScrollArea>
            </Tabs.Content>

            {/* Tab 4: Timeline */}
            <Tabs.Content value="timeline" className="flex-1 p-4" style={{ minHeight: 0, overflow: 'auto' }}>
              <TimelineTab />
            </Tabs.Content>
          </Tabs.Root>
        </Flex>
      </Card>
      </div>
      <ToastUI />
    </>
  )
}

// Mission Stats Bar Component
function MissionStatsBar({
  missionConfig,
  missionLaunched,
  elapsedTime = '00:00',
}: {
  missionConfig: {
    nodes: { type: string }[]
    algorithm: string
    estimatedDuration?: number
  }
  missionLaunched?: boolean
  elapsedTime?: string
}) {
  const customerCount = missionConfig.nodes.filter((n) => n.type === 'customer').length
  const depotCount = missionConfig.nodes.filter((n) => n.type === 'depot').length
  const stationCount = missionConfig.nodes.filter((n) => n.type === 'station').length
  const hazardCount = missionConfig.nodes.filter((n) => n.type === 'hazard').length

  const totalWaypoints = missionConfig.nodes.length

  return (
    <Flex
      gap="4"
      align="center"
      className="px-4 py-2 border-t"
      style={{ backgroundColor: 'rgba(249, 250, 251, 0.8)' }}
    >
      <Flex gap="1" align="center" title="Total Waypoints">
        <MapPin size={14} className="text-gray-600" />
        <Text size="1" weight="medium">{totalWaypoints}</Text>
      </Flex>
      <Box className="w-px h-4 bg-gray-300" />
      <Flex gap="1" align="center" title="Customer Locations">
        <MapPin size={14} className="text-green-600" />
        <Text size="1" weight="medium">{customerCount}</Text>
      </Flex>
      <Flex gap="1" align="center" title="Depots">
        <House size={14} className="text-blue-600" />
        <Text size="1" weight="medium">{depotCount}</Text>
      </Flex>
      <Flex gap="1" align="center" title="Charging Stations">
        <Zap size={14} className="text-orange-500" />
        <Text size="1" weight="medium">{stationCount}</Text>
      </Flex>
      <Flex gap="1" align="center" title="Hazard Zones">
        <AlertTriangle size={14} className="text-red-500" />
        <Text size="1" weight="medium">{hazardCount}</Text>
      </Flex>
      <Box className="w-px h-4 bg-gray-300" />
      <Flex gap="1" align="center" title="Algorithm">
        <Settings size={14} className="text-gray-500" />
        <Text size="1" weight="medium">{missionConfig.algorithm.toUpperCase()}</Text>
      </Flex>
    </Flex>
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

function formatDuration(minutes: number): string {
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getStatusColor(status: string): 'gray' | 'blue' | 'green' | 'orange' | 'red' {
  const colors: Record<string, 'gray' | 'blue' | 'green' | 'orange' | 'red'> = {
    Idle: 'gray',
    planning: 'blue',
    ready: 'green',
    active: 'green',
    paused: 'orange',
    completed: 'blue',
    failed: 'red',
  }
  return colors[status] || 'gray'
}

function getNodeTypeColor(type: string): 'blue' | 'green' | 'orange' | 'purple' | 'red' {
  const colors = {
    depot: 'blue' as const,
    customer: 'green' as const,
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
