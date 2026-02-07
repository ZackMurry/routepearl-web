// Geocoding utility using OSM Nominatim (free, no API key)
// Rate-limited to 1 request/sec per Nominatim usage policy

export interface ForwardGeocodeResult {
  lat: number
  lng: number
  displayName: string
}

// ---------- Rate-limiting queue ----------

const requestQueue: Array<() => Promise<void>> = []
let isProcessing = false

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        resolve(await fn())
      } catch (err) {
        reject(err)
      }
    })
    processQueue()
  })
}

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return
  isProcessing = true
  const next = requestQueue.shift()!
  next().finally(() => {
    setTimeout(() => {
      isProcessing = false
      processQueue()
    }, 1050) // Slightly over 1s for safety
  })
}

// ---------- Cache ----------

const reverseCache = new Map<string, string>()
const forwardCache = new Map<string, ForwardGeocodeResult>()

function reverseCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`
}

// ---------- Public API ----------

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'RoutePearl/1.0'

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = reverseCacheKey(lat, lng)
  const cached = reverseCache.get(key)
  if (cached) return cached

  return enqueue(async () => {
    // Double-check cache (another call may have resolved while queued)
    const cached2 = reverseCache.get(key)
    if (cached2) return cached2

    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) {
      throw new Error(`Nominatim reverse geocode failed: ${res.status}`)
    }

    const data = await res.json()
    const displayName: string = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    const shortened = shortenAddress(displayName)

    reverseCache.set(key, shortened)
    return shortened
  })
}

export async function forwardGeocode(query: string): Promise<ForwardGeocodeResult | null> {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return null

  const cached = forwardCache.get(normalizedQuery)
  if (cached) return cached

  return enqueue(async () => {
    const cached2 = forwardCache.get(normalizedQuery)
    if (cached2) return cached2

    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!res.ok) {
      throw new Error(`Nominatim forward geocode failed: ${res.status}`)
    }

    const data = await res.json()
    if (!data || data.length === 0) return null

    const result: ForwardGeocodeResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: shortenAddress(data[0].display_name),
    }

    forwardCache.set(normalizedQuery, result)
    return result
  })
}

/** Pre-populate cache from saved mission data */
export function seedAddressCache(lat: number, lng: number, address: string): void {
  const key = reverseCacheKey(lat, lng)
  if (!reverseCache.has(key)) {
    reverseCache.set(key, address)
  }
}

// ---------- CSV Helpers ----------

/** Parse a single CSV line, respecting quoted fields (handles commas inside quotes) */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

/** Check if a string looks like a lat,lng coordinate pair */
export function isLatLng(value: string): boolean {
  const parts = value.split(',').map(s => s.trim())
  if (parts.length !== 2) return false
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/** Map CSV node-tag values to internal FlightNode types */
export function csvTagToNodeType(tag: string): 'customer' | 'depot' | 'station' | 'hazard' | null {
  const normalized = tag.trim().toLowerCase()
  switch (normalized) {
    case 'customer': return 'customer'
    case 'depot': return 'depot'
    case 'charging station': return 'station'
    case 'hazard': return 'hazard'
    default: return null
  }
}

/** Map internal FlightNode type to CSV node-tag */
export function nodeTypeToCsvTag(type: string): string | null {
  switch (type) {
    case 'customer': return 'customer'
    case 'depot': return 'depot'
    case 'station': return 'charging station'
    case 'hazard': return 'hazard'
    case 'waypoint': return null // waypoints not exported
    default: return null
  }
}

/** Quote a CSV field if it contains commas */
export function csvQuote(value: string): string {
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Shorten verbose Nominatim addresses to first 3 parts */
function shortenAddress(displayName: string): string {
  const parts = displayName.split(',').map(p => p.trim())
  if (parts.length >= 4) {
    return parts.slice(0, 3).join(', ')
  }
  return displayName
}
