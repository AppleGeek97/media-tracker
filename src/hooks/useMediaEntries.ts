import { useState, useEffect, useMemo } from 'react'
import { subscribeToEntries, addEntry, updateEntry, deleteEntry, initializeGistSync } from '../lib/storage'
import type { MediaEntry, SortField, Filters, ListType } from '../types'

export type SyncStatus = 'syncing' | 'synced' | 'error'

export function useMediaEntries(listType: ListType) {
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('title')
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncStatus] = useState<SyncStatus>('synced')

  useEffect(() => {
    initializeGistSync().catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToEntries(listType, (data) => {
      setEntries(data)
      setLoading(false)
    })
    return unsubscribe
  }, [listType, refreshKey])

  const filteredEntries = useMemo(() => {
    const statusPriority: Record<string, number> = {
      in_progress: 0,
      paused: 1,
      planned: 2,
      completed: 3,
      dropped: 4,
    }

    return entries
      .filter((e) => filters.type === 'all' || e.type === filters.type)
      .filter((e) => filters.status === 'all' || e.status === filters.status)
      .sort((a, b) => {
        const statusCompare = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99)
        if (statusCompare !== 0) return statusCompare
        const createdCompare = a.createdAt.getTime() - b.createdAt.getTime()
        if (createdCompare !== 0) return createdCompare
        if (sortField === 'title') return a.title.localeCompare(b.title)
        return b.year - a.year
      })
  }, [entries, filters, sortField])

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
    setRefreshKey((prev) => prev + 1)
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
