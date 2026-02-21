import type { MediaEntry, ListType } from '../types'
import * as api from './api'

const BACKLOG_KEY = 'media-logbook-backlog'
const FUTURELOG_KEY = 'media-logbook-futurelog'
const OLD_STORAGE_KEY = 'media-logbook-entries'
const USER_KEY = 'media-logbook-user'
const MIGRATED_KEY = 'media-logbook-migrated'

// Generate or retrieve a local user ID (for backward compatibility)
export const getLocalUserId = (): string => {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = 'local-' + crypto.randomUUID()
    localStorage.setItem(USER_KEY, userId)
  }
  return userId
}

// Always use cloud API for single-user mode
export const isCloudUser = (): boolean => {
  return true // Always use API for single-user mode
}

const getStorageKey = (listType: ListType): string => {
  return listType === 'backlog' ? BACKLOG_KEY : FUTURELOG_KEY
}

// Migration function - runs once on app startup
export const migrateToSeparateStorage = () => {
  const migrated = localStorage.getItem(MIGRATED_KEY)
  if (migrated) return

  const oldData = localStorage.getItem(OLD_STORAGE_KEY)
  if (oldData) {
    try {
      const entries: (MediaEntry & { createdAt: string })[] = JSON.parse(oldData)

      const backlogEntries = entries.filter((e) => e.list === 'backlog' || !e.list)
      const futurelogEntries = entries.filter((e) => e.list === 'futurelog')

      if (backlogEntries.length > 0) {
        localStorage.setItem(BACKLOG_KEY, JSON.stringify(backlogEntries))
      }
      if (futurelogEntries.length > 0) {
        localStorage.setItem(FUTURELOG_KEY, JSON.stringify(futurelogEntries))
      }

      localStorage.removeItem(OLD_STORAGE_KEY)
    } catch {
      // If parsing fails, just mark as migrated and move on
    }
  }

  localStorage.setItem(MIGRATED_KEY, 'true')
}

const loadEntries = (listType: ListType): MediaEntry[] => {
  const key = getStorageKey(listType)
  const data = localStorage.getItem(key)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    return parsed.map((e: MediaEntry & { createdAt: string }) => ({
      ...e,
      createdAt: new Date(e.createdAt),
    }))
  } catch {
    return []
  }
}

const saveEntries = (entries: MediaEntry[], listType: ListType) => {
  const key = getStorageKey(listType)
  localStorage.setItem(key, JSON.stringify(entries))
}

type Callback = (entries: MediaEntry[]) => void

// Separate listener registries per list type
const listenersByList: Record<ListType, Callback[]> = {
  backlog: [],
  futurelog: [],
}

const notifyListeners = (listType: ListType) => {
  const entries = loadEntries(listType)
  listenersByList[listType].forEach((cb) => cb(entries))
}

// Sync entries from cloud to local cache
export const syncEntriesFromCloud = async (listType: ListType) => {
  const result = await api.fetchEntries(listType)
  if (result.entries && !result.error) {
    saveEntries(result.entries, listType)
    return result.entries
  }
  return loadEntries(listType)
}

export const subscribeToEntries = (
  listType: ListType,
  callback: (entries: MediaEntry[]) => void
) => {
  // Sync from cloud on mount (single-user mode always uses cloud)
  syncEntriesFromCloud(listType).catch(console.error)

  const wrappedCallback = (entries: MediaEntry[]) => {
    // Sort entries by creation date (newest first)
    const sortedEntries = entries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    callback(sortedEntries)
  }

  listenersByList[listType].push(wrappedCallback)
  wrappedCallback(loadEntries(listType))

  return () => {
    listenersByList[listType] = listenersByList[listType].filter((cb) => cb !== wrappedCallback)
  }
}

export const addEntry = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId'>) => {
  const listType = entry.list

  // Use API for all operations in single-user mode
  const result = await api.createEntry(entry)
  if (result.entry) {
    // Update local cache
    const entries = loadEntries(listType)
    entries.push(result.entry)
    saveEntries(entries, listType)
    notifyListeners(listType)
    return result.entry
  }
  throw new Error(result.error || 'Failed to create entry')
}

export const updateEntry = async (id: string, updates: Partial<MediaEntry>, listType: ListType) => {
  // Use API for all operations in single-user mode
  const result = await api.updateEntry(id, updates)
  if (result.entry) {
    // Update local cache
    const entries = loadEntries(listType)
    const index = entries.findIndex((e) => e.id === id)
    if (index !== -1) {
      entries[index] = result.entry
      saveEntries(entries, listType)
      notifyListeners(listType)
    }
    return
  }
  throw new Error(result.error || 'Failed to update entry')
}

export const deleteEntry = async (id: string, listType: ListType) => {
  // Use API for all operations in single-user mode
  const result = await api.deleteEntry(id)
  if (result.success) {
    // Update local cache
    const entries = loadEntries(listType)
    const filtered = entries.filter((e) => e.id !== id)
    saveEntries(filtered, listType)
    notifyListeners(listType)
    return
  }
  throw new Error(result.error || 'Failed to delete entry')
}

// No-op for single-user mode (keep for compatibility)
export const initializeGistSync = async (): Promise<void> => {
  // No gist sync in single-user mode
}
