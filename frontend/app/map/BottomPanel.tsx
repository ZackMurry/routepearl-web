'use client'

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFlightPlanner } from './FlightPlannerContext'
import { MissionSite, RoutingAlgorithm } from '@/lib/types'
import {
  Box,
  Card,
  Flex,
  Text,
  Button,
  Badge,
  IconButton,
  ScrollArea,
  TextField,
  Progress,
  Tabs,
  Select,
  AlertDialog,
} from '@radix-ui/themes'
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
  Minus,
  Trash2,
  X,
  LogOut,
  Route,
  Map as MapIcon,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  MousePointer2,
  Package,
  Truck,
  Drone,
  House,
  Zap,
  Fuel,
  AlertTriangle,
  Settings,
  Lock,
  Unlock,
  Hash,
  MapPinned,
  Search,
  LayoutGrid,
  Table2,
  Calendar,
  Layers,
  Gavel,
  TowerControl,
} from 'lucide-react'
import { useTimelineGenerator } from './timeline/useTimelineGenerator'
import {
  TimelineSummary,
  formatDistance as formatDistanceTimeline,
  formatDuration as formatDurationTimeline,
  DEFAULT_TIMELINE_CONFIG,
} from './timeline/timeline.types'
import { GanttChart, useGanttData, generateEmptyGanttData, GanttChartState } from './gantt'
import { RoutesTab, useRouteDetails, VehiclesTab, useVehicleDetails } from './routes'
import { pointMatchesNode } from '@/lib/util'
import {
  reverseGeocode,
  forwardGeocode,
  seedAddressCache,
  parseCSVLine,
  isLatLng,
  csvTagToNodeType,
  nodeTypeToCsvTag,
  csvQuote,
} from '@/lib/geocoding'
import {
  ViewToggle,
  OrdersTable,
  OrdersEditableTable,
  MissionSitesTable,
  MissionSitesEditableTable,
  RoutesTable,
  VehiclesTable,
} from './tables'

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
    truckStops,
    isFlightPlannerMode,
    setIsFlightPlannerMode,
    addNode,
    updateNode,
    removeNode,
    generateRoute,
    isGeneratingRoute,
    plotModeOrder,
    setPlotModeOrder,
    plotModeNodes,
    setPlotModeNodes,
    selectedNodeId,
    setSelectedNodeId,
    focusNodeId,
    focusNodeCounter,
    selectedRouteId,
    setSelectedRouteId,
    fleetMode,
    trucks,
    addTruck,
    removeTruck,
    updateTruck,
    droneCount,
    truckCount,
    missionLaunched,
    missionPaused,
    launchMission,
    pauseMission,
    stopMission,
    hasUnassignedWaypoints,
    hasUnroutedNodes,
    mapCenter,
  } = useFlightPlanner()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(0)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [missionTab, setMissionTab] = useState<'gantt' | 'orders' | 'missionSites' | 'routes' | 'vehicles'>('gantt')
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'drones' | 'trucks' | 'driver'>('all')
  const [nodeTab, setNodeTab] = useState<'overview' | 'orders' | 'missionSites'>('overview')

  const [csvImporting, setCsvImporting] = useState(false)

  // --- Clamp panel height on window resize so it never exceeds 80% of viewport ---
  useEffect(() => {
    const handleResize = () => {
      const maxHeight = window.innerHeight * 0.8
      if (bottomPanelHeight > maxHeight) {
        setBottomPanelHeight(maxHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [bottomPanelHeight, setBottomPanelHeight])

  // --- Focus node effect: switch tab and scroll to node entry on map marker double-click ---
  useEffect(() => {
    if (focusNodeCounter === 0 || !focusNodeId) return

    const node = missionConfig.nodes.find(n => n.id === focusNodeId)
    if (!node) return

    const isOrder = node.type === 'order'

    if (isFlightPlannerMode) {
      setNodeTab(isOrder ? 'orders' : 'missionSites')
    } else {
      setMissionTab(isOrder ? 'orders' : 'missionSites')
    }

    // Expand panel if collapsed
    if (!bottomPanelExpanded) {
      setBottomPanelExpanded(true)
    }

    // Scroll to the element after a delay to allow tab switch to render
    setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${focusNodeId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }, [focusNodeCounter]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Date/Time display state ---
  const [timeMode, setTimeMode] = useState<'clock' | 'mission'>('clock')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live clock - update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // --- Date/Time formatting helpers ---
  const formatClockTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const formatMissionElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `T+ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const DateTimeDisplay = () => (
    <Flex
      gap='1'
      align='center'
      onClick={() => setTimeMode(prev => (prev === 'clock' ? 'mission' : 'clock'))}
      style={{
        cursor: 'pointer',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: missionLaunched ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        userSelect: 'none',
      }}
      title={timeMode === 'clock' ? 'Click for mission time' : 'Click for clock time'}
    >
      <Calendar size={16} style={{ color: missionLaunched ? '#10b981' : '#6b7280' }} />
      <Text size='2' style={{ color: missionLaunched ? '#10b981' : '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
        {timeMode === 'clock' ? formatClockTime(currentTime) : formatMissionElapsed(missionElapsedTime)}
      </Text>
    </Flex>
  )

  // --- Grid / Table view toggle (single global toggle) ---
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const toggleViewMode = () => {
    setViewMode(prev => (prev === 'grid' ? 'table' : 'grid'))
  }

  // --- Address/Coordinate toggle state ---
  const [globalDisplayMode, setGlobalDisplayMode] = useState<'coords' | 'address'>('coords')
  const [cardDisplayOverrides, setCardDisplayOverrides] = useState<Map<string, 'coords' | 'address'>>(new Map())
  const [addressSearchInputs, setAddressSearchInputs] = useState<Map<string, string>>(new Map())
  const [geocodingLoading, setGeocodingLoading] = useState<Map<string, boolean>>(new Map())

  const getDisplayMode = (nodeId: string): 'coords' | 'address' => {
    return cardDisplayOverrides.get(nodeId) ?? globalDisplayMode
  }

  const toggleCardDisplayMode = (nodeId: string, node: MissionSite) => {
    const currentEffective = cardDisplayOverrides.get(nodeId) ?? globalDisplayMode
    const newMode = currentEffective === 'coords' ? 'address' : 'coords'
    setCardDisplayOverrides(prev => {
      const next = new Map(prev)
      next.set(nodeId, newMode)
      return next
    })
    if (newMode === 'address' && !node.address) {
      ensureAddressLoaded(node)
    }
  }

  const toggleGlobalDisplayMode = () => {
    const newMode = globalDisplayMode === 'coords' ? 'address' : 'coords'
    setGlobalDisplayMode(newMode)
    setCardDisplayOverrides(new Map())
    if (newMode === 'address') {
      missionConfig.nodes.forEach(node => {
        if (!node.address) ensureAddressLoaded(node)
      })
    }
  }

  const handleAddressSearch = async (nodeId: string) => {
    const query = addressSearchInputs.get(nodeId)
    if (!query?.trim()) return

    setGeocodingLoading(prev => new Map(prev).set(nodeId, true))
    try {
      const result = await forwardGeocode(query)
      if (result) {
        updateNode(nodeId, { lat: result.lat, lng: result.lng, address: result.displayName })
        setAddressSearchInputs(prev => {
          const n = new Map(prev)
          n.delete(nodeId)
          return n
        })
      }
    } catch (err) {
      console.error('Forward geocode failed:', err)
    } finally {
      setGeocodingLoading(prev => {
        const n = new Map(prev)
        n.delete(nodeId)
        return n
      })
    }
  }

  const ensureAddressLoaded = async (node: MissionSite) => {
    if (node.address) return
    setGeocodingLoading(prev => new Map(prev).set(node.id, true))
    try {
      const address = await reverseGeocode(node.lat, node.lng)
      updateNode(node.id, { address })
    } catch (err) {
      console.error('Reverse geocode failed:', err)
    } finally {
      setGeocodingLoading(prev => {
        const n = new Map(prev)
        n.delete(node.id)
        return n
      })
    }
  }

  // Seed geocoding cache from nodes that already have addresses
  useEffect(() => {
    missionConfig.nodes.forEach(node => {
      if (node.address) seedAddressCache(node.lat, node.lng, node.address)
    })
  }, [missionConfig.nodes])

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
      const vh = window.innerHeight
      // On very small viewports (<600px), allow panel to shrink more
      const minHeightPercent = vh < 600 ? (isFlightPlannerMode ? 0.25 : 0.2) : isFlightPlannerMode ? 0.32 : 0.24
      const minHeight = Math.max(120, vh * minHeightPercent)
      const maxHeight = vh * 0.8
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
      reader.onload = e => {
        const content = e.target?.result as string
        console.log('File content loaded, importing mission...')
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
    if (!file) return
    // Reset input so the same file can be re-imported
    if (event.target) event.target.value = ''

    const reader = new FileReader()
    reader.onload = async e => {
      const content = e.target?.result as string
      const lines = content.split('\n').filter(l => l.trim())
      if (lines.length === 0) {
        showToast('CSV file is empty', 'error')
        return
      }

      // Validate header
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase())
      const addrIdx = header.indexOf('address')
      const tagIdx = header.indexOf('node-tag')
      const radiusIdx = header.indexOf('radius')
      if (addrIdx === -1 || tagIdx === -1) {
        showToast('CSV must have "address" and "node-tag" columns', 'error')
        return
      }

      setCsvImporting(true)
      let imported = 0
      let skipped = 0

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i])
        const addressVal = fields[addrIdx] || ''
        const tagVal = fields[tagIdx] || ''
        const radiusVal = radiusIdx >= 0 ? fields[radiusIdx] || '' : ''

        if (!addressVal || !tagVal) {
          skipped++
          continue
        }

        const nodeType = csvTagToNodeType(tagVal)
        if (!nodeType) {
          skipped++
          continue
        }

        // Validate radius for hazard
        if (nodeType === 'hazard') {
          const r = parseFloat(radiusVal)
          if (!radiusVal || isNaN(r) || r <= 0) {
            skipped++
            continue
          }
        }

        // Resolve address to lat/lng
        let lat: number, lng: number
        let addressStr: string | undefined
        if (isLatLng(addressVal)) {
          const parts = addressVal.split(',').map(s => s.trim())
          lat = parseFloat(parts[0])
          lng = parseFloat(parts[1])
        } else {
          // Forward geocode street address
          try {
            const result = await forwardGeocode(addressVal)
            if (!result) {
              skipped++
              continue
            }
            lat = result.lat
            lng = result.lng
            addressStr = result.displayName
          } catch {
            skipped++
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
      if (skipped > 0) {
        showToast(`Imported ${imported} node(s), ${skipped} row(s) skipped`, imported > 0 ? 'success' : 'error')
      } else {
        showToast(`Imported ${imported} node(s) successfully!`, 'success')
      }
    }
    reader.readAsText(file)
  }

  const handleExportCSV = () => {
    const rows: string[] = ['address,node-tag,radius']

    for (const node of missionConfig.nodes) {
      const tag = nodeTypeToCsvTag(node.type)
      if (!tag) continue // skip waypoints

      // Use cached street address if available, otherwise fall back to lat,lng
      const addr = node.address || `${node.lat},${node.lng}`
      const radius = node.type === 'hazard' && node.radius ? String(node.radius) : ''
      rows.push(`${csvQuote(addr)},${tag},${radius}`)
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(missionConfig.missionName || 'addresses').replace(/\s+/g, '_')}_addresses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleAddOrder = () => {
    const newNode: MissionSite = {
      id: `node-${Date.now()}`,
      type: 'order',
      lat: mapCenter.lat,
      lng: mapCenter.lng,
    }
    addNode(newNode)
  }

  const handleAddMissionSite = () => {
    const newNode: MissionSite = {
      id: `node-${Date.now()}`,
      type: 'waypoint',
      lat: mapCenter.lat,
      lng: mapCenter.lng,
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

  const handleOverviewDoubleClick = (nodeId: string) => {
    const node = missionConfig.nodes.find(n => n.id === nodeId)
    if (!node) return
    const targetTab = node.type === 'order' ? 'orders' : 'missionSites'
    setNodeTab(targetTab as 'overview' | 'orders' | 'missionSites')
    setSelectedNodeId(nodeId)
    setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${nodeId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }

  const missionStatus = currentMission?.status || 'Idle'
  const hasRoute = truckRoute.length > 0 || droneRoutes.length > 0
  // Lock algorithm & fleet controls only when a route exists AND all points are routed.
  // If a new unrouted point is added, unlock so the user can reconfigure and re-route.
  const isConfigLocked = hasRoute && !hasUnroutedNodes
  const orderNodes = missionConfig.nodes.filter(n => n.type === 'order')
  const missionSites = missionConfig.nodes.filter(n => n.type !== 'order')
  const hasDepot = missionConfig.nodes.some(n => n.type === 'depot')
  const canGenerateRoute = hasDepot && orderNodes.length > 0
  const canSave = missionConfig.nodes.length > 0

  // Drag-to-scroll and edge fade for badge-scroll containers
  useEffect(() => {
    const updateScrollClass = (el: HTMLElement) => {
      const canScroll = el.scrollWidth > el.clientWidth
      if (!canScroll) {
        el.classList.add('scroll-none')
        el.classList.remove('scroll-start', 'scroll-end')
        return
      }
      el.classList.remove('scroll-none')
      const atStart = el.scrollLeft <= 1
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      el.classList.toggle('scroll-start', atStart && !atEnd)
      el.classList.toggle('scroll-end', atEnd && !atStart)
      if (!atStart && !atEnd) {
        el.classList.remove('scroll-start', 'scroll-end')
      }
      if (atStart && atEnd) {
        el.classList.add('scroll-none')
      }
    }
    const els = document.querySelectorAll<HTMLElement>('.badge-scroll')
    const cleanups: (() => void)[] = []
    els.forEach(el => {
      updateScrollClass(el)
      let isDown = false,
        startX = 0,
        scrollLeft = 0
      const onMouseDown = (e: MouseEvent) => {
        isDown = true
        startX = e.pageX - el.offsetLeft
        scrollLeft = el.scrollLeft
        el.style.cursor = 'grabbing'
      }
      const onMouseUp = () => {
        isDown = false
        el.style.cursor = 'grab'
      }
      const onMouseMove = (e: MouseEvent) => {
        if (!isDown) return
        e.preventDefault()
        el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX)
      }
      const onScroll = () => updateScrollClass(el)
      el.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('mousemove', onMouseMove)
      el.addEventListener('scroll', onScroll)
      cleanups.push(() => {
        el.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('mousemove', onMouseMove)
        el.removeEventListener('scroll', onScroll)
      })
    })
    return () => cleanups.forEach(fn => fn())
  })

  // When a node is selected, expand the bottom panel if collapsed
  useEffect(() => {
    if (!selectedNodeId) return
    if (!bottomPanelExpanded) {
      setBottomPanelExpanded(true)
    }
  }, [selectedNodeId])

  // Compute delivery vehicle for each order: 'drone' | 'truck' | 'unrouted'
  // Use truckStops (original un-snapped coordinates) when available for reliable matching,
  // falling back to truckRoute (OSRM road geometry) for legacy data
  const orderDeliveryMap = useMemo(() => {
    const truckMatchPoints = truckStops.length > 0 ? truckStops : truckRoute
    const map = new Map<string, 'drone' | 'truck' | 'unrouted'>()
    orderNodes.forEach(order => {
      const isDrone = droneRoutes.some(sortie => sortie.length >= 2 && pointMatchesNode(sortie[1], order))
      if (isDrone) {
        map.set(order.id, 'drone')
      } else if (hasRoute && truckMatchPoints.some(pt => pointMatchesNode(pt, order))) {
        map.set(order.id, 'truck')
      } else {
        map.set(order.id, 'unrouted')
      }
    })
    return map
  }, [orderNodes, droneRoutes, truckStops, truckRoute, hasRoute])

  // Delivery counts from route matching (more reliable than timeline for truck deliveries)
  const droneDeliveryCount = useMemo(
    () => Array.from(orderDeliveryMap.values()).filter(v => v === 'drone').length,
    [orderDeliveryMap],
  )
  const truckDeliveryCount = useMemo(
    () => Array.from(orderDeliveryMap.values()).filter(v => v === 'truck').length,
    [orderDeliveryMap],
  )

  // Generate timeline data for Gantt chart
  const timelineResult = useTimelineGenerator(truckRoute, droneRoutes, missionConfig.nodes)

  // Stats for header display — sourced from timeline summary for consistency
  const totalOrders = orderNodes.length
  const deliveredPackages = hasRoute && missionLaunched ? droneDeliveryCount + truckDeliveryCount : 0
  const totalDistance = hasRoute ? formatDistanceTimeline(timelineResult.summary.totalDistance) : '--'
  const coveredDistance = missionLaunched ? '0km' : '--' // Live tracking - future feature
  const estimatedTime = hasRoute ? formatDurationTimeline(timelineResult.summary.totalDuration) : '--:--'

  // Compute ETA and distance for each order directly from route data
  const orderEtaMap = useMemo(() => {
    const map = new Map<string, { eta: number; distance: number }>()
    if (!hasRoute) return map

    // Haversine distance in meters
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000
      const toRad = (d: number) => (d * Math.PI) / 180
      const dLat = toRad(b.lat - a.lat)
      const dLon = toRad(b.lng - a.lng)
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
      return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    }

    const TRUCK_SPEED_MS = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600
    const DRONE_SPEED_MS = (DEFAULT_TIMELINE_CONFIG.droneSpeedKmh * 1000) / 3600

    // Pre-compute cumulative truck distances for each route index
    const truckCumDist: number[] = [0]
    for (let i = 1; i < truckRoute.length; i++) {
      truckCumDist.push(truckCumDist[i - 1] + haversine(truckRoute[i - 1], truckRoute[i]))
    }

    for (const order of orderNodes) {
      const vehicle = orderDeliveryMap.get(order.id) || 'unrouted'

      if (vehicle === 'drone') {
        // Find the sortie delivering to this order
        for (const sortie of droneRoutes) {
          if (sortie.length >= 2 && pointMatchesNode(sortie[1], order)) {
            const dist = haversine(sortie[0], sortie[1])
            const travelTime = dist / DRONE_SPEED_MS
            const eta =
              DEFAULT_TIMELINE_CONFIG.droneLoadTimeSeconds + travelTime + DEFAULT_TIMELINE_CONFIG.droneUnloadTimeSeconds
            map.set(order.id, { eta, distance: dist })
            break
          }
        }
      } else if (vehicle === 'truck') {
        // Walk truck route to find the matching point
        for (let i = 1; i < truckRoute.length; i++) {
          if (pointMatchesNode(truckRoute[i], order)) {
            const dist = truckCumDist[i]
            const travelTime = dist / TRUCK_SPEED_MS
            const eta = travelTime + DEFAULT_TIMELINE_CONFIG.truckDeliveryTimeSeconds
            map.set(order.id, { eta, distance: dist })
            break
          }
        }
      }
    }

    return map
  }, [hasRoute, orderNodes, orderDeliveryMap, droneRoutes, truckRoute])

  // Compute per-type numbering for mission sites (e.g., Depot 1, Station 2)
  const nodeTypeNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    const counters: Record<string, number> = {}
    for (const node of missionSites) {
      counters[node.type] = (counters[node.type] || 0) + 1
      map.set(node.id, counters[node.type])
    }
    return map
  }, [missionSites])

  // Compute ETA (cumulative time) and distance-on-route for each mission site on the truck route
  const nodeEtaMap = useMemo(() => {
    const map = new Map<string, { eta: number; distance: number }>()
    if (!hasRoute || truckRoute.length < 2) return map

    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000
      const toRad = (d: number) => (d * Math.PI) / 180
      const dLat = toRad(b.lat - a.lat)
      const dLon = toRad(b.lng - a.lng)
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
      return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    }
    const TRUCK_SPEED_MS = (DEFAULT_TIMELINE_CONFIG.truckSpeedKmh * 1000) / 3600

    const truckCumDist: number[] = [0]
    for (let i = 1; i < truckRoute.length; i++) {
      truckCumDist.push(truckCumDist[i - 1] + haversine(truckRoute[i - 1], truckRoute[i]))
    }

    for (const node of missionSites) {
      for (let i = 0; i < truckRoute.length; i++) {
        if (pointMatchesNode(truckRoute[i], node)) {
          const dist = truckCumDist[i]
          const travelTime = dist / TRUCK_SPEED_MS
          // Add service time based on node type
          let serviceTime = 0
          if (node.type === 'station')
            serviceTime = 600 // 10 min charging
          else if (node.type === 'depot') serviceTime = 0
          else serviceTime = DEFAULT_TIMELINE_CONFIG.truckDeliveryTimeSeconds
          const eta = travelTime + serviceTime
          map.set(node.id, { eta, distance: dist })
          break
        }
      }
    }
    return map
  }, [hasRoute, truckRoute, missionSites])

  // Count timeline events per mission site location
  const nodeEventCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!hasRoute) return map
    for (const node of missionSites) {
      const count = timelineResult.events.filter(
        e => Math.abs(e.location.lat - node.lat) < 0.0001 && Math.abs(e.location.lng - node.lng) < 0.0001,
      ).length
      if (count > 0) map.set(node.id, count)
    }
    return map
  }, [hasRoute, missionSites, timelineResult.events])

  // Generate Gantt chart data - always call hooks unconditionally
  const ganttDataFromHook = useGanttData(timelineResult, fleetMode, droneCount, missionConfig.nodes)
  const ganttData = hasRoute ? ganttDataFromHook : generateEmptyGanttData(fleetMode, droneCount)

  // Generate route details for Routes tab
  const routeDetails = useRouteDetails(timelineResult, fleetMode, droneCount, hasRoute, orderNodes)

  // Generate vehicle details for Vehicles tab
  const vehicleDetails = useVehicleDetails(timelineResult, fleetMode, droneCount, hasRoute, orderNodes)

  // Determine Gantt chart state
  const ganttState: GanttChartState =
    !missionConfig.nodes.some(n => n.type === 'depot') && orderNodes.length === 0
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
          className='flight-planner-bottom'
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <Card className='rounded-none shadow-xl' style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
            <Flex direction='column'>
              <Flex
                align='center'
                className='p-4 panel-header'
                style={{
                  gap: 'var(--panel-header-gap)',
                  paddingTop: '24px',
                  flexWrap: 'wrap',
                  rowGap: '6px',
                  position: 'relative',
                  paddingRight: '48px',
                }}
              >
                {/* Mode label + Mission name + status badges — fixed width so right side stays put */}
                {isFlightPlannerMode ? (
                  <Flex
                    align='center'
                    gap='2'
                    style={{
                      width: 'var(--panel-header-name-width)',
                      minWidth: '140px',
                      flexShrink: 1,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <Text
                      size='1'
                      weight='medium'
                      style={{
                        position: 'absolute',
                        top: '-16px',
                        left: 0,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '10px',
                      }}
                    >
                      Route Planner
                    </Text>
                    <Gavel size={16} style={{ flexShrink: 0, color: '#000000' }} />
                    <TextField.Root
                      value={missionConfig.missionName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateMissionConfig({ missionName: e.target.value })
                      }
                      placeholder='Untitled Mission'
                      size='1'
                      variant='soft'
                      color='gray'
                      style={{
                        flex: 1,
                        height: '28px',
                        fontWeight: 700,
                        fontSize: '14px',
                        letterSpacing: '-0.01em',
                        color: '#4b5563',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      className='badge-scroll'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        minWidth: 0,
                        flexShrink: 1,
                      }}
                    >
                      <Badge
                        size='1'
                        style={{ fontSize: '10px', flexShrink: 0 }}
                        color={
                          hasUnassignedWaypoints ? 'red' : hasRoute ? 'green' : orderNodes.length > 0 ? 'orange' : 'gray'
                        }
                        variant={hasRoute ? 'soft' : 'outline'}
                      >
                        {hasUnassignedWaypoints
                          ? 'Blocked'
                          : hasRoute
                            ? 'Route Ready'
                            : orderNodes.length > 0
                              ? 'Route Required'
                              : 'Pending'}
                      </Badge>
                    </div>
                  </Flex>
                ) : (
                  <Flex
                    align='center'
                    gap='2'
                    style={{
                      width: 'var(--panel-header-name-width)',
                      minWidth: '140px',
                      flexShrink: 1,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <Text
                      size='1'
                      weight='medium'
                      style={{
                        position: 'absolute',
                        top: '-16px',
                        left: 0,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '10px',
                      }}
                    >
                      Mission Control
                    </Text>
                    <TowerControl size={16} style={{ flexShrink: 0 }} />
                    <Text size='2' weight='bold' style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {missionConfig.missionName || 'Untitled Mission'}
                    </Text>
                    <div
                      className='badge-scroll'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        minWidth: 0,
                        flexShrink: 1,
                      }}
                    >
                      <Badge size='1' style={{ fontSize: '10px', flexShrink: 0 }} color={getStatusColor(missionStatus)}>
                        {missionStatus}
                      </Badge>
                      {!missionLaunched && (
                        <>
                          <Badge
                            size='1'
                            style={{ fontSize: '10px', flexShrink: 0 }}
                            color={missionConfig.nodes.length > 0 ? 'green' : 'gray'}
                            variant={missionConfig.nodes.length > 0 ? 'soft' : 'outline'}
                          >
                            {missionConfig.nodes.length > 0 ? 'Plan Loaded' : 'No Plan'}
                          </Badge>
                          <Badge
                            size='1'
                            style={{ fontSize: '10px', flexShrink: 0 }}
                            color={hasRoute ? 'green' : missionConfig.nodes.length > 0 ? 'orange' : 'gray'}
                            variant={hasRoute ? 'soft' : 'outline'}
                          >
                            {hasRoute ? 'Route Ready' : missionConfig.nodes.length > 0 ? 'Route Required' : 'No Route'}
                          </Badge>
                        </>
                      )}
                    </div>
                  </Flex>
                )}

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                <DateTimeDisplay />

                {/* Stats */}
                <Flex
                  gap='3'
                  align='center'
                  className='text-gray-600'
                  style={{ flexShrink: 1, flexWrap: 'wrap', minWidth: 0 }}
                >
                  <Flex gap='1' align='center' title='Time Elapsed / Estimated'>
                    <Clock size={16} />
                    <Text size='2'>00:00/{estimatedTime}</Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Deliveries'>
                    <Package size={16} />
                    <Text size='2'>
                      {deliveredPackages}/{hasRoute ? totalOrders : '-'}
                    </Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Distance Covered / Total'>
                    <Route size={16} />
                    <Text size='2'>
                      {coveredDistance}/{totalDistance}
                    </Text>
                  </Flex>
                </Flex>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Center zone: control buttons (between stats and action buttons) */}
                <Flex gap='2' align='center' justify='center' style={{ flexShrink: 0, minWidth: '280px' }}>
                  {isFlightPlannerMode ? (
                    <Button
                      size='2'
                      style={{ paddingLeft: '16px', paddingRight: '16px' }}
                      onClick={generateRoute}
                      loading={isGeneratingRoute}
                      disabled={!canGenerateRoute || hasUnassignedWaypoints || isGeneratingRoute}
                      title={
                        !canGenerateRoute
                          ? 'Requires at least 1 depot and 1 order'
                          : hasUnassignedWaypoints
                            ? 'Assign all waypoints a type first'
                            : 'Generate Optimal Route'
                      }
                    >
                      <Route size={14} /> Generate Route
                    </Button>
                  ) : (
                    <>
                      <Button
                        size='2'
                        color='green'
                        disabled={
                          !missionConfig.nodes.length ||
                          (truckRoute.length === 0 && droneRoutes.length === 0) ||
                          hasUnroutedNodes ||
                          missionLaunched
                        }
                        onClick={launchMission}
                        title={hasUnroutedNodes ? 'Unrouted points exist' : 'Launch Mission'}
                      >
                        <Play size={14} /> Launch
                      </Button>
                      <Button size='2' color='orange' variant='soft' disabled={!missionLaunched} onClick={pauseMission}>
                        <Pause size={14} /> {missionPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button size='2' color='red' variant='soft' disabled={!missionLaunched} onClick={stopMission}>
                        <Square size={14} /> Stop
                      </Button>
                    </>
                  )}
                </Flex>

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                {/* Right zone: action buttons next to collapse */}
                {isFlightPlannerMode ? (
                  <Flex
                    gap='2'
                    align='center'
                    style={{ flexShrink: 1, width: 'var(--panel-header-actions-width)', minWidth: '120px' }}
                  >
                    <Button
                      size='2'
                      variant={hasRoute ? 'solid' : 'soft'}
                      color={hasRoute ? 'blue' : 'gray'}
                      className={hasRoute ? 'exit-highlight-pulse' : ''}
                      style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                      onClick={handleExitFlightPlanner}
                    >
                      <LogOut size={14} /> Exit
                    </Button>
                    <Button
                      size='2'
                      variant='soft'
                      style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                      onClick={handleExport}
                      disabled={!canSave}
                      title={!canSave ? 'Add at least 1 node or order to save' : 'Save mission'}
                    >
                      <Download size={14} /> Save
                    </Button>
                  </Flex>
                ) : (
                  <Flex
                    gap='2'
                    align='center'
                    style={{ flexShrink: 1, width: 'var(--panel-header-actions-width)', minWidth: '120px' }}
                  >
                    <Button
                      size='2'
                      style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                      onClick={() => setIsFlightPlannerMode(true)}
                      disabled={missionLaunched}
                    >
                      {missionConfig.nodes.length > 0 ? (
                        <>
                          <Settings size={14} /> Edit Plan
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Make Plan
                        </>
                      )}
                    </Button>
                    <Button
                      size='2'
                      variant='soft'
                      style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                      onClick={handleImport}
                      disabled={missionLaunched}
                    >
                      <FolderOpen size={14} /> Load Plan
                    </Button>
                  </Flex>
                )}

                <IconButton
                  size='3'
                  variant='ghost'
                  onClick={() => setBottomPanelExpanded(true)}
                  style={{
                    cursor: 'pointer',
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <ChevronUp size={24} />
                </IconButton>
              </Flex>
              <MissionStatsBar
                missionConfig={missionConfig}
                missionLaunched={missionLaunched}
                fleetMode={fleetMode}
                truckCount={truckCount}
                droneCount={droneCount}
                hasRoute={hasRoute}
                timelineSummary={hasRoute ? timelineResult.summary : undefined}
                droneDeliveries={droneDeliveryCount}
                truckDeliveries={truckDeliveryCount}
                truckRoutePoints={truckRoute.length}
                droneSorties={droneRoutes.length}
                isFlightPlannerMode={isFlightPlannerMode}
              />
            </Flex>
          </Card>
        </div>
        {/* Hidden file inputs */}
        <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} className='hidden' />
        <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
        <ToastUI />
      </>
    )
  }

  // Expanded state - Flight Planner Mode
  if (isFlightPlannerMode) {
    return (
      <>
        <div
          className='flight-planner-bottom'
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
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
            }}
            onMouseLeave={e => {
              if (!isDragging) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
          <Card className='h-full rounded-none shadow-xl' style={{ height: '100%' }}>
            <Flex direction='column' className='h-full'>
              {/* Header */}
              <Flex
                align='center'
                className='p-4 border-b panel-header'
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  gap: 'var(--panel-header-gap)',
                  paddingTop: '24px',
                  flexWrap: 'wrap',
                  rowGap: '6px',
                  position: 'relative',
                  paddingRight: '48px',
                }}
              >
                {/* Mode label + Mission name + route status badge — fixed width so right side stays put */}
                <Flex
                  align='center'
                  gap='2'
                  style={{
                    width: 'var(--panel-header-name-width)',
                    minWidth: '140px',
                    flexShrink: 1,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <Text
                    size='1'
                    weight='medium'
                    style={{
                      position: 'absolute',
                      top: '-16px',
                      left: 0,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                    }}
                  >
                    Route Planner
                  </Text>
                  <Gavel size={16} style={{ flexShrink: 0, color: '#000000' }} />
                  <TextField.Root
                    value={missionConfig.missionName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateMissionConfig({ missionName: e.target.value })
                    }
                    placeholder='Untitled Mission'
                    size='1'
                    variant='soft'
                    color='gray'
                    style={{
                      flex: 1,
                      height: '28px',
                      fontWeight: 700,
                      fontSize: '14px',
                      letterSpacing: '-0.01em',
                      color: '#4b5563',
                      flexShrink: 0,
                    }}
                  />
                  <div
                    className='badge-scroll'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      minWidth: 0,
                      flexShrink: 1,
                    }}
                  >
                    <Badge
                      size='1'
                      style={{ fontSize: '10px', flexShrink: 0 }}
                      color={hasUnassignedWaypoints ? 'red' : hasRoute ? 'green' : orderNodes.length > 0 ? 'orange' : 'gray'}
                      variant={hasRoute ? 'soft' : 'outline'}
                    >
                      {hasUnassignedWaypoints
                        ? 'Blocked'
                        : hasRoute
                          ? 'Route Ready'
                          : orderNodes.length > 0
                            ? 'Route Required'
                            : 'Pending'}
                    </Badge>
                  </div>
                </Flex>

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                <DateTimeDisplay />

                {/* Stats */}
                <Flex
                  gap='3'
                  align='center'
                  className='text-gray-600'
                  style={{ flexShrink: 1, flexWrap: 'wrap', minWidth: 0 }}
                >
                  <Flex gap='1' align='center' title='Time Elapsed / Estimated'>
                    <Clock size={16} />
                    <Text size='2'>00:00/{estimatedTime}</Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Deliveries'>
                    <Package size={16} />
                    <Text size='2'>
                      {deliveredPackages}/{hasRoute ? totalOrders : '-'}
                    </Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Distance Covered / Total'>
                    <Route size={16} />
                    <Text size='2'>
                      {coveredDistance}/{totalDistance}
                    </Text>
                  </Flex>
                </Flex>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Center: Generate Route button */}
                <Button
                  size='2'
                  style={{ paddingLeft: '16px', paddingRight: '16px' }}
                  onClick={generateRoute}
                  loading={isGeneratingRoute}
                  disabled={!canGenerateRoute || hasUnassignedWaypoints || isGeneratingRoute}
                  title={
                    !canGenerateRoute
                      ? 'Requires at least 1 depot and 1 order'
                      : hasUnassignedWaypoints
                        ? 'Assign all waypoints a type first'
                        : 'Generate Optimal Route'
                  }
                >
                  <Route size={14} /> Generate Route
                </Button>

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                {/* Right: Exit/Save buttons next to collapse */}
                <Flex
                  gap='2'
                  align='center'
                  style={{ flexShrink: 1, width: 'var(--panel-header-actions-width)', minWidth: '120px' }}
                >
                  <Button
                    size='2'
                    variant={hasRoute ? 'solid' : 'soft'}
                    color={hasRoute ? 'blue' : 'gray'}
                    className={hasRoute ? 'exit-highlight-pulse' : ''}
                    style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    onClick={handleExitFlightPlanner}
                  >
                    <LogOut size={14} /> Exit
                  </Button>
                  <Button
                    size='2'
                    variant='soft'
                    style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    onClick={handleExport}
                    disabled={!canSave}
                    title={!canSave ? 'Add at least 1 node or order to save' : 'Save mission'}
                  >
                    <Download size={14} /> Save
                  </Button>
                </Flex>

                <IconButton
                  size='3'
                  variant='ghost'
                  onClick={() => setBottomPanelExpanded(false)}
                  style={{
                    cursor: 'pointer',
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <ChevronDown size={24} />
                </IconButton>
              </Flex>

              {/* Stats Bar */}
              <MissionStatsBar
                missionConfig={missionConfig}
                fleetMode={fleetMode}
                truckCount={truckCount}
                droneCount={droneCount}
                hasRoute={hasRoute}
                timelineSummary={hasRoute ? timelineResult.summary : undefined}
                droneDeliveries={droneDeliveryCount}
                truckDeliveries={truckDeliveryCount}
                truckRoutePoints={truckRoute.length}
                droneSorties={droneRoutes.length}
                isFlightPlannerMode={true}
              />

              <Flex className='flex-1' style={{ minHeight: 0, backgroundColor: 'white' }}>
                {/* Left: Nodes with Tabs */}
                <Box className='flex-1 border-r' style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Tabs.Root
                    value={nodeTab}
                    onValueChange={(v: string) => {
                      setNodeTab(v as 'overview' | 'orders' | 'missionSites')
                      setSelectedNodeId(null)
                    }}
                    style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                  >
                    <Flex justify='between' align='center' className='px-4 pt-3'>
                      <Tabs.List>
                        <Tabs.Trigger value='overview'>
                          <LayoutGrid size={14} className='mr-1' />
                          Overview ({missionConfig.nodes.length})
                        </Tabs.Trigger>
                        <Tabs.Trigger value='orders'>
                          <MapPin size={14} className='mr-1' />
                          Order Points ({orderNodes.length})
                        </Tabs.Trigger>
                        <Tabs.Trigger value='missionSites'>
                          <Layers size={14} className='mr-1' />
                          Mission Sites ({missionSites.length})
                        </Tabs.Trigger>
                      </Tabs.List>
                      <Flex gap='3' align='center'>
                        <IconButton
                          size='1'
                          variant='ghost'
                          color={globalDisplayMode === 'address' ? 'blue' : 'gray'}
                          onClick={toggleGlobalDisplayMode}
                          title={globalDisplayMode === 'coords' ? 'Show addresses' : 'Show coordinates'}
                          style={{ cursor: 'pointer' }}
                        >
                          {globalDisplayMode === 'coords' ? <MapPinned size={14} /> : <Hash size={14} />}
                        </IconButton>
                        <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
                        {nodeTab === 'overview' ? (
                          <>
                            <Button size='1' variant='soft' onClick={handleImportCSV} disabled={csvImporting}>
                              <Upload size={14} /> {csvImporting ? 'Importing...' : 'Import Addresses (CSV)'}
                            </Button>
                            <Button
                              size='1'
                              variant='soft'
                              onClick={handleExportCSV}
                              disabled={missionConfig.nodes.length === 0}
                            >
                              <Download size={14} /> Export Addresses (CSV)
                            </Button>
                            <AlertDialog.Root>
                              <AlertDialog.Trigger>
                                <Button size='1' variant='soft' color='orange' disabled={!hasRoute}>
                                  <Route size={14} /> Reset Routing
                                </Button>
                              </AlertDialog.Trigger>
                              <AlertDialog.Content maxWidth='400px'>
                                <AlertDialog.Title>Reset Routing</AlertDialog.Title>
                                <AlertDialog.Description size='2'>
                                  This will remove the generated route but keep all nodes and orders. You can regenerate the
                                  route afterwards.
                                </AlertDialog.Description>
                                <Flex gap='3' mt='4' justify='end'>
                                  <AlertDialog.Cancel>
                                    <Button variant='soft' color='gray'>
                                      Cancel
                                    </Button>
                                  </AlertDialog.Cancel>
                                  <AlertDialog.Action>
                                    <Button variant='solid' color='orange' onClick={() => updateMissionConfig({ routes: undefined })}>
                                      Reset Routing
                                    </Button>
                                  </AlertDialog.Action>
                                </Flex>
                              </AlertDialog.Content>
                            </AlertDialog.Root>
                            <AlertDialog.Root>
                              <AlertDialog.Trigger>
                                <Button size='1' variant='soft' color='red' disabled={missionConfig.nodes.length === 0}>
                                  <Trash2 size={14} /> Reset Flight Plan
                                </Button>
                              </AlertDialog.Trigger>
                              <AlertDialog.Content maxWidth='400px'>
                                <AlertDialog.Title>Reset Flight Plan</AlertDialog.Title>
                                <AlertDialog.Description size='2'>
                                  This will remove all nodes and routes from the current flight plan. This action cannot be
                                  undone.
                                </AlertDialog.Description>
                                <Flex gap='3' mt='4' justify='end'>
                                  <AlertDialog.Cancel>
                                    <Button variant='soft' color='gray'>
                                      Cancel
                                    </Button>
                                  </AlertDialog.Cancel>
                                  <AlertDialog.Action>
                                    <Button
                                      variant='solid'
                                      color='red'
                                      onClick={() => updateMissionConfig({ nodes: [], routes: undefined })}
                                    >
                                      Reset
                                    </Button>
                                  </AlertDialog.Action>
                                </Flex>
                              </AlertDialog.Content>
                            </AlertDialog.Root>
                          </>
                        ) : nodeTab === 'orders' ? (
                          <>
                            <Button
                              size='1'
                              variant={plotModeOrder ? 'solid' : 'soft'}
                              color={plotModeOrder ? 'blue' : 'gray'}
                              onClick={() => setPlotModeOrder(!plotModeOrder)}
                            >
                              <MousePointer2 size={14} /> Plot
                            </Button>
                            <Button size='1' onClick={handleAddOrder}>
                              <Plus size={14} /> Add Order
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size='1'
                              variant={plotModeNodes ? 'solid' : 'soft'}
                              color={plotModeNodes ? 'blue' : 'gray'}
                              onClick={() => setPlotModeNodes(!plotModeNodes)}
                            >
                              <MousePointer2 size={14} /> Plot
                            </Button>
                            <Button size='1' onClick={handleAddMissionSite}>
                              <Plus size={14} /> Add Node
                            </Button>
                          </>
                        )}
                      </Flex>
                    </Flex>

                    {/* Overview Tab (read-only) */}
                    <Tabs.Content value='overview' className='flex-1 p-3' style={{ minHeight: 0, overflow: 'hidden' }}>
                      {viewMode === 'table' ? (
                        <ScrollArea style={{ height: '100%', paddingRight: '8px' }}>
                          {missionConfig.nodes.length === 0 ? (
                            <Box className='text-center p-6 bg-gray-50 rounded'>
                              <Text size='2' color='gray'>
                                No nodes added yet. Use &quot;Import Addresses (CSV)&quot; to bulk import, or switch to the
                                Order Points / Mission Sites tabs to add individually.
                              </Text>
                            </Box>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Orders Table (read-only) */}
                              {orderNodes.length > 0 && (
                                <Box>
                                  <Flex align='center' gap='1' style={{ marginBottom: '4px' }}>
                                    <MapPin size={12} className='text-green-600' />
                                    <Text size='1' weight='bold'>
                                      Order Points ({orderNodes.length})
                                    </Text>
                                  </Flex>
                                  <table className='data-table' style={{ tableLayout: 'fixed' }}>
                                    <thead>
                                      <tr>
                                        <th className='col-id'>#</th>
                                        <th className='col-flex'>Location</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {orderNodes.map(order => {
                                        const rowDisplayMode = getDisplayMode(order.id)
                                        const isLoading = geocodingLoading.get(order.id) || false
                                        const location =
                                          rowDisplayMode === 'coords'
                                            ? `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
                                            : isLoading
                                              ? 'Loading...'
                                              : order.address || `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
                                        const isSelected = selectedNodeId === order.id
                                        return (
                                          <tr
                                            key={order.id}
                                            data-node-id={order.id}
                                            className={isSelected ? 'selected' : ''}
                                            onClick={() => setSelectedNodeId(isSelected ? null : order.id)}
                                            onDoubleClick={() => handleOverviewDoubleClick(order.id)}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            <td
                                              className='accent-cell'
                                              style={{ '--accent-color': '#22c55e' } as React.CSSProperties}
                                            >
                                              <Flex align='center' gap='1'>
                                                <MapPin size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600 }}>{order.orderId || '?'}</span>
                                                <IconButton
                                                  size='1'
                                                  variant='ghost'
                                                  color={rowDisplayMode === 'address' ? 'blue' : 'gray'}
                                                  onClick={e => {
                                                    e.stopPropagation()
                                                    toggleCardDisplayMode(order.id, order)
                                                  }}
                                                  title={rowDisplayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                                  style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                                >
                                                  {rowDisplayMode === 'coords' ? (
                                                    <MapPinned size={10} />
                                                  ) : (
                                                    <Hash size={10} />
                                                  )}
                                                </IconButton>
                                              </Flex>
                                            </td>
                                            <td className='cell-truncate' style={{ color: '#374151' }}>
                                              {location}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </Box>
                              )}
                              {/* Mission Sites Table (read-only) */}
                              {missionSites.length > 0 && (
                                <Box>
                                  <Flex align='center' gap='1' style={{ marginBottom: '4px' }}>
                                    <Layers size={12} className='text-blue-600' />
                                    <Text size='1' weight='bold'>
                                      Mission Sites ({missionSites.length})
                                    </Text>
                                  </Flex>
                                  <table className='data-table' style={{ tableLayout: 'fixed' }}>
                                    <thead>
                                      <tr>
                                        <th className='col-id'>#</th>
                                        <th className='col-flex'>Name</th>
                                        <th className='col-flex'>Location</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {missionSites.map(node => {
                                        const typeColor =
                                          node.type === 'depot'
                                            ? '#3b82f6'
                                            : node.type === 'station'
                                              ? '#f97316'
                                              : node.type === 'hazard'
                                                ? '#ef4444'
                                                : '#8b5cf6'
                                        const rowDisplayMode = getDisplayMode(node.id)
                                        const isLoading = geocodingLoading.get(node.id) || false
                                        const location =
                                          rowDisplayMode === 'coords'
                                            ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                            : isLoading
                                              ? 'Loading...'
                                              : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                        const isSelected = selectedNodeId === node.id
                                        return (
                                          <tr
                                            key={node.id}
                                            data-node-id={node.id}
                                            className={isSelected ? 'selected' : ''}
                                            onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                                            onDoubleClick={() => handleOverviewDoubleClick(node.id)}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            <td
                                              className='accent-cell'
                                              style={{ '--accent-color': typeColor } as React.CSSProperties}
                                            >
                                              <Flex align='center' gap='1'>
                                                <span style={{ fontWeight: 600 }}>{node.siteId || '?'}</span>
                                                <IconButton
                                                  size='1'
                                                  variant='ghost'
                                                  color={rowDisplayMode === 'address' ? 'blue' : 'gray'}
                                                  onClick={e => {
                                                    e.stopPropagation()
                                                    toggleCardDisplayMode(node.id, node)
                                                  }}
                                                  title={rowDisplayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                                  style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                                >
                                                  {rowDisplayMode === 'coords' ? (
                                                    <MapPinned size={10} />
                                                  ) : (
                                                    <Hash size={10} />
                                                  )}
                                                </IconButton>
                                              </Flex>
                                            </td>
                                            <td>
                                              <span style={{ color: typeColor, fontWeight: 600 }}>
                                                {node.type.charAt(0).toUpperCase() + node.type.slice(1)}{' '}
                                                {nodeTypeNumberMap.get(node.id) || ''}
                                              </span>
                                            </td>
                                            <td className='cell-truncate' style={{ color: '#374151' }}>
                                              {location}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </Box>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      ) : (
                        <ScrollArea style={{ height: '100%', paddingRight: '8px' }}>
                          {missionConfig.nodes.length === 0 ? (
                            <Box className='text-center p-6 bg-gray-50 rounded'>
                              <Text size='2' color='gray'>
                                No nodes added yet. Use &quot;Import Addresses (CSV)&quot; to bulk import, or switch to the
                                Order Points / Mission Sites tabs to add individually.
                              </Text>
                            </Box>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Order Points Section */}
                              {orderNodes.length > 0 && (
                                <Box>
                                  <Flex align='center' gap='1' style={{ marginBottom: '4px' }}>
                                    <MapPin size={12} className='text-green-600' />
                                    <Text size='1' weight='bold'>
                                      Order Points ({orderNodes.length})
                                    </Text>
                                  </Flex>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                      gap: '6px',
                                    }}
                                  >
                                    {orderNodes.map(node => {
                                      const displayMode = getDisplayMode(node.id)
                                      const isLoading = geocodingLoading.get(node.id) || false
                                      return (
                                        <Card
                                          key={node.id}
                                          data-node-id={node.id}
                                          className='p-0'
                                          style={{
                                            backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                                            border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                          }}
                                          onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                                          onDoubleClick={() => handleOverviewDoubleClick(node.id)}
                                        >
                                          <Flex>
                                            <div
                                              style={{
                                                width: '3px',
                                                minHeight: '100%',
                                                backgroundColor: '#22c55e',
                                                flexShrink: 0,
                                              }}
                                            />
                                            <Flex
                                              align='center'
                                              gap='1'
                                              style={{ flex: 1, padding: '5px 8px', minWidth: 0 }}
                                            >
                                              <MapPin size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
                                              <Text size='1' weight='bold' style={{ flexShrink: 0 }}>
                                                Order {node.orderId || '?'}
                                              </Text>
                                              <Text
                                                size='1'
                                                color='gray'
                                                style={{
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                  marginLeft: '2px',
                                                }}
                                              >
                                                {displayMode === 'coords'
                                                  ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                                  : isLoading
                                                    ? 'Looking up...'
                                                    : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`}
                                              </Text>
                                              <IconButton
                                                size='1'
                                                variant='ghost'
                                                color={displayMode === 'address' ? 'blue' : 'gray'}
                                                onClick={e => {
                                                  e.stopPropagation()
                                                  toggleCardDisplayMode(node.id, node)
                                                }}
                                                title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                                style={{
                                                  minWidth: '16px',
                                                  minHeight: '16px',
                                                  padding: '1px',
                                                  flexShrink: 0,
                                                  marginLeft: 'auto',
                                                }}
                                              >
                                                {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                              </IconButton>
                                            </Flex>
                                          </Flex>
                                        </Card>
                                      )
                                    })}
                                  </div>
                                </Box>
                              )}

                              {/* Mission Sites Section */}
                              {missionSites.length > 0 && (
                                <Box>
                                  <Flex align='center' gap='1' style={{ marginBottom: '4px' }}>
                                    <Layers size={12} className='text-blue-600' />
                                    <Text size='1' weight='bold'>
                                      Mission Sites ({missionSites.length})
                                    </Text>
                                  </Flex>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                      gap: '6px',
                                    }}
                                  >
                                    {missionSites.map(node => {
                                      const displayMode = getDisplayMode(node.id)
                                      const isLoading = geocodingLoading.get(node.id) || false
                                      const typeColor =
                                        node.type === 'depot'
                                          ? '#3b82f6'
                                          : node.type === 'station'
                                            ? '#f97316'
                                            : node.type === 'hazard'
                                              ? '#ef4444'
                                              : '#8b5cf6'
                                      return (
                                        <Card
                                          key={node.id}
                                          data-node-id={node.id}
                                          className='p-0'
                                          style={{
                                            backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                                            border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                          }}
                                          onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                                          onDoubleClick={() => handleOverviewDoubleClick(node.id)}
                                        >
                                          <Flex>
                                            <div
                                              style={{
                                                width: '3px',
                                                minHeight: '100%',
                                                backgroundColor: typeColor,
                                                flexShrink: 0,
                                              }}
                                            />
                                            <Flex
                                              direction='column'
                                              style={{ flex: 1, padding: '5px 8px', minWidth: 0, gap: '1px' }}
                                            >
                                              <Flex align='center' gap='1'>
                                                <Text size='1' weight='bold' style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                  Site ID: {node.siteId || '?'}
                                                </Text>
                                                <Text size='1' color='gray'>
                                                  -
                                                </Text>
                                                <Text
                                                  size='1'
                                                  weight='medium'
                                                  style={{ color: typeColor, whiteSpace: 'nowrap', flexShrink: 0 }}
                                                >
                                                  {node.type.charAt(0).toUpperCase() + node.type.slice(1)}{' '}
                                                  {nodeTypeNumberMap.get(node.id) || ''}
                                                </Text>
                                                {node.type === 'hazard' && node.severity && (
                                                  <Badge
                                                    size='1'
                                                    variant='soft'
                                                    color={getHazardColor(node.severity)}
                                                    style={{ marginLeft: '2px', flexShrink: 0 }}
                                                  >
                                                    {node.severity}
                                                  </Badge>
                                                )}
                                                <IconButton
                                                  size='1'
                                                  variant='ghost'
                                                  color={displayMode === 'address' ? 'blue' : 'gray'}
                                                  onClick={e => {
                                                    e.stopPropagation()
                                                    toggleCardDisplayMode(node.id, node)
                                                  }}
                                                  title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                                  style={{
                                                    minWidth: '16px',
                                                    minHeight: '16px',
                                                    padding: '1px',
                                                    flexShrink: 0,
                                                    marginLeft: 'auto',
                                                  }}
                                                >
                                                  {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                                </IconButton>
                                              </Flex>
                                              <Text
                                                size='1'
                                                color='gray'
                                                style={{
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                  fontSize: '11px',
                                                }}
                                              >
                                                {displayMode === 'coords'
                                                  ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                                  : isLoading
                                                    ? 'Looking up...'
                                                    : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`}
                                              </Text>
                                            </Flex>
                                          </Flex>
                                        </Card>
                                      )
                                    })}
                                  </div>
                                </Box>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      )}
                    </Tabs.Content>

                    {/* Order Points Tab */}
                    <Tabs.Content value='orders' className='flex-1 p-4' style={{ minHeight: 0, overflow: 'hidden' }}>
                      {viewMode === 'table' ? (
                        <OrdersEditableTable
                          orders={orderNodes}
                          selectedNodeId={selectedNodeId}
                          onSelectNode={id => setSelectedNodeId(id)}
                          displayMode={globalDisplayMode}
                          geocodingLoading={geocodingLoading}
                          updateNode={updateNode}
                          removeNode={removeNode}
                          addressSearchInputs={addressSearchInputs}
                          onAddressSearchInputChange={(nodeId, value) =>
                            setAddressSearchInputs(prev => new Map(prev).set(nodeId, value))
                          }
                          onAddressSearch={handleAddressSearch}
                          getDisplayMode={getDisplayMode}
                          onToggleDisplayMode={toggleCardDisplayMode}
                        />
                      ) : (
                        <ScrollArea style={{ height: '100%' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                              gap: '6px',
                              paddingRight: '8px',
                            }}
                          >
                            {orderNodes.map(node => {
                              const displayMode = getDisplayMode(node.id)
                              const isLoading = geocodingLoading.get(node.id) || false
                              return (
                                <Card
                                  key={node.id}
                                  data-node-id={node.id}
                                  className='p-0'
                                  style={{
                                    backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                                    border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                  }}
                                  onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                                >
                                  <Flex>
                                    <div
                                      style={{ width: '3px', minHeight: '100%', backgroundColor: '#22c55e', flexShrink: 0 }}
                                    />
                                    <Flex direction='column' gap='1' style={{ flex: 1, padding: '8px 10px' }}>
                                      <Flex justify='between' align='center'>
                                        <Flex align='center' gap='1'>
                                          <MapPin size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                                          <Text size='1' weight='bold'>
                                            Order {node.orderId || '?'}
                                          </Text>
                                          <IconButton
                                            size='1'
                                            variant='ghost'
                                            color={displayMode === 'address' ? 'blue' : 'gray'}
                                            onClick={e => {
                                              e.stopPropagation()
                                              toggleCardDisplayMode(node.id, node)
                                            }}
                                            title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                            style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                          >
                                            {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                          </IconButton>
                                        </Flex>
                                        <IconButton
                                          size='1'
                                          variant='ghost'
                                          color='red'
                                          onClick={e => {
                                            e.stopPropagation()
                                            removeNode(node.id)
                                          }}
                                          style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                        >
                                          <Trash2 size={12} />
                                        </IconButton>
                                      </Flex>
                                      {displayMode === 'coords' ? (
                                        <Flex gap='2'>
                                          <Flex align='center' gap='1' style={{ flex: 1 }}>
                                            <TextField.Root
                                              value={node.lat}
                                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                updateNode(node.id, {
                                                  lat: parseFloat(e.target.value) || 0,
                                                  address: undefined,
                                                })
                                              }
                                              placeholder='Latitude'
                                              size='1'
                                              type='number'
                                              step='0.0001'
                                              style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                            />
                                            <Flex direction='column' gap='1'>
                                              <IconButton
                                                size='1'
                                                variant='soft'
                                                onClick={() =>
                                                  updateNode(node.id, {
                                                    lat: parseFloat((node.lat + 0.0001).toFixed(6)),
                                                    address: undefined,
                                                  })
                                                }
                                                style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                              >
                                                <ArrowUp size={12} />
                                              </IconButton>
                                              <IconButton
                                                size='1'
                                                variant='soft'
                                                onClick={() =>
                                                  updateNode(node.id, {
                                                    lat: parseFloat((node.lat - 0.0001).toFixed(6)),
                                                    address: undefined,
                                                  })
                                                }
                                                style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                              >
                                                <ArrowDown size={12} />
                                              </IconButton>
                                            </Flex>
                                          </Flex>
                                          <Flex align='center' gap='1' style={{ flex: 1 }}>
                                            <TextField.Root
                                              value={node.lng}
                                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                updateNode(node.id, {
                                                  lng: parseFloat(e.target.value) || 0,
                                                  address: undefined,
                                                })
                                              }
                                              placeholder='Longitude'
                                              size='1'
                                              type='number'
                                              step='0.0001'
                                              style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                            />
                                            <Flex direction='column' gap='1'>
                                              <IconButton
                                                size='1'
                                                variant='soft'
                                                onClick={() =>
                                                  updateNode(node.id, {
                                                    lng: parseFloat((node.lng + 0.0001).toFixed(6)),
                                                    address: undefined,
                                                  })
                                                }
                                                style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                              >
                                                <ArrowUp size={12} />
                                              </IconButton>
                                              <IconButton
                                                size='1'
                                                variant='soft'
                                                onClick={() =>
                                                  updateNode(node.id, {
                                                    lng: parseFloat((node.lng - 0.0001).toFixed(6)),
                                                    address: undefined,
                                                  })
                                                }
                                                style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                              >
                                                <ArrowDown size={12} />
                                              </IconButton>
                                            </Flex>
                                          </Flex>
                                        </Flex>
                                      ) : (
                                        <Flex gap='2' align='end'>
                                          <TextField.Root
                                            value={addressSearchInputs.get(node.id) ?? node.address ?? ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                              setAddressSearchInputs(prev => new Map(prev).set(node.id, e.target.value))
                                            }
                                            placeholder={isLoading ? 'Looking up address...' : 'Enter street address'}
                                            size='1'
                                            style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                            onKeyDown={(e: React.KeyboardEvent) => {
                                              if (e.key === 'Enter') handleAddressSearch(node.id)
                                            }}
                                          />
                                          <Button
                                            size='1'
                                            variant='soft'
                                            onClick={() => handleAddressSearch(node.id)}
                                            disabled={isLoading}
                                          >
                                            <Search size={12} /> {isLoading ? '...' : 'Search'}
                                          </Button>
                                        </Flex>
                                      )}
                                    </Flex>
                                  </Flex>
                                </Card>
                              )
                            })}
                          </div>
                          {orderNodes.length === 0 && (
                            <Box className='text-center p-6 bg-gray-50 rounded'>
                              <Text size='2' color='gray'>
                                No orders added yet. Click &quot;Add Order&quot; or click on the map.
                              </Text>
                            </Box>
                          )}
                        </ScrollArea>
                      )}
                    </Tabs.Content>

                    {/* Mission Sites Tab */}
                    <Tabs.Content value='missionSites' className='flex-1 p-4' style={{ minHeight: 0, overflow: 'hidden' }}>
                      {viewMode === 'table' ? (
                        <MissionSitesEditableTable
                          nodes={missionSites}
                          selectedNodeId={selectedNodeId}
                          onSelectNode={id => setSelectedNodeId(id)}
                          displayMode={globalDisplayMode}
                          geocodingLoading={geocodingLoading}
                          updateNode={updateNode}
                          removeNode={removeNode}
                          addressSearchInputs={addressSearchInputs}
                          onAddressSearchInputChange={(nodeId, value) =>
                            setAddressSearchInputs(prev => new Map(prev).set(nodeId, value))
                          }
                          onAddressSearch={handleAddressSearch}
                          getDisplayMode={getDisplayMode}
                          onToggleDisplayMode={toggleCardDisplayMode}
                        />
                      ) : (
                        <ScrollArea style={{ height: '100%' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                              gap: '6px',
                              paddingRight: '8px',
                            }}
                          >
                            {missionSites.map((node, index) => {
                              const displayMode = getDisplayMode(node.id)
                              const isLoading = geocodingLoading.get(node.id) || false
                              const typeColor =
                                node.type === 'depot'
                                  ? '#3b82f6'
                                  : node.type === 'station'
                                    ? '#f97316'
                                    : node.type === 'hazard'
                                      ? '#ef4444'
                                      : '#8b5cf6'
                              return (
                                <Card
                                  key={node.id}
                                  data-node-id={node.id}
                                  className='p-0'
                                  style={{
                                    backgroundColor: selectedNodeId === node.id ? '#eff6ff' : 'white',
                                    border: selectedNodeId === node.id ? '2px solid #3b82f6' : undefined,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                  }}
                                  onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                                >
                                  <Flex>
                                    <div
                                      style={{ width: '3px', minHeight: '100%', backgroundColor: typeColor, flexShrink: 0 }}
                                    />
                                    <Flex direction='column' gap='1' style={{ flex: 1, padding: '8px 10px' }}>
                                      <Flex justify='between' align='center'>
                                        <Flex align='center' gap='1' style={{ minWidth: 0 }}>
                                          <Text size='1' weight='bold' style={{ whiteSpace: 'nowrap' }}>
                                            Site ID: {node.siteId || '?'}
                                          </Text>
                                          <Text size='1' color='gray'>
                                            -
                                          </Text>
                                          <Text size='1' weight='medium' style={{ color: typeColor, whiteSpace: 'nowrap' }}>
                                            {node.type.charAt(0).toUpperCase() + node.type.slice(1)}{' '}
                                            {nodeTypeNumberMap.get(node.id) || ''}
                                          </Text>
                                          {node.type === 'hazard' && node.severity && (
                                            <Badge
                                              size='1'
                                              variant='soft'
                                              color={getHazardColor(node.severity)}
                                              style={{ fontSize: '9px' }}
                                            >
                                              {node.severity}
                                            </Badge>
                                          )}
                                          <IconButton
                                            size='1'
                                            variant='ghost'
                                            color={displayMode === 'address' ? 'blue' : 'gray'}
                                            onClick={e => {
                                              e.stopPropagation()
                                              toggleCardDisplayMode(node.id, node)
                                            }}
                                            title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                            style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                          >
                                            {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                          </IconButton>
                                        </Flex>
                                        <IconButton
                                          size='1'
                                          variant='ghost'
                                          color='red'
                                          onClick={e => {
                                            e.stopPropagation()
                                            removeNode(node.id)
                                          }}
                                          style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                        >
                                          <Trash2 size={12} />
                                        </IconButton>
                                      </Flex>

                                      <Box style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <Select.Root
                                          value={node.type}
                                          onValueChange={(value: string) => {
                                            const updates: Partial<MissionSite> = { type: value as MissionSite['type'] }
                                            if (value === 'hazard') {
                                              if (!node.radius) updates.radius = 100
                                              if (!node.severity) updates.severity = 'medium'
                                            }
                                            updateNode(node.id, updates)
                                          }}
                                        >
                                          <Select.Trigger />
                                          <Select.Content>
                                            <Select.Item value='depot'>Depot</Select.Item>
                                            <Select.Item value='station'>Station</Select.Item>
                                            <Select.Item value='waypoint'>Waypoint</Select.Item>
                                            <Select.Item value='hazard'>Hazard</Select.Item>
                                          </Select.Content>
                                        </Select.Root>

                                        {displayMode === 'coords' ? (
                                          <Flex gap='2'>
                                            <Flex align='center' gap='1' style={{ flex: 1 }}>
                                              <TextField.Root
                                                placeholder='Lat'
                                                value={node.lat}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                  updateNode(node.id, {
                                                    lat: parseFloat(e.target.value) || 0,
                                                    address: undefined,
                                                  })
                                                }
                                                size='1'
                                                type='number'
                                                step='0.0001'
                                                style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                              />
                                              <Flex direction='column' gap='1'>
                                                <IconButton
                                                  size='1'
                                                  variant='soft'
                                                  onClick={() =>
                                                    updateNode(node.id, {
                                                      lat: parseFloat((node.lat + 0.0001).toFixed(6)),
                                                      address: undefined,
                                                    })
                                                  }
                                                  style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                                >
                                                  <ArrowUp size={12} />
                                                </IconButton>
                                                <IconButton
                                                  size='1'
                                                  variant='soft'
                                                  onClick={() =>
                                                    updateNode(node.id, {
                                                      lat: parseFloat((node.lat - 0.0001).toFixed(6)),
                                                      address: undefined,
                                                    })
                                                  }
                                                  style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                                >
                                                  <ArrowDown size={12} />
                                                </IconButton>
                                              </Flex>
                                            </Flex>
                                            <Flex align='center' gap='1' style={{ flex: 1 }}>
                                              <TextField.Root
                                                placeholder='Lng'
                                                value={node.lng}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                  updateNode(node.id, {
                                                    lng: parseFloat(e.target.value) || 0,
                                                    address: undefined,
                                                  })
                                                }
                                                size='1'
                                                type='number'
                                                step='0.0001'
                                                style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                              />
                                              <Flex direction='column' gap='1'>
                                                <IconButton
                                                  size='1'
                                                  variant='soft'
                                                  onClick={() =>
                                                    updateNode(node.id, {
                                                      lng: parseFloat((node.lng + 0.0001).toFixed(6)),
                                                      address: undefined,
                                                    })
                                                  }
                                                  style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                                >
                                                  <ArrowUp size={12} />
                                                </IconButton>
                                                <IconButton
                                                  size='1'
                                                  variant='soft'
                                                  onClick={() =>
                                                    updateNode(node.id, {
                                                      lng: parseFloat((node.lng - 0.0001).toFixed(6)),
                                                      address: undefined,
                                                    })
                                                  }
                                                  style={{ minWidth: '24px', minHeight: '18px', padding: '2px 4px' }}
                                                >
                                                  <ArrowDown size={12} />
                                                </IconButton>
                                              </Flex>
                                            </Flex>
                                          </Flex>
                                        ) : (
                                          <Flex gap='2' align='end'>
                                            <TextField.Root
                                              value={addressSearchInputs.get(node.id) ?? node.address ?? ''}
                                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setAddressSearchInputs(prev => new Map(prev).set(node.id, e.target.value))
                                              }
                                              placeholder={isLoading ? 'Looking up address...' : 'Enter street address'}
                                              size='1'
                                              style={{ flex: 1, fontSize: '11px', height: '26px' }}
                                              onKeyDown={(e: React.KeyboardEvent) => {
                                                if (e.key === 'Enter') handleAddressSearch(node.id)
                                              }}
                                            />
                                            <Button
                                              size='1'
                                              variant='soft'
                                              onClick={() => handleAddressSearch(node.id)}
                                              disabled={isLoading}
                                            >
                                              <Search size={12} /> {isLoading ? '...' : 'Search'}
                                            </Button>
                                          </Flex>
                                        )}

                                        {node.type === 'hazard' && (
                                          <Flex gap='2'>
                                            <TextField.Root
                                              placeholder='Radius (m)'
                                              value={node.radius || ''}
                                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                updateNode(node.id, { radius: parseFloat(e.target.value) || 100 })
                                              }
                                              size='1'
                                              type='number'
                                              style={{ flex: 1 }}
                                            />
                                            <Select.Root
                                              value={node.severity || 'medium'}
                                              onValueChange={(value: string) =>
                                                updateNode(node.id, { severity: value as 'low' | 'medium' | 'high' })
                                              }
                                            >
                                              <Select.Trigger placeholder='Severity' />
                                              <Select.Content>
                                                <Select.Item value='low'>Low</Select.Item>
                                                <Select.Item value='medium'>Medium</Select.Item>
                                                <Select.Item value='high'>High</Select.Item>
                                              </Select.Content>
                                            </Select.Root>
                                          </Flex>
                                        )}
                                      </Box>
                                    </Flex>
                                  </Flex>
                                </Card>
                              )
                            })}
                          </div>
                          {missionSites.length === 0 && (
                            <Box className='text-center p-6 bg-gray-50 rounded'>
                              <Text size='2' color='gray'>
                                No mission sites added yet. Click &quot;Add Node&quot; to add depots, stations, waypoints, or
                                hazards.
                              </Text>
                            </Box>
                          )}
                        </ScrollArea>
                      )}
                    </Tabs.Content>
                  </Tabs.Root>
                </Box>

                {/* Right: Config Panel */}
                <Box className='w-79 p-4 border-l config-scroll' style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                  {/* Routing Algorithm */}
                  <Box className='mb-4'>
                    <Flex align='center' gap='2' style={{ display: 'flex', marginBottom: '12px' }}>
                      <Text size='2' weight='bold'>
                        Routing Algorithm
                      </Text>
                      {isConfigLocked && (
                        <Badge color='orange' size='1'>
                          <Lock size={10} /> Locked
                        </Badge>
                      )}
                      {hasRoute && hasUnroutedNodes && (
                        <Badge color='blue' size='1'>
                          <Unlock size={10} /> Unlocked
                        </Badge>
                      )}
                    </Flex>
                    {isConfigLocked && (
                      <Text size='1' color='gray' style={{ display: 'block', marginBottom: '8px' }}>
                        Clear route to change algorithm.
                      </Text>
                    )}
                    {hasRoute && hasUnroutedNodes && (
                      <Text size='1' color='blue' style={{ display: 'block', marginBottom: '8px' }}>
                        New unrouted points detected — reconfigure and re-route.
                      </Text>
                    )}
                    <Box style={{ opacity: isConfigLocked ? 0.5 : 1, pointerEvents: isConfigLocked ? 'none' : 'auto' }}>
                      <Select.Root
                        value={missionConfig.algorithm}
                        onValueChange={(value: string) => updateMissionConfig({ algorithm: value as RoutingAlgorithm })}
                        disabled={isConfigLocked}
                      >
                        <Select.Trigger style={{ width: '100%' }} />
                        <Select.Content>
                          <Select.Item value='negar'>Default Routing Engine</Select.Item>
                          <Select.Item value='custom'>Custom</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </Box>
                  </Box>

                  {/* Fleet Control */}
                  <Box className='mb-4 border-t pt-4'>
                    <Flex align='center' gap='2' className='mb-3'>
                      <Text size='2' weight='bold'>
                        Fleet Control
                      </Text>
                      {isConfigLocked && (
                        <Badge color='orange' size='1'>
                          <Lock size={10} /> Locked
                        </Badge>
                      )}
                      {hasRoute && hasUnroutedNodes && (
                        <Badge color='blue' size='1'>
                          <Unlock size={10} /> Unlocked
                        </Badge>
                      )}
                    </Flex>
                    {isConfigLocked && (
                      <Text size='1' color='gray' style={{ display: 'block', marginBottom: '8px' }}>
                        Clear route to change fleet configuration.
                      </Text>
                    )}
                    {hasRoute && hasUnroutedNodes && (
                      <Text size='1' color='blue' style={{ display: 'block', marginBottom: '8px' }}>
                        New unrouted points detected — reconfigure and re-route.
                      </Text>
                    )}
                    <Flex
                      direction='column'
                      gap='2'
                      style={{ opacity: isConfigLocked ? 0.5 : 1, pointerEvents: isConfigLocked ? 'none' : 'auto' }}
                    >
                      {/* Fleet totals summary */}
                      <Flex
                        align='center'
                        justify='between'
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px dashed #e5e7eb',
                        }}
                      >
                        <Text size='1' color='gray'>
                          Total fleet
                        </Text>
                        <Flex align='center' gap='3'>
                          <Flex align='center' gap='1'>
                            <Truck size={12} style={{ color: '#374151' }} />
                            <Text size='1' weight='medium'>
                              {truckCount}
                            </Text>
                          </Flex>
                          <Flex align='center' gap='1'>
                            <Drone size={12} style={{ color: '#3b82f6' }} />
                            <Text size='1' weight='medium'>
                              {droneCount}
                            </Text>
                          </Flex>
                        </Flex>
                      </Flex>
                      <Button
                        size='1'
                        variant='soft'
                        color='blue'
                        onClick={addTruck}
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        <Plus size={12} /> Add Truck
                      </Button>
                      {trucks.map((truck, index) => (
                        <Box
                          key={truck.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <Flex align='center' justify='between' className='mb-2'>
                            <Flex align='center' gap='2'>
                              <Truck size={14} style={{ color: '#374151' }} />
                              <Text size='2' weight='medium'>
                                Truck {index + 1}
                              </Text>
                            </Flex>
                            <IconButton
                              size='1'
                              variant='ghost'
                              color='gray'
                              onClick={() => removeTruck(truck.id)}
                              disabled={trucks.length <= 1}
                              style={{ cursor: trucks.length <= 1 ? 'not-allowed' : 'pointer' }}
                              title={trucks.length <= 1 ? 'At least one truck is required' : 'Remove truck'}
                            >
                              <Trash2 size={12} />
                            </IconButton>
                          </Flex>
                          {/* Power type toggle */}
                          <Flex align='center' justify='between' className='mb-2'>
                            <Text size='1' color='gray'>
                              Power
                            </Text>
                            <Flex
                              align='center'
                              gap='1'
                              style={{ backgroundColor: '#f3f4f6', borderRadius: '6px', padding: '2px' }}
                            >
                              <button
                                onClick={() => updateTruck(truck.id, { powerType: 'gas' })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  backgroundColor: truck.powerType === 'gas' ? 'white' : 'transparent',
                                  color: truck.powerType === 'gas' ? '#374151' : '#9ca3af',
                                  boxShadow: truck.powerType === 'gas' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                }}
                              >
                                <Fuel size={12} /> Gas
                              </button>
                              <button
                                onClick={() => updateTruck(truck.id, { powerType: 'electric' })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  backgroundColor: truck.powerType === 'electric' ? 'white' : 'transparent',
                                  color: truck.powerType === 'electric' ? '#374151' : '#9ca3af',
                                  boxShadow: truck.powerType === 'electric' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                }}
                              >
                                <Zap size={12} /> Electric
                              </button>
                            </Flex>
                          </Flex>
                          {/* Drones allocated to this truck */}
                          <Flex align='center' justify='between'>
                            <Flex align='center' gap='2'>
                              <Drone size={14} style={{ color: '#6b7280' }} />
                              <Text size='1' color='gray'>
                                Drones
                              </Text>
                            </Flex>
                            <Flex align='center' gap='1'>
                              <IconButton
                                size='1'
                                variant='soft'
                                color='gray'
                                onClick={() => updateTruck(truck.id, { drones: Math.max(0, truck.drones - 1) })}
                                disabled={truck.drones <= 0}
                                style={{ cursor: truck.drones <= 0 ? 'not-allowed' : 'pointer' }}
                              >
                                <Minus size={12} />
                              </IconButton>
                              <TextField.Root
                                type='number'
                                value={truck.drones}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateTruck(truck.id, { drones: Math.max(0, parseInt(e.target.value) || 0) })
                                }
                                size='1'
                                style={{ width: '48px', textAlign: 'center' }}
                              />
                              <IconButton
                                size='1'
                                variant='soft'
                                color='gray'
                                onClick={() => updateTruck(truck.id, { drones: truck.drones + 1 })}
                              >
                                <Plus size={12} />
                              </IconButton>
                            </Flex>
                          </Flex>
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                </Box>
              </Flex>
            </Flex>
          </Card>

          {/* Hidden file inputs */}
          <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
          <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} className='hidden' />
        </div>
        <ToastUI />
      </>
    )
  }

  // Expanded state - Mission Management Mode
  const deliveryProgress = totalOrders > 0 ? (deliveredPackages / totalOrders) * 100 : 0

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
          className='flight-planner-bottom'
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
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
            }}
            onMouseLeave={e => {
              if (!isDragging) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
          <Card className='h-full rounded-none shadow-xl' style={{ height: '100%' }}>
            <Flex direction='column' className='h-full'>
              {/* Header */}
              <Flex
                align='center'
                className='p-4 border-b panel-header'
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  gap: 'var(--panel-header-gap)',
                  paddingTop: '24px',
                  flexWrap: 'wrap',
                  rowGap: '6px',
                  position: 'relative',
                  paddingRight: '48px',
                }}
              >
                {/* Mode label + Mission name + status badges — fixed width so right side stays put */}
                <Flex
                  align='center'
                  gap='2'
                  style={{
                    width: 'var(--panel-header-name-width)',
                    minWidth: '140px',
                    flexShrink: 1,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <Text
                    size='1'
                    weight='medium'
                    style={{
                      position: 'absolute',
                      top: '-16px',
                      left: 0,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                    }}
                  >
                    Mission Control
                  </Text>
                  <TowerControl size={16} style={{ flexShrink: 0 }} />
                  <Text size='2' weight='bold' style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {missionConfig.missionName || 'Untitled Mission'}
                  </Text>
                  <div
                    className='badge-scroll'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      minWidth: 0,
                      flexShrink: 1,
                    }}
                  >
                    <Badge
                      size='1'
                      style={{ fontSize: '10px', flexShrink: 0 }}
                      color={missionPaused ? 'orange' : 'green'}
                      variant='solid'
                    >
                      {missionPaused ? 'Paused' : 'Running'}
                    </Badge>
                  </div>
                </Flex>

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                <DateTimeDisplay />

                {/* Stats */}
                <Flex
                  gap='3'
                  align='center'
                  className='text-gray-600'
                  style={{ flexShrink: 1, flexWrap: 'wrap', minWidth: 0 }}
                >
                  <Flex gap='1' align='center' title='Time Elapsed / Estimated'>
                    <Clock size={16} />
                    <Text size='2'>00:00/{estimatedTime}</Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Deliveries'>
                    <Package size={16} />
                    <Text size='2'>
                      {deliveredPackages}/{hasRoute ? totalOrders : '-'}
                    </Text>
                  </Flex>
                  <Flex gap='1' align='center' title='Distance Covered / Total'>
                    <Route size={16} />
                    <Text size='2'>
                      {coveredDistance}/{totalDistance}
                    </Text>
                  </Flex>
                </Flex>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Center: Flight control buttons */}
                <Flex gap='2' align='center' style={{ flexShrink: 0 }}>
                  <Button size='2' color='green' disabled>
                    <Play size={14} /> Launch
                  </Button>
                  <Button size='2' color='orange' variant='soft' onClick={pauseMission}>
                    <Pause size={14} /> {missionPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button size='2' color='red' variant='soft' onClick={stopMission}>
                    <Square size={14} /> Stop
                  </Button>
                </Flex>

                <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

                {/* Right: Make/Edit + Load (disabled during mission) next to collapse */}
                <Flex
                  gap='2'
                  align='center'
                  style={{ flexShrink: 1, width: 'var(--panel-header-actions-width)', minWidth: '120px' }}
                >
                  <Button
                    size='2'
                    style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    disabled
                  >
                    <Settings size={14} /> Edit Plan
                  </Button>
                  <Button
                    size='2'
                    variant='soft'
                    style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    disabled
                  >
                    <FolderOpen size={14} /> Load Plan
                  </Button>
                </Flex>

                <IconButton
                  size='3'
                  variant='ghost'
                  onClick={() => setBottomPanelExpanded(false)}
                  style={{
                    cursor: 'pointer',
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <ChevronDown size={24} />
                </IconButton>
              </Flex>

              {/* Stats Bar */}
              <MissionStatsBar
                missionConfig={missionConfig}
                missionLaunched={missionLaunched}
                fleetMode={fleetMode}
                truckCount={truckCount}
                droneCount={droneCount}
                hasRoute={hasRoute}
                timelineSummary={hasRoute ? timelineResult.summary : undefined}
                droneDeliveries={droneDeliveryCount}
                truckDeliveries={truckDeliveryCount}
                truckRoutePoints={truckRoute.length}
                droneSorties={droneRoutes.length}
              />

              {/* Tabs */}
              <Tabs.Root
                value={hasRoute ? missionTab : 'gantt'}
                onValueChange={(v: string) => {
                  if (!hasRoute) return
                  setMissionTab(v as 'gantt' | 'orders' | 'missionSites' | 'routes' | 'vehicles')
                  setSelectedNodeId(null)
                  setSelectedRouteId(null)
                }}
                className='flex-1'
                style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
              >
                <Flex align='center' justify='between' className='px-4 pt-3'>
                  <Tabs.List size='2' style={!hasRoute ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                    <Tabs.Trigger value='gantt'>
                      <MapIcon size={16} className='mr-1' />
                      Itinerary
                    </Tabs.Trigger>
                    <Tabs.Trigger value='orders'>
                      <MapPin size={16} className='mr-1' />
                      Orders ({orderNodes.length})
                    </Tabs.Trigger>
                    <Tabs.Trigger value='missionSites'>
                      <Layers size={16} className='mr-1' />
                      Mission Sites ({missionSites.length})
                    </Tabs.Trigger>
                    <Tabs.Trigger value='routes'>
                      <Route size={16} className='mr-1' />
                      Routes ({routeDetails.length})
                    </Tabs.Trigger>
                    <Tabs.Trigger value='vehicles'>
                      <Truck size={16} className='mr-1' />
                      Vehicles ({vehicleDetails.length})
                    </Tabs.Trigger>
                  </Tabs.List>
                  {missionTab !== 'gantt' && (
                    <Flex gap='3' align='center'>
                      {(missionTab === 'orders' || missionTab === 'missionSites') && (
                        <IconButton
                          size='1'
                          variant='ghost'
                          color={globalDisplayMode === 'address' ? 'blue' : 'gray'}
                          onClick={toggleGlobalDisplayMode}
                          title={globalDisplayMode === 'coords' ? 'Show addresses' : 'Show coordinates'}
                          style={{ cursor: 'pointer' }}
                        >
                          {globalDisplayMode === 'coords' ? <MapPinned size={14} /> : <Hash size={14} />}
                        </IconButton>
                      )}
                      <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
                    </Flex>
                  )}
                </Flex>

                {/* Tab 1: Itinerary */}
                <Tabs.Content value='gantt' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                  <GanttChart
                    data={ganttData}
                    state={ganttState}
                    currentTime={missionElapsedTime}
                    onCreatePlan={() => setIsFlightPlannerMode(true)}
                    onLoadPlan={() => fileInputRef.current?.click()}
                    vehicleFilter={vehicleFilter}
                    onVehicleFilterChange={setVehicleFilter}
                    onStopClick={stop => {
                      if (stop.nodeId) {
                        setSelectedNodeId(selectedNodeId === stop.nodeId ? null : stop.nodeId)
                        setSelectedRouteId(null)
                      }
                    }}
                    onStopDoubleClick={stop => {
                      if (stop.nodeId) {
                        setSelectedNodeId(stop.nodeId)
                        setSelectedRouteId(null)
                        const node = missionConfig.nodes.find(n => n.id === stop.nodeId)
                        if (node) {
                          setMissionTab(node.type === 'order' ? 'orders' : 'missionSites')
                        }
                      }
                    }}
                    onVehicleClick={vehicle => {
                      const routeId = vehicle.type === 'truck' ? 'truck' : vehicle.id
                      setSelectedRouteId(selectedRouteId === routeId ? null : routeId)
                      setSelectedNodeId(null)
                    }}
                    onVehicleDoubleClick={vehicle => {
                      const routeId = vehicle.type === 'truck' ? 'truck' : vehicle.id
                      setSelectedRouteId(routeId)
                      setSelectedNodeId(null)
                      setMissionTab('routes')
                    }}
                  />
                </Tabs.Content>

                {/* Tab 2: Orders */}
                <Tabs.Content value='orders' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                  {viewMode === 'table' ? (
                    <OrdersTable
                      orders={orderNodes}
                      orderDeliveryMap={orderDeliveryMap}
                      orderEtaMap={orderEtaMap}
                      displayMode={globalDisplayMode}
                      geocodingLoading={geocodingLoading}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={id => setSelectedNodeId(id)}
                      getDisplayMode={getDisplayMode}
                      onToggleDisplayMode={toggleCardDisplayMode}
                    />
                  ) : (
                    <ScrollArea style={{ height: '100%' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                          gap: '6px',
                          padding: '16px',
                          paddingRight: '24px',
                        }}
                      >
                        {orderNodes.map(order => {
                          const vehicle = orderDeliveryMap.get(order.id) || 'unrouted'
                          const accentColor = vehicle === 'drone' ? '#facc15' : vehicle === 'truck' ? '#3b82f6' : '#d1d5db'
                          const displayMode = getDisplayMode(order.id)
                          const isLoading = geocodingLoading.get(order.id) || false
                          const etaInfo = orderEtaMap.get(order.id)
                          return (
                            <Card
                              key={order.id}
                              data-node-id={order.id}
                              className='p-0'
                              style={{
                                border: selectedNodeId === order.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                backgroundColor: selectedNodeId === order.id ? '#eff6ff' : undefined,
                                overflow: 'hidden',
                                cursor: 'pointer',
                              }}
                              onClick={() => setSelectedNodeId(selectedNodeId === order.id ? null : order.id)}
                            >
                              <Flex>
                                <div
                                  style={{ width: '3px', minHeight: '100%', backgroundColor: accentColor, flexShrink: 0 }}
                                />
                                <Box style={{ padding: '8px 10px', flex: 1 }}>
                                  <Flex justify='between' align='center' style={{ marginBottom: '4px' }}>
                                    <Flex align='center' gap='2'>
                                      <MapPin
                                        size={12}
                                        style={{ color: accentColor === '#d1d5db' ? '#9ca3af' : accentColor, flexShrink: 0 }}
                                      />
                                      <Text size='1' weight='bold'>
                                        Order {order.orderId || '?'}
                                      </Text>
                                    </Flex>
                                    <IconButton
                                      size='1'
                                      variant='ghost'
                                      color={displayMode === 'address' ? 'blue' : 'gray'}
                                      onClick={() => toggleCardDisplayMode(order.id, order)}
                                      title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                      style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                    >
                                      {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                    </IconButton>
                                  </Flex>
                                  <Text size='1' color='gray' style={{ display: 'block', marginBottom: '4px' }}>
                                    {displayMode === 'coords'
                                      ? `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
                                      : isLoading
                                        ? 'Loading address...'
                                        : order.address || `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`}
                                  </Text>
                                  {etaInfo && (
                                    <Flex gap='3' style={{ marginBottom: '4px' }}>
                                      <Flex align='center' gap='1'>
                                        <Clock size={10} style={{ color: '#6b7280' }} />
                                        <Text size='1' color='gray'>
                                          ETA:{' '}
                                          <span style={{ fontWeight: 500, color: '#374151' }}>
                                            {formatDurationTimeline(etaInfo.eta)}
                                          </span>
                                        </Text>
                                      </Flex>
                                      {etaInfo.distance > 0 && (
                                        <Flex align='center' gap='1'>
                                          <Route size={10} style={{ color: '#6b7280' }} />
                                          <Text size='1' color='gray'>
                                            Dist:{' '}
                                            <span style={{ fontWeight: 500, color: '#374151' }}>
                                              {formatDistanceTimeline(etaInfo.distance)}
                                            </span>
                                          </Text>
                                        </Flex>
                                      )}
                                    </Flex>
                                  )}
                                  {vehicle !== 'unrouted' ? (
                                    <Badge
                                      size='1'
                                      variant='soft'
                                      style={{
                                        backgroundColor: vehicle === 'drone' ? '#fef9c3' : '#dbeafe',
                                        color: vehicle === 'drone' ? '#a16207' : '#1d4ed8',
                                      }}
                                    >
                                      <Flex align='center' gap='1'>
                                        {vehicle === 'drone' ? <Drone size={10} /> : <Truck size={10} />}
                                        Delivered by {vehicle === 'drone' ? 'Drone' : 'Truck'}
                                      </Flex>
                                    </Badge>
                                  ) : (
                                    <Badge size='1' variant='soft' color='gray'>
                                      Unrouted
                                    </Badge>
                                  )}
                                </Box>
                              </Flex>
                            </Card>
                          )
                        })}
                        {orderNodes.length === 0 && (
                          <Box className='text-center p-6 bg-gray-50 rounded' style={{ gridColumn: '1 / -1' }}>
                            <Text size='2' color='gray'>
                              No orders added yet.
                            </Text>
                          </Box>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </Tabs.Content>

                {/* Tab 3: Mission Sites */}
                <Tabs.Content value='missionSites' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                  {viewMode === 'table' ? (
                    <MissionSitesTable
                      nodes={missionSites}
                      displayMode={globalDisplayMode}
                      geocodingLoading={geocodingLoading}
                      nodeEtaMap={nodeEtaMap}
                      nodeEventCountMap={nodeEventCountMap}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={id => setSelectedNodeId(id)}
                      getDisplayMode={getDisplayMode}
                      onToggleDisplayMode={toggleCardDisplayMode}
                    />
                  ) : (
                    <ScrollArea style={{ height: '100%' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                          gap: '6px',
                          padding: '16px',
                          paddingRight: '24px',
                        }}
                      >
                        {missionSites.map(node => {
                          const nodeColor =
                            node.type === 'depot'
                              ? '#3b82f6'
                              : node.type === 'station'
                                ? '#f97316'
                                : node.type === 'hazard'
                                  ? '#ef4444'
                                  : '#8b5cf6'
                          const displayMode = getDisplayMode(node.id)
                          const isLoading = geocodingLoading.get(node.id) || false
                          const etaInfo = nodeEtaMap.get(node.id)
                          const eventCount = nodeEventCountMap.get(node.id) || 0
                          const typeNum = nodeTypeNumberMap.get(node.id) || ''
                          return (
                            <Card
                              key={node.id}
                              data-node-id={node.id}
                              className='p-0'
                              style={{
                                border: selectedNodeId === node.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                backgroundColor: selectedNodeId === node.id ? '#eff6ff' : undefined,
                                overflow: 'hidden',
                                cursor: 'pointer',
                              }}
                              onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                            >
                              <Flex>
                                <div
                                  style={{ width: '3px', minHeight: '100%', backgroundColor: nodeColor, flexShrink: 0 }}
                                />
                                <Box style={{ padding: '8px 10px', flex: 1 }}>
                                  <Flex justify='between' align='start' style={{ marginBottom: '4px' }}>
                                    <Flex align='center' gap='1'>
                                      {node.type === 'depot' ? (
                                        <House size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                      ) : node.type === 'station' ? (
                                        <Zap size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                      ) : node.type === 'hazard' ? (
                                        <AlertTriangle size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                      ) : (
                                        <MapPin size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                      )}
                                      <Text size='1' weight='bold' style={{ whiteSpace: 'nowrap' }}>
                                        Site ID: {node.siteId || '?'}
                                      </Text>
                                      <Text size='1' color='gray'>
                                        -
                                      </Text>
                                      <Text size='1' weight='medium' style={{ color: nodeColor, whiteSpace: 'nowrap' }}>
                                        {node.type.charAt(0).toUpperCase() + node.type.slice(1)} {typeNum}
                                      </Text>
                                    </Flex>
                                    <Flex align='center' gap='1'>
                                      {node.type === 'hazard' && node.severity && (
                                        <Badge size='1' variant='soft' color={getHazardColor(node.severity)}>
                                          {node.severity}
                                        </Badge>
                                      )}
                                      <IconButton
                                        size='1'
                                        variant='ghost'
                                        color={displayMode === 'address' ? 'blue' : 'gray'}
                                        onClick={e => {
                                          e.stopPropagation()
                                          toggleCardDisplayMode(node.id, node)
                                        }}
                                        title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                        style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                      >
                                        {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                      </IconButton>
                                    </Flex>
                                  </Flex>
                                  <Text size='1' color='gray' style={{ display: 'block', marginBottom: '4px' }}>
                                    {displayMode === 'coords'
                                      ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                      : isLoading
                                        ? 'Loading address...'
                                        : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`}
                                  </Text>
                                  <Flex gap='3' align='center'>
                                    {etaInfo ? (
                                      <>
                                        <Text size='1' color='gray'>
                                          Dist:{' '}
                                          <span style={{ fontWeight: 500, color: '#374151' }}>
                                            {formatDistanceTimeline(etaInfo.distance)}
                                          </span>
                                        </Text>
                                        <Text size='1' color='gray'>
                                          ETA:{' '}
                                          <span style={{ fontWeight: 500, color: '#374151' }}>
                                            {formatDurationTimeline(etaInfo.eta)}
                                          </span>
                                        </Text>
                                      </>
                                    ) : (
                                      <Text size='1' color='gray'>
                                        Dist: <span style={{ color: '#9ca3af' }}>--</span>
                                      </Text>
                                    )}
                                    {eventCount > 0 && (
                                      <Text size='1' color='gray'>
                                        Events: <span style={{ fontWeight: 500, color: '#374151' }}>{eventCount}</span>
                                      </Text>
                                    )}
                                  </Flex>
                                </Box>
                              </Flex>
                            </Card>
                          )
                        })}
                        {missionSites.length === 0 && (
                          <Box className='text-center p-6 bg-gray-50 rounded' style={{ gridColumn: '1 / -1' }}>
                            <Text size='2' color='gray'>
                              No mission sites (depots, stations, waypoints, hazards) defined.
                            </Text>
                          </Box>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </Tabs.Content>

                {/* Tab 4: Routes */}
                <Tabs.Content value='routes' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                  {viewMode === 'table' ? (
                    <RoutesTable
                      routes={routeDetails}
                      selectedRouteId={selectedRouteId}
                      onSelectRoute={setSelectedRouteId}
                    />
                  ) : (
                    <RoutesTab routes={routeDetails} selectedRouteId={selectedRouteId} onSelectRoute={setSelectedRouteId} />
                  )}
                </Tabs.Content>

                {/* Tab 5: Vehicles */}
                <Tabs.Content value='vehicles' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                  {viewMode === 'table' ? (
                    <VehiclesTable
                      vehicles={vehicleDetails}
                      selectedRouteId={selectedRouteId}
                      onSelectRoute={setSelectedRouteId}
                    />
                  ) : (
                    <VehiclesTab
                      vehicles={vehicleDetails}
                      selectedRouteId={selectedRouteId}
                      onSelectRoute={setSelectedRouteId}
                    />
                  )}
                </Tabs.Content>
              </Tabs.Root>
            </Flex>
          </Card>
        </div>
        <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} className='hidden' />
        <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
        <ToastUI />
      </>
    )
  }

  // Default Mission Management Mode (not launched)
  return (
    <>
      <div
        className='flight-planner-bottom'
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
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
          }}
          onMouseLeave={e => {
            if (!isDragging) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        />
        <Card className='h-full rounded-none shadow-xl' style={{ height: '100%' }}>
          <Flex direction='column' className='h-full'>
            {/* Header */}
            <Flex
              align='center'
              className='p-4 border-b panel-header'
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                gap: 'var(--panel-header-gap)',
                paddingTop: '24px',
                flexWrap: 'wrap',
                rowGap: '6px',
                position: 'relative',
                paddingRight: '48px',
              }}
            >
              {/* Mode label + Mission name + status badges — fixed width so right side stays put */}
              <Flex
                align='center'
                gap='2'
                style={{
                  width: 'var(--panel-header-name-width)',
                  minWidth: '140px',
                  flexShrink: 1,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Text
                  size='1'
                  weight='medium'
                  style={{
                    position: 'absolute',
                    top: '-16px',
                    left: 0,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '10px',
                  }}
                >
                  Mission Control
                </Text>
                <TowerControl size={16} style={{ flexShrink: 0 }} />
                <Text size='2' weight='bold' style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {missionConfig.missionName || 'Untitled Mission'}
                </Text>
                <div
                  className='badge-scroll'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    minWidth: 0,
                    flexShrink: 1,
                  }}
                >
                  <Badge size='1' style={{ fontSize: '10px', flexShrink: 0 }} color={getStatusColor(missionStatus)}>
                    {missionStatus}
                  </Badge>
                  {!missionLaunched && (
                    <>
                      <Badge
                        size='1'
                        style={{ fontSize: '10px', flexShrink: 0 }}
                        color={missionConfig.nodes.length > 0 ? 'green' : 'gray'}
                        variant={missionConfig.nodes.length > 0 ? 'soft' : 'outline'}
                      >
                        {missionConfig.nodes.length > 0 ? 'Plan Loaded' : 'No Plan'}
                      </Badge>
                      <Badge
                        size='1'
                        style={{ fontSize: '10px', flexShrink: 0 }}
                        color={hasRoute ? 'green' : missionConfig.nodes.length > 0 ? 'orange' : 'gray'}
                        variant={hasRoute ? 'soft' : 'outline'}
                      >
                        {hasRoute ? 'Route Ready' : missionConfig.nodes.length > 0 ? 'Route Required' : 'No Route'}
                      </Badge>
                    </>
                  )}
                </div>
              </Flex>

              <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

              <DateTimeDisplay />

              {/* Stats */}
              <Flex
                gap='3'
                align='center'
                className='text-gray-600'
                style={{ flexShrink: 1, flexWrap: 'wrap', minWidth: 0 }}
              >
                <Flex gap='1' align='center' title='Time Elapsed / Estimated'>
                  <Clock size={16} />
                  <Text size='2'>00:00/{estimatedTime}</Text>
                </Flex>
                <Flex gap='1' align='center' title='Deliveries'>
                  <Package size={16} />
                  <Text size='2'>
                    {deliveredPackages}/{hasRoute ? totalOrders : '-'}
                  </Text>
                </Flex>
                <Flex gap='1' align='center' title='Distance Covered / Total'>
                  <Route size={16} />
                  <Text size='2'>
                    {coveredDistance}/{totalDistance}
                  </Text>
                </Flex>
              </Flex>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Center: Flight control buttons */}
              <Flex gap='2' align='center' style={{ flexShrink: 0 }}>
                <Button
                  size='2'
                  color='green'
                  disabled={
                    !missionConfig.nodes.length ||
                    (truckRoute.length === 0 && droneRoutes.length === 0) ||
                    hasUnroutedNodes ||
                    missionLaunched
                  }
                  onClick={launchMission}
                  title={hasUnroutedNodes ? 'Unrouted points exist' : 'Launch Mission'}
                >
                  <Play size={14} /> Launch
                </Button>
                <Button size='2' color='orange' variant='soft' disabled={!missionLaunched} onClick={pauseMission}>
                  <Pause size={14} /> {missionPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button size='2' color='red' variant='soft' disabled={!missionLaunched} onClick={stopMission}>
                  <Square size={14} /> Stop
                </Button>
              </Flex>

              <Box className='w-px h-6 bg-gray-300' style={{ flexShrink: 0 }} />

              {/* Right: Make/Edit + Load buttons next to collapse */}
              <Flex
                gap='2'
                align='center'
                style={{ flexShrink: 1, width: 'var(--panel-header-actions-width)', minWidth: '120px' }}
              >
                <Button
                  size='2'
                  style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                  onClick={() => setIsFlightPlannerMode(true)}
                  disabled={missionLaunched}
                >
                  {missionConfig.nodes.length > 0 ? (
                    <>
                      <Settings size={14} /> Edit Plan
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Make Plan
                    </>
                  )}
                </Button>
                <Button
                  size='2'
                  variant='soft'
                  style={{ flex: 1, fontSize: 'clamp(10px, 1.2vw, 14px)', whiteSpace: 'nowrap', overflow: 'hidden' }}
                  onClick={handleImport}
                  disabled={missionLaunched}
                >
                  <FolderOpen size={14} /> Load Plan
                </Button>
              </Flex>

              <IconButton
                size='3'
                variant='ghost'
                onClick={() => setBottomPanelExpanded(false)}
                style={{ cursor: 'pointer', position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <ChevronDown size={24} />
              </IconButton>
            </Flex>

            {/* Stats Bar */}
            <MissionStatsBar
              missionConfig={missionConfig}
              missionLaunched={missionLaunched}
              fleetMode={fleetMode}
              truckCount={truckCount}
              droneCount={droneCount}
              hasRoute={hasRoute}
              timelineSummary={hasRoute ? timelineResult.summary : undefined}
              droneDeliveries={droneDeliveryCount}
              truckDeliveries={truckDeliveryCount}
              truckRoutePoints={truckRoute.length}
              droneSorties={droneRoutes.length}
            />

            {/* Tabs */}
            <Tabs.Root
              value={hasRoute ? missionTab : 'gantt'}
              onValueChange={(v: string) => {
                if (!hasRoute) return
                setMissionTab(v as 'gantt' | 'orders' | 'missionSites' | 'routes' | 'vehicles')
                setSelectedNodeId(null)
                setSelectedRouteId(null)
              }}
              className='flex-1'
              style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
              <Flex align='center' justify='between' className='px-4 pt-3'>
                <Tabs.List size='2' style={!hasRoute ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                  <Tabs.Trigger value='gantt'>
                    <MapIcon size={16} className='mr-1' />
                    Itinerary
                  </Tabs.Trigger>
                  <Tabs.Trigger value='orders'>
                    <MapPin size={16} className='mr-1' />
                    Orders ({orderNodes.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value='missionSites'>
                    <Layers size={16} className='mr-1' />
                    Mission Sites ({missionSites.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value='routes'>
                    <Route size={16} className='mr-1' />
                    Routes ({routeDetails.length})
                  </Tabs.Trigger>
                  <Tabs.Trigger value='vehicles'>
                    <Truck size={16} className='mr-1' />
                    Vehicles ({vehicleDetails.length})
                  </Tabs.Trigger>
                </Tabs.List>
                {missionTab !== 'gantt' && (
                  <Flex gap='3' align='center'>
                    {(missionTab === 'orders' || missionTab === 'missionSites') && (
                      <IconButton
                        size='1'
                        variant='ghost'
                        color={globalDisplayMode === 'address' ? 'blue' : 'gray'}
                        onClick={toggleGlobalDisplayMode}
                        title={globalDisplayMode === 'coords' ? 'Show addresses' : 'Show coordinates'}
                        style={{ cursor: 'pointer' }}
                      >
                        {globalDisplayMode === 'coords' ? <MapPinned size={14} /> : <Hash size={14} />}
                      </IconButton>
                    )}
                    <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
                  </Flex>
                )}
              </Flex>

              {/* Tab 1: Itinerary */}
              <Tabs.Content value='gantt' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                <GanttChart
                  data={ganttData}
                  state={ganttState}
                  currentTime={missionElapsedTime}
                  onCreatePlan={() => setIsFlightPlannerMode(true)}
                  onLoadPlan={() => fileInputRef.current?.click()}
                  vehicleFilter={vehicleFilter}
                  onVehicleFilterChange={setVehicleFilter}
                  onStopClick={stop => {
                    if (stop.nodeId) {
                      setSelectedNodeId(selectedNodeId === stop.nodeId ? null : stop.nodeId)
                      setSelectedRouteId(null)
                    }
                  }}
                  onStopDoubleClick={stop => {
                    if (stop.nodeId) {
                      setSelectedNodeId(stop.nodeId)
                      setSelectedRouteId(null)
                      const node = missionConfig.nodes.find(n => n.id === stop.nodeId)
                      if (node) {
                        setMissionTab(node.type === 'order' ? 'orders' : 'missionSites')
                      }
                    }
                  }}
                  onVehicleClick={vehicle => {
                    const routeId = vehicle.type === 'truck' ? 'truck' : vehicle.id
                    setSelectedRouteId(selectedRouteId === routeId ? null : routeId)
                    setSelectedNodeId(null)
                  }}
                  onVehicleDoubleClick={vehicle => {
                    const routeId = vehicle.type === 'truck' ? 'truck' : vehicle.id
                    setSelectedRouteId(routeId)
                    setSelectedNodeId(null)
                    setMissionTab('routes')
                  }}
                />
              </Tabs.Content>

              {/* Tab 2: Orders */}
              <Tabs.Content value='orders' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                {viewMode === 'table' ? (
                  <OrdersTable
                    orders={orderNodes}
                    orderDeliveryMap={orderDeliveryMap}
                    orderEtaMap={orderEtaMap}
                    displayMode={globalDisplayMode}
                    geocodingLoading={geocodingLoading}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={id => setSelectedNodeId(id)}
                    getDisplayMode={getDisplayMode}
                    onToggleDisplayMode={toggleCardDisplayMode}
                  />
                ) : (
                  <ScrollArea style={{ height: '100%' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '8px',
                        padding: '16px',
                        paddingRight: '24px',
                      }}
                    >
                      {orderNodes.map(order => {
                        const vehicle = orderDeliveryMap.get(order.id) || 'unrouted'
                        const accentColor = vehicle === 'drone' ? '#facc15' : vehicle === 'truck' ? '#3b82f6' : '#d1d5db'
                        const displayMode = getDisplayMode(order.id)
                        const isLoading = geocodingLoading.get(order.id) || false
                        const etaInfo = orderEtaMap.get(order.id)
                        return (
                          <Card
                            key={order.id}
                            data-node-id={order.id}
                            className='p-0'
                            style={{
                              border: selectedNodeId === order.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                              backgroundColor: selectedNodeId === order.id ? '#eff6ff' : undefined,
                              overflow: 'hidden',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedNodeId(selectedNodeId === order.id ? null : order.id)}
                          >
                            <Flex>
                              <div
                                style={{ width: '3px', minHeight: '100%', backgroundColor: accentColor, flexShrink: 0 }}
                              />
                              <Box style={{ padding: '8px 10px', flex: 1 }}>
                                <Flex justify='between' align='center' style={{ marginBottom: '4px' }}>
                                  <Flex align='center' gap='2'>
                                    <MapPin
                                      size={12}
                                      style={{ color: accentColor === '#d1d5db' ? '#9ca3af' : accentColor, flexShrink: 0 }}
                                    />
                                    <Text size='1' weight='bold'>
                                      Order {order.orderId || '?'}
                                    </Text>
                                  </Flex>
                                  <IconButton
                                    size='1'
                                    variant='ghost'
                                    color={displayMode === 'address' ? 'blue' : 'gray'}
                                    onClick={() => toggleCardDisplayMode(order.id, order)}
                                    title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                    style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                  >
                                    {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                  </IconButton>
                                </Flex>
                                <Text size='1' color='gray' style={{ display: 'block', marginBottom: '4px' }}>
                                  {displayMode === 'coords'
                                    ? `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`
                                    : isLoading
                                      ? 'Loading address...'
                                      : order.address || `${order.lat.toFixed(6)}, ${order.lng.toFixed(6)}`}
                                </Text>
                                {etaInfo && (
                                  <Flex gap='3' style={{ marginBottom: '4px' }}>
                                    <Flex align='center' gap='1'>
                                      <Clock size={10} style={{ color: '#6b7280' }} />
                                      <Text size='1' color='gray'>
                                        ETA:{' '}
                                        <span style={{ fontWeight: 500, color: '#374151' }}>
                                          {formatDurationTimeline(etaInfo.eta)}
                                        </span>
                                      </Text>
                                    </Flex>
                                    {etaInfo.distance > 0 && (
                                      <Flex align='center' gap='1'>
                                        <Route size={10} style={{ color: '#6b7280' }} />
                                        <Text size='1' color='gray'>
                                          Dist:{' '}
                                          <span style={{ fontWeight: 500, color: '#374151' }}>
                                            {formatDistanceTimeline(etaInfo.distance)}
                                          </span>
                                        </Text>
                                      </Flex>
                                    )}
                                  </Flex>
                                )}
                                {vehicle !== 'unrouted' ? (
                                  <Badge
                                    size='1'
                                    variant='soft'
                                    style={{
                                      backgroundColor: vehicle === 'drone' ? '#fef9c3' : '#dbeafe',
                                      color: vehicle === 'drone' ? '#a16207' : '#1d4ed8',
                                    }}
                                  >
                                    <Flex align='center' gap='1'>
                                      {vehicle === 'drone' ? <Drone size={10} /> : <Truck size={10} />}
                                      Delivered by {vehicle === 'drone' ? 'Drone' : 'Truck'}
                                    </Flex>
                                  </Badge>
                                ) : (
                                  <Badge size='1' variant='soft' color='gray'>
                                    Unrouted
                                  </Badge>
                                )}
                              </Box>
                            </Flex>
                          </Card>
                        )
                      })}
                      {orderNodes.length === 0 && (
                        <Box className='text-center p-6 bg-gray-50 rounded' style={{ gridColumn: '1 / -1' }}>
                          <Text size='2' color='gray'>
                            No orders added. Create or load a flight plan to add orders.
                          </Text>
                        </Box>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </Tabs.Content>

              {/* Tab 3: Mission Sites */}
              <Tabs.Content value='missionSites' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                {viewMode === 'table' ? (
                  <MissionSitesTable
                    nodes={missionSites}
                    displayMode={globalDisplayMode}
                    geocodingLoading={geocodingLoading}
                    nodeEtaMap={nodeEtaMap}
                    nodeEventCountMap={nodeEventCountMap}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={id => setSelectedNodeId(id)}
                    getDisplayMode={getDisplayMode}
                    onToggleDisplayMode={toggleCardDisplayMode}
                  />
                ) : (
                  <ScrollArea style={{ height: '100%' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '8px',
                        padding: '16px',
                        paddingRight: '24px',
                      }}
                    >
                      {missionSites.map(node => {
                        const nodeColor =
                          node.type === 'depot'
                            ? '#3b82f6'
                            : node.type === 'station'
                              ? '#f97316'
                              : node.type === 'hazard'
                                ? '#ef4444'
                                : '#8b5cf6'
                        const displayMode = getDisplayMode(node.id)
                        const isLoading = geocodingLoading.get(node.id) || false
                        const etaInfo = nodeEtaMap.get(node.id)
                        const eventCount = nodeEventCountMap.get(node.id) || 0
                        const typeNum = nodeTypeNumberMap.get(node.id) || ''
                        return (
                          <Card
                            key={node.id}
                            data-node-id={node.id}
                            className='p-0'
                            style={{
                              border: selectedNodeId === node.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                              backgroundColor: selectedNodeId === node.id ? '#eff6ff' : undefined,
                              overflow: 'hidden',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                          >
                            <Flex>
                              <div style={{ width: '3px', minHeight: '100%', backgroundColor: nodeColor, flexShrink: 0 }} />
                              <Box style={{ padding: '8px 10px', flex: 1 }}>
                                <Flex justify='between' align='start' style={{ marginBottom: '4px' }}>
                                  <Flex align='center' gap='1'>
                                    {node.type === 'depot' ? (
                                      <House size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                    ) : node.type === 'station' ? (
                                      <Zap size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                    ) : node.type === 'hazard' ? (
                                      <AlertTriangle size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                    ) : (
                                      <MapPin size={12} style={{ color: nodeColor, flexShrink: 0 }} />
                                    )}
                                    <Text size='1' weight='bold' style={{ whiteSpace: 'nowrap' }}>
                                      Site ID: {node.siteId || '?'}
                                    </Text>
                                    <Text size='1' color='gray'>
                                      -
                                    </Text>
                                    <Text size='1' weight='medium' style={{ color: nodeColor, whiteSpace: 'nowrap' }}>
                                      {node.type.charAt(0).toUpperCase() + node.type.slice(1)} {typeNum}
                                    </Text>
                                  </Flex>
                                  <Flex align='center' gap='1'>
                                    {node.type === 'hazard' && node.severity && (
                                      <Badge size='1' variant='soft' color={getHazardColor(node.severity)}>
                                        {node.severity}
                                      </Badge>
                                    )}
                                    <IconButton
                                      size='1'
                                      variant='ghost'
                                      color={displayMode === 'address' ? 'blue' : 'gray'}
                                      onClick={e => {
                                        e.stopPropagation()
                                        toggleCardDisplayMode(node.id, node)
                                      }}
                                      title={displayMode === 'coords' ? 'Show address' : 'Show coordinates'}
                                      style={{ minWidth: '18px', minHeight: '18px', padding: '1px' }}
                                    >
                                      {displayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                                    </IconButton>
                                  </Flex>
                                </Flex>
                                <Text size='1' color='gray' style={{ display: 'block', marginBottom: '4px' }}>
                                  {displayMode === 'coords'
                                    ? `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`
                                    : isLoading
                                      ? 'Loading address...'
                                      : node.address || `${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}`}
                                </Text>
                                <Flex gap='3' align='center'>
                                  {etaInfo ? (
                                    <>
                                      <Text size='1' color='gray'>
                                        Dist:{' '}
                                        <span style={{ fontWeight: 500, color: '#374151' }}>
                                          {formatDistanceTimeline(etaInfo.distance)}
                                        </span>
                                      </Text>
                                      <Text size='1' color='gray'>
                                        ETA:{' '}
                                        <span style={{ fontWeight: 500, color: '#374151' }}>
                                          {formatDurationTimeline(etaInfo.eta)}
                                        </span>
                                      </Text>
                                    </>
                                  ) : (
                                    <Text size='1' color='gray'>
                                      Dist: <span style={{ color: '#9ca3af' }}>--</span>
                                    </Text>
                                  )}
                                  {eventCount > 0 && (
                                    <Text size='1' color='gray'>
                                      Events: <span style={{ fontWeight: 500, color: '#374151' }}>{eventCount}</span>
                                    </Text>
                                  )}
                                </Flex>
                              </Box>
                            </Flex>
                          </Card>
                        )
                      })}
                      {missionSites.length === 0 && (
                        <Box className='text-center p-6 bg-gray-50 rounded' style={{ gridColumn: '1 / -1' }}>
                          <Text size='2' color='gray'>
                            No mission sites defined. Create or load a flight plan.
                          </Text>
                        </Box>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </Tabs.Content>

              {/* Tab 4: Routes */}
              <Tabs.Content value='routes' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                {viewMode === 'table' ? (
                  <RoutesTable routes={routeDetails} selectedRouteId={selectedRouteId} onSelectRoute={setSelectedRouteId} />
                ) : (
                  <RoutesTab routes={routeDetails} selectedRouteId={selectedRouteId} onSelectRoute={setSelectedRouteId} />
                )}
              </Tabs.Content>

              {/* Tab 5: Vehicles */}
              <Tabs.Content value='vehicles' className='flex-1' style={{ minHeight: 0, overflow: 'hidden' }}>
                {viewMode === 'table' ? (
                  <VehiclesTable
                    vehicles={vehicleDetails}
                    selectedRouteId={selectedRouteId}
                    onSelectRoute={setSelectedRouteId}
                  />
                ) : (
                  <VehiclesTab
                    vehicles={vehicleDetails}
                    selectedRouteId={selectedRouteId}
                    onSelectRoute={setSelectedRouteId}
                  />
                )}
              </Tabs.Content>
            </Tabs.Root>
          </Flex>
        </Card>
      </div>
      <input ref={fileInputRef} type='file' accept='.json' onChange={handleFileChange} className='hidden' />
      <input ref={csvInputRef} type='file' accept='.csv' onChange={handleCSVImport} className='hidden' />
      <ToastUI />
    </>
  )
}

// Mission Stats Bar Component
function MissionStatsBar({
  missionConfig,
  missionLaunched,
  elapsedTime = '00:00',
  fleetMode = 'truck-drone',
  truckCount = 1,
  droneCount = 2,
  hasRoute = false,
  timelineSummary,
  droneDeliveries: droneDeliveriesProp,
  truckDeliveries: truckDeliveriesProp,
  truckRoutePoints,
  droneSorties,
  isFlightPlannerMode,
}: {
  missionConfig: {
    nodes: { type: string }[]
    algorithm: string
    estimatedDuration?: number
  }
  missionLaunched?: boolean
  elapsedTime?: string
  fleetMode?: 'truck-drone' | 'truck-only' | 'drones-only'
  truckCount?: number
  droneCount?: number
  hasRoute?: boolean
  timelineSummary?: TimelineSummary
  droneDeliveries?: number
  truckDeliveries?: number
  truckRoutePoints?: number
  droneSorties?: number
  isFlightPlannerMode?: boolean
}) {
  const orderCount = missionConfig.nodes.filter(n => n.type === 'order').length
  const depotCount = missionConfig.nodes.filter(n => n.type === 'depot').length
  const stationCount = missionConfig.nodes.filter(n => n.type === 'station').length
  const hazardCount = missionConfig.nodes.filter(n => n.type === 'hazard').length

  const totalNodes = missionConfig.nodes.length
  const hasTruck = fleetMode === 'truck-drone' || fleetMode === 'truck-only'
  const hasDrones = fleetMode === 'truck-drone' || fleetMode === 'drones-only'

  return (
    <Flex
      gap='3'
      align='center'
      className='px-4 py-2 border-t'
      style={{ backgroundColor: 'rgba(249, 250, 251, 0.8)', flexWrap: 'wrap', rowGap: '4px', gap: 'var(--panel-stats-gap)' }}
    >
      <Text
        size='1'
        weight='bold'
        style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#3b82f6' }}
      >
        {isFlightPlannerMode ? 'Planner Mode' : 'Control Mode'}
      </Text>
      <Box className='w-px h-4 bg-gray-300' />
      <Flex gap='1' align='center' title='Total Mission Sites'>
        <MapPin size={14} className='text-gray-600' />
        <Text size='1' weight='medium'>
          {totalNodes}
        </Text>
      </Flex>
      <Box className='w-px h-4 bg-gray-300' />
      <Flex gap='1' align='center' title='Order Points'>
        <MapPin size={14} className='text-green-600' />
        <Text size='1' weight='medium'>
          {orderCount}
        </Text>
      </Flex>
      <Flex gap='1' align='center' title='Depots'>
        <House size={14} className='text-blue-600' />
        <Text size='1' weight='medium'>
          {depotCount}
        </Text>
      </Flex>
      <Flex gap='1' align='center' title='Charging Stations'>
        <Zap size={14} className='text-orange-500' />
        <Text size='1' weight='medium'>
          {stationCount}
        </Text>
      </Flex>
      <Flex gap='1' align='center' title='Hazard Zones'>
        <AlertTriangle size={14} className='text-red-500' />
        <Text size='1' weight='medium'>
          {hazardCount}
        </Text>
      </Flex>
      <Box className='w-px h-4 bg-gray-300' />
      {/* Fleet display */}
      <Flex
        gap='1'
        align='center'
        title={!hasRoute ? 'No route generated' : hasTruck ? `${truckCount} truck(s)` : 'Truck disabled'}
        style={{ opacity: !hasRoute || !hasTruck ? 0.35 : 1 }}
      >
        <Truck size={14} style={{ color: hasRoute && hasTruck ? '#374151' : '#9ca3af' }} />
        <Text size='1' weight='medium' style={{ color: hasRoute && hasTruck ? undefined : '#9ca3af' }}>
          {hasRoute && hasTruck ? truckCount : '-'}
        </Text>
      </Flex>
      <Flex
        gap='1'
        align='center'
        title={!hasRoute ? 'No route generated' : hasDrones ? `${droneCount} drone(s)` : 'Drones disabled'}
        style={{ opacity: !hasRoute || !hasDrones ? 0.35 : 1 }}
      >
        <Drone size={14} style={{ color: hasRoute && hasDrones ? '#3b82f6' : '#9ca3af' }} />
        <Text size='1' weight='medium' style={{ color: hasRoute && hasDrones ? undefined : '#9ca3af' }}>
          {hasRoute && hasDrones ? droneCount : '-'}
        </Text>
      </Flex>
      {/* Vehicle-specific stats from timeline summary */}
      {timelineSummary && (
        <>
          <Box className='w-px h-4 bg-gray-300' />
          <Flex gap='1' align='center' title='Total distance'>
            <Route size={12} className='text-gray-500' />
            <Text size='1' weight='medium'>
              {formatDistanceTimeline(timelineSummary.totalDistance)}
            </Text>
          </Flex>
          <Flex gap='1' align='center' title='Truck distance' style={{ opacity: hasTruck ? 1 : 0.35 }}>
            <Truck size={12} style={{ color: hasTruck ? '#374151' : '#9ca3af' }} />
            <Text size='1' weight='medium' style={{ color: hasTruck ? undefined : '#9ca3af' }}>
              {hasTruck ? formatDistanceTimeline(timelineSummary.truckDistance) : '--'}
            </Text>
          </Flex>
          <Flex gap='1' align='center' title='Drone distance' style={{ opacity: hasDrones ? 1 : 0.35 }}>
            <Drone size={12} style={{ color: hasDrones ? '#3b82f6' : '#9ca3af' }} />
            <Text size='1' weight='medium' style={{ color: hasDrones ? undefined : '#9ca3af' }}>
              {hasDrones ? formatDistanceTimeline(timelineSummary.droneDistance) : '--'}
            </Text>
          </Flex>
          <Flex gap='1' align='center' title='Routes (truck / drone)'>
            <Route size={12} className='text-gray-500' />
            <Flex
              gap='1'
              align='center'
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                padding: '1px 6px',
                backgroundColor: '#f8fafc',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hasTruck ? 1 : 0.35 }}>
                <Truck size={11} style={{ color: hasTruck ? '#374151' : '#9ca3af' }} />
                <Text size='1' weight='medium' style={{ color: hasTruck ? undefined : '#9ca3af' }}>
                  {hasTruck && truckRoutePoints ? 1 : 0}
                </Text>
                {truckRoutePoints != null && truckRoutePoints > 0 && (
                  <Text size='1' style={{ color: '#9ca3af', fontSize: '10px' }}>
                    ({truckRoutePoints} pts)
                  </Text>
                )}
              </span>
              <Text size='1' style={{ color: '#cbd5e1' }}>
                /
              </Text>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hasDrones ? 1 : 0.35 }}>
                <Drone size={11} style={{ color: hasDrones ? '#3b82f6' : '#9ca3af' }} />
                <Text size='1' weight='medium' style={{ color: hasDrones ? undefined : '#9ca3af' }}>
                  {hasDrones && droneSorties ? droneSorties : 0}
                </Text>
                {droneSorties != null && droneSorties > 0 && (
                  <Text size='1' style={{ color: '#9ca3af', fontSize: '10px' }}>
                    ({droneSorties} sorties)
                  </Text>
                )}
              </span>
            </Flex>
          </Flex>
          <Box className='w-px h-4 bg-gray-300' />
          <Flex gap='1' align='center' title='Deliveries (drone / truck)'>
            <Package size={12} className='text-gray-500' />
            <Flex
              gap='1'
              align='center'
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                padding: '1px 6px',
                backgroundColor: '#f8fafc',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hasDrones ? 1 : 0.35 }}>
                <Drone size={11} style={{ color: hasDrones ? '#3b82f6' : '#9ca3af' }} />
                <Text size='1' weight='medium' style={{ color: hasDrones ? undefined : '#9ca3af' }}>
                  {hasDrones ? (droneDeliveriesProp ?? timelineSummary.droneDeliveries) : '-'}
                </Text>
              </span>
              <Text size='1' style={{ color: '#cbd5e1' }}>
                /
              </Text>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hasTruck ? 1 : 0.35 }}>
                <Truck size={11} style={{ color: hasTruck ? '#374151' : '#9ca3af' }} />
                <Text size='1' weight='medium' style={{ color: hasTruck ? undefined : '#9ca3af' }}>
                  {hasTruck ? (truckDeliveriesProp ?? timelineSummary.truckDeliveries) : '-'}
                </Text>
              </span>
            </Flex>
          </Flex>
        </>
      )}
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
      <CheckCircle size={16} className='text-green-500' />
    ) : status === 'incomplete' ? (
      <AlertCircle size={16} className='text-red-500' />
    ) : (
      <Clock size={16} className='text-gray-400' />
    )

  return (
    <Flex gap='2' align='start'>
      {icon}
      <Box className='flex-1'>
        <Text size='2' weight='medium'>
          {label}
        </Text>
        <Text size='1' color='gray'>
          {detail}
        </Text>
      </Box>
    </Flex>
  )
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
