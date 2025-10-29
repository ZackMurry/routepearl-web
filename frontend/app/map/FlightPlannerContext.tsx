'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Mission, MissionConfig, MissionStatus, FlightNode, HazardZone, Point } from '@/lib/types'

interface FlightPlannerContextType {
  // Mission state
  currentMission: Mission | null
  setCurrentMission: (mission: Mission | null) => void

  // Configuration state
  missionConfig: MissionConfig
  updateMissionConfig: (updates: Partial<MissionConfig>) => void

  // Node management
  addNode: (node: FlightNode) => void
  updateNode: (id: string, updates: Partial<FlightNode>) => void
  removeNode: (id: string) => void

  // Hazard zone management
  addHazardZone: (zone: HazardZone) => void
  updateHazardZone: (id: string, updates: Partial<HazardZone>) => void
  removeHazardZone: (id: string) => void

  // Route state
  truckRoute: Point[]
  droneRoutes: Point[][]
  setTruckRoute: (route: Point[]) => void
  setDroneRoutes: (routes: Point[][]) => void

  // UI state
  activePanelTab: 'overview' | 'nodes' | 'advanced'
  setActivePanelTab: (tab: 'overview' | 'nodes' | 'advanced') => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  bottomPanelExpanded: boolean
  setBottomPanelExpanded: (expanded: boolean) => void
  isFlightPlannerMode: boolean
  setIsFlightPlannerMode: (mode: boolean) => void

  // Mission actions
  createNewMission: () => void
  saveMission: () => void
  loadMission: (mission: Mission) => void
  exportMission: () => void
  importMission: (data: string) => void

  // Route generation
  generateRoute: () => Promise<void>
  isGeneratingRoute: boolean
}

const FlightPlannerContext = createContext<FlightPlannerContextType | undefined>(undefined)

const defaultMissionConfig: MissionConfig = {
  missionName: 'Untitled Mission',
  missionGoal: '',
  nodes: [],
  algorithm: 'alns',
  hazardZones: [],
}

export function FlightPlannerProvider({ children }: { children: ReactNode }) {
  // Mission state
  const [currentMission, setCurrentMission] = useState<Mission | null>(null)
  const [missionConfig, setMissionConfig] = useState<MissionConfig>(defaultMissionConfig)

  // Route state
  const [truckRoute, setTruckRoute] = useState<Point[]>([])
  const [droneRoutes, setDroneRoutes] = useState<Point[][]>([])

  // UI state
  const [activePanelTab, setActivePanelTab] = useState<'overview' | 'nodes' | 'advanced'>('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState(false)
  const [isFlightPlannerMode, setIsFlightPlannerMode] = useState(true) // Default to flight planner mode
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)

  // Update mission config
  const updateMissionConfig = (updates: Partial<MissionConfig>) => {
    setMissionConfig((prev) => ({ ...prev, ...updates }))
  }

  // Node management
  const addNode = (node: FlightNode) => {
    setMissionConfig((prev) => ({
      ...prev,
      nodes: [...prev.nodes, node],
    }))
  }

  const updateNode = (id: string, updates: Partial<FlightNode>) => {
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
    setTruckRoute([])
    setDroneRoutes([])
  }

  const saveMission = () => {
    if (currentMission && typeof window !== 'undefined') {
      const updatedMission: Mission = {
        ...currentMission,
        config: missionConfig,
        updatedAt: new Date(),
        route: {
          truckRoute,
          droneRoutes,
        },
      }
      setCurrentMission(updatedMission)

      // Save to localStorage
      try {
        const savedMissions = JSON.parse(localStorage.getItem('missions') || '[]')
        const existingIndex = savedMissions.findIndex((m: Mission) => m.id === currentMission.id)

        if (existingIndex >= 0) {
          savedMissions[existingIndex] = updatedMission
        } else {
          savedMissions.push(updatedMission)
        }

        localStorage.setItem('missions', JSON.stringify(savedMissions))
      } catch (error) {
        console.error('Failed to save mission:', error)
      }
    }
  }

  const loadMission = (mission: Mission) => {
    setCurrentMission(mission)
    setMissionConfig(mission.config)
    setTruckRoute(mission.route?.truckRoute || [])
    setDroneRoutes(mission.route?.droneRoutes || [])
  }

  const exportMission = () => {
    if (!currentMission) return

    const missionData = {
      ...currentMission,
      config: missionConfig,
      route: {
        truckRoute,
        droneRoutes,
      },
    }

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
      loadMission(mission)
    } catch (error) {
      console.error('Failed to import mission:', error)
    }
  }

  // Generate route using backend API
  const generateRoute = async () => {
    if (missionConfig.nodes.length < 2) {
      setTruckRoute([])
      setDroneRoutes([])
      return
    }

    // Separate nodes by type
    const depots = missionConfig.nodes.filter((n) => n.type === 'depot')
    const customers = missionConfig.nodes.filter((n) => n.type === 'customer')
    const stations = missionConfig.nodes.filter((n) => n.type === 'station')

    // If no explicit depots, use first waypoint
    const finalDepots = depots.length > 0 ? depots : [missionConfig.nodes[0]]
    const finalCustomers =
      customers.length > 0
        ? customers
        : missionConfig.nodes.filter((n) => !finalDepots.includes(n) && n.type !== 'hazard')

    setIsGeneratingRoute(true)
    try {
      const res = await fetch('http://localhost:8000/api/routes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depots: finalDepots.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
          customers: finalCustomers.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
          stations: stations.map((n) => ({ id: n.id, lat: n.lat, lon: n.lng })),
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

      // --- Truck route ---
      if (data.routes.truck_route) {
        const truckPoints: Point[] = data.routes.truck_route.flatMap((segment: number[][]) =>
          segment.map(([lat, lon]) => ({ lat, lng: lon })),
        )
        setTruckRoute(truckPoints)
        console.log('Truck route:', truckPoints)
      } else {
        setTruckRoute([])
      }

      // --- Drone route ---
      if (data.routes.drone_route) {
        const dronePaths = []
        const toLatLon = (coord: number[]): Point => ({ lat: coord[0], lng: coord[1] })
        for (const dp of data.routes.drone_route) {
          dronePaths.push([toLatLon(dp[0]), toLatLon(dp[1]), toLatLon(dp[2])])
        }
        setDroneRoutes(dronePaths)
        console.log('Drone route:', dronePaths)
      } else {
        setDroneRoutes([])
      }
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
    setTruckRoute,
    setDroneRoutes,
    activePanelTab,
    setActivePanelTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    bottomPanelExpanded,
    setBottomPanelExpanded,
    isFlightPlannerMode,
    setIsFlightPlannerMode,
    createNewMission,
    saveMission,
    loadMission,
    exportMission,
    importMission,
    generateRoute,
    isGeneratingRoute,
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
