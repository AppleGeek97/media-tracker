import { useState, useEffect } from 'react'
import {
  getLocalUserId,
  getCloudUserId,
  isCloudUser,
  subscribeToEntries,
  syncEntriesFromCloud,
  addEntry,
  updateEntry,
  deleteEntry,
} from '../lib/storage'
import type { MediaEntry, SortField, Filters, ListType } from '../types'

export function useMediaEntries(listType: ListType) {
  const [userId, setUserId] = useState(() => {
    // Check if cloud user is logged in
    if (isCloudUser()) {
      return localStorage.getItem('media-logbook-user-id') || getLocalUserId()
    }
    return getLocalUserId()
  })
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('title')
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToEntries(userId, listType, (data) => {
      setEntries(data)
      setLoading(false)
    })

    return unsubscribe
  }, [userId, listType, refreshKey])

  // Update userId when cloud auth changes
  useEffect(() => {
    const checkCloudUser = async () => {
      if (isCloudUser()) {
        const cloudUserId = await getCloudUserId()
        if (cloudUserId && cloudUserId !== userId) {
          setUserId(cloudUserId)
        }
      }
    }
    checkCloudUser()
  }, [])

  const filteredEntries = entries
    .filter((e) => filters.type === 'all' || e.type === filters.type)
    .filter((e) => filters.status === 'all' || e.status === filters.status)
    .sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title)
      }
      return b.year - a.year
    })

  const add = async (entry: Omit<MediaEntry, 'id' | 'userId' | 'createdAt'>) => {
    await addEntry({ ...entry, userId })
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
    user: { uid: userId },
    entries: filteredEntries,
    loading,
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
