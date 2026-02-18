import type { MediaEntry, ListType } from '../types'
import * as api from './api'
import { isAuthenticated, clearTokens } from './auth'
import * as gist from './gist'

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

// Check if user is using cloud storage (authenticated)
export const isCloudUser = (): boolean => {
  return isAuthenticated()
}

// Sign out (clear cloud user tokens)
export const signOut = async () => {
  await api.authSignout()
  clearTokens()
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
  const isCloud = isCloudUser()

  // Sync from cloud if cloud user
  if (isCloud) {
    syncEntriesFromCloud(listType).catch(console.error)
  }

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
  const isCloud = isCloudUser()

  if (isCloud) {
    // Use API for cloud users (userId added automatically from JWT)
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
    // Use localStorage for local users (need to add userId)
    const entries = loadEntries(listType)
    const userId = getLocalUserId()
    const newEntry: MediaEntry = {
      ...entry,
      userId,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }
    entries.push(newEntry)
    saveEntries(entries, listType)
    notifyListeners(listType)

    // Sync to gist if enabled (non-blocking)
    if (gist.isGistEnabled()) {
      syncToGist().catch(console.error)
    }

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

      // Sync to gist if enabled (non-blocking)
      if (gist.isGistEnabled()) {
        syncToGist().catch(console.error)
      }
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

    // Sync to gist if enabled
    if (gist.isGistEnabled()) {
      syncToGist().catch(console.error)
    }
  }
}

// Gist sync functions
export const syncToGist = async (): Promise<{ success: boolean; error?: string }> => {
  if (!gist.isGistEnabled()) {
    return { success: false, error: 'Gist sync not enabled' }
  }

  const token = gist.getGitHubToken()
  if (!token) {
    return { success: false, error: 'No GitHub token found' }
  }

  try {
    const backlog = loadEntries('backlog')
    const futurelog = loadEntries('futurelog')
    const gistId = gist.getGistId()

    if (gistId) {
      const result = await gist.updateGist(token, gistId, backlog, futurelog)
      if (result.success) {
        gist.setSyncPending(false)
      }
      return result
    } else {
      const result = await gist.createGist(token, backlog, futurelog)
      if (result.success && result.gistId) {
        gist.setGistId(result.gistId)
        gist.setSyncPending(false)
      }
      return result
    }
  } catch (error) {
    gist.setSyncPending(true)
    return { success: false, error: 'Sync failed. Changes will sync when connection is restored.' }
  }
}

export const syncFromGist = async (): Promise<{ success: boolean; error?: string }> => {
  if (!gist.isGistEnabled()) {
    return { success: false, error: 'Gist sync not enabled' }
  }

  const token = gist.getGitHubToken()
  const gistId = gist.getGistId()

  if (!token || !gistId) {
    return { success: false, error: 'Gist not configured' }
  }

  try {
    const result = await gist.fetchGist(token, gistId)
    if (result.success && result.data) {
      const localBacklog = loadEntries('backlog')
      const localFuturelog = loadEntries('futurelog')

      const merged = gist.mergeGistData(localBacklog, localFuturelog, result.data)

      saveEntries(merged.backlog, 'backlog')
      saveEntries(merged.futurelog, 'futurelog')

      notifyListeners('backlog')
      notifyListeners('futurelog')

      return { success: true }
    }
    return result
  } catch (error) {
    return { success: false, error: 'Failed to sync from gist' }
  }
}

export const initializeGistSync = async (): Promise<void> => {
  if (gist.isGistEnabled() && gist.getGistId()) {
    // Pull from gist on app load
    await syncFromGist()
  }

  // If sync was pending (offline changes), try to sync now
  if (gist.isSyncPending()) {
    await syncToGist()
  }
}
