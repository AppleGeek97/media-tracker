import type { ListType } from '../types'

const SYNC_STATE_KEY = 'media-logbook-sync-state'

export interface SyncState {
  lastSyncTime: string | null
  deviceId: string
}

export interface SyncResult {
  entries: any[]
  serverTime: string
  isNewData: boolean
  isInitial: boolean
}

export function getSyncState(): SyncState {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) return JSON.parse(stored)

  const deviceId = 'device-' + crypto.randomUUID()
  const initialState = { lastSyncTime: null, deviceId }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(initialState))
  return initialState
}

export function updateSyncState(updates: Partial<SyncState>) {
  const current = getSyncState()
  const updated = { ...current, ...updates }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated))
}

export async function performSync(listType: ListType): Promise<SyncResult> {
  const state = getSyncState()
  const since = state.lastSyncTime || ''

  const url = since
    ? `/api/entries/sync?list=${listType}&since=${since}`
    : `/api/entries/sync?list=${listType}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Sync failed')

  const data = await res.json()

  // Update sync state with server time
  updateSyncState({ lastSyncTime: data.serverTime })

  // Return entries for merging
  return {
    entries: data.entries,
    serverTime: data.serverTime,
    isNewData: data.entries.length > 0,
    isInitial: data.isInitial
  }
}
