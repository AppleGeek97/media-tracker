import type { MediaEntry, ListType } from '../types'
import * as api from './api'

const BACKLOG_KEY = 'media-logbook-backlog'
const FUTURELOG_KEY = 'media-logbook-futurelog'
const OLD_STORAGE_KEY = 'media-logbook-entries'
const USER_KEY = 'media-logbook-user'
const MIGRATED_KEY = 'media-logbook-migrated'
const USER_EMAIL_KEY = 'media-logbook-user-email'
const USER_ID_KEY = 'media-logbook-user-id'

// Generate or retrieve a local user ID (for backward compatibility)
export const getLocalUserId = (): string => {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = 'local-' + crypto.randomUUID()
    localStorage.setItem(USER_KEY, userId)
  }
  return userId
}

// Get or create cloud user ID via email authentication
export const getCloudUserId = async (email?: string): Promise<string> => {
  // If email provided, authenticate and get userId
  if (email) {
    const result = await api.authEmail(email)
    if (result.userId) {
      localStorage.setItem(USER_ID_KEY, result.userId)
      localStorage.setItem(USER_EMAIL_KEY, email)
      return result.userId
    }
  }

  // Check if we have a stored cloud userId
  const storedUserId = localStorage.getItem(USER_ID_KEY)
  if (storedUserId) {
    return storedUserId
  }

  // Fallback to local userId
  return getLocalUserId()
}

// Check if user is using cloud storage
export const isCloudUser = (): boolean => {
  return !!localStorage.getItem(USER_ID_KEY)
}

// Sign out (clear cloud user)
export const signOut = () => {
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(USER_EMAIL_KEY)
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
export const syncEntriesFromCloud = async (userId: string, listType: ListType) => {
  const result = await api.fetchEntries(userId, listType)
  if (result.entries && !result.error) {
    saveEntries(result.entries, listType)
    return result.entries
  }
  return loadEntries(listType)
}

export const subscribeToEntries = async (
  userId: string,
  listType: ListType,
  callback: (entries: MediaEntry[]) => void
) => {
  const isCloud = isCloudUser()

  // Sync from cloud if cloud user
  if (isCloud) {
    await syncEntriesFromCloud(userId, listType)
  }

  const wrappedCallback = (entries: MediaEntry[]) => {
    const userEntries = entries
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    callback(userEntries)
  }

  listenersByList[listType].push(wrappedCallback)
  wrappedCallback(loadEntries(listType))

  return () => {
    listenersByList[listType] = listenersByList[listType].filter((cb) => cb !== wrappedCallback)
  }
}

export const addEntry = async (entry: Omit<MediaEntry, 'id' | 'createdAt'>) => {
  const listType = entry.list
  const isCloud = isCloudUser()

  if (isCloud) {
    // Use API for cloud users
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
  } else {
    // Use localStorage for local users
    const entries = loadEntries(listType)
    const newEntry: MediaEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }
    entries.push(newEntry)
    saveEntries(entries, listType)
    notifyListeners(listType)
    return newEntry
  }
}

export const updateEntry = async (id: string, updates: Partial<MediaEntry>, listType: ListType) => {
  const isCloud = isCloudUser()

  if (isCloud) {
    // Use API for cloud users
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
  } else {
    // Use localStorage for local users
    const entries = loadEntries(listType)
    const index = entries.findIndex((e) => e.id === id)
    if (index !== -1) {
      const { id: _, createdAt: __, ...safeUpdates } = updates as MediaEntry
      entries[index] = { ...entries[index], ...safeUpdates }
      saveEntries(entries, listType)
      notifyListeners(listType)
    }
  }
}

export const deleteEntry = async (id: string, listType: ListType) => {
  const isCloud = isCloudUser()

  if (isCloud) {
    // Use API for cloud users
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
  } else {
    // Use localStorage for local users
    const entries = loadEntries(listType)
    const filtered = entries.filter((e) => e.id !== id)
    saveEntries(filtered, listType)
    notifyListeners(listType)
  }
}
