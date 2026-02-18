// =============================================================================
// SECURITY NOTICE
// =============================================================================
// This implementation uses GitHub OAuth with PKCE (Proof Key for Code Exchange).
// Tokens are stored in sessionStorage (cleared when tab closes) instead of
// localStorage for improved security. The OAuth flow requires no client secret.
//
// SETUP REQUIRED:
// 1. Create a GitHub OAuth App at: https://github.com/settings/applications/new
// 2. Homepage URL: https://jefflog.vercel.app
// 3. Authorization callback URL: https://jefflog.vercel.app/auth/callback
// 4. Copy the Client ID to GITHUB_CLIENT_ID below
//
// SECURITY NOTES:
// - Tokens stored in sessionStorage (not localStorage)
// - OAuth with PKCE prevents authorization code interception
// - Tokens are short-lived (8 hours for GitHub)
// - Only 'gist' scope is requested (minimal permissions)
// =============================================================================

// GitHub OAuth Configuration
export const GITHUB_CLIENT_ID = 'Ov23liB3JbXPrvJ54R2U' // TODO: Replace with actual Client ID
export const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

// SessionStorage keys (more secure than localStorage - cleared on tab close)
const SESSION_TOKEN_KEY = 'github-token'
const SESSION_TOKEN_EXPIRY_KEY = 'github-token-expiry'

// LocalStorage keys (persistent data)
const GIST_ID_KEY = 'gist-id'
const GIST_FILENAME = 'media-logback-data.json'
const DEVICE_ID_KEY = 'device-id'
const SYNC_PENDING_KEY = 'sync-pending'
const OAUTH_STATE_KEY = 'oauth-state'
const OAUTH_VERIFIER_KEY = 'oauth-verifier'

// =============================================================================
// OAUTH WITH PKCE IMPLEMENTATION
// =============================================================================

// Generate random string for code verifier
const generateRandomString = (length: number): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (byte) => possible[byte % possible.length]).join('')
}

// SHA-256 hash and base64url encode
const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return await crypto.subtle.digest('SHA-256', data)
}

const base64UrlEncode = (buffer: ArrayBuffer): string => {
  const str = String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer)))
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Store OAuth state and verifier during auth flow
const storeOAuthState = (state: string, verifier: string): void => {
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier)
}

const getOAuthState = (): { state: string | null; verifier: string | null } => {
  return {
    state: sessionStorage.getItem(OAUTH_STATE_KEY),
    verifier: sessionStorage.getItem(OAUTH_VERIFIER_KEY),
  }
}

const clearOAuthState = (): void => {
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
}

// Initiate OAuth login - redirects to GitHub
export const initiateOAuth = async (): Promise<void> => {
  // Generate code verifier and challenge for PKCE
  const verifier = generateRandomString(128)
  const hashed = await sha256(verifier)
  const challenge = base64UrlEncode(hashed)

  // Generate state to prevent CSRF attacks
  const state = generateRandomString(32)

  // Store for verification when GitHub redirects back
  storeOAuthState(state, verifier)

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: window.location.origin + '/auth/callback',
    scope: 'gist',
    response_type: 'code',
    state: state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  // Redirect to GitHub
  window.location.href = `${GITHUB_OAUTH_URL}?${params.toString()}`
}

// Exchange authorization code for access token
export const exchangeCodeForToken = async (
  code: string,
  state: string
): Promise<{ success: boolean; error?: string }> => {
  // Verify state to prevent CSRF
  const storedState = getOAuthState()
  if (storedState.state !== state || !storedState.verifier) {
    return { success: false, error: 'Invalid state. Possible CSRF attack.' }
  }

  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        code: code,
        redirect_uri: window.location.origin + '/auth/callback',
        code_verifier: storedState.verifier,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Failed to exchange token: ${error}` }
    }

    const data = await response.json()

    if (data.error) {
      return { success: false, error: data.error_description || data.error }
    }

    // Store token in sessionStorage (not localStorage!)
    const expiresIn = data.expires_in || 28800 // 8 hours default
    const expiresAt = Date.now() + expiresIn * 1000

    sessionStorage.setItem(SESSION_TOKEN_KEY, data.access_token)
    sessionStorage.setItem(SESSION_TOKEN_EXPIRY_KEY, expiresAt.toString())

    // Clear OAuth state
    clearOAuthState()

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Network error during token exchange' }
  }
}

// =============================================================================
// TOKEN MANAGEMENT (Session Storage for security)
// =============================================================================

export const getGitHubToken = (): string | null => {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
  const expiry = sessionStorage.getItem(SESSION_TOKEN_EXPIRY_KEY)

  if (!token) return null

  // Check if token is expired
  if (expiry) {
    const expiresAt = parseInt(expiry, 10)
    if (Date.now() >= expiresAt) {
      // Token expired, clear it
      clearGitHubToken()
      return null
    }
  }

  return token
}

export const clearGitHubToken = (): void => {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  sessionStorage.removeItem(SESSION_TOKEN_EXPIRY_KEY)
  // Keep gist_id - it's not sensitive
}

export const isGistEnabled = (): boolean => {
  return !!getGitHubToken()
}

export const getTokenExpiry = (): number | null => {
  const expiry = sessionStorage.getItem(SESSION_TOKEN_EXPIRY_KEY)
  return expiry ? parseInt(expiry, 10) : null
}

export const isTokenExpired = (): boolean => {
  const expiry = getTokenExpiry()
  return expiry ? Date.now() >= expiry : false
}

export const getTimeUntilExpiry = (): number | null => {
  const expiry = getTokenExpiry()
  return expiry ? Math.max(0, expiry - Date.now()) : null
}

// =============================================================================
// PERSISTENT DATA (LocalStorage)
// =============================================================================

export const getGistId = (): string | null => {
  return localStorage.getItem(GIST_ID_KEY)
}

export const setGistId = (gistId: string): void => {
  localStorage.setItem(GIST_ID_KEY, gistId)
}

export const setSyncPending = (pending: boolean): void => {
  localStorage.setItem(SYNC_PENDING_KEY, pending.toString())
}

export const isSyncPending = (): boolean => {
  return localStorage.getItem(SYNC_PENDING_KEY) === 'true'
}

// Device ID for conflict resolution
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

// =============================================================================
// GITHUB API CALLS
// =============================================================================

export const validateGitHubToken = async (): Promise<{ valid: boolean; error?: string }> => {
  const token = getGitHubToken()
  if (!token) {
    return { valid: false, error: 'No token found. Please authenticate with GitHub.' }
  }

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
      clearGitHubToken()
      return { valid: false, error: 'Token expired. Please re-authenticate.' }
    } else if (response.status === 403) {
      return { valid: false, error: 'Token lacks gist permissions.' }
    } else {
      return { valid: false, error: `GitHub API error: ${response.status}` }
    }
  } catch (error) {
    return { valid: false, error: 'Network error. Please check your connection.' }
  }
}

// =============================================================================
// GIST DATA STRUCTURE
// =============================================================================

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

// =============================================================================
// GIST OPERATIONS
// =============================================================================

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
  backlog: any[],
  futurelog: any[]
): Promise<{ success: boolean; gistId?: string; error?: string }> => {
  const token = getGitHubToken()
  if (!token) {
    return { success: false, error: 'Not authenticated. Please sign in with GitHub.' }
  }

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
  gistId: string,
  backlog: any[],
  futurelog: any[]
): Promise<{ success: boolean; error?: string }> => {
  const token = getGitHubToken()
  if (!token) {
    return { success: false, error: 'Not authenticated. Please sign in with GitHub.' }
  }

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
  gistId: string
): Promise<{ success: boolean; data?: GistData; error?: string }> => {
  const token = getGitHubToken()
  if (!token) {
    return { success: false, error: 'Not authenticated. Please sign in with GitHub.' }
  }

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
