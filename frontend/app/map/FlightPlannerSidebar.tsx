'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import { FlightNode, HazardZone, RoutingAlgorithm } from '@/lib/types'

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
  } = useFlightPlanner()

  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      reader.onload = (e) => {
        const content = e.target?.result as string
        try {
          const mission = JSON.parse(content)
          // Load the mission and enter flight planner mode to view/edit it
          updateMissionConfig(mission.config || mission)
          setIsFlightPlannerMode(true)
        } catch (error) {
          console.error('Failed to import flight plan:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  if (sidebarCollapsed) {
    return (
      <div className="absolute left-0 top-0 h-full z-[1000] pointer-events-auto">
        <Button
          onClick={() => setSidebarCollapsed(false)}
          className="mt-4 ml-2 bg-white shadow-lg hover:shadow-xl"
          size="2"
        >
          <ChevronRight size={20} />
        </Button>
      </div>
    )
  }

  // Mission Management Mode Sidebar
  if (!isFlightPlannerMode) {
    return (
      <div
        className="flight-planner-sidebar"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100vh',
          width: '384px',
          backgroundColor: 'white',
          zIndex: 1000,
          pointerEvents: 'auto',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
        }}
      >
        <Card className="h-full rounded-none" style={{ backgroundColor: 'white', height: '100%' }}>
          <Flex direction="column" className="h-full" style={{ height: '100%' }}>
            {/* Header */}
            <Flex justify="between" align="center" className="p-4 border-b">
              <Flex align="center" gap="2">
                <Target size={20} />
                <Text size="5" weight="bold">
                  Mission Control
                </Text>
              </Flex>
              <IconButton onClick={() => setSidebarCollapsed(true)} size="2" variant="ghost">
                <ChevronLeft size={20} />
              </IconButton>
            </Flex>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Mission Management Section */}
                <Box>
                  <Flex align="center" gap="2" className="mb-3">
                    <Settings size={18} />
                    <Text size="3" weight="bold">
                      Mission Management
                    </Text>
                  </Flex>

                  <div className="space-y-2">
                    <Button size="3" className="w-full" onClick={handleMakeFlightPlan}>
                      <Plus size={16} /> Make Flight Plan
                    </Button>
                    <Button size="3" variant="soft" className="w-full" onClick={handleImportFlightPlan}>
                      <Upload size={16} /> Import Flight Plan
                    </Button>
                  </div>

                  <Box className="mt-3 p-3 bg-gray-50 rounded">
                    <Text size="1" color="gray">
                      Create a new flight plan or import from a saved JSON file.
                    </Text>
                  </Box>
                </Box>

                {/* Flight Control Section */}
                <Box className="border-t pt-6">
                  <Flex align="center" gap="2" className="mb-3">
                    <Play size={18} />
                    <Text size="3" weight="bold">
                      Flight Control
                    </Text>
                  </Flex>

                  <div className="space-y-2">
                    <Button
                      size="3"
                      color="green"
                      className="w-full"
                      disabled={!missionConfig.nodes.length}
                    >
                      <Play size={16} /> Launch Mission
                    </Button>
                    <Flex gap="2">
                      <Button size="3" color="orange" variant="soft" className="flex-1" disabled>
                        <Pause size={16} /> Pause
                      </Button>
                      <Button size="3" color="red" variant="soft" className="flex-1" disabled>
                        <Square size={16} /> Stop
                      </Button>
                    </Flex>
                  </div>

                  <Box className="mt-3 p-3 bg-blue-50 rounded">
                    <Text size="2" color="blue">
                      <strong>Status:</strong> Ready to plan
                      <br />
                      Create or load a flight plan to begin.
                    </Text>
                  </Box>
                </Box>

                {/* Mission Info */}
                <Box className="border-t pt-6">
                  <Text size="2" weight="bold" className="mb-2 block">
                    Current Mission
                  </Text>
                  <Box className="p-3 bg-gray-50 rounded space-y-2">
                    <Flex justify="between">
                      <Text size="1" color="gray">Name:</Text>
                      <Text size="1" weight="medium">{missionConfig.missionName}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" color="gray">Nodes:</Text>
                      <Text size="1" weight="medium">{missionConfig.nodes.length}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" color="gray">Algorithm:</Text>
                      <Text size="1" weight="medium">{missionConfig.algorithm.toUpperCase()}</Text>
                    </Flex>
                  </Box>
                </Box>
              </div>
            </ScrollArea>
          </Flex>
        </Card>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>
    )
  }

  // Flight Planner Mode Sidebar
  return (
    <div
      className="flight-planner-sidebar"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100vh',
        width: '384px',
        backgroundColor: 'white',
        zIndex: 1000,
        pointerEvents: 'auto',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
      }}
    >
      <Card className="h-full rounded-none" style={{ backgroundColor: 'white', height: '100%' }}>
        <Flex direction="column" className="h-full" style={{ height: '100%' }}>
          {/* Header */}
          <Flex justify="between" align="center" className="p-4 border-b">
            <Flex align="center" gap="2">
              <Layers size={20} />
              <Text size="5" weight="bold">
                Flight Planner
              </Text>
            </Flex>
            <IconButton onClick={() => setSidebarCollapsed(true)} size="2" variant="ghost">
              <ChevronLeft size={20} />
            </IconButton>
          </Flex>

          {/* Tabs */}
          <Tabs.Root value={activePanelTab} onValueChange={(v: string) => setActivePanelTab(v as 'overview' | 'nodes' | 'advanced')}>
            <Tabs.List className="px-4 pt-2">
              <Tabs.Trigger value="overview">
                <Target size={16} className="mr-1" />
                Overview
              </Tabs.Trigger>
              <Tabs.Trigger value="nodes">
                <MapPin size={16} className="mr-1" />
                Nodes
              </Tabs.Trigger>
              <Tabs.Trigger value="advanced">
                <Settings size={16} className="mr-1" />
                Advanced
              </Tabs.Trigger>
            </Tabs.List>

            <ScrollArea className="flex-1">
              {/* Overview Tab */}
              <Tabs.Content value="overview" className="p-4 space-y-4">
                <Box>
                  <Text size="2" weight="bold" className="mb-2 block">
                    Mission Name
                  </Text>
                  <TextField.Root
                    value={missionConfig.missionName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMissionConfig({ missionName: e.target.value })}
                    placeholder="Enter mission name"
                  />
                </Box>

                <Box>
                  <Text size="2" weight="bold" className="mb-2 block">
                    Mission Goal
                  </Text>
                  <TextArea
                    value={missionConfig.missionGoal}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateMissionConfig({ missionGoal: e.target.value })}
                    placeholder="Describe the mission objective..."
                    rows={4}
                  />
                </Box>

                <Box>
                  <Text size="2" weight="bold" className="mb-2 block">
                    Estimated Duration (minutes)
                  </Text>
                  <TextField.Root
                    type="number"
                    value={missionConfig.estimatedDuration || ''}
                    placeholder="Computed from backend after route generation"
                    disabled
                  />
                  <Text size="1" color="gray" className="mt-1 block">
                    This value is calculated by the optimization algorithm
                  </Text>
                </Box>

                <Box className="bg-blue-50 p-3 rounded">
                  <Text size="2" color="blue">
                    <strong>Mission Overview:</strong>
                    <br />
                    {isFlightPlannerMode ? (
                      <>
                        Customers: {missionConfig.nodes.filter(n => n.type === 'customer').length}
                        <br />
                        Other Nodes: {missionConfig.nodes.filter(n => n.type !== 'customer').length}
                      </>
                    ) : (
                      <>Nodes: {missionConfig.nodes.length}</>
                    )}
                    <br />
                    Hazards: {missionConfig.nodes.filter(n => n.type === 'hazard').length}
                    <br />
                    Algorithm: {missionConfig.algorithm === 'alns' ? 'ALNS' : 'Custom'}
                  </Text>
                </Box>

                <Box className="border-t pt-3">
                  <Text size="2" weight="bold" className="mb-2 block">
                    Node Color Legend
                  </Text>
                  <div className="space-y-1">
                    <Flex gap="2" align="center">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                      <Text size="1">Depot (start/end point)</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                      <Text size="1">Customer (delivery location)</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
                      <Text size="1">Station (charging point)</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }}></div>
                      <Text size="1">Waypoint (unassigned)</Text>
                    </Flex>
                    <Box className="mt-2">
                      <Text size="1" weight="bold" className="block mb-1">Hazard (shows radius circle):</Text>
                      <div className="ml-3 space-y-1">
                        <Flex gap="2" align="center">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
                          <Text size="1">Low severity (yellow)</Text>
                        </Flex>
                        <Flex gap="2" align="center">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
                          <Text size="1">Medium severity (orange)</Text>
                        </Flex>
                        <Flex gap="2" align="center">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                          <Text size="1">High severity (red)</Text>
                        </Flex>
                      </div>
                    </Box>
                  </div>
                </Box>
              </Tabs.Content>

              {/* Nodes Tab */}
              <Tabs.Content value="nodes" className="p-4 space-y-4">
                {isFlightPlannerMode && (
                  <Box className="bg-blue-50 p-3 rounded mb-3">
                    <Text size="2" color="blue">
                      <strong>Note:</strong> Customer nodes are managed in the bottom panel.
                      <br />
                      Use this tab to manage depots, stations, waypoints, and hazards.
                    </Text>
                  </Box>
                )}

                <Flex justify="between" align="center" className="mb-2">
                  <Text size="3" weight="bold">
                    Flight Nodes ({isFlightPlannerMode
                      ? missionConfig.nodes.filter(n => n.type !== 'customer').length
                      : missionConfig.nodes.length})
                  </Text>
                  <Flex gap="2">
                    <Button
                      size="1"
                      variant={plotModeNodes ? 'solid' : 'soft'}
                      color={plotModeNodes ? 'blue' : 'gray'}
                      onClick={() => setPlotModeNodes(!plotModeNodes)}
                    >
                      <MousePointer2 size={14} /> Plot
                    </Button>
                    <Button
                      size="1"
                      onClick={() => {
                        const newNode: FlightNode = {
                          id: `node-${Date.now()}`,
                          type: 'waypoint',
                          lat: 26.4619, // Default FGCU coordinates
                          lng: -81.7726,
                          label: `Node ${missionConfig.nodes.length + 1}`,
                        }
                        addNode(newNode)
                      }}
                    >
                      <Plus size={14} /> Add Node
                    </Button>
                  </Flex>
                </Flex>

                <ScrollArea style={{ height: 'calc(100vh - 250px - 9rem)' }}>
                  <div className="space-y-2 pr-2">
                    {missionConfig.nodes
                      .filter(node => !isFlightPlannerMode || node.type !== 'customer')
                      .map((node, index) => (
                    <Card
                      key={node.id}
                      className="p-3"
                      style={{
                        backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                        border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                      }}
                    >
                      <Flex justify="between" align="start" className="mb-2">
                        <Flex align="center" gap="2">
                          <MapPin size={16} />
                          <Text size="2" weight="bold">
                            {node.label || `Node ${index + 1}`}
                          </Text>
                          <Badge color={node.type === 'hazard' && node.severity ? getHazardColor(node.severity) : getNodeTypeColor(node.type)}>
                            {node.type}
                          </Badge>
                          {node.type === 'hazard' && node.severity && (
                            <Badge size="1" variant="soft" color={getHazardColor(node.severity)}>
                              {node.severity}
                            </Badge>
                          )}
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

                      <Box className="space-y-2">
                        <TextField.Root
                          placeholder="Label"
                          value={node.label || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNode(node.id, { label: e.target.value })}
                          size="1"
                        />

                        <Select.Root
                          value={node.type}
                          onValueChange={(value: string) => {
                            const updates: Partial<FlightNode> = { type: value as FlightNode['type'] }
                            // Set default values when changing to hazard type
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
                            {!isFlightPlannerMode && <Select.Item value="customer">Customer</Select.Item>}
                            <Select.Item value="station">Station</Select.Item>
                            <Select.Item value="waypoint">Waypoint</Select.Item>
                            <Select.Item value="hazard">Hazard</Select.Item>
                          </Select.Content>
                        </Select.Root>

                        <Flex gap="2">
                          {/* Latitude with increment/decrement */}
                          <Flex align="center" gap="1" style={{ flex: 1 }}>
                            <TextField.Root
                              placeholder="Lat"
                              value={node.lat}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNode(node.id, { lat: parseFloat(e.target.value) || 0 })}
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
                              placeholder="Lng"
                              value={node.lng}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNode(node.id, { lng: parseFloat(e.target.value) || 0 })}
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
                          <>
                            <TextField.Root
                              placeholder="Radius (m)"
                              value={node.radius || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateNode(node.id, { radius: parseFloat(e.target.value) || 100 })
                              }
                              size="1"
                              type="number"
                            />

                            <Select.Root
                              value={node.severity || 'medium'}
                              onValueChange={(value: string) =>
                                updateNode(node.id, { severity: value as 'low' | 'medium' | 'high' })
                              }
                            >
                              <Select.Trigger placeholder="Severity" />
                              <Select.Content>
                                <Select.Item value="low">Low Severity</Select.Item>
                                <Select.Item value="medium">Medium Severity</Select.Item>
                                <Select.Item value="high">High Severity</Select.Item>
                              </Select.Content>
                            </Select.Root>

                            <TextField.Root
                              placeholder="Description (optional)"
                              value={node.description || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateNode(node.id, { description: e.target.value })
                              }
                              size="1"
                            />
                          </>
                        )}

                        {node.type !== 'hazard' && (
                          <TextField.Root
                            placeholder="Action (optional)"
                            value={node.action || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNode(node.id, { action: e.target.value })}
                            size="1"
                          />
                        )}
                      </Box>
                    </Card>
                  ))}

                    {missionConfig.nodes.filter(node => !isFlightPlannerMode || node.type !== 'customer').length === 0 && (
                      <Box className="text-center p-6 bg-gray-50 rounded">
                        <Text size="2" color="gray">
                          {isFlightPlannerMode
                            ? 'No depot, station, waypoint, or hazard nodes added yet. Click "Add Node" to start planning.'
                            : 'No nodes added yet. Click "Add Node" to start planning.'}
                        </Text>
                      </Box>
                    )}
                  </div>
                </ScrollArea>
              </Tabs.Content>

              {/* Advanced Tab */}
              <Tabs.Content value="advanced" className="p-4 space-y-4">
                <Box>
                  <Text size="2" weight="bold" className="mb-2 block">
                    Routing Algorithm
                  </Text>
                  <Select.Root
                    value={missionConfig.algorithm}
                    onValueChange={(value: string) => updateMissionConfig({ algorithm: value as RoutingAlgorithm })}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="alns">ALNS (Adaptive Large Neighborhood Search)</Select.Item>
                      <Select.Item value="custom">Custom</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box className="bg-gray-50 p-3 rounded mt-4">
                  <Text size="2" color="gray">
                    <strong>Note:</strong> Additional algorithm parameters will be added here.
                    <br />
                    Hazard zones are now managed in the Nodes tab.
                  </Text>
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
