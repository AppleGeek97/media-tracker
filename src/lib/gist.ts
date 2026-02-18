// LocalStorage keys
const GITHUB_TOKEN_KEY = 'github-token'
const GIST_ID_KEY = 'gist-id'
const GIST_FILENAME = 'media-logback-data.json'
const DEVICE_ID_KEY = 'device-id'
const SYNC_PENDING_KEY = 'sync-pending'

// Device ID for conflict resolution
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

// Token management
export const getGitHubToken = (): string | null => {
  return localStorage.getItem(GITHUB_TOKEN_KEY)
}

export const setGitHubToken = (token: string): void => {
  localStorage.setItem(GITHUB_TOKEN_KEY, token)
}

export const clearGitHubToken = (): void => {
  localStorage.removeItem(GITHUB_TOKEN_KEY)
  localStorage.removeItem(GIST_ID_KEY)
}

export const getGistId = (): string | null => {
  return localStorage.getItem(GIST_ID_KEY)
}

export const setGistId = (gistId: string): void => {
  localStorage.setItem(GIST_ID_KEY, gistId)
}

export const isGistEnabled = (): boolean => {
  return !!getGitHubToken()
}

// Sync pending state
export const setSyncPending = (pending: boolean): void => {
  localStorage.setItem(SYNC_PENDING_KEY, pending.toString())
}

export const isSyncPending = (): boolean => {
  return localStorage.getItem(SYNC_PENDING_KEY) === 'true'
}

// GitHub API calls
export const validateGitHubToken = async (token: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (response.ok) {
      return { valid: true }
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Please check your GitHub Personal Access Token.' }
    } else if (response.status === 403) {
      return { valid: false, error: 'Token lacks required permissions. Make sure it has the "gist" scope.' }
    } else {
      return { valid: false, error: `GitHub API error: ${response.status}` }
    }
  } catch (error) {
    return { valid: false, error: 'Network error. Please check your connection.' }
  }
}

export interface GistData {
  version: string
  backlog: Array<{
    id: string
    userId: string
    title: string
    type: string
    status: string
    year: number
    list: string
    seasonsCompleted?: number
    coverUrl?: string
    releaseDate?: string
    completedAt?: string
    createdAt: string
  }>
  futurelog: Array<{
    id: string
    userId: string
    title: string
    type: string
    status: string
    year: number
    list: string
    seasonsCompleted?: number
    coverUrl?: string
    releaseDate?: string
    completedAt?: string
    createdAt: string
  }>
  lastModified: string
  deviceId: string
}

const prepareGistData = (
  backlog: any[],
  futurelog: any[]
): GistData => {
  return {
    version: '1.0',
    backlog: backlog.map(e => ({
      ...e,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    })),
    futurelog: futurelog.map(e => ({
      ...e,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    })),
    lastModified: new Date().toISOString(),
    deviceId: getDeviceId(),
  }
}

const parseGistData = (gistData: GistData): { backlog: any[]; futurelog: any[] } => {
  return {
    backlog: (gistData.backlog || []).map(e => ({
      ...e,
      createdAt: new Date(e.createdAt),
    })),
    futurelog: (gistData.futurelog || []).map(e => ({
      ...e,
      createdAt: new Date(e.createdAt),
    })),
  }
}

// Merge strategy: last-write-wins based on createdAt timestamp
const mergeEntries = (local: any[], remote: any[]): any[] => {
  const entryMap = new Map<string, any>()

  // Add local entries
  for (const entry of local) {
    entryMap.set(entry.id, entry)
  }

  // Merge with remote (remote overrides local if newer)
  for (const entry of remote) {
    const existing = entryMap.get(entry.id)
    if (!existing) {
      entryMap.set(entry.id, entry)
    } else {
      const existingTime = new Date(existing.createdAt).getTime()
      const remoteTime = new Date(entry.createdAt).getTime()
      if (remoteTime > existingTime) {
        entryMap.set(entry.id, entry)
      }
    }
  }

  return Array.from(entryMap.values())
}

export const mergeGistData = (
  localBacklog: any[],
  localFuturelog: any[],
  gistData: GistData
): { backlog: any[]; futurelog: any[] } => {
  const { backlog: remoteBacklog, futurelog: remoteFuturelog } = parseGistData(gistData)

  return {
    backlog: mergeEntries(localBacklog, remoteBacklog),
    futurelog: mergeEntries(localFuturelog, remoteFuturelog),
  }
}

export const createGist = async (
  token: string,
  backlog: any[],
  futurelog: any[]
): Promise<{ success: boolean; gistId?: string; error?: string }> => {
  try {
    const gistData = prepareGistData(backlog, futurelog)

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Media Logbook Sync Data',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(gistData, null, 2),
          },
        },
      }),
    })

    if (response.ok) {
      const gist = await response.json()
      return { success: true, gistId: gist.id }
    } else {
      const error = await response.text()
      return { success: false, error: `Failed to create gist: ${error}` }
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

export const updateGist = async (
  token: string,
  gistId: string,
  backlog: any[],
  futurelog: any[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const gistData = prepareGistData(backlog, futurelog)

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(gistData, null, 2),
          },
        },
      }),
    })

    if (response.ok) {
      return { success: true }
    } else {
      const error = await response.text()
      return { success: false, error: `Failed to update gist: ${error}` }
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

export const fetchGist = async (
  token: string,
  gistId: string
): Promise<{ success: boolean; data?: GistData; error?: string }> => {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (response.ok) {
      const gist = await response.json()
      const fileContent = gist.files[GIST_FILENAME]?.content

      if (!fileContent) {
        return { success: false, error: 'Gist data file not found' }
      }

      const data = JSON.parse(fileContent) as GistData
      return { success: true, data }
    } else if (response.status === 404) {
      return { success: false, error: 'Gist not found. It may have been deleted.' }
    } else {
      const error = await response.text()
      return { success: false, error: `Failed to fetch gist: ${error}` }
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}
