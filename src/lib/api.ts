import type { MediaEntry, ListType } from '../types'
import { getAccessToken, setTokens, clearTokens } from './auth'

const API_BASE = '/api'

export interface FetchEntriesResponse {
  entries: (MediaEntry & { createdAt: Date })[]
  error?: string
}

export interface CreateEntryResponse {
  entry?: MediaEntry
  error?: string
}

export interface AuthResponse {
  access_token?: string
  refresh_token?: string
  userId?: string
  error?: string
}

/**
 * Authenticated fetch wrapper that adds JWT token to requests
 * Handles automatic token refresh on 401 errors
 */
async function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  // Skip auth for signup and login endpoints
  if (url.includes('/auth/signup') || url.includes('/auth/login') || url.includes('/auth/refresh')) {
    return fetch(url, options)
  }

  let token = getAccessToken()

  // If no token and request requires auth, return 401
  if (!token) {
    throw new Error('No authentication token')
  }

  // Add Authorization header
  const headers = {
    ...options?.headers,
    Authorization: `Bearer ${token}`,
  }

  let response = await fetch(url, { ...options, headers })

  // If token expired, try to refresh
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('media_logbook_refresh_token')

    if (refreshToken) {
      try {
        // Attempt to refresh token
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()

          if (refreshData.access_token) {
            // Update access token
            localStorage.setItem('media_logbook_access_token', refreshData.access_token)

            // Retry original request with new token
            const newHeaders = {
                ...options?.headers,
                Authorization: `Bearer ${refreshData.access_token}`,
              }

            response = await fetch(url, { ...options, headers: newHeaders })
          }
        } else {
          // Refresh failed, clear tokens
          clearTokens()
          throw new Error('Token refresh failed')
        }
      } catch (error) {
        // Refresh failed, clear tokens and throw
        clearTokens()
        throw error
      }
    } else {
      // No refresh token available
      clearTokens()
      throw new Error('Session expired')
    }
  }

  return response
}

/**
 * Signup with username + password
 */
export async function authSignup(
  username: string,
  password: string
): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()

    if (res.ok && data.access_token && data.refresh_token) {
      setTokens(data.access_token, data.refresh_token)
    }

    return data
  } catch (error) {
    console.error('Signup error:', error)
    return { error: 'Failed to signup' }
  }
}

/**
 * Login with username + password
 */
export async function authLogin(
  username: string,
  password: string
): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()

    if (res.ok && data.access_token && data.refresh_token) {
      setTokens(data.access_token, data.refresh_token)
    }

    return data
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Failed to login' }
  }
}

/**
 * Sign out - revoke refresh token and clear local tokens
 */
export async function authSignout(): Promise<{ success?: boolean; error?: string }> {
  try {
    const refreshToken = localStorage.getItem('media_logbook_refresh_token')

    if (refreshToken) {
      await fetch(`${API_BASE}/auth/signout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    }

    clearTokens()
    return { success: true }
  } catch (error) {
    console.error('Signout error:', error)
    return { error: 'Failed to signout' }
  }
}

// Fetch entries for authenticated user and list type
export async function fetchEntries(
  listType: ListType
): Promise<FetchEntriesResponse> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/entries?list=${listType}`)
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
    const res = await authenticatedFetch(`${API_BASE}/entries/create`, {
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
    const res = await authenticatedFetch(`${API_BASE}/entries/update`, {
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
    const res = await authenticatedFetch(`${API_BASE}/entries/delete`, {
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
