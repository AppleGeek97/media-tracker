import { useState, useEffect } from 'react'
import {
  subscribeToEntries,
  addEntry,
  updateEntry,
  deleteEntry,
} from '../lib/storage'
import type { MediaEntry, SortField, Filters, ListType } from '../types'

export function useMediaEntries(listType: ListType) {
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('title')
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all' })
  const [refreshKey, setRefreshKey] = useState(0)

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

  const add = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId'>) => {
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
