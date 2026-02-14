import type { MediaEntry, ListType } from '../types'

const API_BASE = '/api'

export interface FetchEntriesResponse {
  entries: (MediaEntry & { createdAt: Date })[]
  error?: string
}

export interface CreateEntryResponse {
  entry: MediaEntry
  error?: string
}

export interface AuthResponse {
  userId: string
  error?: string
}

// Simple authentication - returns userId for email
export async function authEmail(email: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Auth error:', error)
    return { error: 'Failed to authenticate' }
  }
}

// Fetch entries for a user and list type
export async function fetchEntries(
  userId: string,
  listType: ListType
): Promise<FetchEntriesResponse> {
  try {
    const res = await fetch(`${API_BASE}/entries?userId=${encodeURIComponent(userId)}&list=${listType}`)
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Fetch entries error:', error)
    return { entries: [], error: 'Failed to fetch entries' }
  }
}

// Create a new media entry
export async function createEntry(
  entry: Omit<MediaEntry, 'id' | 'createdAt'>
): Promise<CreateEntryResponse> {
  try {
    const res = await fetch(`${API_BASE}/entries/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: entry.userId,
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
    const res = await fetch(`${API_BASE}/entries/update`, {
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
    const res = await fetch(`${API_BASE}/entries/delete`, {
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
