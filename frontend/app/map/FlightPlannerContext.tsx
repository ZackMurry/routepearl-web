'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Mission, MissionConfig, MissionStatus, MissionSite, HazardZone, Point } from '@/lib/types'

interface FlightPlannerContextType {
  // Mission state
  currentMission: Mission | null
  setCurrentMission: (mission: Mission | null) => void

  // Configuration state
  missionConfig: MissionConfig
  updateMissionConfig: (updates: Partial<MissionConfig>) => void

  // Node management
  addNode: (node: MissionSite) => void
  updateNode: (id: string, updates: Partial<MissionSite>) => void
  removeNode: (id: string) => void

  // Hazard zone management
  addHazardZone: (zone: HazardZone) => void
  updateHazardZone: (id: string, updates: Partial<HazardZone>) => void
  removeHazardZone: (id: string) => void

  // Route state (derived from missionConfig.routes)
  truckRoute: Point[]
  droneRoutes: Point[][]

  // UI state
  activePanelTab: 'overview' | 'nodes' | 'advanced'
  setActivePanelTab: (tab: 'overview' | 'nodes' | 'advanced') => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  bottomPanelExpanded: boolean
  setBottomPanelExpanded: (expanded: boolean) => void
  bottomPanelHeight: number
  setBottomPanelHeight: (height: number) => void
  isFlightPlannerMode: boolean
  setIsFlightPlannerMode: (mode: boolean) => void
  plotModeOrder: boolean
  setPlotModeOrder: (mode: boolean) => void
  plotModeNodes: boolean
  setPlotModeNodes: (mode: boolean) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  selectedRouteId: string | null // 'truck', 'drone-1', 'drone-2', etc.
  setSelectedRouteId: (id: string | null) => void

  // Mission actions
  createNewMission: () => void
  saveMission: () => void
  loadMission: (mission: Mission) => void
  exportMission: () => void
  importMission: (data: string) => void

  // Fleet configuration
  fleetMode: 'truck-drone' | 'truck-only' | 'drones-only'
  setFleetMode: (mode: 'truck-drone' | 'truck-only' | 'drones-only') => void
  droneCount: number
  setDroneCount: (count: number) => void

  // Map state
  mapCenter: Point
  setMapCenter: (center: Point) => void

  // Route generation
  generateRoute: () => Promise<void>
  isGeneratingRoute: boolean
  hasUnassignedWaypoints: boolean

  // Mission launch
  missionLaunched: boolean
  launchMission: () => void
  stopMission: () => void
}

const FlightPlannerContext = createContext<FlightPlannerContextType | undefined>(undefined)

const defaultMissionConfig: MissionConfig = {
  missionName: 'Untitled Mission',
  missionGoal: '',
  nodes: [],
  algorithm: 'alns',
  hazardZones: [],
  routes: undefined,
}

export function FlightPlannerProvider({ children }: { children: ReactNode }) {
  // Mission state
  const [currentMission, setCurrentMission] = useState<Mission | null>(null)
  const [missionConfig, setMissionConfig] = useState<MissionConfig>(defaultMissionConfig)

  // Route state (computed from missionConfig.routes)
  const truckRoute = missionConfig.routes?.truckRoute || []
  const droneRoutes = missionConfig.routes?.droneRoutes || []

  // UI state
  const [activePanelTab, setActivePanelTab] = useState<'overview' | 'nodes' | 'advanced'>('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState(true)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(400) // Default height increased for better visibility
  const [isFlightPlannerMode, setIsFlightPlannerMode] = useState(false) // Default to mission management mode
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)
  const [plotModeOrder, setPlotModeOrderInternal] = useState(false)
  const [plotModeNodes, setPlotModeNodesInternal] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [fleetMode, setFleetMode] = useState<'truck-drone' | 'truck-only' | 'drones-only'>('truck-drone')
  const [droneCount, setDroneCount] = useState<number>(2)
  const [missionLaunched, setMissionLaunched] = useState(false)
  const [mapCenter, setMapCenter] = useState<Point>({ lat: 38.9404, lng: -92.3277 })

  // Debug logging for route changes
  React.useEffect(() => {
    console.log('Truck route updated:', truckRoute.length, 'points')
  }, [truckRoute])

  React.useEffect(() => {
    console.log('Drone routes updated:', droneRoutes.length, 'paths')
  }, [droneRoutes])

  // Wrapper functions to ensure mutual exclusivity
  const setPlotModeOrder = (mode: boolean) => {
    if (mode) {
      setPlotModeNodesInternal(false) // Turn off nodes mode
    }
    setPlotModeOrderInternal(mode)
  }

  const setPlotModeNodes = (mode: boolean) => {
    if (mode) {
      setPlotModeOrderInternal(false) // Turn off order mode
    }
    setPlotModeNodesInternal(mode)
  }

  // Update mission config
  const updateMissionConfig = (updates: Partial<MissionConfig>) => {
    setMissionConfig((prev) => ({ ...prev, ...updates }))
  }

  // Helper function to get the next available Order ID for orders
  // Reuses IDs from deleted orders (finds the lowest available ID)
  const getNextAvailableAddressId = (nodes: MissionSite[]): number => {
    const orderNodes = nodes.filter(n => n.type === 'order')
    const usedIds = new Set(orderNodes.map(n => n.orderId).filter((id): id is number => id !== undefined))

    // Find the lowest available ID starting from 1
    let nextId = 1
    while (usedIds.has(nextId)) {
      nextId++
    }
    return nextId
  }

  // Helper function to get the next available Mission Site ID for non-order nodes
  // Reuses IDs from deleted mission sites (finds the lowest available ID)
  const getNextAvailableMissionSiteId = (nodes: MissionSite[]): number => {
    const missionSites = nodes.filter(n => n.type !== 'order')
    const usedIds = new Set(missionSites.map(n => n.siteId).filter((id): id is number => id !== undefined))

    // Find the lowest available ID starting from 1
    let nextId = 1
    while (usedIds.has(nextId)) {
      nextId++
    }
    return nextId
  }

  // Helper function to assign missing IDs to nodes
  // Used when loading/importing missions that may have nodes without IDs
  const assignMissingNodeIds = (nodes: MissionSite[]): MissionSite[] => {
    const usedOrderIds = new Set<number>()
    const usedMissionSiteIds = new Set<number>()

    // First pass: collect all existing IDs
    nodes.forEach(node => {
      if (node.type === 'order' && node.orderId !== undefined) {
        usedOrderIds.add(node.orderId)
      } else if (node.type !== 'order' && node.siteId !== undefined) {
        usedMissionSiteIds.add(node.siteId)
      }
    })

    // Second pass: assign IDs to nodes without one
    return nodes.map(node => {
      if (node.type === 'order' && node.orderId === undefined) {
        // Find the lowest available order ID
        let nextId = 1
        while (usedOrderIds.has(nextId)) {
          nextId++
        }
        usedOrderIds.add(nextId)
        return {
          ...node,
          orderId: nextId,
        }
      } else if (node.type !== 'order' && node.siteId === undefined) {
        // Find the lowest available mission site ID
        let nextId = 1
        while (usedMissionSiteIds.has(nextId)) {
          nextId++
        }
        usedMissionSiteIds.add(nextId)
        return {
          ...node,
          siteId: nextId,
        }
      }
      return node
    })
  }

  // Node management
  const addNode = (node: MissionSite) => {
    setMissionConfig((prev) => {
      // If it's an order node, auto-assign the next available Order ID
      if (node.type === 'order' && node.orderId === undefined) {
        const orderId = getNextAvailableAddressId(prev.nodes)
        const nodeWithAddressId = {
          ...node,
          orderId,
        }
        return {
          ...prev,
          nodes: [...prev.nodes, nodeWithAddressId],
        }
      }
      // If it's a non-order node, auto-assign the next available Mission Site ID
      if (node.type !== 'order' && node.siteId === undefined) {
        const siteId = getNextAvailableMissionSiteId(prev.nodes)
        const nodeWithMissionSiteId = {
          ...node,
          siteId,
        }
        return {
          ...prev,
          nodes: [...prev.nodes, nodeWithMissionSiteId],
        }
      }
      return {
        ...prev,
        nodes: [...prev.nodes, node],
      }
    })
  }

  const updateNode = (id: string, updates: Partial<MissionSite>) => {
    setMissionConfig((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === id ? { ...node, ...updates } : node)),
    }))
  }

  const removeNode = (id: string) => {
    setMissionConfig((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== id),
    }))
  }

  // Hazard zone management
  const addHazardZone = (zone: HazardZone) => {
    setMissionConfig((prev) => ({
      ...prev,
      hazardZones: [...prev.hazardZones, zone],
    }))
  }

  const updateHazardZone = (id: string, updates: Partial<HazardZone>) => {
    setMissionConfig((prev) => ({
      ...prev,
      hazardZones: prev.hazardZones.map((zone) => (zone.id === id ? { ...zone, ...updates } : zone)),
    }))
  }

  const removeHazardZone = (id: string) => {
    setMissionConfig((prev) => ({
      ...prev,
      hazardZones: prev.hazardZones.filter((zone) => zone.id !== id),
    }))
  }

  // Mission actions
  const createNewMission = () => {
    const newMission: Mission = {
      id: `mission-${Date.now()}`,
      config: { ...defaultMissionConfig },
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setCurrentMission(newMission)
    setMissionConfig(defaultMissionConfig)
  }

  const saveMission = () => {
    if (typeof window === 'undefined') return

    // Create a new mission if one doesn't exist
    let missionToSave = currentMission
    if (!missionToSave) {
      missionToSave = {
        id: `mission-${Date.now()}`,
        config: missionConfig,
        status: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentMission(missionToSave)
    }

    const updatedMission: Mission = {
      ...missionToSave,
      config: missionConfig,
      updatedAt: new Date(),
    }
    setCurrentMission(updatedMission)

    // Save to localStorage
    try {
      const savedMissions = JSON.parse(localStorage.getItem('missions') || '[]')
      const existingIndex = savedMissions.findIndex((m: Mission) => m.id === missionToSave!.id)

      if (existingIndex >= 0) {
        savedMissions[existingIndex] = updatedMission
      } else {
        savedMissions.push(updatedMission)
      }

      localStorage.setItem('missions', JSON.stringify(savedMissions))
      console.log('Mission saved successfully:', updatedMission.config.missionName)
      console.log('Route data saved:', {
        truckRoutePoints: missionConfig.routes?.truckRoute?.length || 0,
        droneRoutePaths: missionConfig.routes?.droneRoutes?.length || 0,
        hasRoute: (missionConfig.routes?.truckRoute?.length || 0) > 0 || (missionConfig.routes?.droneRoutes?.length || 0) > 0,
      })
    } catch (error) {
      console.error('Failed to save mission:', error)
    }
  }

  const loadMission = (mission: Mission) => {
    // Assign missing IDs to any nodes that don't have them
    const nodesWithIds = assignMissingNodeIds(mission.config.nodes)
    const configWithIds = {
      ...mission.config,
      nodes: nodesWithIds,
    }
    const missionWithIds = {
      ...mission,
      config: configWithIds,
    }

    setCurrentMission(missionWithIds)
    setMissionConfig(configWithIds)
    console.log('Mission loaded:', mission.config.missionName)
    console.log('Route data loaded:', {
      truckRoutePoints: mission.config.routes?.truckRoute?.length || 0,
      droneRoutePaths: mission.config.routes?.droneRoutes?.length || 0,
      hasRoute: (mission.config.routes?.truckRoute?.length || 0) > 0 || (mission.config.routes?.droneRoutes?.length || 0) > 0,
    })
  }

  const exportMission = () => {
    // Create a new mission if one doesn't exist
    let missionToExport = currentMission
    if (!missionToExport) {
      missionToExport = {
        id: `mission-${Date.now()}`,
        config: missionConfig,
        status: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentMission(missionToExport)
    }

    const missionData = {
      ...missionToExport,
      config: missionConfig,
      updatedAt: new Date(),
    }

    console.log('Exporting mission:', missionConfig.missionName)
    console.log('Route data exported:', {
      truckRoutePoints: missionConfig.routes?.truckRoute?.length || 0,
      droneRoutePaths: missionConfig.routes?.droneRoutes?.length || 0,
      hasRoute: (missionConfig.routes?.truckRoute?.length || 0) > 0 || (missionConfig.routes?.droneRoutes?.length || 0) > 0,
    })

    const dataStr = JSON.stringify(missionData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${missionConfig.missionName.replace(/\s+/g, '_')}_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importMission = (data: string) => {
    try {
      const mission: Mission = JSON.parse(data)
      console.log('Importing mission:', mission.config?.missionName)
      console.log('Mission data:', mission)
      console.log('Route data in import:', {
        hasTruckRoute: !!mission.config.routes?.truckRoute,
        truckRouteLength: mission.config.routes?.truckRoute?.length || 0,
        hasDroneRoutes: !!mission.config.routes?.droneRoutes,
        droneRoutesLength: mission.config.routes?.droneRoutes?.length || 0,
      })
      loadMission(mission)
    } catch (error) {
      console.error('Failed to import mission:', error)
    }
  }

  // Launch mission
  const launchMission = () => {
    if (!currentMission) {
      // Create a new mission if one doesn't exist
      const newMission: Mission = {
        id: `mission-${Date.now()}`,
        config: missionConfig,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentMission(newMission)
    } else {
      // Update existing mission status
      setCurrentMission({
        ...currentMission,
        status: 'active',
        updatedAt: new Date(),
      })
    }
    setMissionLaunched(true)
    console.log('Mission launched:', missionConfig.missionName)
  }

  // Stop mission
  const stopMission = () => {
    if (currentMission) {
      setCurrentMission({
        ...currentMission,
        status: 'idle',
        updatedAt: new Date(),
      })
    }
    setMissionLaunched(false)
    console.log('Mission stopped')
  }

  // Generate route using backend API
  const hasUnassignedWaypoints = missionConfig.nodes.some((n) => n.type === 'waypoint')

  const generateRoute = async () => {
    if (missionConfig.nodes.length < 2 || hasUnassignedWaypoints) {
      updateMissionConfig({ routes: undefined })
      return
    }

    // Separate nodes by type
    const depots = missionConfig.nodes.filter((n) => n.type === 'depot')
    const orders = missionConfig.nodes.filter((n) => n.type === 'order')
    const stations = missionConfig.nodes.filter((n) => n.type === 'station')

    // If no explicit depots, use first waypoint
    const finalDepots = depots.length > 0 ? depots : [missionConfig.nodes[0]]
    const finalOrders =
      orders.length > 0
        ? orders
        : missionConfig.nodes.filter((n) => !finalDepots.includes(n) && n.type !== 'hazard')

    setIsGeneratingRoute(true)
    try {
      const res = await fetch('http://localhost:8000/api/routes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depots: finalDepots.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
          customers: finalOrders.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
          stations: stations.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
          algorithm: 'negar',
          provider: 'OSRM-Online'
          // TODO: Uncomment when backend is ready to handle hazards
          // hazards: hazards.map((n, index) => ({
          //   id: index + 1,
          //   center: [n.lat, n.lng],
          //   radius: n.radius || 100,
          //   severity: n.severity || 'medium',
          // })),
        }),
      })

      if (!res.ok) {
        console.error('Backend error', await res.text())
        return
      }

      const data = await res.json()

      // Prepare route data
      let truckPoints: Point[] = []
      let dronePaths: Point[][] = []

      // --- Truck route ---
      if (data.routes.truck_route) {
        truckPoints = data.routes.truck_route.flatMap((segment: number[][]) =>
          segment.map(([lat, lon]) => ({ lat, lng: lon })),
        )
        console.log('Truck route:', truckPoints)
      }

      // --- Drone route ---
      if (data.routes.drone_route) {
        const toLatLon = (coord: number[]): Point => ({ lat: coord[0], lng: coord[1] })
        for (const dp of data.routes.drone_route) {
          dronePaths.push([toLatLon(dp[0]), toLatLon(dp[1]), toLatLon(dp[2])])
        }
        console.log('Drone route:', dronePaths)
      }

      // Save routes to missionConfig
      updateMissionConfig({
        routes: {
          truckRoute: truckPoints,
          droneRoutes: dronePaths,
        },
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingRoute(false)
    }
  }

  const value: FlightPlannerContextType = {
    currentMission,
    setCurrentMission,
    missionConfig,
    updateMissionConfig,
    addNode,
    updateNode,
    removeNode,
    addHazardZone,
    updateHazardZone,
    removeHazardZone,
    truckRoute,
    droneRoutes,
    activePanelTab,
    setActivePanelTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    bottomPanelExpanded,
    setBottomPanelExpanded,
    bottomPanelHeight,
    setBottomPanelHeight,
    isFlightPlannerMode,
    setIsFlightPlannerMode,
    plotModeOrder,
    setPlotModeOrder,
    plotModeNodes,
    setPlotModeNodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedRouteId,
    setSelectedRouteId,
    fleetMode,
    setFleetMode,
    droneCount,
    setDroneCount,
    createNewMission,
    saveMission,
    loadMission,
    exportMission,
    importMission,
    mapCenter,
    setMapCenter,
    generateRoute,
    isGeneratingRoute,
    hasUnassignedWaypoints,
    missionLaunched,
    launchMission,
    stopMission,
  }

  return <FlightPlannerContext.Provider value={value}>{children}</FlightPlannerContext.Provider>
}

export function useFlightPlanner() {
  const context = useContext(FlightPlannerContext)
  if (context === undefined) {
    throw new Error('useFlightPlanner must be used within a FlightPlannerProvider')
  }
  return context
}
