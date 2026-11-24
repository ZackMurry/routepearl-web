// Base URL of the routing backend (FastAPI server.py). Override with
// NEXT_PUBLIC_API_URL, e.g. NEXT_PUBLIC_API_URL=http://192.168.1.20:8000 or
// a relative '/api-proxy' when served behind a reverse proxy.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

export const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
