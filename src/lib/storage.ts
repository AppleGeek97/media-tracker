import type { MediaEntry, ListType } from '../types'
import * as api from './api'

type Callback = (entries: MediaEntry[]) => void

// In-memory store per list type (SQLite is the actual persistence layer)
const store: Record<ListType, MediaEntry[]> = {
  backlog: [],
  futurelog: [],
}

const listenersByList: Record<ListType, Callback[]> = {
  backlog: [],
  futurelog: [],
}

function notifyListeners(listType: ListType) {
  listenersByList[listType].forEach((cb) => cb(store[listType]))
}

export const subscribeToEntries = (
  listType: ListType,
  callback: (entries: MediaEntry[]) => void
) => {
  listenersByList[listType].push(callback)

  // Initial load from SQLite
  api.fetchEntries(listType).then((result) => {
    if (result.entries && !result.error) {
      store[listType] = result.entries
    }
    callback(store[listType])
  }).catch(console.error)

  return () => {
    listenersByList[listType] = listenersByList[listType].filter((cb) => cb !== callback)
  }
}

export const addEntry = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>) => {
  const listType = entry.list

  // Optimistic add
  const tempId = 'temp-' + crypto.randomUUID()
  const now = new Date()
  const optimistic: MediaEntry = {
    ...entry,
    id: tempId,
    createdAt: now,
    updatedAt: now,
    userId: 'local',
  }
  store[listType] = [...store[listType], optimistic]
  notifyListeners(listType)

  const result = await api.createEntry(entry)
  if (result.entry) {
    store[listType] = store[listType].map((e) => (e.id === tempId ? result.entry! : e))
    requestAnimationFrame(() => notifyListeners(listType))
    return result.entry
  } else {
    store[listType] = store[listType].filter((e) => e.id !== tempId)
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to create entry')
  }
}

export const updateEntry = async (id: string, updates: Partial<MediaEntry>, listType: ListType) => {
  const index = store[listType].findIndex((e) => e.id === id)
  if (index === -1) throw new Error('Entry not found')

  const previous = store[listType][index]
  const optimistic = { ...previous, ...updates, updatedAt: new Date() }
  store[listType] = store[listType].map((e) => (e.id === id ? optimistic : e))
  notifyListeners(listType)

  const result = await api.updateEntry(id, updates)
  if (result.entry) {
    store[listType] = store[listType].map((e) => (e.id === id ? result.entry! : e))
    requestAnimationFrame(() => notifyListeners(listType))
  } else {
    store[listType] = store[listType].map((e) => (e.id === id ? previous : e))
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to update entry')
  }
}

export const deleteEntry = async (id: string, listType: ListType) => {
  const entry = store[listType].find((e) => e.id === id)
  if (!entry) throw new Error('Entry not found')

  store[listType] = store[listType].filter((e) => e.id !== id)
  notifyListeners(listType)

  const result = await api.deleteEntry(id)
  if (!result.success) {
    store[listType] = [...store[listType], entry]
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to delete entry')
  }
}

// No-op kept for compatibility with useMediaEntries hook
export const initializeGistSync = async (): Promise<void> => {}

export const promoteMaturedFuturelogEntries = async (): Promise<void> => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { entries } = await api.fetchEntries('futurelog')

  for (const entry of entries) {
    if (!entry.releaseDate) continue
    const parts = entry.releaseDate.split('/')
    if (parts.length !== 3) continue
    let yr = parseInt(parts[2], 10)
    if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr
    const releaseDate = new Date(yr, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
    if (releaseDate > today) continue

    // Optimistically move from futurelog → backlog
    store.futurelog = store.futurelog.filter((e) => e.id !== entry.id)
    notifyListeners('futurelog')
    const promoted = { ...entry, list: 'backlog' as ListType, status: 'planned' as const, year: yr, releaseDate: undefined }
    store.backlog = [...store.backlog, promoted]
    notifyListeners('backlog')

    await api.updateEntry(entry.id, { list: 'backlog', status: 'planned', year: yr, releaseDate: undefined })
  }
}
