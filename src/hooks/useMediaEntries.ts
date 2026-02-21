import { useState, useEffect } from 'react'
import {
  subscribeToEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  initializeGistSync,
} from '../lib/storage'
import { startBackgroundSync, stopBackgroundSync, syncOnFocus } from '../lib/sync-manager'
import type { MediaEntry, SortField, Filters, ListType } from '../types'

export type SyncStatus = 'syncing' | 'synced' | 'error'

export function useMediaEntries(listType: ListType) {
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('title')
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')

  // Initialize gist sync on mount (only once)
  useEffect(() => {
    initializeGistSync().catch(console.error)
  }, [])

  // Start background sync on mount
  useEffect(() => {
    startBackgroundSync([listType], (syncedListType, hasNewData) => {
      setSyncStatus('synced')
      if (hasNewData && syncedListType === listType) {
        // Trigger re-fetch when new data arrives
        setRefreshKey(prev => prev + 1)
      }
    })

    // Sync on window focus
    window.addEventListener('focus', syncOnFocus)

    return () => {
      stopBackgroundSync()
      window.removeEventListener('focus', syncOnFocus)
    }
  }, [listType])

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToEntries(listType, (data) => {
      setEntries(data)
      setLoading(false)
    })

    return unsubscribe
  }, [listType, refreshKey])

  const filteredEntries = entries
    .filter((e) => filters.type === 'all' || e.type === filters.type)
    .filter((e) => filters.status === 'all' || e.status === filters.status)
    .sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title)
      }
      return b.year - a.year
    })

  const add = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>) => {
    await addEntry(entry)
  }

  const update = async (id: string, updates: Partial<MediaEntry>) => {
    await updateEntry(id, updates, listType)
  }

  const remove = async (id: string) => {
    await deleteEntry(id, listType)
  }

  const refresh = async () => {
    setRefreshKey(prev => prev + 1)
  }

  return {
    entries: filteredEntries,
    loading,
    syncStatus,
    sortField,
    setSortField,
    filters,
    setFilters,
    add,
    update,
    remove,
    refresh,
  }
}
