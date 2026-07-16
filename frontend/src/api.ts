// Client API centralisé. Même origine que le back (Caddy route /api -> backend),
// donc cookie de session via `credentials: 'include'`, pas de CORS.
import type {
  DaySummary,
  Entry,
  FoodHit,
  NewEntry,
  Settings,
  Summary,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* pas de corps JSON */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    req<{ ok: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => req<{ authenticated: boolean }>('/api/auth/me'),

  // Settings
  getSettings: () => req<Settings>('/api/settings'),
  putSettings: (patch: Partial<Settings>) =>
    req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  // Food
  searchFood: (q: string, page = 1) =>
    req<{ results: FoodHit[] }>(`/api/food/search?q=${encodeURIComponent(q)}&page=${page}`),
  barcode: (code: string) => req<FoodHit>(`/api/food/barcode/${encodeURIComponent(code)}`),

  // Entries
  createEntry: (entry: NewEntry) =>
    req<Entry>('/api/entries', { method: 'POST', body: JSON.stringify(entry) }),
  listEntries: (date?: string) =>
    req<{ date: string; entries: Entry[] }>(`/api/entries${date ? `?date=${date}` : ''}`),
  patchEntry: (id: number, patch: { name?: string; quantity?: number }) =>
    req<Entry>(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteEntry: (id: number) => req<void>(`/api/entries/${id}`, { method: 'DELETE' }),

  // Summary / history
  summaryToday: (date?: string) =>
    req<Summary>(`/api/summary/today${date ? `?date=${date}` : ''}`),
  history: () => req<DaySummary[]>('/api/history'),

  // Fitbit (stub V1)
  fitbitStatus: () => req<{ connected: boolean; available: boolean }>('/api/fitbit/status'),
}
