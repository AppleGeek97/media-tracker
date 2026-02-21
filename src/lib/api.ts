import type { MediaEntry, ListType } from '../types'

const API_BASE = '/api'

export interface FetchEntriesResponse {
  entries: (MediaEntry & { createdAt: Date })[]
  error?: string
}

export interface CreateEntryResponse {
  entry?: MediaEntry
  error?: string
}

/**
 * Simple fetch wrapper (no auth needed for single-user mode)
 */
async function fetchWrapper(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options)
}

// Fetch entries for authenticated user and list type
export async function fetchEntries(
  listType: ListType
): Promise<FetchEntriesResponse> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries?list=${listType}`)
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Fetch entries error:', error)
    return { entries: [], error: 'Failed to fetch entries' }
  }
}

// Create a new media entry
export async function createEntry(
  entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId'>
): Promise<CreateEntryResponse> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: entry.title,
        type: entry.type,
        status: entry.status,
        year: entry.year,
        listType: entry.list,
        seasonsCompleted: entry.seasonsCompleted,
        coverUrl: entry.coverUrl,
        releaseDate: entry.releaseDate,
        completedAt: entry.completedAt,
      }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Create entry error:', error)
    return { error: 'Failed to create entry' }
  }
}

// Update an existing entry
export async function updateEntry(
  id: string,
  updates: Partial<MediaEntry>
): Promise<{ entry?: MediaEntry; error?: string }> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Update entry error:', error)
    return { error: 'Failed to update entry' }
  }
}

// Delete an entry
export async function deleteEntry(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Delete entry error:', error)
    return { error: 'Failed to delete entry' }
  }
}
